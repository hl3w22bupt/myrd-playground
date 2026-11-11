#!/usr/bin/env node
// football-contract.spec.mjs — 5v5 多球员实况机制契约（策划案 v2：两队多球员 + 队友接应 + 对方逼抢 + 人形建模数值）。
// 全部断言跑在确定性内核上（零 three/零 DOM）。
import { createGame } from "../src/kernel/loop.js";
import { footballIntent } from "../src/kernel/autopilot.js";
import { kickoffReset } from "../src/kernel/world.js";
import { KICKOFF_SPOTS } from "../src/levels/pitch.js";
import { TEAM_SIZE, ROUND_SECONDS, PITCH_HALF_Z, SEED_DEFAULT } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— 阵伍结构：5v5、两队、号码、门将 ——
{
  const g = createGame({ seed: 20261111 });
  const w = g.world;
  ok(w.players.length === TEAM_SIZE * 2, `场上球员 = ${w.players.length} = 2×${TEAM_SIZE}（5v5 量级）`);
  ok(w.players.filter((p) => p.team === 0).length === 5, "主队 5 人");
  ok(w.players.filter((p) => p.team === 1).length === 5, "客队 5 人");
  ok(w.players.filter((p) => p.role === "GK").length === 2, "双方各一门将（GK×2）");
  for (const team of [0, 1]) {
    const nums = w.players.filter((p) => p.team === team).map((p) => p.num).sort((a, b) => a - b);
    ok(JSON.stringify(nums) === JSON.stringify([1, 2, 3, 4, 5]), `team${team} 号码 1-5 且不重复（队服色+号码）`);
  }
  const spots = KICKOFF_SPOTS;
  const mirrored = spots.filter((s) => s.team === 0).every((s) =>
    spots.some((t) => t.team === 1 && t.role === s.role && t.x === -s.x && t.z === -s.z));
  ok(mirrored, "客队开球位与主队镜像对称（中圈公平开球）");
}

// —— 对局活力（自动跑完整场）：抢断/传球/射门事件真实发生，球权易手频繁 ——
// 循环上限 = 90s 净比赛 + 30s 余量（spec v3 打磨项：进球庆祝 1.2s 窗口冻结倒计时，
// 庆祝秒数消耗固定步预算但不消耗比赛时间 —— gameover 以 timeLeft 归零为准；
// 30s 余量取 spec「含加时总时长不超过 120 秒」产品窗，防理论无终局死循环）
function playMatch(seed) {
  const g = createGame({ seed });
  g.start();
  const tally = { pass: 0, shot: 0, tackle: 0, goal: 0, clear: 0, kickoff: 0 };
  for (let s = 0; s < ROUND_SECONDS + 30 && g.state === "playing"; s++) {
    for (const ev of g.fastForward(1, footballIntent(g.world)).events) {
      if (tally[ev.type] !== undefined) tally[ev.type]++;
    }
  }
  return { g, tally };
}
{
  const { g, tally } = playMatch(SEED_DEFAULT);
  const w = g.world;
  ok(g.state === "gameover", "自动驾驶跑完整场（gameover 终局；90s 净比赛 + 庆祝冻结余量）");
  ok(w.timeLeft <= 1e-9, "计时光走完（timeLeft 归零；庆祝冻结不计入比赛时间）");
  ok(tally.goal === 0 || w.celebrationLeft === 0, "终局时庆祝窗已耗尽（celebrationLeft 归零）");
  ok(tally.pass >= 5, `传球事件 ≥5（实测 ${tally.pass}，队友接应出球在发生）`);
  ok(tally.tackle >= 2, `抢断事件 ≥2（实测 ${tally.tackle}，贴身对抗在发生）`);
  ok(tally.shot >= 2, `射门事件 ≥2（实测 ${tally.shot}，进攻推进在发生）`);
  ok(w.possessionChanges >= 20, `球权易手 ≥20 次（实测 ${w.possessionChanges}，5v5 争抢活）`);
  const finite = w.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.phase))
    && Number.isFinite(w.ball.x) && Number.isFinite(w.ball.z);
  ok(finite, "全场数值有限（无 NaN 污染）");
  const inBounds = w.players.every((p) =>
    Math.abs(p.x) <= 13 && Math.abs(p.z) <= 20.5);
  ok(inBounds, "球员全部在场内（无穿模出界）");
}

// —— 跨种子活力与确定性 ——
{
  let goals = 0, shots = 0;
  const finals = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const { g, tally } = playMatch(seed);
    goals += g.world.goals;
    shots += tally.shot;
    finals.push(JSON.stringify({
      score: g.world.score, pc: g.world.possessionChanges,
      players: g.world.players.map((p) => [p.x.toFixed(3), p.z.toFixed(3)]),
      ball: [g.world.ball.x.toFixed(3), g.world.ball.z.toFixed(3)],
    }));
  }
  ok(shots >= 10, `5 个种子合计射门 ≥10（实测 ${shots}）`);
  ok(finals.length === 5, "5 种子终态快照齐备（异种子 → 异对局）");
  ok(new Set(finals).size === 5, "异种子 → 终局状态互不相同（rng 真参与）");
  const snap = (w) => JSON.stringify({
    score: w.score, pc: w.possessionChanges,
    players: w.players.map((p) => [p.x.toFixed(3), p.z.toFixed(3)]),
    ball: [w.ball.x.toFixed(3), w.ball.z.toFixed(3)],
  });
  ok(snap(playMatch(1).g.world) === finals[0], "同种子复跑 → 终局逐字段一致（确定性）");
}

// —— 开球重置：进球后全复位 ——
{
  const g = createGame({ seed: 7 });
  g.start();
  g.fastForward(8, footballIntent(g.world));
  const dirty = g.world.possessionChanges > 0 || g.world.timeLeft < ROUND_SECONDS;
  kickoffReset(g.world);
  const w = g.world;
  const atSpots = w.players.every((p, i) =>
    Math.abs(p.x - KICKOFF_SPOTS[i].x) < 1e-9 && Math.abs(p.z - KICKOFF_SPOTS[i].z) < 1e-9);
  ok(atSpots, "开球重置 → 全员回开球位" + (dirty ? "（此前确有脏状态）" : ""));
  ok(w.ball.x === 0 && w.ball.z === 0 && w.ball.owner === null, "球回中点且无归属");
}

// —— 队友接应（机制级）：主队持球时，无球队友目标位沿进攻方向前推（朝 -Z）——
{
  const g = createGame({ seed: 11 });
  g.start();
  // 直接把球交给受控人（内核世界对象直改 = 测试脚手架，非游戏路径）
  const c = g.world.players[g.world.controlledId];
  g.world.ball.owner = c.id;
  g.world.ball.x = c.x; g.world.ball.z = c.z;
  g.fastForward(0.5, { moveX: 0, moveZ: -1, pass: false, shoot: false });
  const w = g.world;
  const mates = w.players.filter((p) => p.team === 0 && p.id !== w.ball.owner && p.role !== "GK");
  const advancing = mates.filter((m) => m.targetZ < m.z - 0.5 || m.z < PITCH_HALF_Z * 0.3);
  ok(advancing.length >= 2, `主队持球时无球队友前压接应 ≥2 人（实测 ${advancing.length}/${mates.length}）`);
}

// —— 对方逼抢（机制级）：客队持球时，主队最近者在 2s 内显著逼近持球人 ——
{
  const g = createGame({ seed: 13 });
  g.start();
  const w = g.world;
  const carrier = w.players.find((p) => p.team === 1 && p.role === "FW");
  w.ball.owner = carrier.id;
  w.ball.x = carrier.x; w.ball.z = carrier.z;
  const nearestHome = () => {
    let best = null, bd = Infinity;
    for (const p of w.players) {
      if (p.team !== 0) continue;
      const d = Math.hypot(p.x - carrier.x, p.z - carrier.z);
      if (d < bd) { bd = d; best = p; }
    }
    return bd;
  };
  const d0 = nearestHome();
  g.fastForward(2, footballIntent(g.world)); // 自动驾驶意图 = 闲置自动补防路径
  const d1 = nearestHome();
  ok(d1 < d0 * 0.6, `防守者 2s 内逼近客队持球人（${d0.toFixed(1)} → ${d1.toFixed(1)}，逼抢生效）`);
}

// —— 受控人切换：主队队友拿球 → 受控切到持球人 ——
{
  const g = createGame({ seed: 17 });
  g.start();
  const w = g.world;
  const mate = w.players.find((p) => p.team === 0 && p.id !== w.controlledId && p.role !== "GK");
  w.ball.owner = mate.id;
  w.ball.x = mate.x; w.ball.z = mate.z;
  g.tick(1 / 60, { moveX: 0, moveZ: 0, pass: false, shoot: false });
  ok(w.controlledId === mate.id, "队友拿球 → 受控人自动切到持球人");
}

console.log(failures.length ? `FOOTBALL-CONTRACT: FAIL（${failures.length}）` : "FOOTBALL-CONTRACT: PASS");
process.exit(failures.length ? 1 : 0);
