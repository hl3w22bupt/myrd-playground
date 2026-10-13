// ac-16-guidance-telemetry — 埋点四事件骨架机判（first_tap / first_loop_complete / restart_clicked / hint_shown）
//
// 任务书增量（spec v1.2 预埋）：四事件含相对时间戳字段 atMs（= tick × FIXED_STEP_MS，局内相对毫秒）；
// a5-guidance-first-action 判定语义 = hint_shown 后 5s 内首次有效操作（atMs 差 ≤5000ms，auto）；
// a4 v1 写死面 = restart_clicked 真实点击本地计数 +1（count 递增，auto）。
// spec v1.2 入链后本件经 checks/ 薄壳挂到 acceptance（checks/ac-a5-guidance-first-action.mjs 等）。
import { assert, loadSpec } from './helpers.mjs';
const spec = loadSpec();
const stepMs = spec.numeric.FIXED_STEP_MS;

const { createGame, pickUpgradeHost, offerIfNeeded } = await import(
  new URL('../../src/game.ts', import.meta.url).pathname
);

const g = createGame(spec);

// ① hint_shown：首局 running 起始即展示引导浮层，条目含相对时间戳 atMs=0 与逐字文案
assert(typeof g.step === 'function', '前置：Game.step 可用');
g.step(stepMs); // 推进一帧（running）
const ents = () => g.telemetryEntries();
const hint = ents().find((t) => t.id === 'hint_shown');
assert(hint, 'hint_shown 未产生（引导浮层未接线）');
assert(hint.atMs === 0, `hint_shown.atMs 应为 0（首局起始），实得 ${hint.atMs}`);
assert(typeof hint.text === 'string' && hint.text.length > 0, 'hint_shown 缺逐字文案字段 text');

// ② first_tap：shell 面首次点按 once，相对时间戳 atMs = tick×stepMs
assert(typeof g.recordTap === 'function', '缺 Game.recordTap 接缝（first_tap 未接线）');
g.step(stepMs);
g.recordTap();
g.recordTap(); // 二次点按不重复记（once）
const taps = ents().filter((t) => t.id === 'first_tap');
assert(taps.length === 1, `first_tap 应恰好 1 条（once），实得 ${taps.length}`);
assert(Math.abs(taps[0].atMs - g.state.tick * stepMs) <= stepMs, `first_tap.atMs ${taps[0].atMs} 与 tick×stepMs ${g.state.tick * stepMs} 不一致`);

// ③ a5 判定语义样例：真实操作发生在 hint_shown 后 5s 内（本件以受控时序断言窗语义）
const tapAt = taps[0].atMs, hintAt = hint.atMs;
assert(tapAt - hintAt <= 5000, `a5 窗语义：首操作 atMs-tap ${tapAt - hintAt}ms > 5000ms（受控时序应落在窗内）`);

// ④ first_loop_complete：首次升级三选一选择完成 = 首次核心循环闭环（拖动→击杀→掉落→拾取→升级）
// 驱动真实仿真：拖动锚定 → step 快进 → 三选一出现即真实选择；循环直至 flc 落账
// （pick 设置 firstUpgradeTick 后还需一帧 step 才落遥测——循环条件以观测面为准，防状态/观测脱节）
g.pointer = { x: g.state.captain.pos.x + 30, y: g.state.captain.pos.y + 20 };
let guard = 0;
const hasFlc = () => g.telemetryEntries().some((t) => t.id === 'first_loop_complete');
while (!hasFlc() && guard < 200000) {
  guard += 1;
  offerIfNeeded(g);
  g.step(stepMs);
  if (g.state.choices) pickUpgradeHost(g, 0);
}
assert(g.state.firstUpgradeTick !== null, `驱动 ${guard} 步未发生首次升级（前置断链）`);
const flc = ents().find((t) => t.id === 'first_loop_complete');
assert(flc, 'first_loop_complete 未产生（首次核心循环闭环未接线）');
assert(flc.atMs === g.state.firstUpgradeTick * stepMs,
  `first_loop_complete.atMs ${flc.atMs} ≠ firstUpgradeTick×stepMs ${g.state.firstUpgradeTick * stepMs}`);

// ⑤ restart_clicked：结算态点按重开 → 本地计数 +1（每次点击一条，count 递增）
assert(typeof g.recordRestartClick === 'function', '缺 Game.recordRestartClick 接缝（restart_clicked 未接线）');
g.state.phase = 'ended';
g.recordRestartClick();
g.recordRestartClick();
const rc = ents().filter((t) => t.id === 'restart_clicked');
assert(rc.length === 2, `restart_clicked 应 2 条（两次点按），实得 ${rc.length}`);
assert(rc[0].count === 1 && rc[1].count === 2, `restart_clicked.count 应递增 1,2，实得 ${rc.map((r) => r.count).join(',')}`);

console.log(`PASS ac-16 埋点四事件骨架（hint_shown@${hint.atMs}ms + first_tap once@${tapAt}ms + first_loop_complete@${flc.atMs}ms + restart_clicked count 1→2）· a5 窗语义 5s 内可达`);
