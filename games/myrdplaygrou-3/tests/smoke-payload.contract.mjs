#!/usr/bin/env node
// smoke-payload.contract.mjs — 冒烟 payload 玩法契约（playtest/polish 断言面）：
// 输入方向探针（sf-bug-controls 线上机判）+ 多球员在场数量（5v5）+ 人形建模证据。
// 数据源 = qa/smoke/report.json（browser-smoke.mjs 双视口跑完落盘）；缺报告时 SKIP 不拦（先建后断）。
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const reportPath = path.join(root, "qa", "smoke", "report.json");

if (!existsSync(reportPath)) {
  console.log("  SKIP  qa/smoke/report.json 不存在（先跑 browser-smoke.mjs 生成双视口报告）—— 本契约在冒烟后复跑断言");
  console.log("SMOKE-PAYLOAD-CONTRACT: SKIP");
  process.exit(0);
}

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const viewports = Array.isArray(report.viewports) ? report.viewports : [];
ok(viewports.length === 2, `双视口报告齐备（实测 ${viewports.length} 个视口）`);

for (const vp of viewports) {
  const tag = `[${vp.id}]`;
  const p = vp.payload;
  if (!p) { ok(false, `${tag} payload 缺失`); continue; }

  // —— 输入方向（缺陷单 sf-bug-controls 的线上机判）：探针符号全部正确 ——
  const ip = p.inputProbe;
  ok(!!ip && ip.ok === true, `${tag} inputProbe 方向探针存在且自判通过（${ip ? `ok=${ip.ok}` : "缺失"}）`);
  ok(!!ip && ip.leftDx < 0, `${tag} 按左 → 向屏幕左（leftDx=${ip ? ip.leftDx?.toFixed(3) : "?"} < 0）`);
  ok(!!ip && ip.rightDx > 0, `${tag} 按右 → 向屏幕右（rightDx=${ip ? ip.rightDx?.toFixed(3) : "?"} > 0）`);
  ok(!!ip && ip.upDz < 0 && ip.downDz > 0, `${tag} 上下轴符号正确（upDz=${ip ? ip.upDz?.toFixed(3) : "?"}，downDz=${ip ? ip.downDz?.toFixed(3) : "?"}）`);

  // —— 多球员在场数量（5v5 量级）+ 两队 ——
  ok(p.playersOnField === 10, `${tag} 在场球员 = ${p.playersOnField}（5v5 = 10）`);
  ok(p.teams === 2, `${tag} 队伍数 = ${p.teams}（两队）`);

  // —— 人形建模证据（程序化关节人形）：每球员段件数与 drawCalls 留痕 ——
  const r = p.render || {};
  ok((r.playerSegments || 0) >= 10 * 12, `${tag} 人形段件 ≥120（10 人 × ≥12 件，实测 ${r.playerSegments}）`);
  ok(Number.isFinite(r.drawCalls) && r.drawCalls > 0, `${tag} drawCalls 留痕（${r.drawCalls}）`);

  // —— 对局活力（自动驾驶快进必须产生真实足球事件）——
  ok(p.possessionChanges >= 5, `${tag} 球权易手 ≥5（实测 ${p.possessionChanges}）`);
  ok(p.shots >= 1, `${tag} 射门 ≥1（实测 ${p.shots}）`);
}

console.log(failures.length ? `SMOKE-PAYLOAD-CONTRACT: FAIL（${failures.length}）` : "SMOKE-PAYLOAD-CONTRACT: PASS");
process.exit(failures.length ? 1 : 0);
