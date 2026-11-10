#!/usr/bin/env node
// visual-ratchet.mjs —— 视觉棘轮（量产闭环 R3 / M3，技术设计 D5/D6）：同 scenario 相邻证据包
// 的 pHash 整体相似度 diff，生成可读回归报告。**advisory：只挂报告，绝不拦截 verdict** ——
// 审美官未达 ENFORCE_ELIGIBLE 前任何视觉结论都不得当放行条件（需求 7.3 红线）。
//
// 首版选型（D5 定案）：只做感知哈希（pHash，64-bit DCT）整体相似度；
// 「关键 UI 分区像素 diff」因分区来源未定义**推迟**（解锁条件 = 分区来源定案）；
// 不引入模型评审（不可复现、成本高）。
//
// 可比性判定（D6）：仅同 scenario、同分辨率、同关键状态的截图可比 —— 分辨率不一致 →
// 「无法对比」（不误报退化）；pHash 相似度 < T1 记「疑似退化」并给建议动作。
// T1 初始值 0.70（阈值显式、可 --threshold 覆盖；首批同 scenario 证据包定标后固化）。
//
// 用法（一次一 scenario，before/after 各为一张 PNG 或一个截图目录）：
//   node std-skills/godot-game-dev/scripts/visual-ratchet.mjs --game {{gamePath}} \
//     --scenario polish-round-2 --before {{gamePath}}/qa/playtest/steps \
//     --after {{gamePath}}/qa/experience/<pack>/screenshots
// 输出：{{gamePath}}/qa/visual-ratchet/report.json（条目含 scenario、前后证据路径、
//       diff 结论、建议动作 —— 验收 6 的四个必填字段）
// 退出码：恒 0（advisory；用法错误才 2）。判定标记：VISUAL_RATCHET: OK / NOT_COMPARABLE /
//         SUSPECTED_REGRESSION(ADVISORY)。
//
// 目录对配对规则：before/after 为目录时按**文件名**配对（同名 PNG 一对一 diff，取并集，
// 缺对的一侧记 not-comparable）—— evidence pack 的截图都带确定性文件名（steps/NNN-action.png）。

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodePng, PngError, pHash, pHashSimilarity } from "./lib-png.mjs";

const args = process.argv.slice(2);
const argOf = (name, dflt = null) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};
const gameArg = argOf("--game");
const scenario = argOf("--scenario");
const beforeArg = argOf("--before");
const afterArg = argOf("--after");
if (!gameArg || !scenario || !beforeArg || !afterArg) {
  console.error("用法: node visual-ratchet.mjs --game <gamePath> --scenario <name> --before <png|dir> --after <png|dir> [--threshold 0.70] [--report <path>]");
  process.exit(2);
}
const gameDir = path.resolve(gameArg);
if (!existsSync(gameDir)) {
  console.error(`VISUAL_RATCHET: FAIL(2) — 工程目录不存在: ${gameArg}`);
  process.exit(2);
}
const thresholdRaw = Number(argOf("--threshold", "0.70"));
const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw <= 1 ? thresholdRaw : 0.7;
const reportPath = path.resolve(argOf("--report") ?? path.join(gameDir, "qa", "visual-ratchet", "report.json"));

/** 收集 PNG：文件 → 单张；目录 → 按文件名排序的全部 PNG */
function collectPngs(target) {
  const abs = path.resolve(target);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [{ name: path.basename(abs), abs }];
  return readdirSync(abs)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort()
    .map((f) => ({ name: f, abs: path.join(abs, f) }));
}

/** 解码 + pHash；解码失败返回 null（调用方记 not-comparable，不冒充通过也不误报） */
function fingerprint(file) {
  try {
    const { width, height, rgba } = decodePng(readFileSync(file.abs));
    return { name: file.name, path: file.abs, width, height, hash: pHash(rgba, width, height) };
  } catch (e) {
    return { name: file.name, path: file.abs, error: e instanceof PngError ? e.message : String(e) };
  }
}

const beforeFiles = collectPngs(beforeArg);
const afterFiles = collectPngs(afterArg);
if (beforeFiles.length === 0 || afterFiles.length === 0) {
  console.error(`VISUAL_RATCHET: FAIL(2) — before/after 至少一侧没有 PNG（before=${beforeFiles.length} after=${afterFiles.length}）`);
  process.exit(2);
}

const beforeByName = new Map(beforeFiles.map((f) => [f.name, f]));
const afterByName = new Map(afterFiles.map((f) => [f.name, f]));
const pairs = [];
for (const [name, bf] of beforeByName) {
  if (afterByName.has(name)) pairs.push([bf, afterByName.get(name)]);
}
if (pairs.length === 0) {
  // 单张对单张也允许（两侧都是文件时文件名不同不算错）
  if (beforeFiles.length === 1 && afterFiles.length === 1) pairs.push([beforeFiles[0], afterFiles[0]]);
}

const comparisons = [];
for (const [bf, af] of pairs) {
  const fpBefore = fingerprint(bf);
  const fpAfter = fingerprint(af);
  const rel = (p) => path.relative(gameDir, p).split(path.sep).join("/");
  if (fpBefore.error || fpAfter.error) {
    comparisons.push({
      before: rel(fpBefore.path),
      after: rel(fpAfter.path),
      verdict: "not-comparable",
      reason: `PNG 解析失败：${fpBefore.error ?? fpAfter.error}`,
      suggestedAction: "换用可解析的 PNG 证据（截图链必须是 PNG）；不要把「无法对比」当「没有退化」",
    });
    continue;
  }
  if (fpBefore.width !== fpAfter.width || fpBefore.height !== fpAfter.height) {
    comparisons.push({
      before: rel(fpBefore.path),
      after: rel(fpAfter.path),
      resolutionBefore: `${fpBefore.width}x${fpBefore.height}`,
      resolutionAfter: `${fpAfter.width}x${fpAfter.height}`,
      verdict: "not-comparable",
      reason: `分辨率不一致（${fpBefore.width}x${fpBefore.height} vs ${fpAfter.width}x${fpAfter.height}）—— D6：仅同分辨率可比`,
      suggestedAction: "统一视口/导出分辨率后重采证据再对比；不可比不误报退化",
    });
    continue;
  }
  const similarity = pHashSimilarity(fpBefore.hash, fpAfter.hash);
  const regressed = similarity < threshold;
  comparisons.push({
    before: rel(fpBefore.path),
    after: rel(fpAfter.path),
    resolution: `${fpBefore.width}x${fpBefore.height}`,
    pHashBefore: fpBefore.hash,
    pHashAfter: fpAfter.hash,
    similarity: Number(similarity.toFixed(4)),
    verdict: regressed ? "suspected-regression" : "comparable-pass",
    reason: regressed
      ? `pHash 相似度 ${similarity.toFixed(4)} < T1=${threshold}（整体画面明显变化 —— 可能是退化，也可能是大幅重设计）`
      : `pHash 相似度 ${similarity.toFixed(4)} ≥ T1=${threshold}`,
    suggestedAction: regressed
      ? "对照 round-N.md 的改动清单逐条复核：若属刻意重设计，在打磨记录里写明并把本条标记为已解释；若非刻意，回滚该改动并复跑同动作序列取证"
      : "无需动作",
  });
}

// 目录模式下未配对的文件显式列出（不静默丢 ——「no silent caps」纪律）
const unmatched = [
  ...[...beforeByName.keys()].filter((n) => !afterByName.has(n)).map((n) => `before 独有: ${n}`),
  ...[...afterByName.keys()].filter((n) => !beforeByName.has(n)).map((n) => `after 独有: ${n}`),
];

const regressedCount = comparisons.filter((c) => c.verdict === "suspected-regression").length;
const notComparableCount = comparisons.filter((c) => c.verdict === "not-comparable").length;
const verdict =
  regressedCount > 0 ? "SUSPECTED_REGRESSION(ADVISORY)" : notComparableCount === comparisons.length ? "NOT_COMPARABLE" : "OK";

// 报告 upsert（按 scenario；历史对比保留在 comparisons，容量上限 20 防无限膨胀）
let report = { schemaVersion: 1, thresholdT1: threshold, entries: [] };
if (existsSync(reportPath)) {
  try {
    const parsed = JSON.parse(readFileSync(reportPath, "utf-8"));
    if (parsed && Array.isArray(parsed.entries)) report = parsed;
  } catch {
    // 报告损坏则重建（旧内容被覆盖前已尽力读取）
  }
}
report.thresholdT1 = threshold;
report.updatedAt = new Date().toISOString();
report.entries = (report.entries ?? []).filter((e) => e.scenario !== scenario);
report.entries.push({
  scenario,
  beforeSource: path.isAbsolute(beforeArg) ? beforeArg : path.relative(gameDir, path.resolve(beforeArg)).split(path.sep).join("/"),
  afterSource: path.isAbsolute(afterArg) ? afterArg : path.relative(gameDir, path.resolve(afterArg)).split(path.sep).join("/"),
  comparedAt: new Date().toISOString(),
  pairsCompared: comparisons.length,
  suspectedRegressions: regressedCount,
  notComparable: notComparableCount,
  unmatchedFiles: unmatched,
  comparisons,
  // 验收 6 必填四字段的顶层投影：scenario / 前后证据路径 / diff 结论 / 建议动作
  diffConclusion: verdict,
  suggestedAction:
    regressedCount > 0
      ? "逐条复核 suspected-regression 对：刻意重设计需在打磨记录解释；非刻意则回滚改动并复跑取证（advisory，不拦截 verdict）"
      : notComparableCount === comparisons.length
        ? "证据不可比（分辨率/解析失败）—— 统一采集口径后重采，不要据此下「无退化」结论"
        : "无需动作",
});
report.entries = report.entries.slice(-50);

try {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
} catch (e) {
  console.error(`visual-ratchet: 报告写盘失败: ${e instanceof Error ? e.message : String(e)}`);
}

console.log(`visual-ratchet: scenario=${scenario} pairs=${comparisons.length} regression=${regressedCount} notComparable=${notComparableCount} T1=${threshold}`);
for (const note of unmatched) console.log(`visual-ratchet: NOTE 未配对 ${note}`);
console.log(`visual-ratchet: 报告已写 ${path.relative(gameDir, reportPath).split(path.sep).join("/")}（advisory —— 不拦截 verdict）`);
console.log(`VISUAL_RATCHET: ${verdict}`);
process.exit(0);
