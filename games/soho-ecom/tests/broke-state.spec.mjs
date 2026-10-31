#!/usr/bin/env node
// broke-state.spec.mjs — 趴窝判定（M1 验收 4 的机判）：可触发、可恢复、现金充足不误报、幂等不重复扣费。
// 口径全部来自 M0：brokeRule「可用现金 < 固定开支 + 最低补货 → 趴窝：广告停投 + 无法补货」。
import { createGame } from "../src/kernel/loop.js";
import { isBroke, isTerminal, actionRestock, actionNoodle, actionMeal, createWorld } from "../src/kernel/world.js";
import { settle } from "../src/kernel/ledger.js";
import { SEED_DEFAULT, BROKE_LINE, RENT_PER_DAY, UNIT_COST_WITH_FREIGHT, MIN_RESTOCK_UNITS } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };
const MIN_LOT_COST = MIN_RESTOCK_UNITS * UNIT_COST_WITH_FREIGHT;

// —— 阈值口径：BROKE_LINE = 房租 + 最低补货（30 + 5×40 = 230，调参 v1 最低档 10→5 件，spec.tune.restockLots） ——
ok(BROKE_LINE === RENT_PER_DAY + MIN_LOT_COST, `趴窝线口径 = 固定开支 ${RENT_PER_DAY} + 最低补货 ${MIN_LOT_COST} = ¥${BROKE_LINE}`);

// —— 构造存档（?case=broke 同款）：现金不足 + 回款全部在途 → 稳定触发趴窝 ——
{
  const w = createWorld(SEED_DEFAULT, "broke");
  ok(w.cash < BROKE_LINE && w.receivables.length > 0 && w.inventory === 0, `构造存档成立：现金 ¥${w.cash} < ¥${BROKE_LINE}，回款 ¥${w.receivables[0].amount} 全在途，库存 0`);
  ok(isBroke(w) && w.broke === true, "趴窝状态稳定触发（broke=true）");
  ok(isTerminal(w) === false, "有在途回款时绝不误判终局（趴窝可恢复）");

  // 趴窝中补货被拒绝且不扣费（幂等：连点不重复扣费）
  const cash0 = w.cash;
  const r1 = actionRestock(w, 10, []);
  const r2 = actionRestock(w, 10, []);
  ok(r1.ok === false && r2.ok === false && w.cash === cash0 && w.inventory === 0, `趴窝中补货两次全拒（现金保持 ¥${w.cash}，无重复扣费）`);

  // 按指引处置：等在途回款到账 → 趴窝自动解除 → 可继续循环（补货成功）
  const g = createGame({ seed: SEED_DEFAULT, scenario: "broke" });
  g.start();
  const until = () => { for (let d = 0; d < 20 && g.world.broke; d++) g.fastForward(1); };
  until();
  const after = g.world;
  ok(after.broke === false && after.cash >= BROKE_LINE, `按指引等待后趴窝解除（现金 ¥${Math.round(after.cash)} ≥ ¥${BROKE_LINE}，回款自动转现金）`);
  const r3 = actionRestock(after, 10, []);
  ok(r3.ok === true && after.inventory === 10, `解除后恢复经营：补货 10 件成功（库存=${after.inventory}）`);
}

// —— 现金充足不误报 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  ok(g.world.broke === false && isBroke(g.world) === false, `开局 ¥${g.world.cash} 不误报趴窝`);
  g.dispatch("restock", 50); // 首批 ¥2000 → 剩 ~1500 仍 > 230
  ok(g.world.cash >= BROKE_LINE && g.world.broke === false, `首批补货后现金 ¥${Math.round(g.world.cash)} 仍不误报`);
}

// —— 趴窝沿不抖动：阈值附近不反复进出（状态机健康） ——
{
  const w = createWorld(SEED_DEFAULT);
  const evs = [];
  w.cash = BROKE_LINE + 1; // 测试侧直接构造阈值邻域（内核侧仍只经 settle 改值）
  const seq = [];
  for (const c of [BROKE_LINE + 0.5, BROKE_LINE - 0.5, BROKE_LINE + 0.5]) {
    // 模拟资金小幅波动：到账/消费
    if (c < w.cash) settle(w, { kind: "test-spend", from: "cash", to: "expense", amount: w.cash - c });
    else settle(w, { kind: "test-income", from: "market", to: "cash", amount: c - w.cash });
    const nowBroke = isBroke(w);
    if (seq.length === 0 || seq[seq.length - 1] !== nowBroke) seq.push(nowBroke);
  }
  ok(seq.filter((b) => b === true).length === 1, `阈值邻域波动下趴窝沿清晰（进入沿 ${seq.filter((b) => b === true).length} 次：${seq.join("→")}）`);
}

// —— 终局（资金链断裂）只在三路全封死时触发 ——
{
  // 路 A：有库存可售 → 不判负
  let w = createWorld(SEED_DEFAULT, "broke");
  w.receivables = [];
  w.inventory = 5;
  w.energy = 100;
  ok(isTerminal(w) === false, "趴窝+无回款但有库存可售 → 不判终局");
  // 路 B：精力不足但够自救启动金（¥55）→ 不判负
  w.inventory = 0;
  w.energy = 0;
  w.cash = 55;
  ok(isTerminal(w) === false, "精力为 0 但现金 ≥ 自救启动金 ¥55 → 不判终局");
  // 路 C：全封死 → 判负
  w.cash = 54;
  ok(isTerminal(w) === true, "无现金(¥54<¥55)无回款无库存且精力枯竭 → 资金链断裂");
}

// —— 省钱指引真实有效：泡面/睡车里在趴窝期可用 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "broke" });
  g.start();
  g.world.cash = 50; // 测试侧构造：仅够泡面×2 + 睡车里（免费）
  const before = g.world.cash;
  ok(actionNoodle(g.world, []).ok === true && g.world.cash === before - 5, "趴窝期泡面可用（¥5）");
  ok(g.dispatch("sleepVan").length > 0, "趴窝期睡车里可用（免费回精，饱腹 >0 前提）");
}

console.log(failures.length ? `BROKE-STATE: FAIL（${failures.length}）` : "BROKE-STATE: PASS");
process.exit(failures.length ? 1 : 0);
