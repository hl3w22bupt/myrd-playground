#!/usr/bin/env node
// validate-review.mjs — 审美官评审的落库门禁：schema + 证据链 + 总分机械推导。
// 与 verification skill「没过门禁的报告不允许落库」同款纪律：exit 0 才许把 advisory
// 写进目标产物 / 供校准消费；任何一条不合规 → exit 1 并列出全部问题（一次改完，不来回）。
//
// 用法：node validate-review.mjs <packDir>
//   <packDir>/review.json 为被检对象；包内文件（steps/、video/frames/）用于证据链存在性核对。
// 退出码：0 = REVIEW_VALID: PASS；1 = 评审不合规（按清单修正后重跑）；2 = 用法/环境错误。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DIMENSION_IDS = ["palette", "typography", "composition", "motion", "polish"];
const SEVERITIES = new Set(["major", "minor"]);

const packDir = process.argv[2];
if (!packDir) { console.error("用法: node validate-review.mjs <packDir>"); process.exit(2); }
const reviewPath = path.join(packDir, "review.json");
if (!existsSync(reviewPath)) { console.error(`REVIEW_INVALID: 缺少 ${reviewPath}`); process.exit(1); }

let review;
try { review = JSON.parse(readFileSync(reviewPath, "utf-8")); }
catch (e) { console.error(`REVIEW_INVALID: review.json 解析失败 —— ${e.message}`); process.exit(1); }

const problems = [];
const push = (msg) => problems.push(msg);

// —— 顶层必填 ——
if (review.schemaVersion !== 1) push(`schemaVersion 必须为 1（收到 ${JSON.stringify(review.schemaVersion)}）`);
if (review.kind !== "perceptual-advisory") push(`kind 必须为 perceptual-advisory（收到 ${JSON.stringify(review.kind)}）`);
if (review.advisoryOnly !== true) push("advisoryOnly 必须为 true —— advisory 评审禁止携带拦截语义（用户拍板 D1）");
if (!review.target || typeof review.target.packDir !== "string" || !review.target.packDir) push("target.packDir 必填（评审与证据同源）");
if (typeof review.generatedBy !== "string" || !review.generatedBy) push("generatedBy 必填（溯源：谁评的）");

// —— 五维：集合精确、分数 1-5 整数、issue 结构与证据链 ——
const dims = Array.isArray(review.dimensions) ? review.dimensions : [];
const dimIds = dims.map((d) => d?.id);
for (const id of DIMENSION_IDS) {
  if (!dimIds.includes(id)) push(`缺维度 ${id}（五维齐全才许落库）`);
}
const extras = dimIds.filter((id) => !DIMENSION_IDS.includes(id));
if (extras.length) push(`未知维度：${extras.join("、")}（只允许 ${DIMENSION_IDS.join("/")}`);
if (new Set(dimIds).size !== dimIds.length) push("维度 id 重复");

for (const d of dims) {
  if (!Number.isInteger(d?.score) || d.score < 1 || d.score > 5) push(`维度 ${d?.id}: score 必须是 1-5 整数（收到 ${JSON.stringify(d?.score)}）`);
  if (typeof d?.summary !== "string" || d.summary.trim().length < 4) push(`维度 ${d?.id}: summary 缺失或过短（写明依据，写不了说明没看够）`);
  for (const [i, issue] of (Array.isArray(d?.issues) ? d.issues : []).entries()) {
    if (!SEVERITIES.has(issue?.severity)) push(`维度 ${d.id} issues[${i}]: severity 必须是 major/minor`);
    if (typeof issue?.finding !== "string" || issue.finding.trim().length < 5) push(`维度 ${d.id} issues[${i}]: finding 缺失或过短（描述看到了什么）`);
    if (typeof issue?.suggestion !== "string" || issue.suggestion.trim().length < 3) push(`维度 ${d.id} issues[${i}]: suggestion 必填（advisory 的价值在改法）`);
    // 证据链：evidence 首个路径 token 必须是包内真实存在的文件（文件名可含中文标签）
    const match = String(issue?.evidence ?? "").match(/([\w./\u4e00-\u9fff-]+\.(?:png|jpe?g))/i);
    if (!match) {
      push(`维度 ${d.id} issues[${i}]: evidence 必须引用包内图片文件（如 steps/02-初始画面.png + 位置描述）`);
    } else if (!existsSync(path.join(packDir, ...match[1].split("/")))) {
      push(`维度 ${d.id} issues[${i}]: evidence 引用的文件不在包内 —— ${match[1]}（凭空意见不落库）`);
    }
  }
}

// —— overall：机械推导核对（禁手填漂移） ——
const scores = dims.filter((d) => Number.isInteger(d?.score)).map((d) => d.score);
if (scores.length === DIMENSION_IDS.length) {
  const expected = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  if (review.overall?.score !== expected) {
    push(`overall.score 必须等于五维均值的四舍五入（期望 ${expected}，收到 ${JSON.stringify(review.overall?.score)}）`);
  }
}
const vt = review.overall?.verdictText;
if (typeof vt !== "string" || vt.trim().length < 4 || vt.length > 80) push("overall.verdictText 必填且 ≤80 字（一句话结论）");

// —— topIssues：最多 3 条，finding 必须来自某维 issues（不许凭空造「头条」） ——
const allFindings = dims.flatMap((d) => (Array.isArray(d?.issues) ? d.issues : []).map((x) => x.finding));
for (const [i, t] of (Array.isArray(review.topIssues) ? review.topIssues : []).entries()) {
  if (i >= 3) { push(`topIssues 最多 3 条（第 ${i + 1} 条越界）`); break; }
  if (!allFindings.includes(t?.finding)) push(`topIssues[${i}].finding 不在任何维度的 issues 里 —— 头条必须来自正文`);
}

if (problems.length > 0) {
  console.error(`REVIEW_INVALID: ${problems.length} 处不合规 —— ${reviewPath}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`REVIEW_VALID: PASS —— 五维齐全、证据链闭合、总分机械一致（${reviewPath}）`);
process.exit(0);
