// a5-td-onboarding-four-events — 首屏引导四事件骨架
// spec acceptance a5：hint_shown@0ms → first_tap（once）→ first_loop_complete=首波结束 tick×16ms
//   → restart_clicked count 1→2（结算页真实点击）；首操作须落 hint 后 ≤5000ms 窗；
//   首屏文案三方逐字同名：spec.world.firstScreenCopy ≡ 渲染层 GUIDANCE 常量 ≡ hint_shown.text。
import { loadCfg, loadSpec, assert, GAME_ROOT } from '../helpers.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { Game } = await import(join(GAME_ROOT, 'src', 'game.ts'));
const { GUIDANCE } = await import(join(GAME_ROOT, 'src', 'render', 'guidance.ts'));

const cfg = loadCfg();
const spec = loadSpec();

// —— ③ 三方逐字同名（先于流程：文案面失配即结构性红）——
const copyRows = spec.world.firstScreenCopy;
assert(Array.isArray(copyRows) && copyRows.length === 12, `firstScreenCopy ${copyRows?.length} ≠ 12 条`);
for (const row of copyRows) {
  assert(GUIDANCE[row.id] === row.text, `文案漂移 ${row.id}: spec="${row.text}" vs GUIDANCE="${GUIDANCE[row.id]}"`);
}
const game = new Game({ cfg });
// —— ① hint_shown@0ms → ② first_tap（≤5000ms 窗）——
game.advanceTitle(0);
const hint = game.entries().find((e) => e.name === 'hint_shown');
assert(hint, 'hint_shown 未出账');
assert(hint.atMs === 0, `hint_shown.atMs=${hint.atMs} ≠ 0`);
const hintText = spec.world.firstScreenCopy.find((c) => c.id === 'copy-hint-place').text;
assert(hint.text === hintText, `hint_shown.text 与 spec copy-hint-place 不逐字等："${hint.text}" vs "${hintText}"`);
assert(hint.text === GUIDANCE['copy-hint-place'], 'hint_shown.text 与 GUIDANCE 不逐字等（三方断链）');
game.advanceTitle(4800);                       // 5s 窗内首操作
assert(game.pointerDown(320, 252), '开始按钮未生效');
const tap = game.entries().find((e) => e.name === 'first_tap');
assert(tap, 'first_tap 未出账');
const firstTapEvents = game.entries().filter((e) => e.name === 'first_tap');
assert(firstTapEvents.length === 1, `first_tap 出账 ${firstTapEvents.length} 次 ≠ once`);
assert(tap.atMs - hint.atMs <= 5000, `首操作落点 ${tap.atMs}ms 超 hint 后 5000ms 窗`);
// —— 布防推进到首波结束（first_loop_complete = 首波结束 tick×16ms）——
assert(game.pointerDown(496, 208) && game.pointerDown(320, 344), '首布防失败');
let guard = 0;
while (game.phase === 'running' && game.sim.firstLoopTick === 0 && guard < 40000) { game.tick(1); guard += 1; }
const flc = game.entries().find((e) => e.name === 'first_loop_complete');
assert(flc, 'first_loop_complete 未出账');
assert(flc.atMs === game.sim.firstLoopTick * cfg.fixedStepMs, `first_loop_complete atMs=${flc.atMs} ≠ 首波结束 tick×16=${game.sim.firstLoopTick * cfg.fixedStepMs}`);
// —— ④ restart_clicked count 1→2（结算页真实点击两次）——
guard = 0;
while (game.phase === 'running' && guard < 60000) { game.tick(1); guard += 1; }
assert(game.phase === 'settled', '未进结算页');
assert(game.pointerDown(320, 236), '第一次重开点击未生效');
const rc1 = game.entries().filter((e) => e.name === 'restart_clicked');
assert(rc1.length === 1 && rc1[0].count === 1, `restart_clicked 首次 count 异常: ${JSON.stringify(rc1)}`);
guard = 0;
while (game.phase === 'running' && guard < 60000) { game.tick(1); guard += 1; }
assert(game.phase === 'settled', '第二局未进结算页');
assert(game.pointerDown(320, 236), '第二次重开点击未生效');
const rc = game.entries().filter((e) => e.name === 'restart_clicked');
assert(rc.length === 2 && rc[1].count === 2, `restart_clicked 未达 count=2: ${JSON.stringify(rc.map((e) => e.count))}`);
console.log(`PASS a5-td-onboarding-four-events hint@0ms → first_tap@${tap.atMs}ms(≤5000窗) → first_loop_complete@${flc.atMs}ms(tick${game.sim.firstLoopTick}) → restart_clicked 1→2 · 文案三方逐字同名 ${copyRows.length}/12`);
