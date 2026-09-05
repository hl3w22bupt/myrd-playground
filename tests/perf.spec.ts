/**
 * perf.spec —— 性能小步的确定性断言（不依赖真实时序/DOM，可在 CI 稳定复跑）：
 *
 * 1) 零分配快照通道：snapshotReusable() 返回恒定对象（逐帧零分配）、字段正确、playerEntity 直引；
 * 2) 渲染单循环：FrameDriver 每帧恰好注册一次 rAF、逐帧工作各调用一次、快照对象恒定；
 * 3) 实体视图对象池：容量封顶、复用同一对象（零创建/零销毁）；
 * 4) HUD 字段级脏检查：值不变不产生 DOM 写入、值变化只写变化字段；
 * 5) 节流器与采样器：低频 UI 按配置 Hz 执行、采样环形缓冲有界、统计按节流频率刷新；
 * 6) FixedLoop：意图只在第一个逻辑 tick 消费一次、未消费意图跨帧保留；
 * 7) 性能配置表：同屏实体上限与池容量的关系约束。
 */

import { describe, expect, it } from 'vitest';
import { buildSnapshot, createMatch, createWorldForTest, tickWorld } from '../src/core';
import type { MatchHandle, PlayerIntent, World, WorldSnapshot } from '../src/core';
import { FixedLoop } from '../src/core/loop';
import { SnapshotWriter } from '../src/core/snapshot';
import { acquireIntentSlot, recycleIntentSlots, slotAsIntent } from '../src/core/world';
import { FrameDriver } from '../src/app/frame';
import type { FrameDriverDeps } from '../src/app/frame';
import { PerfSampler } from '../src/perf/sampler';
import { hzToIntervalMs, RateLimiter } from '../src/perf/rate';
import { HudState } from '../src/ui/hudState';
import { EntityViewPool } from '../src/render/entityPool';
import { inventorySignature } from '../src/ui/panels';
import { AI_COUNT_DEFAULT, ENTITY_CAP } from '../src/content/constants';
import {
  DEBUG_TEXT_HZ,
  ENTITY_VIEW_POOL_SIZE,
  MAX_VISIBLE_ENTITIES,
  MINIMAP_UPDATE_HZ,
  PERF_SAMPLE_HZ,
} from '../src/content/render';
import * as THREE from 'three';

describe('零分配快照通道（core/snapshot）', () => {
  it('snapshotReusable() 返回恒定对象且字段随仿真推进更新', () => {
    const match = createMatch({ seed: 20260831, playerCount: 1, aiCount: AI_COUNT_DEFAULT });
    expect(match.snapshotReusable).toBeTypeOf('function');

    const s1 = match.snapshotReusable!();
    const tickBefore = s1.tick;
    const elapsedBefore = s1.elapsedMs;
    const playerBefore = s1.playerEntity;

    tickWorld(match.world, []);
    const s2 = match.snapshotReusable!();

    // 恒定引用：不重建对象图（零逐帧分配的关键性质）
    expect(s2).toBe(s1);
    expect(s2.entities).toBe(s1.entities);
    expect(s2.loots).toBe(s1.loots);
    expect(s2.zone).toBe(s1.zone);
    expect(s2.player).toBe(s1.player);
    // 字段已更新（s1/s2 是同一对象，必须在 tick 前先取值再比较，否则读到的是 tick 后的新值）
    expect(s2.tick).toBe(tickBefore + 1);
    expect(s2.elapsedMs).toBeGreaterThan(elapsedBefore);
    // 玩家实体直引稳定（渲染层免逐帧 find）
    expect(playerBefore).not.toBeNull();
    expect(s2.playerEntity).toBe(playerBefore);
    expect(s2.playerEntity?.id).toBe('player');
  });

  it('实体/物资数量与 world 一致；分配版 snapshot() 语义保持不变', () => {
    const match = createMatch({ seed: 4242, playerCount: 1, aiCount: 10 });
    const w = match.world;
    const snap = match.snapshotReusable!();
    expect(snap.entities.length).toBe(w.entities.length);
    expect(snap.loots.length).toBe(w.loots.filter((l) => !l.taken).length);

    const allocSnap = buildSnapshot(w);
    expect(allocSnap.tick).toBe(w.tick);
    expect(allocSnap.entities.length).toBe(w.entities.length);
    expect(allocSnap).not.toBe(snap); // 分配版每次新对象（跨帧保留语义）
    expect(allocSnap.entities[0]).not.toBe(snap.entities[0]);
  });

  it('SnapshotWriter 独立可用：同 world 连续 write() 恒定引用且字段随仿真更新', () => {
    const match = createMatch({ seed: 7, playerCount: 1, aiCount: 10 });
    const writer = new SnapshotWriter(ENTITY_CAP);
    const a = writer.write(match.world);
    const stateBefore = a.playerEntity?.state ?? null;
    const tickBefore = a.tick; // 数值捕获（a 与 b 是同一对象，不能事后用 a.tick 比较）
    tickWorld(match.world, [{ kind: 'jumpFromPlane' }]);
    const b = writer.write(match.world);
    expect(b).toBe(a); // 恒定引用
    expect(b.tick).toBe(tickBefore + 1);
    expect(stateBefore).toBe('plane');
    expect(b.playerEntity?.state).toBe('freefall'); // 跳伞意图已生效并反映在快照
  });
});

describe('渲染统一为单循环（app/frame FrameDriver）', () => {
  interface Harness {
    driver: FrameDriver;
    rafQueue: Array<(t: number) => void>;
    calls: { render: number; hud: number; minimap: number; inventory: number };
    seenSnaps: WorldSnapshot[];
    deps: FrameDriverDeps;
    match: MatchHandle & { world: World };
  }

  function makeHarness(): Harness {
    const match = createMatch({ seed: 20260831, playerCount: 1, aiCount: AI_COUNT_DEFAULT });
    const rafQueue: Array<(t: number) => void> = [];
    const calls = { render: 0, hud: 0, minimap: 0, inventory: 0 };
    const seenSnaps: WorldSnapshot[] = [];

    const deps: FrameDriverDeps = {
      match,
      loop: new FixedLoop((intents) => match.tick(intents)),
      sampler: new PerfSampler(),
      input: { consume: () => [] },
      hud: {
        update: () => {
          calls.hud += 1;
        },
        consumeEvents: () => {},
        setDebug: () => {},
      },
      minimap: {
        update: () => {
          calls.minimap += 1;
          return true;
        },
      },
      inventory: {
        get visible() {
          return true;
        },
        render: () => {
          calls.inventory += 1;
        },
      },
      view: {
        render: (snap) => {
          calls.render += 1;
          seenSnaps.push(snap);
        },
        autoTune: () => null,
        drawCalls: 0,
        qualityLevel: 'medium',
      },
      raf: (cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      },
      caf: () => {},
    };
    return { driver: new FrameDriver(deps), rafQueue, calls, seenSnaps, deps, match };
  }

  it('每帧恰好注册一次 rAF，各逐帧工作每帧执行一次', () => {
    const h = makeHarness();
    h.driver.start();
    // 推进 5 帧（t 每次 +16.67ms）
    for (let i = 1; i <= 5; i++) {
      const cb = h.rafQueue.shift();
      expect(cb).toBeDefined();
      cb!(i * (1000 / 60));
    }
    expect(h.driver.frameCount).toBe(5);
    expect(h.driver.rafSubscriptionCount).toBe(6); // start 1 次 + 每帧 1 次（单循环性质）
    expect(h.calls.render).toBe(5);
    expect(h.calls.hud).toBe(5);
    expect(h.calls.minimap).toBe(5);
    expect(h.calls.inventory).toBe(5);
    expect(h.driver.isRunning).toBe(true);

    // stop 后不再推进
    h.driver.stop();
    const pending = h.rafQueue.shift();
    pending?.(6 * (1000 / 60));
    expect(h.driver.frameCount).toBe(5);
  });

  it('帧路径使用零分配快照：跨帧看到的快照是同一对象', () => {
    const h = makeHarness();
    h.driver.start();
    for (let i = 1; i <= 4; i++) {
      const cb = h.rafQueue.shift()!;
      cb!(i * (1000 / 60));
    }
    expect(h.seenSnaps.length).toBe(4);
    expect(h.seenSnaps[1]).toBe(h.seenSnaps[0]);
    expect(h.seenSnaps[3]).toBe(h.seenSnaps[0]);
  });

  it('对局结束时 onEnded 只触发一次', () => {
    const h = makeHarness();
    let endedCount = 0;
    // 直接构造一个已结束的 match（重写 status 语义：用 onEnded 的去抖性质验证）
    const deps: FrameDriverDeps = {
      ...h.deps,
      match: {
        ...h.match,
        status: () => 'ended',
      },
      onEnded: () => {
        endedCount += 1;
      },
    };
    const driver = new FrameDriver(deps);
    driver.start();
    for (let i = 1; i <= 3; i++) {
      const cb = h.rafQueue.shift()!;
      cb!(i * (1000 / 60));
    }
    expect(endedCount).toBe(1);
    expect(driver.frameCount).toBe(3);
  });
});

describe('实体视图对象池（render/entityPool）', () => {
  it('容量封顶：取尽返回 null，不现场创建', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 3);
    expect(pool.capacity).toBe(3);
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(pool.acquiredCount).toBe(3);
    pool.dispose();
  });

  it('复用同一对象：releaseAll 后 acquire 返回原视图（零创建/零销毁）', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 2);
    const first = pool.acquire()!;
    pool.releaseAll();
    expect(pool.acquiredCount).toBe(0);
    const again = pool.acquire()!;
    expect(again).toBe(first);
    // 归还后几何/材质已被重置为不可见
    expect(first.group.visible).toBe(false);
    pool.dispose();
  });
});

describe('HUD 字段级脏检查（ui/hudState）', () => {
  /** 构造确定性的 HUD 输入快照（绕开仿真时序，直接驱动纯逻辑层） */
  function makeSnap(hp: number, aliveCount: number, timeLeftMs: number): WorldSnapshot {
    return {
      tick: 1,
      elapsedMs: 20,
      status: 'playing',
      entities: [
        {
          id: 'player',
          kind: 'player',
          alive: true,
          pos: { x: 0, y: 0, z: 0 },
          yaw: 0,
          pitch: 0,
          state: 'ground',
          weapon: 'ar_m4',
          hp,
          maxHp: 100,
        },
      ],
      playerEntity: null,
      player: {
        id: 'player',
        hp,
        maxHp: 100,
        state: 'ground',
        weapon: 'ar_m4',
        magazine: 30,
        reserve: 90,
        reloading: false,
        weapons: [{ weapon: 'ar_m4', magazine: 30 }, null],
        inventory: new Array(20).fill(null),
        usedGrids: 0,
        armorReduction: 0,
        helmetReduction: 0,
        kills: 0,
        aliveCount,
        medkitChannelMsLeft: 0,
      },
      loots: [],
      zone: {
        center: { x: 800, y: 0, z: 800 },
        radius: 600,
        nextCenter: { x: 800, y: 0, z: 800 },
        nextRadius: 400,
        phase: 0,
        phaseCount: 6,
        mode: 'wait',
        timeLeftMs,
        dps: 0,
      },
      plane: null,
    };
  }

  it('值不变不产生任何脏标记；值变化只标记对应字段', () => {
    const hud = new HudState();

    // 首帧：全量渲染
    const first = hud.compute(makeSnap(100, 13, 30_000));
    expect(first.changed).toBe(true);
    hud.commit();

    // 完全相同的快照：无任何字段需要写 DOM（这就是消除强制布局的关键性质）
    const same = hud.compute(makeSnap(100, 13, 30_000));
    expect(same.changed).toBe(false);
    expect(same.dirty.hpText).toBe(false);
    expect(same.dirty.aliveText).toBe(false);
    expect(same.dirty.zoneText).toBe(false);
    expect(same.dirty.vignetteDanger).toBe(false);

    // 只有血量变化（跨过 35% 危险阈值）：血量与危险标记被更新，其余字段不写 DOM
    const hpChanged = hud.compute(makeSnap(30, 13, 30_000));
    expect(hpChanged.dirty.hpText).toBe(true);
    expect(hpChanged.dirty.aliveText).toBe(false);
    expect(hpChanged.dirty.weaponText).toBe(false);
    expect(hpChanged.dirty.vignetteDanger).toBe(true);

    // 只有存活数变化：仅存活数字段被标记
    hud.commit();
    const aliveChanged = hud.compute(makeSnap(30, 12, 30_000));
    expect(aliveChanged.dirty.aliveText).toBe(true);
    expect(aliveChanged.dirty.hpText).toBe(false);
    expect(aliveChanged.dirty.vignetteDanger).toBe(false);
  });
});

describe('节流器与采样器（perf/rate、perf/sampler）', () => {
  it('RateLimiter 按 minIntervalMs 放行', () => {
    const limiter = new RateLimiter(hzToIntervalMs(MINIMAP_UPDATE_HZ)); // 50ms @20Hz
    expect(limiter.due(0)).toBe(true);
    expect(limiter.due(10)).toBe(false);
    expect(limiter.due(49.9)).toBe(false);
    expect(limiter.due(50)).toBe(true);
    expect(hzToIntervalMs(DEBUG_TEXT_HZ)).toBeCloseTo(250, 5);
  });

  it('PerfSampler 环形缓冲有界、统计按 PERF_SAMPLE_HZ 节流刷新', () => {
    const sampler = new PerfSampler(300, PERF_SAMPLE_HZ); // 250ms
    const frameMs = 1000 / 60;
    let t = 1000;
    for (let i = 0; i < 1000; i++) {
      sampler.frame(t);
      t += frameMs;
    }
    // 首帧无前值可算 dt（与生产语义一致），其后每帧计数
    expect(sampler.frameCount).toBe(999);

    const a = sampler.sample();
    const b = sampler.sample();
    expect(b).toBe(a); // 未到节流间隔 → 复用上次结果
    const c = sampler.sample(true);
    expect(c).not.toBe(a);
    expect(c.fps).toBeGreaterThan(0);
    expect(c.avgFrameMs).toBeCloseTo(frameMs, 1);
  });
});

describe('AI 意图对象池（core/world 槽位回收）', () => {
  it('acquire → recycle → acquire 复用同一槽位对象（零新建）', () => {
    const a = acquireIntentSlot();
    recycleIntentSlots([slotAsIntent(a)]);
    const b = acquireIntentSlot();
    expect(b).toBe(a);
  });

  it('AI 意图应用一次即回收清空（tickWorld 契约）', () => {
    const w = createWorldForTest({ seed: 7, playerCount: 1, aiCount: 3 });
    const ai = w.entities[1]!;
    const s = acquireIntentSlot();
    s.kind = 'move';
    s.dirX = 1;
    s.dirZ = 0;
    s.sprint = true;
    ai.pendingIntents.push(slotAsIntent(s));
    tickWorld(w, []);
    // 意图字段已生效，且缓冲在应用后被清空（槽位回收）
    expect(ai.moveDirX).toBe(1);
    expect(ai.pendingIntents.length).toBe(0);
  });

  it('连跑对局：意图缓冲处于「已应用清空或本 tick 新写」的合法状态（≤3 条/实体）', () => {
    const match = createMatch({ seed: 20260831, playerCount: 1, aiCount: 10 });
    const w = match.world;
    for (let i = 0; i < 1200 && w.status !== 'ended'; i++) tickWorld(w, []);
    for (const e of w.entities) {
      if (e.kind !== 'ai') continue;
      expect(e.pendingIntents.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('FixedLoop 意图消费语义（core/loop）', () => {
  it('意图只在第一个逻辑 tick 消费一次；无 tick 帧跨帧保留', () => {
    const seen: PlayerIntent[][] = [];
    const loop = new FixedLoop((intents) => {
      seen.push([...intents]);
    });

    // dt 不足一个 tick（10 < 20）：意图保留
    expect(loop.advance(10, [{ kind: 'fire' }])).toBeGreaterThanOrEqual(0);
    expect(seen.length).toBe(0);

    // 累积 10+15=25ms → 恰好 1 个 tick：保留的意图在该 tick 消费
    loop.advance(15, []);
    expect(seen.length).toBe(1);
    expect(seen[0]).toHaveLength(1);
    expect(seen[0]![0]!.kind).toBe('fire');

    // 后续 tick 不再重复消费（40ms → 2 个 tick，均收到空数组）
    loop.advance(40, []);
    expect(seen.length).toBe(3);
    expect(seen[1]).toHaveLength(0);
    expect(seen[2]).toHaveLength(0);
  });
});

describe('背包签名与性能配置表约束', () => {
  it('inventorySignature 对内容敏感、对相同内容稳定', () => {
    const inv = (items: Array<{ item: string; count: number } | null>): Array<{ item: string; count: number } | null> => items;
    const a = inventorySignature(2, inv([{ item: 'medkit_large', count: 1 }, { item: 'ammo_556', count: 30 }]));
    const b = inventorySignature(2, inv([{ item: 'medkit_large', count: 1 }, { item: 'ammo_556', count: 30 }]));
    const c = inventorySignature(2, inv([{ item: 'medkit_large', count: 1 }, null]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('同屏实体上限与池容量关系：= 实体上限（覆盖 aiCount 全可选区间，画面不变），且 ≥ 标准场景实体数', () => {
    // 开始画面允许 aiCount ∈ [10, 19]（panels.ts 钳制），实体总数最多 1 + 19 = 20 = ENTITY_CAP；
    // 同屏上限必须等于实体上限，保证任何用户可选 aiCount 下都不隐藏实体（画面不变）。
    expect(MAX_VISIBLE_ENTITIES).toBe(ENTITY_CAP);
    expect(MAX_VISIBLE_ENTITIES).toBeGreaterThanOrEqual(1 + 19);
    expect(MAX_VISIBLE_ENTITIES).toBeGreaterThanOrEqual(1 + AI_COUNT_DEFAULT);
    expect(ENTITY_VIEW_POOL_SIZE).toBe(ENTITY_CAP);
    expect(MINIMAP_UPDATE_HZ).toBeGreaterThan(0);
    expect(DEBUG_TEXT_HZ).toBeGreaterThan(0);
    expect(PERF_SAMPLE_HZ).toBeGreaterThan(0);
  });
});
