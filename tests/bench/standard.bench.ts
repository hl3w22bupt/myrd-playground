/**
 * 标准场景性能基准（本地验收：≥60FPS 能力 + 无内存持续增长）。
 *
 * 运行：npm run bench（vitest.bench.config.ts + --expose-gc，独立于 npm run test 的确定性套件）
 *
 * 场景口径（与收敛需求 AC1 的「标准场景」一致）：
 * - 固定 seed、玩家 1 + AI 12（实体上限 20 内）、物资全量、缩圈全程、AI FSM 全开；
 * - 玩家控制器全程活跃：跳伞落地 → 移动 + 持续开火（触发射击/命中/淘汰事件路径）；
 * - 标准负载保底：对局结束或存活实体跌破 MIN_ALIVE_FOR_STANDARD_LOAD 即重开对局，
 *   避免对局后期「空场」让基准测出虚假的低成本；
 * - 时间步进 = 60FPS 帧间隔 16.667ms，帧内跑真实帧路径：
 *   固定逻辑 tick（FixedLoop）→ drainEvents → 零分配快照 → HUD 纯逻辑计算。
 *
 * 指标口径：
 * - frameMs：帧内 JS 成本（仿真 + 快照 + 事件 + HUD 计算）。Three.js GPU 提交无法在 Node 计量，
 *   因此以「帧 JS 成本远小于 16.667ms 帧预算」作为 ≥60FPS 能力的判据（capableFps = 1000 / avgFrameMs）。
 * - heap：预热后取基线；每窗口采样前强制 GC（--expose-gc），度量「活堆」增长，
 *   从而把 GC 未触发的垃圾堆积与真实泄漏区分开。
 */

import { describe, expect, it } from 'vitest';
import { createMatch, createWorldForTest, tickWorld } from '../../src/core';
import type { MatchHandle, PlayerIntent, World } from '../../src/core';
import { FixedLoop } from '../../src/core/loop';
import { terrainHeightAt } from '../../src/core/mapgen';
import { HudState } from '../../src/ui/hudState';
import { AI_COUNT_DEFAULT, ENTITY_CAP } from '../../src/content/constants';

const SEED = 20260831;
const AI_COUNT = AI_COUNT_DEFAULT; // 12 → 玩家 1 + AI 12 = 13 实体
const FRAME_MS = 1000 / 60;
const BENCH_BUDGET_MS = FRAME_MS; // 60FPS 帧预算
const WARMUP_FRAMES = 6_000; // 预热期：JIT 编译/内联缓存稳定（不计入统计与堆基线）
const MEASURE_FRAMES = 30_000; // 稳态测量期：600s 逻辑时长 @60FPS
const HEAP_WINDOW_FRAMES = 1_000;
/** 标准负载保底：存活实体跌破该值即重开对局（保持满负载） */
const MIN_ALIVE_FOR_STANDARD_LOAD = 8;

interface LandingState {
  targetX: number;
  targetZ: number;
}

/** 标准场景玩家控制器：自选跳伞时机 → 四阶段落地 → 地面移动 + 持续开火（仅产生 PlayerIntent，与真实玩家同通道） */
function standardPlayerIntents(w: World, frame: number, landing: LandingState): PlayerIntent[] {
  const p = w.player;
  if (p.state === 'plane') {
    const d = Math.hypot(landing.targetX - p.pos.x, landing.targetZ - p.pos.z);
    return d <= 420 ? [{ kind: 'jumpFromPlane' }] : [];
  }
  if (p.state === 'freefall' || p.state === 'parachute') {
    return landingIntents(w, landing);
  }

  const intents: PlayerIntent[] = [
    { kind: 'aim', yaw: (frame * 0.011) % (Math.PI * 2), pitch: 0.05 },
    { kind: 'move', dirX: Math.cos(frame * 0.002), dirZ: Math.sin(frame * 0.002), sprint: false },
  ];
  // 保持武器可用：弹匣空则换弹/切枪，否则持续开火（覆盖射击/命中/事件路径）
  const slot = p.weapons[p.activeWeapon];
  if (!slot || slot.magazine === 0) {
    intents.push({ kind: 'reload' });
    if (p.activeWeapon === 0 && p.weapons[1]) intents.push({ kind: 'switchWeapon', slot: 1 });
  } else {
    intents.push({ kind: 'fire' });
  }
  return intents;
}

function landingIntents(w: World, landing: LandingState): PlayerIntent[] {
  const p = w.player;
  const groundY = terrainHeightAt(w.pack, p.pos.x, p.pos.z);
  const descent = p.state === 'freefall' ? Math.max(25, -p.vel.y) : w.pack.physics.parachute.chuteDescentSpeed;
  const ttg = Math.max(0, (p.pos.y - groundY) / descent);
  const errX = landing.targetX - (p.pos.x + p.vel.x * ttg);
  const errZ = landing.targetZ - (p.pos.z + p.vel.z * ttg);
  const err = Math.hypot(errX, errZ);

  if (p.state === 'freefall') {
    if (err < 45) return [{ kind: 'deployParachute' }];
    const dive = err > 160 ? 1 : 0.15;
    return [{ kind: 'freefallControl', dirX: errX / (err || 1), dirZ: errZ / (err || 1), dive }];
  }
  const leadX = landing.targetX - p.vel.x * 0.4;
  const leadZ = landing.targetZ - p.vel.z * 0.4;
  const dx = leadX - p.pos.x;
  const dz = leadZ - p.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 2) return [{ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: 0 }];
  return [{ kind: 'freefallControl', dirX: 0, dirZ: 0, dive: 0 }];
}

interface HeapWindow {
  frame: number;
  aliveCount: number;
  heapMb: number;
}

export interface BenchResult {
  frames: number;
  ticks: number;
  logicalSeconds: number;
  restarts: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  capableFps: number;
  snapshotIdentityStable: boolean;
  entityCapRespected: boolean;
  minAliveSeen: number;
  heapBaseMb: number;
  heapLastMb: number;
  heapMaxMb: number;
  heapGrowthMb: number;
  heapGrowthRatio: number;
  heapWindows: number[];
  monotonicGrowth: boolean;
  gcAvailable: boolean;
  /** 探针：测量期实际执行的逻辑 tick 数（应为 ≈0.833×帧数）与墙钟 */
  measuredTicks: number;
  measuredWallMs: number;
  frameSumMs: number;
  frameSumCount: number;
}

/** 有 --expose-gc 时强制回收，度量「活堆」而非「未回收垃圾」 */
function forceGc(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc === 'function') gc();
}

/** Node 堆读取（经 globalThis 取用，避免为基准引入 @types/node） */
function heapUsedMb(): number {
  const proc = (globalThis as { process?: { memoryUsage(): { heapUsed: number } } }).process;
  return (proc?.memoryUsage().heapUsed ?? 0) / (1024 * 1024);
}

export function runStandardBenchmark(
  measureFrames: number = MEASURE_FRAMES,
  warmupFrames: number = WARMUP_FRAMES,
): BenchResult {
  let match: MatchHandle & { world: World } = createMatch({ seed: SEED, playerCount: 1, aiCount: AI_COUNT });
  let restarts = 0;
  let totalTicks = 0;
  let landing: LandingState = { targetX: 430, targetZ: 460 };

  const loop = new FixedLoop((intents) => {
    measuredTicks += 1;
    match.tick(intents);
  });
  const hudState = new HudState();

  // 滚动窗口帧耗时（环形语义：满了覆盖最旧）
  const heapWindows: HeapWindow[] = [];
  let snapshotIdentityStable = true;
  let firstSnap: unknown = null;
  let entityCapRespected = true;
  let minAliveSeen = Number.POSITIVE_INFINITY;
  let heapBaseMb: number | null = null;
  let measuredTicks = 0;
  let measuredWallMs = 0;
  let frameSumMs = 0;
  let frameSumCount = 0;
  let frameMaxMs = 0;

  const restart = (): void => {
    totalTicks += match.world.tick;
    match = createMatch({ seed: SEED, playerCount: 1, aiCount: AI_COUNT });
    loop.reset();
    restarts += 1;
    landing = { targetX: 430, targetZ: 460 };
    firstSnap = null;
  };

  /** 等距采样 reservoir：全程均匀取 FRAME_RESERVOIR 个样本，p95 代表全周期而非某一段 */
  const FRAME_RESERVOIR = 4096;
  const reservoir: number[] = [];

  const stepOnce = (frame: number): void => {
    if (match.status() === 'ended') restart();

    const intents = standardPlayerIntents(match.world, frame, landing);
    const t0 = performance.now();
    loop.advance(FRAME_MS, intents);
    const events = match.drainEvents();
    const snap = match.snapshotReusable!();
    hudState.compute(snap);
    hudState.commit();
    const t1 = performance.now();
    void events;

    // 零分配恒等校验：可复用快照必须返回恒定对象
    if (firstSnap === null) firstSnap = snap;
    else if (firstSnap !== snap) snapshotIdentityStable = false;
    if (snap.entities.length > ENTITY_CAP) entityCapRespected = false;
    const alive = snap.player?.aliveCount ?? 0;
    if (alive < minAliveSeen) minAliveSeen = alive;
    // 标准负载保底：存活过少 → 重开，保持满负载（在计时区间外执行）
    if (alive <= MIN_ALIVE_FOR_STANDARD_LOAD) restart();

    frameSumMs += t1 - t0;
    frameSumCount += 1;
    if (t1 - t0 > frameMaxMs) frameMaxMs = t1 - t0;
    if (frameSumCount % Math.max(1, Math.floor(measureFrames / FRAME_RESERVOIR)) === 1) {
      reservoir.push(t1 - t0);
    }

    if (frame % HEAP_WINDOW_FRAMES === 0 && heapBaseMb !== null) {
      forceGc();
      heapWindows.push({ frame, aliveCount: alive, heapMb: heapUsedMb() });
    }
  };

  // —— 阶段 1：预热（丢弃统计，不设堆基线）——
  for (let frame = 0; frame < warmupFrames; frame++) stepOnce(frame);

  // —— 阶段 2：稳态测量（堆基线取预热结束并强制 GC 后）——
  forceGc();
  heapBaseMb = heapUsedMb();
  measuredTicks = 0;
  frameSumMs = 0;
  frameSumCount = 0;
  frameMaxMs = 0;
  const phase2Start = performance.now();
  for (let frame = warmupFrames; frame < warmupFrames + measureFrames; frame++) stepOnce(frame);
  measuredWallMs = performance.now() - phase2Start;

  const sorted = [...reservoir].sort((a, b) => a - b);
  // 均值取「全量累计」而非局部窗口：局部窗口可能恰好落在负载便宜的时段（如刚重开的登机段），
  // 会系统性低估；累计均值才是稳态真实成本。p95 取全程等距采样 reservoir。
  const avg = frameSumMs / Math.max(1, frameSumCount);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const heaps = heapWindows.map((w) => w.heapMb);
  const heapLast = heaps[heaps.length - 1];
  let monotonic = true;
  for (let i = 1; i < heaps.length; i++) if (heaps[i] <= heaps[i - 1]) monotonic = false;

  const growthMb = heapLast - heapBaseMb;
  return {
    frames: measureFrames,
    ticks: totalTicks + match.world.tick,
    logicalSeconds: ((totalTicks + match.world.tick) * 20) / 1000,
    restarts,
    avgFrameMs: avg,
    p95FrameMs: p95,
    maxFrameMs: frameMaxMs,
    capableFps: 1000 / avg,
    snapshotIdentityStable,
    entityCapRespected,
    minAliveSeen,
    heapBaseMb,
    heapLastMb: heapLast,
    heapMaxMb: Math.max(...heaps),
    heapGrowthMb: growthMb,
    heapGrowthRatio: heapLast / heapBaseMb,
    heapWindows: heaps,
    monotonicGrowth: monotonic,
    gcAvailable: typeof (globalThis as { gc?: () => void }).gc === 'function',
    measuredTicks,
    measuredWallMs,
    frameSumMs,
    frameSumCount,
  };
}

describe('标准场景性能基准（本地 60FPS 验收）', () => {
  it('帧 JS 成本满足 60FPS 预算、可复用快照零分配恒等、活堆无持续增长', () => {
    const r = runStandardBenchmark();

    // —— 输出基准数据（本地验收证据）——
    const mb = (v: number): string => `${v.toFixed(1)}MB`;
    console.log(
      [
        `\n[bench] 标准场景 seed=${SEED} 实体=1+${AI_COUNT} 测量帧=${r.frames}（累计逻辑 ${r.logicalSeconds.toFixed(0)}s，负载重开 ${r.restarts} 次，最低存活 ${r.minAliveSeen}）`,
        `[bench] 帧 JS 成本：avg ${r.avgFrameMs.toFixed(3)}ms · p95 ${r.p95FrameMs.toFixed(3)}ms · max ${r.maxFrameMs.toFixed(3)}ms（预算 ${BENCH_BUDGET_MS.toFixed(2)}ms）`,
        `[bench] capableFps = ${r.capableFps.toFixed(0)}（1000 / avgFrameMs，仿真+快照+HUD 的 JS 成本）`,
        `[bench] 活堆（GC${r.gcAvailable ? '已启用' : '不可用，读原始堆'}）：基线 ${mb(r.heapBaseMb)} → 末 ${mb(r.heapLastMb)} · 峰 ${mb(r.heapMaxMb)} · 增长 ${mb(r.heapGrowthMb)}（${((r.heapGrowthRatio - 1) * 100).toFixed(1)}%）· 窗口数 ${r.heapWindows.length}`,
        `[bench] 堆窗口单调递增：${r.monotonicGrowth} · 快照恒等（零分配）：${r.snapshotIdentityStable} · 实体上限：${r.entityCapRespected}`,
        `[bench] 探针：测量期执行 tick=${r.measuredTicks}（期望≈${Math.round(r.frames * 0.833)}）· 测量期墙钟 ${r.measuredWallMs.toFixed(0)}ms`,
        `[bench] 探针：全帧累计 ${(r.frameSumMs).toFixed(1)}ms / ${r.frameSumCount} 帧 = ${(r.frameSumMs / Math.max(1, r.frameSumCount) * 1000).toFixed(1)}µs·帧⁻¹；采样窗口 avg ${(r.avgFrameMs * 1000).toFixed(1)}µs\n`,
      ].join('\n'),
    );

    // —— 验收断言 ——
    expect(r.capableFps).toBeGreaterThanOrEqual(60);
    expect(r.avgFrameMs).toBeLessThan(BENCH_BUDGET_MS);
    expect(r.snapshotIdentityStable).toBe(true);
    expect(r.entityCapRespected).toBe(true);
    expect(r.minAliveSeen).toBeGreaterThan(0);
    // 无内存持续增长：活堆窗口不单调递增，且首末差受控（≤8MB 噪声带或 ≤5%）
    expect(r.monotonicGrowth).toBe(false);
    expect(r.heapGrowthMb <= 8 || r.heapGrowthMb <= r.heapBaseMb * 0.05).toBe(true);
  });

  it('满负载下纯仿真 tick 成本远低于 50Hz 预算（20ms）', () => {
    const w = createWorldForTest({ seed: SEED, playerCount: 1, aiCount: AI_COUNT });
    // 落地后进入地面战斗负载
    let frame = 0;
    while (w.player.state !== 'ground' && frame < 8000) {
      tickWorld(w, standardPlayerIntents(w, frame, { targetX: 430, targetZ: 460 }));
      frame += 1;
    }
    const t0 = performance.now();
    const n = 5000;
    for (let i = 0; i < n; i++) tickWorld(w, standardPlayerIntents(w, frame + i, { targetX: 430, targetZ: 460 }));
    const perTickMs = (performance.now() - t0) / n;
    console.log(`[bench] 纯仿真 tick 成本 ${perTickMs.toFixed(4)}ms（50Hz 预算 20ms）`);
    expect(perTickMs).toBeLessThan(20);
  });
});
