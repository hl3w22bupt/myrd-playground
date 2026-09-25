/**
 * acc-02 红线验收：input_to_shot_latency_ms ≤ 50（spec §6 / R-03）。
 * 零依赖：node pixel-fives/tests/red-line/input-to-shot.test.mjs → JSON 摘要 + exit 0/1。
 *
 * 判定语义：射门判定发生在输入所在 tick 内（60Hz 同 tick ⇒ 延迟 ≤1 tick ≈ 16.7ms ≤ 50ms）；
 * A06 动画（9帧@12fps=0.75s）为纯视觉，kickAnimT > 0 时不阻塞下一次判定（仅受冷却约束）。
 */
import { Player } from '../../src/entities/player.js';
import { Ball } from '../../src/entities/ball.js';
import { TICK_DT_S, RED_LINE_INPUT_TO_SHOT_MS, A06, PLAYER } from '../../src/core/constants.js';

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}

// ---------- 用例 1：输入所在 tick 内即时出球 ----------
{
  const p = new Player('red', 100, 80, 168);
  p.facing = 1;
  const ball = new Ball(106, 80); // 距离 6 ≤ reach 13
  let impulseApplied = false;
  const impulse = () => { impulseApplied = true; };
  const before = { vx: ball.vx, vy: ball.vy, shots: p.shotCount };
  const intent = { moveX: 1, moveY: 0, kick: true };
  p.tick(intent, ball, impulse, TICK_DT_S);
  check('1a 判定发生在同一 tick（impulse 同步调用）', impulseApplied);
  check('1b 射门计数 +1', p.shotCount === before.shots + 1);
  check('1c 单 tick 延迟 ≤ 红线 50ms', TICK_DT_S * 1000 <= RED_LINE_INPUT_TO_SHOT_MS, `tick=${(TICK_DT_S * 1000).toFixed(3)}ms ≤ ${RED_LINE_INPUT_TO_SHOT_MS}ms`);
  check('1d A06 动画被排程（纯视觉）', p.kickAnimT === A06.duration_s, String(p.kickAnimT));
  check('1e 冷却进入生效', p.kickCooldown > 0);
  check('1f 动画时长 = 0.75s（9帧@12fps 终裁 R-01）', A06.duration_s === 0.75 && A06.frames === 9 && A06.fps === 12 && A06.contact_frame === 3);
}

// ---------- 用例 2：动画不阻塞判定（kickAnimT > 0 仍可出球） ----------
{
  const p = new Player('red', 100, 80, 168);
  p.facing = 1;
  const ball = new Ball(106, 80);
  // 空操作 impulse：本用例只验判定闸门，不验冲量（避免球被踢远改变触距）
  const impulse = () => {};
  const i = { moveX: 0, moveY: 0, kick: true };
  p.tick(i, ball, impulse, TICK_DT_S); // 第一次射门 → 冷却 0.3s、动画 0.75s
  // 快进：冷却结束，但动画仍在播（0.3s < 0.75s）
  let simulated = 0;
  while (p.kickCooldown > 0 && simulated < 60) { p.tick({ moveX: 0, moveY: 0, kick: false }, ball, impulse, TICK_DT_S); simulated += 1; }
  check('2a 快进至冷却结束', p.kickCooldown <= 0);
  check('2b 动画仍在播放（kickAnimT > 0）', p.kickAnimT > 0, String(p.kickAnimT));
  const shots = p.shotCount;
  const ok = p.tryKick(ball, impulse); // 直接再判定：动画未播完不阻塞
  check('2c 动画未播完不阻塞判定', ok === true && p.shotCount === shots + 1);
}

// ---------- 用例 3：冷却闸门（冷却中不可连踢） ----------
{
  const p = new Player('red', 100, 80, 168);
  p.facing = 1;
  const ball = new Ball(106, 80);
  const impulse = (ix, iy) => ball.impulse(ix, iy);
  const ok1 = p.tryKick(ball, impulse);
  const ok2 = p.tryKick(ball, impulse); // 冷却中
  check('3a 首次判定成功', ok1 === true);
  check('3b 冷却中第二次判定被拒', ok2 === false && p.shotCount === 1);
}

// ---------- 用例 4：触距闸门（球在 reach 之外不可踢） ----------
{
  const p = new Player('red', 100, 80, 168);
  p.facing = 1;
  const ball = new Ball(130, 80); // 距离 30 > reach 13
  let impulseApplied = false;
  const impulse = () => { impulseApplied = true; };
  const ok = p.tryKick(ball, impulse);
  check('4a 触距外判定失败', ok === false && !impulseApplied && p.shotCount === 0);
  check('4b reach 常量 = 13（R-10 采纳值）', PLAYER.REACH === 13);
}

// ---------- 摘要 ----------
const summary = { test: 'red-line/input-to-shot', total: results.length, failures, results };
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 ? 0 : 1);
