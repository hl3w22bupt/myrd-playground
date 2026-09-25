/**
 * acc-05 onboarding 提示 UI 集成测试（spec §6 acc-05 / el-09 / R-04 落点）。
 * 零依赖：node pixel-fives/tests/ui/onboarding-hint.test.mjs → JSON 摘要 + exit 0/1。
 *
 * 断言链（spec §4.1 el-09：开局显示，首次触球后 ≤3s 淡出）：
 *  A 开局可见（alpha=1）→ B 首次触球锚定 firstTouchS → C 淡出在 ≤3s 内完成
 *  → D 未触球不淡出 → E 淡出单调不回弹。
 * R-04 口径：本测试驱动真实触球链路（player.tick → ball.impulse），不走 bot 对局。
 */
import { Match } from '../../src/core/match.js';
import { TICK_DT_S } from '../../src/core/constants.js';
import { PITCH_LEVEL } from '../../src/levels/pitch.js';

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}

const NO_INTENT = { moveX: 0, moveY: 0, kick: false };

// ---------- A：开局可见 ----------
{
  const m = new Match({ seed: 5 });
  check('A1 开局提示不透明度 = 1（可见）', m.onboardingAlpha() === 1, String(m.onboardingAlpha()));
  check('A2 el-09 落点在关卡 script', PITCH_LEVEL.elements.some((e) => e.id === 'el-09'), 'el-09');
}

// ---------- B：首次触球锚定 firstTouchS ----------
{
  const m = new Match({ seed: 5 });
  const red = m.world.players[0];
  red.place(120, 80); // 球在 (128,80)，间距 8px ≤ REACH 13
  m.step(TICK_DT_S, { moveX: 1, moveY: 0, kick: true }, NO_INTENT);
  check('B1 首次触球被感知（touchCount>0）', m.world.ball.touchCount > 0, String(m.world.ball.touchCount));
  check('B2 firstTouchS 锚定', m.firstTouchS !== null, String(m.firstTouchS));
}

// ---------- C：淡出 ≤3s 完成 ----------
{
  const m = new Match({ seed: 5 });
  const red = m.world.players[0];
  red.place(120, 80);
  m.step(TICK_DT_S, { moveX: 1, moveY: 0, kick: true }, NO_INTENT);
  const tTouch = m.firstTouchS;
  let fadeDoneAt = null;
  for (let i = 0; i < 600; i++) { // ≤10s 扫描窗
    m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
    if (fadeDoneAt === null && m.onboardingAlpha() === 0) {
      fadeDoneAt = m.timeS - tTouch;
      break;
    }
  }
  check('C1 淡出完成（alpha=0）', fadeDoneAt !== null, String(fadeDoneAt));
  check('C2 淡出时限 ≤3s（spec el-09 / onboarding.hide_after_first_touch_s=3）',
    fadeDoneAt !== null && fadeDoneAt <= 3, fadeDoneAt === null ? 'never' : `${fadeDoneAt.toFixed(3)}s`);
}

// ---------- D：未触球不淡出 ----------
{
  const m = new Match({ seed: 5 });
  for (let i = 0; i < 300; i++) m.step(TICK_DT_S, NO_INTENT, NO_INTENT); // 5s 无触球
  check('D1 5s 未触球提示仍可见（alpha=1）', m.onboardingAlpha() === 1, String(m.onboardingAlpha()));
}

// ---------- E：淡出单调不回弹 ----------
{
  const m = new Match({ seed: 5 });
  const red = m.world.players[0];
  red.place(120, 80);
  m.step(TICK_DT_S, { moveX: 1, moveY: 0, kick: true }, NO_INTENT);
  let prev = m.onboardingAlpha();
  let monotonic = true;
  for (let i = 0; i < 120; i++) {
    m.step(TICK_DT_S, NO_INTENT, NO_INTENT);
    const a = m.onboardingAlpha();
    if (a > prev + 1e-9) monotonic = false;
    prev = a;
  }
  check('E1 淡出过程单调不回弹', monotonic, null);
}

const summary = {
  test: 'ui/onboarding-hint',
  total: results.length,
  failures,
  results,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 ? 0 : 1);
