#!/usr/bin/env node
// playtest-summary.mjs —— 试玩证据聚合装配 + 完整性校验（量产闭环 R3 / M2，§2.3）。
//
// 定位（v3 评审订正，红线）：**聚合派生产物** —— 从既有证据产物（qa/mobile/report.json、
// qa/playtest/round-N.md、qa/playtest/session.json、qa/playtest/ 下的截图）装配生成
// qa/playtest-summary.json，是证据的索引与汇总视图，**不是新的并行采集通道**；
// agent 只按既有协议落盘原始证据，不做双份记账。
//
// 轮次记录协议（qa/playtest/round-N.md 的机器可解析段，polish/playtest 节点按它落盘）：
//   ## 观察   —— 本轮看到了什么（非空必填）
//   ## 动作   —— 本轮的确定性动作序列（≥1 条列表项；与试玩桥动作对应）
//   ## 截图   —— 本轮证据截图相对路径列表（≥1 条；文件必须真实存在且 >0 字节）
//   ## 改进点 / ## 改动 / ## 复玩对比 —— 既有协议段（本轮校验只硬性要求前三段）
//
// 完整性校验（缺任何一项 → FAIL，缺证据不得判 PASS）：
//   C1 轮次 ≥ 3（验收「每 run ≥3 轮改→玩→看」）
//   C2 每轮有非空观察 + ≥1 动作 + ≥1 真实存在的截图
//   C3 console error 归零，或每条附结构化解释（qa/playtest/console-explanations.json）
//   C4 关键交互全部可达（qa/mobile/report.json 的 touch/input 类检查全 pass）
//   C5 顶层 screenshots 总数 == 各轮截图之和（验收「截图数量与轮次匹配」）
//   C6 截图 mtime 落在 [startedAt, endedAt] 窗口内（startedAt 取 session.json 或最早证据 mtime）
//   C7 versionSha 记录进 summary（= 当前构建 HEAD；跨 run 比对的锚，脚本只记不判跨 run 相等）
//
// 用法：
//   node std-skills/godot-game-dev/scripts/playtest-summary.mjs --game {{gamePath}} \
//     [--session {{gamePath}}/qa/playtest/session.json] [--version-sha <sha>] [--min-rounds 3]
// 输出：<gamePath>/qa/playtest-summary.json（含 valid 字段；FAIL 也落盘供审计）
// 退出码：0 = PLAYTEST_SUMMARY: PASS；1 = FAIL（问题清单见输出）；2 = 用法错误。

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (name, dflt = null) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};
const gameArg = argOf("--game");
if (!gameArg) {
  console.error("用法: node playtest-summary.mjs --game <gamePath> [--session <session.json>] [--version-sha <sha>] [--min-rounds 3]");
  process.exit(2);
}
const gameDir = path.resolve(gameArg);
const gameRel = gameArg.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
if (!existsSync(gameDir)) {
  console.error(`PLAYTEST_SUMMARY: FAIL(2) — 工程目录不存在: ${gameArg}`);
  process.exit(2);
}

const playtestDir = path.join(gameDir, "qa", "playtest");
const outPath = path.resolve(argOf("--out") ?? path.join(gameDir, "qa", "playtest-summary.json"));
const minRounds = Math.max(1, Number(argOf("--min-rounds", "3")) || 3);
const problems = [];
const nowIso = () => new Date().toISOString();

// ---- C7 versionSha：当前构建 HEAD（--version-sha 显式覆盖；git 不可得时如实记 unknown） ----
function resolveVersionSha() {
  const explicit = argOf("--version-sha");
  if (explicit) return explicit.trim();
  try {
    return execSync("git rev-parse HEAD", { cwd: gameDir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

// ---- 轮次记录解析（round-N.md 的机器可段） ----
function parseRoundFile(filePath) {
  const text = readFileSync(filePath, "utf-8");
  const sections = {};
  const re = /^##\s+(.+?)\s*$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(text)) !== null) heads.push({ title: m[1].trim(), start: m.index });
  for (let i = 0; i < heads.length; i += 1) {
    const end = i + 1 < heads.length ? heads[i + 1].start : text.length;
    sections[heads[i].title] = text.slice(heads[i].start + heads[i].title.length + 3, end).trim();
  }
  const bullets = (name) =>
    (sections[name] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- ") || l.startsWith("* "))
      .map((l) => l.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean);
  return {
    file: filePath,
    observation: (sections["观察"] ?? "").trim(),
    actions: bullets("动作"),
    screenshotRefs: bullets("截图").map((line) => {
      // 截图行约定：`- <相对路径>`（可带尾注）；路径取第一个 token
      return line.split(/\s+/)[0];
    }),
    improvements: (sections["改进点"] ?? "").trim(),
    changes: (sections["改动"] ?? "").trim(),
    replay: (sections["复玩对比"] ?? sections["复玩"] ?? "").trim(),
  };
}

/** 解析截图路径：相对 gameDir（qa/playtest/… 或 steps/…）或仓库相对路径都认 */
function resolveEvidencePath(ref) {
  const cleaned = ref.replace(/^`+|`+$/g, "").replace(/\\/g, "/");
  const candidates = [
    path.join(gameDir, cleaned),
    path.resolve(cleaned),
    path.join(playtestDir, cleaned),
  ];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

// ---- 移动端门禁报告（既有产物：consoleErrors / fps / touch 类检查） ----
function loadMobileReport() {
  const p = path.join(gameDir, "qa", "mobile", "report.json");
  if (!existsSync(p)) return { path: p, report: null };
  try {
    return { path: p, report: JSON.parse(readFileSync(p, "utf-8")) };
  } catch (e) {
    problems.push(`[C3/C4] qa/mobile/report.json 解析失败: ${e instanceof Error ? e.message : String(e)}`);
    return { path: p, report: null };
  }
}

/** console 解释（可选产物）：{ "<错误子串>": { cause, impact, fix } } —— 每条非零 console 错误必须有解释 */
function loadConsoleExplanations() {
  const p = path.join(playtestDir, "console-explanations.json");
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (e) {
    problems.push(`[C3] console-explanations.json 解析失败: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

// ============================================
// 装配
// ============================================

const roundFiles = existsSync(playtestDir)
  ? readdirSync(playtestDir)
      .filter((f) => /^round-\d+\.md$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
      .map((f) => path.join(playtestDir, f))
  : [];

const rounds = [];
const allActions = [];
const allScreenshots = [];

for (const [index, file] of roundFiles.entries()) {
  const parsed = parseRoundFile(file);
  const roundNo = Number(path.basename(file).match(/\d+/)[0]);
  const screenshots = [];
  for (const ref of parsed.screenshotRefs) {
    const resolved = resolveEvidencePath(ref);
    if (!resolved) {
      problems.push(`[C2] 第 ${roundNo} 轮截图不存在: ${ref}（qa/playtest/ 下必须有真实落盘的证据文件）`);
      continue;
    }
    const st = statSync(resolved);
    if (st.size <= 0) {
      problems.push(`[C2] 第 ${roundNo} 轮截图为空文件: ${ref}`);
      continue;
    }
    screenshots.push({ path: path.relative(gameDir, resolved).split(path.sep).join("/"), bytes: st.size, mtime: new Date(st.mtimeMs).toISOString() });
  }
  if (!parsed.observation) problems.push(`[C2] 第 ${roundNo} 轮缺「## 观察」段或为空（每轮必须有非空观察）`);
  if (parsed.actions.length === 0) problems.push(`[C2] 第 ${roundNo} 轮缺「## 动作」段（每轮必须有 ≥1 条确定性动作）`);
  if (screenshots.length === 0) problems.push(`[C2] 第 ${roundNo} 轮缺可用截图（「## 截图」段列出的文件必须真实存在且 >0 字节）`);

  const roundMtime = new Date(statSync(file).mtimeMs).toISOString();
  for (const action of parsed.actions) {
    allActions.push({ round: roundNo, action, timestamp: roundMtime });
  }
  allScreenshots.push(...screenshots);
  rounds.push({
    round: roundNo,
    file: path.relative(gameDir, file).split(path.sep).join("/"),
    observation: parsed.observation,
    actions: parsed.actions,
    screenshots,
    improvements: parsed.improvements || null,
    changes: parsed.changes || null,
    replayConclusion: parsed.replay || null,
  });
}

if (rounds.length < minRounds) {
  problems.push(`[C1] 轮次不足：找到 ${rounds.length} 个 round-N.md，要求 ≥${minRounds} 轮「改→玩→看」（qa/playtest/）`);
}

// console / fps / 可达性 —— 从既有移动端门禁报告派生（不新增采集）
const mobile = loadMobileReport();
const report = mobile.report;
const consoleRaw = Array.isArray(report?.consoleErrors) ? report.consoleErrors.map(String) : [];
if (report === null) {
  problems.push(`[C3/C4] 缺 qa/mobile/report.json（移动端门禁既有产物）—— 证据链断裂，不允许凭空判 PASS`);
}
const explanations = loadConsoleExplanations();
const consoleErrors = consoleRaw.map((message) => {
  const key = Object.keys(explanations).find((k) => message.includes(k));
  return { message, explanation: key ? explanations[key] : null };
});
for (const entry of consoleErrors) {
  if (!entry.explanation || typeof entry.explanation !== "object" || !entry.explanation.cause) {
    problems.push(`[C3] console error 未归零且缺结构化解释: ${entry.message.slice(0, 120)}（qa/playtest/console-explanations.json 补 { cause, impact, fix }）`);
  }
}

const fpsSamples = [];
const fps = Number(report?.metrics?.fps);
if (Number.isFinite(fps) && fps > 0) fpsSamples.push(fps);
else problems.push("[C4] qa/mobile/report.json 缺 metrics.fps（FPS 采样缺失，性能证据不完整）");

const inputReachability = Array.isArray(report?.checks)
  ? report.checks
      .filter((c) => /touch|input|tap|joy|gesture/i.test(String(c.name ?? "")))
      .map((c) => ({ name: String(c.name), reachable: c.pass === true, detail: String(c.check ?? "") }))
  : [];
if (inputReachability.length === 0) {
  problems.push("[C4] qa/mobile/report.json 无 touch/input 类检查（关键交互可达性无从证明）");
} else {
  for (const item of inputReachability) {
    if (!item.reachable) problems.push(`[C4] 关键交互不可达: ${item.name}（${item.detail}）`);
  }
}

// 时间窗（C6）：startedAt 取 session.json 的 startedAt（session 存续期内），否则最早证据 mtime；
// endedAt 取最晚证据 mtime；截图 mtime 必须落在窗口内（能拦「证据文件晚于收尾/伪造时间戳」类缺陷）
let startedAt = null;
const sessionFile = argOf("--session") ?? path.join(playtestDir, "session.json");
if (existsSync(sessionFile)) {
  try {
    startedAt = JSON.parse(readFileSync(sessionFile, "utf-8"))?.startedAt ?? null;
  } catch {
    problems.push(`[C6] session.json 解析失败（会话元数据不可用，回退证据 mtime 推导）`);
  }
}
const mtimes = allScreenshots.map((s) => Date.parse(s.mtime)).filter(Number.isFinite);
const endedAt = mtimes.length > 0 ? new Date(Math.max(...mtimes)).toISOString() : nowIso();
if (!startedAt && mtimes.length > 0) startedAt = new Date(Math.min(...mtimes)).toISOString();
if (!startedAt) startedAt = endedAt;
const startMs = Date.parse(startedAt);
const endMs = Date.parse(endedAt);
for (const s of allScreenshots) {
  const t = Date.parse(s.mtime);
  if (Number.isFinite(t) && (t < startMs - 60_000 || t > endMs + 60_000)) {
    problems.push(`[C6] 截图时间戳不在证据窗口内: ${s.path}（${s.mtime} ∉ [${startedAt}, ${endedAt}] ±60s）`);
  }
}

// C5：顶层 screenshots 总数与各轮截图之和一致（装配保证；显式断言防两处口径漂移）
const screenshotsMatchRounds = allScreenshots.length === rounds.reduce((n, r) => n + r.screenshots.length, 0);
if (!screenshotsMatchRounds) problems.push("[C5] 顶层 screenshots 数与各轮截图之和不一致（装配口径漂移）");

const versionSha = resolveVersionSha();
const valid = problems.length === 0;

const summary = {
  schemaVersion: 1,
  generatedBy: "playtest-summary.mjs",
  valid,
  gamePath: gameRel,
  versionSha,
  startedAt,
  endedAt,
  rounds,
  actions: allActions,
  observations: rounds.map((r) => ({ round: r.round, observation: r.observation })),
  screenshots: allScreenshots,
  consoleErrors,
  fpsSamples,
  inputReachability,
  checks: {
    roundsAtLeastThree: rounds.length >= minRounds,
    eachRoundComplete: rounds.every((r) => r.observation && r.actions.length > 0 && r.screenshots.length > 0),
    consoleCleanOrExplained: consoleErrors.every((e) => e.explanation),
    interactionsReachable: inputReachability.length > 0 && inputReachability.every((i) => i.reachable),
    screenshotsMatchRounds,
    evidenceWithinWindow: true,
  },
  mobileReport: mobile.report ? path.relative(gameDir, mobile.path).split(path.sep).join("/") : null,
};

// ---- 汇总输出 + 落盘（FAIL 也写 summary，带 valid=false —— 审计可见） ----
try {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
} catch (e) {
  console.error(`playtest-summary: summary 写盘失败: ${e instanceof Error ? e.message : String(e)}`);
  problems.push("summary 写盘失败");
}

if (!valid) {
  console.log(`playtest-summary: 发现 ${problems.length} 处证据缺口（FAIL）：`);
  for (const p of problems) console.log(`  - ${p}`);
}
console.log(
  `playtest-summary: rounds=${rounds.length} screenshots=${allScreenshots.length} actions=${allActions.length} ` +
    `consoleErrors=${consoleErrors.length} fps=${fpsSamples.join("/") || "无"} reachability=${inputReachability.filter((i) => i.reachable).length}/${inputReachability.length} versionSha=${versionSha.slice(0, 12)}`,
);
console.log(`playtest-summary: 已写 ${path.relative(process.cwd(), outPath).split(path.sep).join("/")}`);
console.log(`PLAYTEST_SUMMARY: ${valid ? "PASS" : "FAIL"}`);
process.exit(valid ? 0 : 1);
