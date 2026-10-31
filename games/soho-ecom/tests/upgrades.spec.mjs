#!/usr/bin/env node
// upgrades.spec.mjs — M2 升级线契约（M2 验收 3「解锁正确 + 连点防重复扣费」的机判）：
// ① rich 构造存档（现金 ¥8000 = RICH_SCENARIO_CASH > P1 解锁线，调参 v1）直接落在 P1 阶段；
// ② 海外仓升级：花费 ¥3000、一次性开关、连点 10 次仅扣 1 次、升级后补货 ¥20/件（毛利 ¥15→¥35）；
// ③ SOHO 住房升级：花费 ¥3000、房租档位 ¥30→¥60/日（M0 #13 随档位变化）、睡车里→睡家里（精力 +60、无心情代价）；
// ④ 解锁守卫：P0 阶段/趴窝/现金不足一律拒绝且零扣费；
// ⑤ 趴窝线随档位动态取值（口径 = 固定开支 + 最低补货档，床位档 230：调参 v1 最低档 5 件，spec.tune.restockLots）。
import { createGame } from "../src/kernel/loop.js";
import { stepWorld } from "../src/kernel/world.js";
import { restockUnitCost, rentPerDay, brokeLine, upgradeGuard } from "../src/kernel/upgrades.js";
import {
  SEED_DEFAULT, WAREHOUSE_UPGRADE_COST, HOUSING_SOHO_COST,
  WAREHOUSE_UNIT_COST, UNIT_COST_WITH_FREIGHT, RENT_PER_DAY, RENT_SOHO_PER_DAY,
  SLEEP_HOME_ENERGY, MIN_RESTOCK_UNITS, BROKE_LINE, P1_CASH_LINE, CASH_INITIAL,
  RICH_SCENARIO_CASH,
} from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— ① rich 存档 + ② 海外仓升级 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "rich" });
  g.start();
  const w = g.world;
  ok(w.cash === RICH_SCENARIO_CASH && w.stage === "P1", `rich 构造存档：现金 ¥${RICH_SCENARIO_CASH} > 解锁线 ¥${P1_CASH_LINE}，阶段直达 P1（stage=${w.stage}）`);
  ok(upgradeGuard(w, "warehouse").ok === true, "P1 阶段海外仓升级入口可用");

  const done = g.dispatch("upgradeWarehouse");
  ok(done.some((e) => e.type === "upgrade" && e.id === "warehouse"), "升级事件派发成功");
  ok(w.upgrades.warehouse === true && w.cash === RICH_SCENARIO_CASH - WAREHOUSE_UPGRADE_COST, `海外仓升级落账：扣费 ¥${WAREHOUSE_UPGRADE_COST}（${RICH_SCENARIO_CASH} → ${w.cash}）`);
  const kind = w.journal.find((e) => e.kind === "upgrade-warehouse");
  ok(kind?.amount === WAREHOUSE_UPGRADE_COST && kind?.to === "expense", "升级扣费走唯一结算入口（journal kind=upgrade-warehouse）");

  // 连点 10 次仅扣 1 次（一次性开关守卫）
  const cashAfterFirst = w.cash;
  for (let i = 0; i < 10; i++) g.dispatch("upgradeWarehouse");
  ok(w.cash === cashAfterFirst, `升级确认处连点 10 次仅扣费 1 次（现金稳定 ¥${w.cash}）`);
  ok(upgradeGuard(w, "warehouse").ok === false, "已升级后守卫拒绝（不重复扣费）");

  // 升级效果：补货 ¥20/件 → 出单毛利 ¥35（= P1 单位经济锚）
  ok(restockUnitCost(w) === WAREHOUSE_UNIT_COST, `头程成本结构变化：补货 ¥${UNIT_COST_WITH_FREIGHT} → ¥${restockUnitCost(w)}/件`);
  ok(55 - restockUnitCost(w) === 35, `单位经济 ¥15/单 → ¥${55 - restockUnitCost(w)}/单（stageCurve P1 锚）`);
  const restocked = g.dispatch("restock", 10);
  ok(restocked.some((e) => e.type === "restock" && e.cost === 10 * WAREHOUSE_UNIT_COST), `海外仓补货 10 件 = ¥${10 * WAREHOUSE_UNIT_COST}（¥20/件）`);
}

// —— ③ SOHO 住房升级：房租档位 + 睡家里 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "rich" });
  g.start();
  const w = g.world;
  const cashBeforeHousing = w.cash;
  const done = g.dispatch("upgradeHousing");
  ok(done.some((e) => e.type === "upgrade" && e.id === "housingSoho") && w.upgrades.housingSoho === true, "SOHO 一人居升级成功");
  ok(w.cash === cashBeforeHousing - HOUSING_SOHO_COST, `住房升级扣费 ¥${HOUSING_SOHO_COST}（${cashBeforeHousing} → ${w.cash}）`);
  for (let i = 0; i < 10; i++) g.dispatch("upgradeHousing");
  ok(w.cash === cashBeforeHousing - HOUSING_SOHO_COST, `住房升级连点 10 次仅扣费 1 次（现金稳定 ¥${w.cash}）`);

  // 房租档位：下一日结算按 ¥60（M0 #13 床位档起 → SOHO ×2）
  ok(rentPerDay(w) === RENT_SOHO_PER_DAY, `房租档位 ¥${RENT_PER_DAY} → ¥${rentPerDay(w)}/日`);
  const dayBefore = w.day;
  let steps = 0;
  while (w.day === dayBefore && steps++ < 240) stepWorld(w, 1 / 240); // 快进到下一日上午（房租结算点）
  const rent = w.journal.filter((e) => e.kind === "rent").at(-1);
  ok(rent?.amount === RENT_SOHO_PER_DAY && rent?.ref?.housingTier === "soho", `SOHO 房租逐日 ¥${rent?.amount}（journal ref.housingTier=soho）`);

  // 睡家里：免费、精力 +60、无心情代价（睡车里的心情 −5 不再发生）
  w.satiety = 100;
  w.energy = 10;
  const moodBefore = w.mood;
  const slept = g.dispatch("sleepVan");
  ok(slept.some((e) => e.type === "sleep-home") && w.energy === 10 + SLEEP_HOME_ENERGY, `睡家里：精力 10 → ${w.energy}（+${SLEEP_HOME_ENERGY}，免费）`);
  ok(w.mood === moodBefore, `睡家里无心情代价（心情保持 ${w.mood}）`);
  ok(w.journal.some((e) => e.kind === "sleep-home"), "睡家里走结算入口（journal kind=sleep-home）");
}

// —— ④ 解锁守卫：P0 / 现金不足 / 趴窝 ——
{
  const g = createGame({ seed: SEED_DEFAULT }); // fresh：P0
  g.start();
  const w = g.world;
  ok(g.dispatch("upgradeWarehouse").length === 0 && g.dispatch("upgradeHousing").length === 0, "P0 阶段两项升级全拒（现金未达解锁线）");
  ok(w.cash === CASH_INITIAL && w.upgrades.warehouse === false, `被拒升级零扣费（现金 ¥${CASH_INITIAL} 分文不动）`);
  // 现金够但趴窝态（测试侧构造存档：现金 100 < 趴窝线，阶段 P1）
  w.cash = 100;
  w.broke = true;
  w.stage = "P1";
  ok(upgradeGuard(w, "warehouse").ok === false, "趴窝中升级被拒（现金即便够也不可升级）");
}

// —— ⑤ 趴窝线随档位动态取值（床位档 = 230：口径「固定开支 + 最低补货档」不变，最低档 5 件为调参 v1）——
{
  const w = createGame({ seed: SEED_DEFAULT }).world;
  ok(brokeLine(w) === BROKE_LINE && brokeLine(w) === RENT_PER_DAY + MIN_RESTOCK_UNITS * UNIT_COST_WITH_FREIGHT, `床位档趴窝线 = ¥${brokeLine(w)}（固定开支 + 最低补货，与 M1 口径一致）`);
  w.upgrades.warehouse = true;
  ok(brokeLine(w) === RENT_PER_DAY + MIN_RESTOCK_UNITS * WAREHOUSE_UNIT_COST, `海外仓档趴窝线 = ¥${brokeLine(w)}（最低补货按 ¥20/件 折算）`);
  w.upgrades.housingSoho = true;
  ok(brokeLine(w) === RENT_SOHO_PER_DAY + MIN_RESTOCK_UNITS * WAREHOUSE_UNIT_COST, `SOHO+海外仓档趴窝线 = ¥${brokeLine(w)}（固定开支按 ¥60 折算）`);
}

console.log(failures.length ? `UPGRADES: FAIL（${failures.length}）` : "UPGRADES: PASS");
process.exit(failures.length ? 1 : 0);
