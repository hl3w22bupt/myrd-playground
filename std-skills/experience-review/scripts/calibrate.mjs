#!/usr/bin/env node
// calibrate.mjs — 判定器 vs 人类评分一致率校准（审美官「转正考核」，G3）。
//
// 协议对齐 eval-core S1 shadow 模式：≥20 个配对且 ±1 一致率 ≥90% 才 ENFORCE_ELIGIBLE，
// 否则保持 SHADOW（advisory-only）。ENFORCE_ELIGIBLE 只是「有资格申请转正」，
// 是否真的把审美官升级为硬性关卡（分数不够打回）由人类拍板。
//
// 用法：
//   node calibrate.mjs --packs <包根目录> --human <人类评分.json>
//   人类评分.json：{ "<包目录名>": { "score": 1-5 }, ... }（问卷/星级评分导出，未来可接 ArtifactRating）
// 扫描 <包根目录>/*//review.json，与人类评分按目录名配对。
// 退出码：0 = 校准完成（结果 informational，不做门禁）；2 = 用法错误。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const packsRoot = flag("--packs");
const humanPath = flag("--human");
if (!packsRoot || !humanPath) {
  console.error("用法: node calibrate.mjs --packs <包根目录> --human <人类评分.json>");
  process.exit(2);
}
if (!existsSync(packsRoot)) { console.error(`包根目录不存在: ${packsRoot}`); process.exit(2); }
let human;
try { human = JSON.parse(readFileSync(humanPath, "utf-8")); }
catch (e) { console.error(`人类评分文件解析失败: ${e.message}`); process.exit(2); }

// —— 配对：包目录名 → (judge overall, human score) ——
const pairs = [];
const skipped = [];
for (const name of readdirSync(packsRoot, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const reviewPath = path.join(packsRoot, name.name, "review.json");
  const h = human[name.name];
  if (!existsSync(reviewPath)) { if (h) skipped.push(`${name.name}: 无 review.json`); continue; }
  if (!h || !Number.isInteger(h.score) || h.score < 1 || h.score > 5) { skipped.push(`${name.name}: 人类评分缺失或非法`); continue; }
  let review;
  try { review = JSON.parse(readFileSync(reviewPath, "utf-8")); }
  catch { skipped.push(`${name.name}: review.json 解析失败`); continue; }
  const j = review?.overall?.score;
  if (!Number.isInteger(j) || j < 1 || j > 5) { skipped.push(`${name.name}: review.overall.score 非法`); continue; }
  pairs.push({ pack: name.name, judge: j, human: h.score, delta: j - h.score });
}

// —— 一致率：±1 口径（5 分制上 ±1 视为一致，同 eval-core ±10 分/百分制折算的宽容度） ——
const within1 = pairs.filter((p) => Math.abs(p.delta) <= 1);
const exact = pairs.filter((p) => p.delta === 0);
const within1Rate = pairs.length ? within1.length / pairs.length : 0;
const exactRate = pairs.length ? exact.length / pairs.length : 0;
const meanDelta = pairs.length ? pairs.reduce((a, p) => a + p.delta, 0) / pairs.length : 0;
const MIN_PAIRS = 20;
const MIN_WITHIN1 = 0.9;
const eligible = pairs.length >= MIN_PAIRS && within1Rate >= MIN_WITHIN1;

const result = {
  schemaVersion: 1,
  kind: "perceptual-advisory-calibration",
  protocol: { minPairs: MIN_PAIRS, minWithin1Rate: MIN_WITHIN1, tolerance: "±1 (5分制)" },
  pairs: pairs.length,
  within1Rate: Number(within1Rate.toFixed(4)),
  exactRate: Number(exactRate.toFixed(4)),
  meanDelta: Number(meanDelta.toFixed(3)),
  mode: eligible ? "ENFORCE_ELIGIBLE" : "SHADOW",
  eligible,
  skipped: skipped.slice(0, 20),
  note: eligible
    ? "有资格申请转正（ENFORCE）：转正与否由人类拍板；rubric 或打分习惯变更后必须重跑校准"
    : pairs.length < MIN_PAIRS
      ? `配对不足（${pairs.length}/${MIN_PAIRS}）——继续 SHADOW，攒人类评分`
      : `±1 一致率 ${(within1Rate * 100).toFixed(1)}% < ${MIN_WITHIN1 * 100}%——品味尚未证明，保持 SHADOW`,
};
console.log(JSON.stringify(result, null, 2));
process.exit(0);
