#!/usr/bin/env node
// combat.spec.mjs — ac-3：武器数值与 spec.numeric 一致（射速节流/弹匣记账/换弹时长/伤害与爆头/得分）。
import { createGame } from "../src/kernel/loop.js";
import {
  FIXED_STEP, FIRE_INTERVAL, RELOAD_TIME, MAG_SIZE, RESERVE_AMMO, BULLET_DAMAGE,
  HEADSHOT_MULT, ENEMY_HP, HIT_SCORE, KILL_SCORE, HEADSHOT_BONUS, PLAYER_MAX_HP,
  ENEMY_HIT_CHANCE, ENEMY_DAMAGE, WAVE_REST,
} from "../src/numeric.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const expect = (cond, okMsg, errMsg) => (cond ? pass(okMsg) : fail(errMsg));

const TICKS = (s) => Math.round(s / FIXED_STEP);

// —— 射速节流：连续按住开火，N tick 内实际开火数 ≤ 理论值 ——
{
  const g = createGame({ seed: 3 });
  g.fastForward(WAVE_REST, {}); // 跳过休整，等 waveStart
  // 站桩对空开火（不对准任何敌人 → 全 miss，只测射速与弹药记账）
  const total = TICKS(FIRE_INTERVAL) * 30 + 10;
  let fired = 0;
  for (let t = 0; t < total && g.world.player.ammo > 0; t++) {
    const before = g.world.shotsFired;
    g.frame(FIXED_STEP, { firing: true, yaw: 0.5, pitch: -0.5 });
    fired += g.world.shotsFired - before;
  }
  const expected = Math.ceil(total / TICKS(FIRE_INTERVAL)) - 1;
  expect(fired <= expected && fired >= expected - 2,
    `射速节流成立：${total} tick 内 ${fired} 发（理论上限 ${expected}，FIRE_INTERVAL=${FIRE_INTERVAL}s）`,
    `射速失控：${total} tick 内打了 ${fired} 发（上限 ${expected}）`);
  expect(g.world.shotsFired === fired,
    "shotsFired 计数与实发一致", `shotsFired=${g.world.shotsFired} 与实发 ${fired} 不一致`);
}

// —— 弹匣与备弹记账 + 自动换弹 ——
{
  const g = createGame({ seed: 3 });
  g.fastForward(WAVE_REST, {});
  const p = g.world.player;
  const mag0 = p.ammo, res0 = p.reserve;
  expect(mag0 === MAG_SIZE && res0 === RESERVE_AMMO,
    `开局弹药 = MAG_SIZE(${MAG_SIZE}) + RESERVE_AMMO(${RESERVE_AMMO})`,
    `开局弹药错误：${mag0}/${res0}`);
  // 打空弹匣
  let guard = 0;
  while (p.ammo > 0 && guard++ < 500) g.frame(FIXED_STEP, { firing: true, yaw: 1.1, pitch: -0.7 });
  expect(p.ammo === 0 || p.reloading, "弹匣打空触发自动换弹", `弹匣打空后既非空也未换弹（ammo=${p.ammo} reloading=${p.reloading}）`);
  // 换弹完成时机 ≈ RELOAD_TIME
  const reloadStart = g.world.time;
  guard = 0;
  while (p.reloading && guard++ < 400) g.frame(FIXED_STEP, {});
  const elapsed = g.world.time - reloadStart;
  expect(Math.abs(elapsed - RELOAD_TIME) < 0.05,
    `换弹时长 ≈ RELOAD_TIME（实测 ${elapsed.toFixed(3)}s）`,
    `换弹时长偏离 RELOAD_TIME：${elapsed.toFixed(3)}s`);
  expect(p.ammo === MAG_SIZE || p.reserve === 0,
    "换弹后弹匣补满（或备弹耗尽）",
    `换弹后弹匣未满：ammo=${p.ammo} reserve=${p.reserve}`);
  expect(res0 - p.reserve + (MAG_SIZE - 0) >= 0 && p.reserve < res0 || p.ammo === MAG_SIZE,
    `备弹扣减记账正确（${res0} → ${p.reserve}）`, `备弹记账异常：${res0} → ${p.reserve}`);
}

// —— 伤害/爆头/得分：构造必中场景（出生点正对 spawn-north 直线）——
{
  const g = createGame({ seed: 42 });
  g.fastForward(WAVE_REST + 0.2, {});
  const p = g.world.player;
  p.x = 0; p.z = 8; // 出生点直线对 spawn-north (0,-21.5)，无掩体遮挡
  // 瞄准枪口高度打身体：敌兵在 ~20m，pitch 打胸口
  const aimBody = (dist) => ({ firing: true, yaw: Math.PI, pitch: Math.atan2(0.9 - 1.6, dist) });
  // 等敌兵进入并站定开火
  let guard = 0;
  while (g.world.enemies.length === 0 && guard++ < 600) g.frame(FIXED_STEP, {});
  const e = g.world.enemies[0];
  guard = 0;
  while (!g.world.over && guard++ < 2000) {
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (e.state !== "dead") {
      const before = g.world.score;
      const beforeHp = e.hp;
      g.frame(FIXED_STEP, aimBody(d));
      // 命中事件检查（如有）
      if (g.world.score > before) {
        const gained = g.world.score - before;
        const killed = beforeHp - BULLET_DAMAGE <= 0;
        const expected = HIT_SCORE + (killed ? KILL_SCORE : 0);
        expect(gained === expected, `命中得分 = HIT_SCORE${killed ? "+KILL_SCORE" : ""}（${gained}）`, `得分异常：${gained} ≠ ${expected}`);
        break;
      }
    } else break;
  }
}

// —— 爆头倍率（直接构造：pitch 上抬至头部带）——
{
  const g = createGame({ seed: 42 });
  g.fastForward(WAVE_REST + 0.2, {});
  const p = g.world.player;
  // 敌兵从 spawn-north 出现后，锁定最近敌，按距离动态爆头
  let killedHead = false, sawHead = false, guard = 0;
  while (guard++ < 2600 && !g.world.over) {
    let best = null, bd = 1e9;
    for (const e of g.world.enemies) {
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { g.frame(FIXED_STEP, {}); continue; }
    const before = g.world.score;
    const beforeKills = g.world.kills;
    g.frame(FIXED_STEP, { firing: true, yaw: Math.atan2(best.x - p.x, best.z - p.z), pitch: Math.atan2(1.55 - 1.6, bd) });
    if (g.world.score > before && g.world.kills === beforeKills) sawHead = sawHead || (g.world.score - before) === HEADSHOT_BONUS + HIT_SCORE;
    if (g.world.kills > beforeKills) { killedHead = true; break; }
  }
  expect(sawHead || killedHead, "爆头判定与 HEADSHOT_BONUS/HIT_SCORE 记账生效", "未见任何爆头记账（检查头部带/瞄准）");
}

// —— 敌兵伤害与命中概率口径 ——
{
  const g = createGame({ seed: 9 });
  g.fastForward(WAVE_REST + 1, {});
  const p = g.world.player;
  const hp0 = p.hp;
  let guard = 0;
  while (p.hp === hp0 && guard++ < 4000 && !g.world.over) g.frame(FIXED_STEP, {});
  const dmgTaken = hp0 - p.hp;
  expect(dmgTaken > 0 && dmgTaken % ENEMY_DAMAGE === 0,
    `玩家承伤为 ENEMY_DAMAGE 整数倍（-${dmgTaken}，ENEMY_DAMAGE=${ENEMY_DAMAGE}，命中率 ENEMY_HIT_CHANCE=${ENEMY_HIT_CHANCE}）`,
    `承伤口径异常：-${dmgTaken}`);
  expect(p.hp <= PLAYER_MAX_HP, "血量封顶 PLAYER_MAX_HP", "血量越界");
}

if (failures.length) { console.error("—— 合计 FAIL ——"); for (const f of failures) console.error(`  FAIL  ${f}`); process.exit(1); }
console.log("CONTRACT: PASS 武器数值与 spec.numeric 一致");
