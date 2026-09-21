/**
 * acc-06 进球链路验收（spec §6 / el-10 逐拍断言）。
 * 零依赖：node pixel-fives/tests/goal-flow.test.mjs → JSON 摘要 + exit 0/1。
 *
 * 断言链：球心过门线且在门嘴带内 → 比分 +1 → A08 于 goal_sfx_at_s=0.0 触发
 *        → 庆祝 1.2s 冻结 → 中圈重开（el-05/06/07 复位、速度清零）→ 恢复运行。
 */
import { Match } from '../src/core/match.js';
import { TICK_DT_S, GOAL_CELEBRATION_S, GOAL_SFX_AT_S } from '../src/core/constants.js';

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}
function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}
const NO_INTENT = { moveX: 0, moveY: 0, kick: false };

// ---------- 用例 A：左门（el-03，defends=blue）→ 赤焰得分 ----------
{
  const m = new Match({ seed: 7 });
  check('A0 开局阶段为 playing', m.phase === 'playing');
  check('A0 开局比分 0:0', m.scores.red === 0 && m.scores.blue === 0);
  // 球心置于左门线内（x < 6）、门嘴带正中（y=80 ∈ (58,102)）
  m.world.ball.place(5.5, 80);
  m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('A1 比分 red +1', m.scores.red === 1 && m.scores.blue === 0, JSON.stringify(m.scores));
  check('A2 进入庆祝阶段（冻结）', m.phase === 'celebration');
  check('A3 A08 于 goal_sfx_at_s=0.0 排程', m.sfxEvents.length === 1 && m.sfxEvents[0].id === 'a08-sfx-goal-hit' && m.sfxEvents[0].at_s === GOAL_SFX_AT_S, JSON.stringify(m.sfxEvents));
  check('A4 goal_sfx_at_s === 0.0（spec v1.2 字段）', GOAL_SFX_AT_S === 0.0);
  check('A5 庆祝时长 = 1.2s', approx(m.celebrationT, GOAL_CELEBRATION_S, 1e-9), String(m.celebrationT));

  // 冻结：庆祝期间世界不步进（球停在网内、计时停走）
  const frozenBallX = m.world.ball.x;
  const frozenTimeS = m.timeS;
  const frozenScores = JSON.stringify(m.scores);
  for (let i = 0; i < 10; i++) m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('A6 庆祝期间球冻结', approx(m.world.ball.x, frozenBallX) && m.world.ball.vx === 0 && m.world.ball.vy === 0);
  check('A7 庆祝期间计时冻结', approx(m.timeS, frozenTimeS));
  check('A8 庆祝期间比分不变', JSON.stringify(m.scores) === frozenScores);

  // 庆祝 1.2s（=72 tick，容许浮点尾差 1 tick）后恢复：中圈重开
  const ticks = Math.round(GOAL_CELEBRATION_S / TICK_DT_S);
  check('A9 庆祝 72 tick = 1.2s', ticks === 72);
  let guard = 0;
  while (m.phase === 'celebration' && guard < 200) {
    m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
    guard += 1;
  }
  check('A10 庆祝结束恢复 playing（≤73 tick）', m.phase === 'playing' && guard <= ticks + 1, `guard=${guard}`);
  check('A11 中圈重开：球回 el-07 (128,80) 速度清零', m.world.ball.x === 128 && m.world.ball.y === 80 && m.world.ball.vx === 0 && m.world.ball.vy === 0);
  check('A12 中圈重开：赤焰回 el-05 (168,80)', m.world.players[0].x === 168 && m.world.players[0].y === 80 && m.world.players[0].vx === 0);
  check('A13 中圈重开：霜蓝回 el-06 (88,80)', m.world.players[1].x === 88 && m.world.players[1].y === 80 && m.world.players[1].vx === 0);
  check('A14 比分保留（red 1:0）', m.scores.red === 1 && m.scores.blue === 0);
}

// ---------- 用例 B：右门（el-04，defends=red）→ 霜蓝得分 ----------
{
  const m = new Match({ seed: 7 });
  m.world.ball.place(250.5, 80); // 球心越过右门线（x > 250）、门嘴带内
  m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('B1 右门得分：blue +1', m.scores.blue === 1 && m.scores.red === 0, JSON.stringify(m.scores));
  check('B2 进入庆祝阶段', m.phase === 'celebration');
}

// ---------- 用例 C：越线但不在门嘴带 → 无进球，端墙反弹 ----------
{
  const m = new Match({ seed: 7 });
  m.world.ball.place(250.5, 110); // y=110 ∉ (58,102)
  m.world.ball.vx = -40;
  m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('C1 带外越线无进球', m.scores.red === 0 && m.scores.blue === 0 && m.phase === 'playing');
  check('C2 端墙反弹回场内', m.world.ball.x === 246 && m.world.ball.vx > 0, `x=${m.world.ball.x} vx=${m.world.ball.vx}`);
}

// ---------- 用例 D：门嘴带边界（开区间）→ 恰在 58/102 不判进 ----------
{
  const m = new Match({ seed: 7 });
  m.world.ball.place(250.5, 102); // 上边界值不在开区间内
  m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('D1 y=102（开区间边界）不判进', m.scores.red === 0 && m.scores.blue === 0 && m.phase === 'playing');
}

// ---------- 用例 E：进球事件逐拍字段（el-10 事件契约） ----------
{
  const m = new Match({ seed: 7 });
  m.world.ball.place(5.5, 80);
  m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  const ev = m.lastGoal;
  check('E1 goal 事件字段齐备', !!ev && ev.type === 'goal' && ev.scorer === 'red' && ev.conceder === 'blue' && ev.goalElementId === 'el-03', JSON.stringify(ev));
  check('E2 sfx 附于事件且 at_s=0.0', !!ev && ev.sfx && ev.sfx.id === 'a08-sfx-goal-hit' && ev.sfx.at_s === 0.0);
}

// ---------- 摘要 ----------
const summary = { test: 'goal-flow', total: results.length, failures, results };
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 ? 0 : 1);
