// a1-td-first-placement-feedback — 首 30 秒体验目标（5/5 种子）
// spec acceptance a1：首 30s 内完成首次布防 ∧ first_placement_at ≤ firstPlacementBudgetSec(20s)
//                    ∧ 首次命中反馈延迟 ≤ feedback.latencyMaxMs(100ms)。样本量=5 种子。
import { loadCfg, Game, assert } from '../helpers.mjs';

const cfg = loadCfg();
const results = [];
for (let i = 0; i < 5; i += 1) {
  const seed = cfg.defaultSeed + i;
  const game = new Game({ cfg, seed });
  game.advanceTitle(400);                       // hint_shown@0ms → 400ms 后首操作（≤5000ms 窗）
  const tapped = game.pointerDown(320, 252);    // 开始布防（first_tap）
  assert(tapped, `seed${i} 开始按钮点击未生效（boot 断链）`);
  // 预算内布防：格 (15,6) 中心 (496,208) → 菜单确认
  const t0 = performance.now();
  const sel = game.pointerDown(496, 208);
  assert(sel && game.ui.pendingTile === '15,6', `seed${i} 空格点选未进放置菜单`);
  const ok = game.pointerDown(320, 344);        // 放置菜单确认
  const interactMs = performance.now() - t0;
  assert(ok, `seed${i} 首次布防被拒（军费/可建面失败）`);
  const fp = game.entries().find((e) => e.name === 'first_placement_at');
  assert(fp, `seed${i} first_placement_at 未出账`);
  const fl = game.entries().filter((e) => e.name === 'feedback_latency_ms');
  const maxLatency = Math.max(0, ...fl.map((e) => e.value));
  results.push({
    seed,
    firstPlacementMs: fp.atMs,
    feedbackLatencyMs: maxLatency,
    firstInteractionWallMs: Math.round(interactMs),
    withinBudgetSec: fp.atMs <= cfg.firstPlacementBudgetSec * 1000,
    within30s: fp.atMs <= 30000,
    latencyOk: maxLatency <= cfg.feedback.latencyMaxMs,
  });
  assert(fp.atMs <= cfg.firstPlacementBudgetSec * 1000, `seed${i} first_placement_at=${fp.atMs}ms > 预算 ${cfg.firstPlacementBudgetSec}s`);
  assert(fp.atMs <= 30000, `seed${i} 首 30s 未完成首次布防`);
  assert(maxLatency <= cfg.feedback.latencyMaxMs, `seed${i} 反馈延迟 ${maxLatency}ms > ${cfg.feedback.latencyMaxMs}ms`);
  assert(interactMs <= cfg.perf.firstInteractionMs, `seed${i} 首交互墙钟 ${interactMs}ms > ${cfg.perf.firstInteractionMs}ms`);
}
console.log('PASS a1-td-first-placement-feedback 5/5 种子', JSON.stringify(results));
