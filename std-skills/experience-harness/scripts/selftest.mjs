#!/usr/bin/env node
// selftest.mjs — experience-harness 的自证测试（G1 验收 5）：门禁变异测试同款纪律，
// 验证「证据生成器看得见该看见的失败类」—— G1 不做判定，但必须不瞎。
//
// 全部本地自足（fixtures 由内置 http 伺服，零外部依赖、不碰任何部署）：
//   1. 正向夹具：good-canvas（默认场景，验收 2 全量口径）、good-dom（游戏无关性）
//   2. 负向夹具四类：bad-blank（没渲染）/ bad-static（有画面但不活，无 canvas）/
//      bad-frozen（渲染一次后冻结，有 canvas）/ bad-swallow（输入到达但被吞）
//      —— 断言证据包的**观测字段**能如实区分，而不是「全记成 pass」
//   3. 交互会话：sessiond + session-step 连续 ≥10 步、显式 stop 资源回收、TTL 自动回收
//
// 判定协议：全部断言通过 → stdout 打 EXPERIENCE_SELFTEST: PASS，退出码 0；
// 任一失败 → EXPERIENCE_SELFTEST: FAIL <清单>，退出码 1。

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "..", "fixtures");
const SCRIPTS = HERE;
const TMP = path.join(HERE, "..", ".selftest-tmp");

const failures = [];
const passes = [];
function ok(name, cond, detail = "") {
  if (cond) { passes.push(name); console.log(`  PASS  ${name}`); }
  else { failures.push(`${name}${detail ? ` —— ${detail}` : ""}`); console.log(`  FAIL  ${name}${detail ? ` —— ${detail}` : ""}`); }
}
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// —— 内置 http 伺服 fixtures（随机端口）——
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const name = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "good-canvas.html";
    const file = path.join(FIXTURES, path.basename(name));
    try {
      const body = readFileSync(file);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

/** 跑一次 pack.mjs，解析产物目录与 manifest */
function runPack(url, { scenario = "default", label, timeoutMs = 100_000 } = {}) {
  return new Promise((resolve, reject) => {
    const outRoot = path.join(TMP, label);
    const cp = spawn(process.execPath, [
      path.join(SCRIPTS, "pack.mjs"), "--url", url, "--out", outRoot,
      "--scenario", scenario, "--label", label,
    ], { cwd: HERE });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { cp.kill("SIGKILL"); reject(new Error("pack 超时")); }, timeoutMs);
    cp.stdout.on("data", (d) => { stdout += d; });
    cp.stderr.on("data", (d) => { stderr += d; });
    cp.on("exit", (code) => {
      clearTimeout(timer);
      const dirMatch = stdout.match(/EXPERIENCE_PACK_DIR (\S+)/);
      const packDir = dirMatch ? dirMatch[1] : null;
      const manifest = packDir && existsSync(path.join(packDir, "pack.json"))
        ? JSON.parse(readFileSync(path.join(packDir, "pack.json"), "utf-8")) : null;
      resolve({ code, stdout, stderr, packDir, manifest });
    });
  });
}

mkdirSync(TMP, { recursive: true });

// ============ 1. good-canvas：默认场景全量口径（验收 2） ============
console.log(`\n===== 1. good-canvas 默认场景（${BASE}/good-canvas.html）=====`);
{
  const r = await runPack(`${BASE}/good-canvas.html`, { label: "good-canvas" });
  ok("good-canvas 退出码 0", r.code === 0, `code=${r.code} stderr=${r.stderr.slice(0, 200)}`);
  const m = r.manifest;
  ok("pack.json 存在且 schemaVersion=1", m?.schemaVersion === 1);
  const s = m?.summary ?? {};
  ok("截图 ≥4 张（带标签步骤）", (s.steps?.length ?? 0) >= 4, `steps=${s.steps?.length}`);
  ok("帧序列 ≥100 帧", (s.framesSaved ?? 0) >= 100, `frames=${s.framesSaved}`);
  ok("FPS 时间序列 ≥10 采样点", (s.fpsSeriesPoints ?? 0) >= 10, `points=${s.fpsSeriesPoints}`);
  ok("首帧采样色数 ≥2（画面真的渲染了）", (s.firstColorCount ?? 0) >= 2, `colors=${s.firstColorCount}`);
  ok("canvas 存在被观测到", s.canvasPresent === true);
  ok("存在画面响应/运动的步骤", s.animatedSomewhere === true || s.hasRespondedStep === true);
  ok("evidenceOnly=true（不含判定字段）", m?.evidenceOnly === true);
  // 文件与体积口径
  if (r.packDir) {
    const pngs = [];
    const walk = (dir) => { for (const n of readdirSync(dir)) { const p = path.join(dir, n); statSync(p).isDirectory() ? walk(p) : p.endsWith(".png") && pngs.push(p); } };
    walk(r.packDir);
    ok("全部 PNG ≤5MB（image-read-guard 口径）", pngs.every((p) => statSync(p).size <= 5 * 1024 * 1024), `共 ${pngs.length} 张`);
    ok("包体积 ≤25MB", s.packBytes <= 25 * 1024 * 1024, `bytes=${s.packBytes}`);
    const f0 = m?.files?.find((f) => f.path.endsWith(".png"));
    ok("manifest sha256 与实际文件一致（抽查）", f0 ? sha256(path.join(r.packDir, f0.path)) === f0.sha256 : false, f0?.path);
  }
}

// ============ 2. good-dom：游戏无关性（验收 3） ============
console.log(`\n===== 2. good-dom 纯 DOM 形态（同一 runner / 同一 schema）=====`);
{
  const scenarioPath = path.join(TMP, "scenario-good-dom.json");
  writeFileSync(scenarioPath, JSON.stringify({
    name: "good-dom-short",
    steps: [
      { id: "load", label: "加载后", action: "wait", params: { ms: 600 } },
      { id: "tap-btn", label: "点按钮", action: "tap", params: { x: 95, y: 240 } },
      { id: "shot", label: "点击后画面", action: "screenshot", params: {} },
      { id: "settle", label: "收尾", action: "wait", params: { ms: 400 } },
    ],
  }));
  const r = await runPack(`${BASE}/good-dom.html`, { scenario: scenarioPath, label: "good-dom", timeoutMs: 45_000 });
  ok("good-dom 退出码 0（同一 runner 跑通 DOM 页）", r.code === 0, `code=${r.code} stderr=${r.stderr.slice(0, 200)}`);
  const s = r.manifest?.summary ?? {};
  ok("无 canvas 页 canvasPresent=false（如实观测）", s.canvasPresent === false);
  const tapStep = s.steps?.find((x) => x.action === "tap");
  ok("点按钮后画面变化（DOM 文本改变被截图帧差捕获）", tapStep?.frameDiff > 0, `frameDiff=${tapStep?.frameDiff}`);
  // 游戏无关硬口径：运行时脚本不得出现引擎名（import/分支/后缀表都不行——.pck 之类引擎专属知识不许进通用 harness；
  // 只扫运行时四件，selftest 自身的断言源码字符串不算）
  const engineHits = [];
  for (const f of ["cdp-core.mjs", "pack.mjs", "sessiond.mjs", "session-step.mjs"]) {
    const text = readFileSync(path.join(SCRIPTS, f), "utf-8");
    const hits = [...text.matchAll(/godot|threejs|cocos/gi)].length;
    if (hits > 0) engineHits.push(`${f}:${hits}`);
  }
  ok("运行时脚本零引擎名硬编码（grep godot/threejs/cocos 无命中）", engineHits.length === 0, engineHits.join("、"));
}

// ============ 3. 负向夹具四类：观测字段如实区分（验收 5） ============
console.log("\n===== 3. 负向夹具：证据生成器不许瞎 =====");
{
  const short = (extra = []) => ({
    name: "negative-short",
    steps: [
      { id: "load", label: "加载后", action: "wait", params: { ms: 800 } },
      { id: "shot", label: "初始画面", action: "screenshot", params: {} },
      { id: "tap", label: "点击中心", action: "tap", params: { x: 195, y: 422 } },
      ...extra,
      { id: "settle", label: "收尾", action: "wait", params: { ms: 800 } },
    ],
  });
  const writeScenario = (name, obj) => {
    const p = path.join(TMP, `scenario-${name}.json`);
    writeFileSync(p, JSON.stringify(obj));
    return p;
  };

  // bad-blank：画面没渲染
  {
    const r = await runPack(`${BASE}/bad-blank.html`, { scenario: writeScenario("blank", short()), label: "bad-blank", timeoutMs: 45_000 });
    const s = r.manifest?.summary ?? {};
    ok("bad-blank 退出码 0（留证成功——生成器不判定页面好坏）", r.code === 0, `code=${r.code}`);
    ok("bad-blank 观测到纯色画面（色数 ≤1）", (s.firstColorCount ?? 99) <= 1, `colors=${s.firstColorCount}`);
    ok("bad-blank 观测到无 canvas", s.canvasPresent === false);
  }
  // bad-static：有画面但无 JS 无 canvas，永不动
  {
    const r = await runPack(`${BASE}/bad-static.html`, { scenario: writeScenario("static", short()), label: "bad-static", timeoutMs: 45_000 });
    const s = r.manifest?.summary ?? {};
    ok("bad-static 退出码 0", r.code === 0, `code=${r.code}`);
    ok("bad-static 有画面（色数 ≥2）但与 blank 可区分", (s.firstColorCount ?? 0) >= 2, `colors=${s.firstColorCount}`);
    ok("bad-static 有画面后帧差恒 0（画面冻结被如实记录；首步无前帧为 null 不计）", (s.steps ?? []).filter((x) => x.frameDiff !== null).every((x) => x.frameDiff === 0), JSON.stringify((s.steps ?? []).map((x) => x.frameDiff)));
  }
  // bad-frozen：canvas 画了一帧就停
  {
    const r = await runPack(`${BASE}/bad-frozen.html`, { scenario: writeScenario("frozen", short()), label: "bad-frozen", timeoutMs: 45_000 });
    const s = r.manifest?.summary ?? {};
    ok("bad-frozen 退出码 0", r.code === 0, `code=${r.code}`);
    ok("bad-frozen canvas 存在（与 static 可区分）", s.canvasPresent === true);
    ok("bad-frozen 首帧有画面（色数 ≥2）", (s.firstColorCount ?? 0) >= 2, `colors=${s.firstColorCount}`);
    ok("bad-frozen 后续帧差 0（冻结被如实记录）", (s.steps ?? []).filter((x) => x.frameDiff !== null).every((x) => x.frameDiff === 0));
  }
  // bad-swallow：输入到达但画面不响应
  {
    const r = await runPack(`${BASE}/bad-swallow.html`, {
      scenario: writeScenario("swallow", short([{ id: "probe", label: "页面内吞入计数", action: "probe", params: { expr: "window.__swallowCount ?? -1" } }])),
      label: "bad-swallow", timeoutMs: 45_000,
    });
    const s = r.manifest?.summary ?? {};
    const tapStep = (s.steps ?? []).find((x) => x.action === "tap");
    const probeStep = (s.steps ?? []).find((x) => x.action === "probe");
    ok("bad-swallow 退出码 0", r.code === 0, `code=${r.code}`);
    ok("bad-swallow 输入到达被观测到（inputArrived=true）", tapStep?.inputArrived === true, JSON.stringify(tapStep));
    ok("bad-swallow 点击后帧差 0（无响应被如实记录）", tapStep?.frameDiff === 0, `frameDiff=${tapStep?.frameDiff}`);
    ok("bad-swallow 页面内计数被探针读到（≥1）", (probeStep?.probeResult ?? -1) >= 1, `probe=${JSON.stringify(probeStep?.probeResult)}`);
  }
  // 区分度总检：四类负向夹具的观测签名互不相同
  {
    const sigs = {};
    for (const label of ["bad-blank", "bad-static", "bad-frozen", "bad-swallow"]) {
      const dir = path.join(TMP, label);
      const entries = readdirSync(dir);
      const manifest = JSON.parse(readFileSync(path.join(dir, entries[0], "pack.json"), "utf-8"));
      const s = manifest.summary;
      sigs[label] = `${s.canvasPresent}/${s.firstColorCount}/${(s.steps ?? []).map((x) => x.frameDiff).join("|")}/${(s.steps ?? []).find((x) => x.action === "tap")?.inputArrived}`;
    }
    const unique = new Set(Object.values(sigs));
    ok("四类负向夹具观测签名互不相同（生成器看得见差异）", unique.size === 4, JSON.stringify(sigs, null, 2));
  }
}

// ============ 4. 交互会话：连续步进 + 资源回收 + TTL（验收 4） ============
console.log("\n===== 4. 交互会话 sessiond/session-step =====");
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitReady = async (cp, timeoutMs = 20_000) => {
    let out = "";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("sessiond 就绪超时")), timeoutMs);
      cp.stdout.on("data", (d) => {
        out += d;
        const m = out.match(/XH_SESSION_READY (\S+)/);
        if (m) { clearTimeout(timer); resolve(m[1]); }
      });
      cp.on("exit", (code) => { clearTimeout(timer); reject(new Error(`sessiond 提前退出 code=${code}`)); });
    });
  };
  const step = (sessionFile, argv) => new Promise((resolve) => {
    const cp = spawn(process.execPath, [path.join(SCRIPTS, "session-step.mjs"), "--session", sessionFile, ...argv]);
    let out = "";
    cp.stdout.on("data", (d) => { out += d; });
    cp.on("exit", (code) => resolve({ code, out }));
  });

  // 4a. 常规会话：10 步 + 显式 stop
  {
    const cp = spawn(process.execPath, [path.join(SCRIPTS, "sessiond.mjs"),
      "--url", `${BASE}/good-canvas.html`, "--ttl", "120",
      "--session-file", path.join(TMP, "session-a.json")], { cwd: HERE });
    const sessionFile = await waitReady(cp);
    const sess = JSON.parse(readFileSync(sessionFile, "utf-8"));
    const steps = [
      ["--tap", "195,422"], ["--tap", "195,300"], ["--swipe", "90,700:170,700"],
      ["--pressKey", "ArrowUp"], ["--screenshot"], ["--tap", "100,600"],
      ["--probe", "window.__xhTouch ? window.__xhTouch.touchstart : -1"],
      ["--wait", "300"], ["--tap", "280,200"], ["--screenshot"],
    ];
    let allOk = true, shotsExist = true, detail = "";
    for (const argv of steps) {
      const r = await step(sessionFile, argv);
      if (r.code !== 0) { allOk = false; detail = `${argv.join(" ")} → ${r.out.slice(0, 200)}`; break; }
      const body = JSON.parse(r.out);
      if (!body.ok || !existsSync(body.screenshot)) { shotsExist = false; detail = `seq=${body.seq} shot=${body.screenshot}`; break; }
    }
    ok("会话连续 10 步全部成功且每步截图落盘", allOk && shotsExist, detail);
    const dom = JSON.parse((await step(sessionFile, ["--probe", "document.title"])).out);
    ok("每步返回含 DOM 摘要与帧差字段", typeof dom.dom === "object" && "frameDiff" in dom, JSON.stringify(dom).slice(0, 120));
    const stop = await step(sessionFile, ["--stop"]);
    ok("显式 stop 成功", stop.code === 0 && JSON.parse(stop.out).stopped === true);
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      cp.on("exit", () => { clearTimeout(timer); resolve(true); });
    });
    ok("stop 后守护进程退出", exited);
    ok("stop 后状态目录与会话文件已清理", !existsSync(sess.stepsDir) && !existsSync(sessionFile), `stepsDir=${sess.stepsDir}`);
    await sleep(500);
    ok("stop 后 Chrome 进程已回收（无 xh-harness 残留）", !(await chromeResidue()), "仍有 xh-harness- 前缀 user-data-dir 进程");
  }
  // 4b. TTL 自动回收
  {
    const sessionFile = path.join(TMP, "session-b.json");
    const cp = spawn(process.execPath, [path.join(SCRIPTS, "sessiond.mjs"),
      "--url", `${BASE}/good-dom.html`, "--ttl", "3",
      "--session-file", sessionFile], { cwd: HERE });
    await waitReady(cp);
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      cp.on("exit", () => { clearTimeout(timer); resolve(true); });
    });
    ok("TTL 到期自动退出", exited);
    ok("TTL 后会话文件已清理", !existsSync(sessionFile));
  }
}

// ============ 汇总 ============
server.close();
try { rmSync(TMP, { recursive: true, force: true }); } catch { /* 尽力而为 */ }
if (failures.length === 0) {
  console.log(`\nEXPERIENCE_SELFTEST: PASS（${passes.length} 项断言全绿）`);
  process.exit(0);
}
console.error(`\nEXPERIENCE_SELFTEST: FAIL（${failures.length}/${passes.length + failures.length} 项未过）：`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);

/** 检查是否还有 harness 起的 Chrome 残留（ps 里 user-data-dir 带 xh-harness-/xh-session- 前缀） */
async function chromeResidue() {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile("ps", ["-eo", "command"], (err, stdout) => {
      if (err) return resolve(false);
      resolve(/xh-harness-|xh-session-/.test(stdout));
    });
  });
}
