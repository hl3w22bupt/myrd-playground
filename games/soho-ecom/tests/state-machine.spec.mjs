#!/usr/bin/env node
// state-machine.spec.mjs — 状态机边界对抗断言（E-10 口径，常驻）：
// 非法转移 no-op + warning / 暂停连按 / 结算瞬间输入与动作 / 重开连点 / 中途重开全复位 / 零 NaN 污染。
import { createGame } from "../src/kernel/loop.js";
import { SEED_DEFAULT, SESSION_DAYS, CASH_INITIAL } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— 非法转移全部拒绝 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  ok(g.pause() === false && g.state === "title", "title 态 pause 拒绝");
  ok(g.restart() === false && g.state === "title", "title 态 restart 拒绝");
  ok(g.dispatch("restock", 10).length === 0, "title 态动作派发拒绝（不进内核）");
  g.start();
  ok(g.start() === true && g.state === "playing", "playing 态 start 幂等");
  const w0 = JSON.stringify({ c: g.world.cash, d: g.world.day, p: g.world.dayProgress });
  g.pause();
  g.tick(1); // paused 零推进
  ok(JSON.stringify({ c: g.world.cash, d: g.world.day, p: g.world.dayProgress }) === w0, "paused 态 tick 零推进（时间冻结）");
  ok(g.dispatch("noodle").length === 0, "paused 态动作派发拒绝");
}

// —— 暂停连按 ≥5：状态始终合法，无幽灵态 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  for (let i = 0; i < 5; i++) { g.pause(); g.resume(); }
  ok(g.state === "playing", "暂停/恢复连按 5 轮 → 回到 playing");
  const r = g.tick(0.2);
  ok(r.stepped > 0, "连按后 tick 正常推进（无残留冻结）");
}

// —— 结算瞬间继续输入：over 后内核零推进、动作不再被接受 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.fastForward(SESSION_DAYS + 1);
  ok(g.state === "gameover", "快进一整局 → gameover");
  const before = JSON.stringify(g.world);
  const r = g.tick(0.5);
  ok(JSON.stringify(g.world) === before && r.stepped === 0, "gameover 后 tick 零推进（结算瞬间输入被冻结）");
  ok(g.dispatch("restock", 10).length === 0, "gameover 后动作派发拒绝");
}

// —— 重开连点 ≥5：每次都全复位（E-10：整 world 重建）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.fastForward(5);
  const dirty = g.world.ordersTotal > 0 || g.world.cash !== CASH_INITIAL;
  for (let i = 0; i < 5; i++) ok(g.restart() === true, `重开 #${i + 1} 成功`);
  const w = g.world;
  ok(g.state === "playing", "重开连点后仍在 playing");
  ok(w.cash === CASH_INITIAL && w.inventory === 0 && w.day === 1 && w.ordersTotal === 0
    && w.receivables.length === 0 && w.journal.length === 0 && w.products.every((p) => !p.listed) && w.over === false,
    `重开后全复位（现金/库存/日期/流水/批次/上架${dirty ? "，此前确实有脏状态被清掉" : ""}）`);
  ok(g.warnings.length === 0, "重开连点零 warning（每次都是合法转移）");
}

// —— 中途重开 + 数值健康：极端注入不产生 NaN ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.tick(NaN);
  g.tick(Infinity);
  g.tick(-3);
  g.restart();
  ok(Number.isFinite(g.world.cash) && Number.isFinite(g.world.energy) && Number.isFinite(g.world.day),
    "极端 dt 注入后重开 → 数值有限（无 NaN 污染，E-09）");
  ok(g.world.cash === CASH_INITIAL && g.world.day === 1, "重开数值复位");
}

console.log(failures.length ? `STATE-MACHINE: FAIL（${failures.length}）` : "STATE-MACHINE: PASS");
process.exit(failures.length ? 1 : 0);
