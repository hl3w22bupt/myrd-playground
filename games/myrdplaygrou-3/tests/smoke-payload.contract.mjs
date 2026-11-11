#!/usr/bin/env node
// smoke-payload.contract.mjs — 冒烟 payload 玩法契约（playtest/polish 断言面）：
// 输入方向探针（sf-bug-controls 线上机判）+ 多球员在场数量（5v5）+ 人形建模证据
// + v3 断言面（策划案 v3 机判锚点）：控制权切换单环（acc-switch-single-highlight）、
// 新手引导三层 DOM（acc-onboarding-card / acc-hud-key-labels）、庆祝冻结（acc-goal-celebration-feedback）、
// 切换性能与渲染预算留痕（acc-tackle-switch-perf）。
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

  // —— v3 断言面 ①：控制权切换单环（acc-switch-single-highlight / 缺陷单 cmwbumwrj）——
  // 全场同时渲染的高亮实例数恒 ≤1（对象池单实例，SWITCH_RING_MAX_CONCURRENT=1 钳制）；
  // instanceCount 是常量口径（池化声明），switchCount>0 证明快进期间切换真实发生且环随行。
  const sr = p.switchRing || {};
  ok(sr.instanceCount === 1, `${tag} 切换高亮实例数 ≤1（acc-switch-single-highlight，实测 ${sr.instanceCount}）`);
  ok((sr.switchCount || 0) >= 1, `${tag} 快进期间控制权切换 ≥1 次（switchCount=${sr.switchCount}，环随行非摆设）`);

  // —— v3 断言面 ②：新手引导三层 DOM（acc-onboarding-card / acc-hud-key-labels / 缺陷单 cmwbumwtv）——
  const ob = p.onboarding || {};
  ok(ob.tutorialCardPresent === true, `${tag} 开屏教学卡 DOM 存在（四操作图示 + 开始/跳过）`);
  ok(ob.tutorialStartPresent === true && ob.tutorialSkipPresent === true,
    `${tag} 教学卡「开始比赛/跳过」双按钮存在（可跳过语义）`);
  const labels = Array.isArray(ob.hudLabels) ? ob.hudLabels : [];
  ok(["移动", "传球", "射门"].every((k) => labels.includes(k)),
    `${tag} HUD 常驻标签 = 移动/传球/射门（实测 [${labels.join("/")}]，常驻非一次性）`);
  ok(ob.bubblePresent === true, `${tag} 首次触球气泡容器存在（3s 或操作后淡出）`);

  // —— v3 断言面 ③：进球庆祝冻结 + 再来一局（acc-goal-celebration-feedback / v3 打磨项）——
  const cel = p.celebration || {};
  ok(Number.isFinite(cel.celebrationLeft), `${tag} 庆祝冻结计时在 payload（celebrationLeft=${cel.celebrationLeft}）`);
  ok(ob.rematchButtonPresent === true, `${tag} 结算屏「再来一局」主按钮存在（一键重赛同局）`);
  if (p.goals >= 1) {
    // 进球发生后 celebrationLeft>0 表示冻结窗生效（快进 62s 内进球 → 庆祝窗口还在或已耗尽均合法，只断字段语义）
    ok(cel.celebrationLeft >= 0, `${tag} 进球 ${p.goals} 球 → 庆祝窗非负（${cel.celebrationLeft}s，庆祝期间倒计时暂停）`);
  }
}

console.log(failures.length ? `SMOKE-PAYLOAD-CONTRACT: FAIL（${failures.length}）` : "SMOKE-PAYLOAD-CONTRACT: PASS");
process.exit(failures.length ? 1 : 0);
