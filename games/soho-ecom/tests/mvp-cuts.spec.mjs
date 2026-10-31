#!/usr/bin/env node
// mvp-cuts.spec.mjs — 三刀收敛核对（M1 验收 5 机判）+ M2 进场范围核对（M2 验收 5 机判）。
// 【M2 变更依据】README「派生下一里程碑」指引第 2 条：M1 被三刀裁掉的事件流/升级线/广告在 M2 恢复进场，
//   恢复时删除黑名单对应条目并说明依据 —— 依据 = M2 需求（goal-cmvv02e7a0019m9uwy2nosbkn / req cmvv7a5bf0016m9ycmvnyohyk）
//   + spec.numeric.events 8 类事件表 / exchangeRates #9 / stageCurve P0→P1（数值逐条对号，见下方 M2 断言组）。
// 刀1 三资源 = 精力/现金/店铺健康（M2：心情进场但**仅作纯事件修正器**，非管理资源；信誉并入店铺健康仍缺席）；
// 刀2 库存一条公式不变（补货入库 / 出单出货两条方向，M2 未新增库存操作）；
// 刀3 回款周期固定 T+14 不变（M2 的批次平移是事件效果的流水留痕，不是第二个回款周期值）。
// M2 仍禁（需求非目标）：P2/P3 内容（招运营/回款垫资/T+7/多店铺/融资上市/品牌备案/自建站/办公室/江景）与汇率波动。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  PAYOUT_CYCLE_DAYS, SESSION_DAYS, SECONDS_PER_GAME_DAY,
  P1_CASH_LINE, UNIT_ECONOMY_P0, UNIT_ECONOMY_P1,
  AD_COST_PER_CAST, AD_EXPECTED_ORDERS,
  WAREHOUSE_UPGRADE_COST, HOUSING_SOHO_COST, RENT_SOHO_PER_DAY, RENT_PER_DAY, WAREHOUSE_UNIT_COST,
} from "../src/numeric.js";
import { PRODUCTS } from "../src/levels/products.js";
import { EVENT_DEFS } from "../src/kernel/events.js";
import { UPGRADE_DEFS } from "../src/kernel/upgrades.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };
const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "..", "src");

const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const allCode = walk(srcDir).map((f) => ({
  f: path.relative(srcDir, f),
  // 剥注释再扫：注释里的口径说明（如「广告停投」原文引用 M0）不算实现进场
  code: readFileSync(f, "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""),
}));

// —— 刀1：三资源在场 ——
ok(existsSync(path.join(srcDir, "numeric.js"))
  && /ENERGY_MAX|ENERGY_PER_ORDER/.test(readFileSync(path.join(srcDir, "numeric.js"), "utf8"))
  && /SHOP_HEALTH_MAX/.test(readFileSync(path.join(srcDir, "numeric.js"), "utf8"))
  && /CASH_INITIAL/.test(readFileSync(path.join(srcDir, "numeric.js"), "utf8")),
  "刀1 三资源数值在场（精力 / 现金 / 店铺健康）");

// —— 刀1b：心情仅作纯事件修正器（M2 需求范围 2），非管理资源 ——
const MOOD_ALLOW = new Set([
  "kernel/events.js",   // 心情由事件写入（shiftMood 唯一通道）
  "kernel/world.js",    // 睡车里 moodDelta（M0 #5）+ 需求乘数
  "numeric.js",         // 修正器参数镜像
  "render/hud.js",      // 徽标展示
  "render/scene.js",    // 事件粒子色映射
  "main.js",            // 装配根：事件弹窗效果文案的账户名映射（纯展示）
]);
const moodStray = allCode.filter(({ f, code }) => /mood|心情/.test(code) && !MOOD_ALLOW.has(f));
ok(moodStray.length === 0, moodStray.length === 0
  ? "心情修正器只存在于事件引擎/数值镜像/内核世界/表现层（无越界进场）"
  : `心情代码越界：${moodStray.map((x) => x.f).join("、")}`);
const moodResource = allCode.filter(({ code }) => /MOOD_MAX|moodMax|心情上限|moodBar|mood-fill|moodRestore|mood-restore/.test(code));
ok(moodResource.length === 0, moodResource.length === 0
  ? "心情无管理资源形态（无上限资源/无恢复动作/无资源条）"
  : `心情被实现成管理资源：${moodResource.map((x) => x.f).join("、")}`);
const reputationish = allCode.filter(({ code }) => /reputation|信誉/.test(code));
ok(reputationish.length === 0, reputationish.length === 0
  ? "信誉并入店铺健康（无独立信誉资源）"
  : `发现独立信誉系统：${reputationish.map((x) => x.f).join("、")}`);

// —— 刀2：库存一条公式（唯一入库动作 = restock，唯一出库动作 = 出单出货） ——
const invMutators = allCode.filter(({ code }) => /inventory\s*(\+=|-=)/.test(code));
ok(invMutators.length === 0, invMutators.length === 0
  ? "刀2 库存无直接算术改值（一切经 settle() 的池转移）"
  : `发现库存直改：${invMutators.map((x) => x.f).join("、")}`);
const inventoryActions = new Set(
  allCode.flatMap(({ code }) => [...code.matchAll(/kind:\s*"(restock-goods|order-ship)"/g)].map((m) => m[1])),
);
ok(inventoryActions.size === 2 && inventoryActions.has("restock-goods") && inventoryActions.has("order-ship"),
  "刀2 库存变更只有两条：补货入库 / 出单出货（M2 未新增库存操作，海外仓只改单价不改公式）");

// —— 刀3：T+14 唯一 ——
ok(PAYOUT_CYCLE_DAYS === 14, "刀3 回款周期 PAYOUT_CYCLE_DAYS = 14（唯一值）");
const otherCycles = allCode.filter(({ code }) => /T\+7|cycleUpgrade|cycle-upgrade|payout-advance|垫资|toDays|fromDays/.test(code));
ok(otherCycles.length === 0, otherCycles.length === 0
  ? "刀3 无 T+7 / 回款垫资 / 周期升级（P2 内容未提前进场）"
  : `发现回款周期变体：${otherCycles.map((x) => x.f).join("、")}`);

// —— M2 仍禁：P2/P3 内容与汇率波动（需求非目标，零出现） ——
const FORBIDDEN = [
  ["招运营/自动回评（P2）", /招运营|hire-operator|自动回评/],
  ["多店铺/融资上市（P3）", /multi-store|multiStore|融资|上市|ipo|品牌备案|自建站|江景/],
  ["汇率波动（P2 前关闭）", /fxSwing|fx-swing|fxMode|汇率波动|汇率\s*[±+*-]/],
  ["办公室档住房（P3）", /办公室/],
];
for (const [name, re] of FORBIDDEN) {
  const hits = allCode.filter(({ code }) => re.test(code));
  ok(hits.length === 0, hits.length === 0
    ? `M2 非目标缺席：${name}`
    : `非目标内容出现在源码：${name} → ${hits.map((x) => x.f).join("、")}`);
}

// —— M2 进场项数值对号（spec 逐条锚定，误差 0） ——
{
  // 事件表：奇葩 4 类可 roll + 暖心 3 类（含海外仓及时补货）+ 状态型旺季断货；汇率波动不在表内
  const ids = EVENT_DEFS.map((d) => d.id);
  const required = ["follow-seller", "bad-reviewer", "freight-delay", "customs-check",
    "peak-stockout", "five-star-rebuy", "organic-hit", "warehouse-restock"];
  for (const id of required) ok(ids.includes(id), `M2 事件表含「${id}」（spec.numeric.events 对号）`);
  ok(!ids.includes("fx-swing"), "汇率波动不进 M2 事件表");
  // 广告（M0 #9 原文）
  ok(AD_COST_PER_CAST === 10 && AD_EXPECTED_ORDERS === 1.5, `广告 ¥${AD_COST_PER_CAST} → 期望 +${AD_EXPECTED_ORDERS} 单（exchangeRates.ads #9 原文；ACOS = 10/(1.5×15) ≈ 0.45 自洽）`);
  // 阶段曲线（stageCurve 原文）
  ok(P1_CASH_LINE === 5000 && UNIT_ECONOMY_P0 === 15 && UNIT_ECONOMY_P1 === 35, `阶段曲线：P0 ¥${UNIT_ECONOMY_P0}/单 → P1 ¥${UNIT_ECONOMY_P1}/单，解锁线现金 ¥${P1_CASH_LINE}`);
  // 升级线（spec.m2.upgrades 派生口径）
  ok(WAREHOUSE_UPGRADE_COST === 3000 && HOUSING_SOHO_COST === 3000, `升级花费各 ¥${WAREHOUSE_UPGRADE_COST}（1.5× 首批进货锚 #7 派生）`);
  ok(RENT_SOHO_PER_DAY === RENT_PER_DAY * 2, `SOHO 房租 ¥${RENT_SOHO_PER_DAY}/日（锚 #13 床位档 ¥${RENT_PER_DAY} × 2 档位）`);
  ok(WAREHOUSE_UNIT_COST === 20, `海外仓单件头程 ¥${WAREHOUSE_UNIT_COST}（毛利 ¥15→¥35 = stageCurve P1 反推）`);
  ok(UPGRADE_DEFS.length === 2, "升级线只有第一档两项（P2/P3 升级档零出现）");
}

// —— M1 范围锚：商品目录 ≤4（P0 一店四链接规模）、一局 30 日、1× = 75s/日 ——
ok(PRODUCTS.length === 4, `选品目录 4 个商品（P0 规模，无多店铺矩阵）`);
ok(SESSION_DAYS === 30, `一局 30 游戏日（覆盖 ≥2 轮完整 T+14 循环）`);
ok(SECONDS_PER_GAME_DAY === 75, `M0 时间口径：1× 下 1 游戏日 = 75 真实秒`);

console.log(failures.length ? `MVP-CUTS: FAIL（${failures.length}）` : "MVP-CUTS: PASS");
process.exit(failures.length ? 1 : 0);
