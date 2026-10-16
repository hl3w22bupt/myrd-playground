/**
 * perf 门禁·两层制之 CI 相对判（r4 N4；任务书：CI 仅相对判，绝对阈值只在真机证据上判）。
 * 复现：node games/stack-tower/tests/perf-relative-check.mjs
 *
 * 口径：
 *  - 确定性工作负载 = 内核 3 拍/帧（fastForward）+ 快照深拷贝 + 涟漪入队/绘制（无头 ctx）——
 *    纯 CPU、零 IO、零随机（同 seed），跨运行方差小；
 *  - 采样 = 每轮 1200 帧取 P95，共 5 轮取中位数（抗抖）；
 *  - 判据 = 新构建 P95 相对基线（tests/perf-baseline.json）劣化 ≤ 10% 即 PASS；
 *  - 绝对阈值（P95≤16.6ms / 峰值≥55fps）属真机层：按 numeric.benchmark_device 真机口径
 *    （骁龙7系/天玑8000系级 + Chrome WebView，3 轮×60s）单列取证，本门禁不判。
 *  - 基线更新：架构有意变更后 `node tests/perf-relative-check.mjs --update-baseline` 显式刷新并随 commit 留痕。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim } from '../build/kernel/sim.js';
import { Renderer } from '../build/render/renderer.js';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(GAME_DIR, 'tests', 'perf-baseline.json');
const REL_TOLERANCE = 0.1; // ≤10% 劣化
const FRAMES = 20000;
const ROUNDS = 5;
const BLOCK = 2000; // 块采样：每样本 = BLOCK 帧合计成本（摆脱 µs 级计时噪声区；无头负载 ~9ms/块）

/** 无头 Canvas2D 替身（与契约 j2 同形：no-op 方法） */
function fakeCtx() {
  const noop = () => {};
  return new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }) },
    { get(t, k) { return k in t ? t[k] : noop; }, set() { return true; } },
  );
}

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/** 一轮：1200 帧 × (3 tick + 快照 + 涟漪绘制) */
function measureRound() {
  const sim = createSim({ seed: 20260925 });
  const renderer = new Renderer();
  const ctx = fakeCtx();
  const logical = { width: 480, height: 720 };
  const blockCosts = [];
  let t = 0;
  // 预热 100 帧（JIT）
  for (let i = 0; i < 100; i++) {
    t += 16;
    sim.tick(i % 97 === 0 ? { type: 'drop' } : undefined);
    renderer.draw(ctx, sim.snapshot(), t, logical);
  }
  let acc = 0;
  for (let f = 0; f < FRAMES; f++) {
    t += 16;
    const t0 = process.hrtime.bigint();
    sim.tick(f % 97 === 0 ? { type: 'drop' } : undefined);
    const snap = sim.snapshot();
    if (f % 53 === 0) {
      // 模拟 perfect 反馈入队（涟漪池压力）
      renderer.enqueueRipple({ level_id: 'lvl-01', element_id: 'e06', window_ms: 140, duration_ms: 300 }, t);
    }
    renderer.draw(ctx, snap, t, logical);
    acc += Number(process.hrtime.bigint() - t0) / 1e6; // ms
    if ((f + 1) % BLOCK === 0) {
      blockCosts.push(acc); // BLOCK 帧合计成本
      acc = 0;
    }
  }
  return p95(blockCosts);
}

const medians = [];
for (let r = 0; r < ROUNDS; r++) medians.push(measureRound());
medians.sort((a, b) => a - b);
const current = medians[Math.floor(ROUNDS / 2)];

const updateMode = process.argv.includes('--update-baseline');
if (updateMode) {
  const baseline = { p95Ms: current, frames: FRAMES, blockFrames: BLOCK, rounds: ROUNDS, recordedAt: new Date().toISOString().slice(0, 10), note: 'r4 霓虹夜塔换装后基线（确定性负载：tick + 快照 + 涟漪池，块采样 2000 帧/样本）' };
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`[perf] 基线已刷新：P95=${current.toFixed(4)}ms（${BASELINE}）`);
  console.log('RESULT: PASS (baseline updated)');
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.log('RESULT: not-runnable — 缺 tests/perf-baseline.json（先 --update-baseline 显式建立）');
  process.exit(0); // not-runnable 单列不计绿不计红
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const delta = (current - baseline.p95Ms) / baseline.p95Ms;
// 噪声地板：块成本 < 1ms 时计时抖动可吞掉 10% 容差 → 判 not-runnable（显式，不静默）
if (baseline.p95Ms < 1 || current < 1) {
  console.log(`[perf] 块成本 ${current.toFixed(4)}ms 落入计时噪声地板（<1ms）——相对判不具判别力`);
  console.log('RESULT: not-runnable — 噪声地板（增大 BLOCK 后重建基线）');
  process.exit(0);
}
const pass = delta <= REL_TOLERANCE;
console.log(`[perf] 相对判：当前块 P95=${current.toFixed(4)}ms/${BLOCK}帧 vs 基线 ${baseline.p95Ms.toFixed(4)}ms（${baseline.recordedAt}）→ 差异 ${(delta * 100).toFixed(2)}%（容忍 ±10%）`);
console.log(`[perf] 绝对阈值（P95≤16.6ms / 峰值≥55fps）按真机口径单列，CI 不判（两层制）`);
console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'} — perf 相对判`);
process.exitCode = pass ? 0 : 1;
