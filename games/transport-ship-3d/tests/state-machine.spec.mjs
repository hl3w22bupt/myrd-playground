#!/usr/bin/env node
// state-machine.spec.mjs — 验收口径 C：状态机对抗断言（常驻 CI）。六组对抗全覆盖：
//   ① 暂停/恢复连按 ≥5 轮 —— 状态唯一收敛、零未捕获异常、暂停腿时间不走
//   ② 结算瞬间继续输入 —— gameover 后移动/开火意图被拒（无新弹道、无位移、时间不走）
//   ③ 重开连点 ≥5 次 —— 状态唯一、数值复位、game.world 引用稳定、与全新对局逐步等价
//   ④ playing 中途暂停后重开 —— HP/波次/分数/弹药/储备/计时器全部复位到初始值
//   ⑤ 无幽灵状态 —— 状态字段唯一（无并列状态布尔）；暂停期计时器冻结、恢复无跳变；重开旧波计时清零
//   ⑥ 内核缺口回归 —— 本套件暴露的内核缺口（无 pause/resume/restart、over 后仍吃意图）修复后不回退
// 断言暴露的内核缺陷（已修，见 src/kernel/loop.js + world.js）：
//   - 内核原无对局状态机，暂停/重开只存在于表现层 main.js 局部变量，内核无法冻结/复位；
//   - world.over 之后 stepTick 仍接受移动意图（阵亡后可位移、时间继续走）。
import { createGame } from "../src/kernel/loop.js";
import { WAVE_REST, FIXED_STEP, PLAYER_MAX_HP, MAG_SIZE, RESERVE_AMMO } from "../src/numeric.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const ok = (cond, m) => (cond ? pass(m) : fail(m));
const tickOf = (s) => Math.max(1, Math.round(s / FIXED_STEP));
const INITIAL_REST_T = tickOf(WAVE_REST);
const STATES = new Set(["playing", "paused", "gameover"]);

/** 对抗跑法：内核任何抛错都计入 failures，不允许未捕获异常逃逸 */
function guard(label, fn) {
  try {
    fn();
    return true;
  } catch (e) {
    fail(`${label} 抛出未捕获异常：${e && e.message}`);
    return false;
  }
}

// ———————— ① 暂停/恢复连按 ≥5 轮 ————————
console.log("—— ① 暂停/恢复连按 ≥5 轮 ——");
{
  const g = createGame({ seed: 11 });
  g.fastForward(2, { forward: 1 }); // 先推进出非平凡状态
  const t0 = g.world.time;
  const seen = new Set();
  const clean = guard("连按暂停/恢复", () => {
    for (let round = 1; round <= 6; round++) {
      g.pause();
      g.pause(); // 连按两下：必须幂等
      seen.add(g.state);
      const tp = g.world.time;
      for (let i = 0; i < 10; i++) g.frame(FIXED_STEP, { forward: 1, firing: true });
      ok(g.state === "paused" && g.world.time === tp,
        `第${round}轮 双击暂停 → 唯一 paused，且暂停腿 10 tick 时间不走`);
      g.resume();
      g.resume();
      seen.add(g.state);
      ok(g.state === "playing", `第${round}轮 恢复 → 唯一 playing`);
    }
  });
  ok(clean, "连按 6 轮（12 次迁移）零未捕获异常");
  ok(g.state === "playing" && seen.size === 2 && [...seen].every((s) => STATES.has(s)),
    "状态唯一收敛：全程只出现 playing/paused 两个合法态，无第三态");
  ok(g.state === "playing", "收尾处于 playing 态");
  g.frame(FIXED_STEP, { forward: 1 }); // 恢复后推进一帧验证时间确实恢复流动
  ok(g.world.time > t0, "恢复后时间继续推进（无冻结残留）");
}

// ———————— ② 结算瞬间继续输入 ————————
console.log("—— ② 结算瞬间继续输入 ——");
{
  const g = createGame({ seed: 3 });
  let waited = 0;
  while (!g.world.over && waited < 400) { g.fastForward(1, { forward: 0 }); waited++; } // 静止站桩打到自然战败
  ok(g.world.over === true && g.state === "gameover" && g.world.player.hp === 0,
    `自然战败结算（存活 ${g.world.time.toFixed(1)}s）→ 状态唯一 gameover、HP=0`);
  const pos = { x: g.world.player.x, z: g.world.player.z };
  const before = {
    shots: g.world.shotsFired, hits: g.world.shotsHit, time: g.world.time,
    score: g.world.score, enemies: g.world.enemies.length, wave: g.world.wave.n,
  };
  let lethalEvents = 0;
  for (let i = 0; i < 120; i++) {
    const ev = g.frame(FIXED_STEP, { forward: 1, strafe: 1, firing: true, yaw: 1.5 });
    lethalEvents += ev.filter((e) => e.type === "shot" || e.type === "enemyHit" || e.type === "shotMiss").length;
  }
  const ff = g.fastForward(5, { forward: 1, strafe: -1, firing: true });
  ok(lethalEvents === 0 && ff.events.length === 0, "阵亡后注入 120 tick 移动+开火意图 → 零事件（无新弹道）");
  ok(g.world.shotsFired === before.shots && g.world.shotsHit === before.hits,
    "阵亡后弹道记账冻结（shotsFired/shotsHit 不增加）");
  ok(g.world.player.x === pos.x && g.world.player.z === pos.z, "阵亡后位置零位移（移动意图被拒）");
  ok(g.world.time === before.time && g.world.score === before.score, "阵亡后时间/分数不走");
  ok(g.world.enemies.length === before.enemies && g.world.wave.n === before.wave, "阵亡后敌兵/波次不再推进");
  ok(STATES.has(g.state) && g.state === "gameover", "结算后状态仍唯一 gameover（不会被输入改写）");
}

// ———————— ③ 重开连点 ≥5 次 ————————
console.log("—— ③ 重开连点 ≥5 次 ——");
{
  const g = createGame({ seed: 5 });
  g.fastForward(12, { forward: 1, firing: true }); // 制造非平凡状态
  const dirty = g.world.score !== 0 || g.world.wave.n !== 0 || g.world.player.ammo !== MAG_SIZE
    || g.world.kills !== 0 || g.world.enemies.length > 0;
  ok(dirty, `重开前状态已非平凡（score=${g.world.score} wave=${g.world.wave.n} ammo=${g.world.player.ammo} 敌兵=${g.world.enemies.length}）`);
  const worldRef = g.world;
  const clean = guard("连点重开", () => {
    for (let i = 1; i <= 6; i++) {
      g.restart();
      ok(g.state === "playing" && g.world.state === "playing", `第${i}次重开 → 状态唯一 playing`);
      ok(g.world.time === 0 && g.world.score === 0 && g.world.kills === 0 && g.world.headshots === 0,
        `第${i}次重开 → 时间/分数/击杀/爆头归零`);
      ok(g.world.player.hp === PLAYER_MAX_HP && g.world.player.ammo === MAG_SIZE
        && g.world.player.reserve === RESERVE_AMMO && g.world.player.reloading === false,
        `第${i}次重开 → HP/弹匣/储备/换弹标志复位`);
      ok(g.world.wave.n === 0 && g.world.wave.state === "rest" && g.world.wave.spawned === 0
        && g.world.enemies.length === 0, `第${i}次重开 → 波次/敌兵复位`);
    }
  });
  ok(clean, "连点 6 次重开零未捕获异常");
  ok(g.world === worldRef, "重开 6 次 → game.world 引用稳定（表现层无需重建）");
  const again = createGame({ seed: 5 });
  g.fastForward(2, { forward: 0 });
  again.fastForward(2, { forward: 0 });
  ok(JSON.stringify(g.snapshot()) === JSON.stringify(again.snapshot()),
    "重开后与全新同 seed 对局逐步等价（确定性复位，非部分清零）");
}

// ———————— ④ playing 中途暂停后重开 ————————
console.log("—— ④ playing 中途暂停后重开 ——");
{
  const g = createGame({ seed: 9 });
  g.fastForward(10, { forward: 1, sprint: true, firing: true });
  ok(g.pause() === "paused", "推进 10s 后暂停成功");
  ok(g.resume() === "playing", "恢复路径可用（暂停 → 恢复 → 重开）");
  g.restart();
  const fresh = createGame({ seed: 9 }).world;
  const scalar = ["time", "score", "kills", "shotsFired", "shotsHit", "headshots", "over"];
  let same = scalar.every((f) => g.world[f] === fresh[f]) && g.world.state === fresh.state;
  same = same && g.world.player.hp === fresh.player.hp && g.world.player.ammo === fresh.player.ammo
    && g.world.player.reserve === fresh.player.reserve && g.world.player.x === fresh.player.x
    && g.world.player.z === fresh.player.z && g.world.player.reloadT === fresh.player.reloadT
    && g.world.player.fireT === fresh.player.fireT && g.world.player.reloading === fresh.player.reloading;
  same = same && g.world.wave.n === fresh.wave.n && g.world.wave.state === fresh.wave.state
    && g.world.wave.restT === fresh.wave.restT && g.world.wave.spawned === fresh.wave.spawned
    && g.world.wave.toSpawn === fresh.wave.toSpawn && g.world.wave.spawnT === fresh.wave.spawnT;
  ok(same, "暂停→重开：HP/波次/分数/弹药/储备/位置/计时器全部等于全新对局初始值");
  ok(g.world.enemies.length === 0, "重开后旧波敌兵全部清除");
  ok(g.state === "playing" && g.world.over === false, "重开后状态唯一 playing、未终局");
}

// ———————— ⑤ 无幽灵状态 / 无残留计时器 ————————
console.log("—— ⑤ 无幽灵状态 / 无残留计时器 ——");
{
  const g = createGame({ seed: 13 });
  const stateLike = Object.keys(g.world).filter((k) => /^(state|over|paused|running|frozen|phase|isPaused|isOver|matchState)$/.test(k)).sort();
  ok(JSON.stringify(stateLike) === JSON.stringify(["over", "state"]),
    "状态字段唯一：仅 state（唯一状态字段）+ over（终局标记），无并列状态布尔/幽灵态");
  ok(g.state === "playing" && g.world.state === "playing" && STATES.has(g.state),
    "状态读取双口径一致且合法（game.state === world.state）");

  // 暂停期 N tick 冻结：覆盖全部计时器可观测点（时间/波次 restT·spawnT/换弹 reloadT/射速 fireT/敌兵位置）
  g.fastForward(9.4, { forward: 1 }); // 进入波次 active 中段（敌兵已在场）
  g.pause();
  const frozen = JSON.stringify(g.snapshot());
  const tPaused = g.world.time;
  for (let i = 0; i < 90; i++) g.frame(FIXED_STEP, { forward: 1, strafe: -1, firing: true, reload: true });
  g.fastForward(2, { forward: 1, firing: true });
  ok(g.world.time === tPaused, "暂停期间推进 90 tick + fastForward(2s)：存活时间不走");
  ok(JSON.stringify(g.snapshot()) === frozen,
    "暂停期间全字段零漂移（位置/波次计时器/换弹与射速计时器/敌兵状态全冻结）");
  g.resume();
  ok(g.world.time === tPaused, "恢复瞬间无时间跳变");
  g.frame(FIXED_STEP, { forward: 0 });
  ok(Math.abs(g.world.time - (tPaused + FIXED_STEP)) < 1e-12, "恢复后首帧恰好推进 1 tick（无补帧爆发/累加器污染）");

  // 旧波次计时器清零：把对局推到 active 倒计时中段再重开
  const g2 = createGame({ seed: 13 });
  g2.fastForward(10.5, { forward: 0 });
  ok(g2.world.wave.n >= 1 && g2.world.wave.state === "active" && g2.world.enemies.length > 0,
    `前置：已进入第${g2.world.wave.n}波 active、敌兵在场（旧计时器非初始）`);
  g2.restart();
  ok(g2.world.wave.n === 0 && g2.world.wave.state === "rest" && g2.world.wave.spawned === 0
    && g2.world.wave.spawnT === 0 && g2.world.wave.toSpawn === 0 && g2.world.wave.restT === INITIAL_REST_T
    && g2.world.player.reloadT === 0 && g2.world.player.fireT === 0,
    `重开后旧波计时器清零（restT=${INITIAL_REST_T} 开局休整、spawnT/spawned/toSpawn/reloadT/fireT 归零）`);

  // 内核 restart(seed) 覆盖（红队 F3 收口的内核基座）：表现层「对局内随机重开」统一走 game.restart(nextSeed)
  const g3 = createGame({ seed: 13 });
  g3.fastForward(10.5, { forward: 1 }); // 推进出非平凡状态（累加器/波次/位置均有残留）
  g3.frame(0.011, { forward: 0 }); // 半 tick 残留在累加器（0.011 < FIXED_STEP 不成步）
  const before = { seed: g3.world.seed, time: g3.world.time };
  g3.restart(424242);
  ok(g3.world.seed === 424242 && g3.world.seed !== before.seed && g3.world.time === 0
    && g3.world.state === "playing",
    "restart(424242)：以注入 seed 整体重建（world.seed 换新）+ 计时归零 + 直接 playing");
  g3.frame(0.005, { forward: 0 }); // 累加器若未清零，0.011+0.005 ≥ FIXED_STEP 会补出一整 tick
  ok(g3.world.time === 0, "restart 后累加器已清零：残留半 tick + 5ms 不补帧（time 仍 0，无首帧跳变）");
  g3.restart(1.5);
  ok(g3.world.seed === 1, "restart(1.5)：非整数有限值按 >>>0 取整为 1（整数化口径）");
  g3.restart(NaN);
  ok(g3.world.seed === 13, "restart(NaN)：非有限 seed 回退创建时 seed（边界加固，NaN 不进内核）");
  g3.restart(-7);
  ok(g3.world.seed === 4294967289, "restart(-7)：负值 >>>0 回绕为无符号（确定性域内）");
}

if (failures.length) {
  console.error("—— 状态机对抗断言 FAIL ——");
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log("STATE-MACHINE: PASS 六组对抗（连按暂停恢复/结算瞬间输入/重开连点/暂停后重开/无幽灵状态/内核缺口回归）全部成立");
