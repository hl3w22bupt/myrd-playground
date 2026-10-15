#!/usr/bin/env node
// pack.mjs — 批量体验证据包生成器：给定 liveUrl + 场景（JSON 动作脚本），产出标准化证据包。
//
// 定位（G1）：只**记录**、不**判定**——「画面好不好看/好不好玩」是 G3 判定层与人的职责，
// 本脚本把「看起来什么样、玩起来什么样」如实留证：带标签步骤截图（≤720 宽）、帧序列、
// FPS 时间序列、网络瀑布、console 错误、逐步输入证据（到达/帧差/响应），manifest 含
// schemaVersion 与逐文件 sha256。
//
// 与 mobile-web-smoke 的分工：那边是门禁（pass/fail 拦截），这边是摄影师（永不拦截）。
// 退出码语义与 MOBILE_SMOKE 对齐：0 = 证据包生成成功（**不代表页面合格**）；1 = 生成失败；
// 2 = 环境不可用（缺 Chrome / Node 无 WebSocket / 场景文件非法——装环境/改用法，不要改代码）。
//
// 用法：
//   node pack.mjs --url <liveUrl> [--out <目录根，默认 ./qa/experience>] \
//     [--scenario default|<scenario.json>] [--viewport mobile|desktop] \
//     [--chrome <路径>] [--max-width 720] [--label <标签>]
// 输出：证据包落在 <out>/<时间戳>-<label>/；stdout 打印
//   EXPERIENCE_PACK_DIR <绝对路径> 与 EXPERIENCE_PACK: DONE <摘要>（自测按此解析）
//
// 证据包布局（schemaVersion 1，详见 references/scenario-format.md）：
//   pack.json                manifest：参数、逐文件 sha256、观测摘要（无判定字段）
//   steps/<NN>-<label>.png   每步截图（≤maxWidth 宽，PNG）
//   video/frames/<NNNN>.jpg  screencast 帧序列（JPEG q60，字节预算 16MB 内能存尽存；录屏契约形态）
//   perf/fps-series.json     FPS 时间序列（页内 rAF 1s 窗口采样）
//   network/waterfall.json   请求瀑布（状态/关键性/时间偏移）
//   console/errors.json      带时间偏移的 console.error + 未捕获异常

import { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import {
  assertEnv, env2, resolveChrome, launchChrome, connectCdp, openSession,
  setupEmulation, navigate, sleep, tap, swipe, pressKey, readTouchCounters,
  captureShot, MOBILE_VIEWPORT, DESKTOP_VIEWPORT, MOBILE_UA,
} from "./cdp-core.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const URL_ARG = flag("--url", "");
const OUT_ROOT = path.resolve(flag("--out", path.join("qa", "experience")));
const SCENARIO_ARG = flag("--scenario", "default");
const VIEWPORT_NAME = flag("--viewport", "mobile");
const MAX_WIDTH = Number(flag("--max-width", "720"));
const LABEL = (flag("--label", "pack") || "pack").replace(/[^\w.-]+/g, "-");
const PORT = 9500 + (process.pid % 400);

assertEnv();
if (!URL_ARG) env2("缺少 --url <liveUrl>");

const VIEWPORT = VIEWPORT_NAME === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
const UA = VIEWPORT_NAME === "desktop" ? null : MOBILE_UA;

const ALLOWED_ACTIONS = new Set(["navigate", "wait", "tap", "swipe", "drag", "pressKey", "screenshot", "probe"]);
const MAX_FRAMES = 400;                     // 帧数硬上限（体积预算兜底）
const FRAME_BUDGET_BYTES = 16 * 1024 * 1024; // 帧序列字节预算（步骤 PNG 另计，整包 ≤25MB 由 manifest 记录并告警）
const MAX_TOTAL_MS = 120_000;               // 总时长硬上限

/** 默认场景：≥20s、≥4 张截图、覆盖 tap/swipe/pressKey/probe —— 满足 G1 验收 2 的下限 */
function defaultScenario() {
  const cx = Math.round(VIEWPORT.width / 2), cy = Math.round(VIEWPORT.height / 2);
  const joyY = VIEWPORT.height - 144;
  return {
    name: "default",
    steps: [
      { id: "load", label: "加载后", action: "wait", params: { ms: 3000 } },
      { id: "shot-load", label: "初始画面", action: "screenshot", params: {} },
      { id: "tap-center", label: "点击屏幕中心", action: "tap", params: { x: cx, y: cy } },
      { id: "swipe-joystick", label: "摇杆区滑动", action: "swipe", params: { from: { x: 90, y: joyY }, to: { x: 170, y: joyY } } },
      { id: "key-up", label: "按上键", action: "pressKey", params: { key: "ArrowUp" } },
      { id: "tap-upper", label: "点击上半屏", action: "tap", params: { x: cx, y: Math.round(cy * 0.6) } },
      { id: "probe-state", label: "状态钩子", action: "probe", params: { expr: "(() => { try { return typeof window.__gameState === 'function' ? window.__gameState() : null; } catch (e) { return null; } })()" } },
      { id: "settle", label: "收尾观察", action: "wait", params: { ms: 15000 } },
    ],
  };
}

/** 载入并校验场景：非法场景 = 用法错误，退出码 2 */
function loadScenario() {
  if (SCENARIO_ARG === "default") return defaultScenario();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path.resolve(SCENARIO_ARG), "utf-8"));
  } catch (e) {
    env2(`场景文件读取/解析失败（${SCENARIO_ARG}）：${e.message}`);
  }
  if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    env2("场景文件必须含非空 steps 数组");
  }
  for (const [i, s] of parsed.steps.entries()) {
    if (!s || !ALLOWED_ACTIONS.has(s?.action)) {
      env2(`steps[${i}] 非法：action 必须是 ${[...ALLOWED_ACTIONS].join("/")} 之一`);
    }
    s.id = s.id || `step-${i + 1}`;
    s.label = s.label || s.id;
    s.params = s.params || {};
  }
  return parsed;
}

/** 帧差统一走截图指纹口径（captureShot 自带 400 点量化采样）——canvas/DOM 页通吃 */
const diffPoints = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.filter((c, i) => c !== b[i]).length : null);
const sumCounters = (c) => (c ? Object.values(c).reduce((x, y) => x + y, 0) : null);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ============ 主流程 ============
const scenario = loadScenario();
const chrome = resolveChrome(flag("--chrome", ""));
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const packDir = path.join(OUT_ROOT, `${stamp}-${LABEL}`);
mkdirSync(packDir, { recursive: true });
for (const sub of ["steps", "video/frames", "perf", "network", "console"]) {
  mkdirSync(path.join(packDir, sub), { recursive: true });
}

const t0 = Date.now();
const offset = () => Date.now() - t0;

const { cp, cleanup } = launchChrome({ chrome, port: PORT, viewport: VIEWPORT });

try {
  const session = await openSession(await connectCdp(PORT));
  try {
    await setupEmulation(session, { viewport: VIEWPORT, ua: UA });

    // —— 事件采集：console 错误 + 网络瀑布（时间偏移相对会话起点）——
    const consoleErrors = [];
    const network = new Map();
    const CRITICAL_EXT = [".wasm", ".js", ".mjs", ".data", ".json", ".html", ".ttf", ".woff", ".woff2", ".bin"];
    session.addListener((m) => {
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        consoleErrors.push({ offsetMs: offset(), kind: "uncaught", text: String(d?.exception?.description || d?.text || "unknown").slice(0, 500) });
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        consoleErrors.push({ offsetMs: offset(), kind: "console.error", text: m.params.args?.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500) });
      }
      if (m.method === "Network.requestWillBeSent") {
        const { requestId, request } = m.params;
        const critical = CRITICAL_EXT.some((e) => new URL(request.url, URL_ARG).pathname.toLowerCase().endsWith(e));
        network.set(requestId, { url: request.url, status: 0, critical, offsetMs: offset() });
      }
      if (m.method === "Network.responseReceived") {
        const r = network.get(m.params.requestId);
        if (r) r.status = m.params.response.status;
      }
      if (m.method === "Network.loadingFailed") {
        const r = network.get(m.params.requestId);
        if (r) r.status = r.status || -1;
      }
    });

    // —— 打开 URL ——
    await navigate(session, URL_ARG);

    // —— 帧序列：Page.startScreencast（JPEG q60，体积约为 PNG 的 1/4~1/8；浏览器侧缩到 maxWidth）。
    //    门控用**字节预算**而非固定时间间隔：帧到达是突发的（合成器节奏不可控），字节预算
    //    让「能存多少存多少」与「总量不爆」同时成立；超预算/超张数只计数丢弃并在 manifest 记录。
    let framesSaved = 0;
    let frameBytes = 0;
    let framesDropped = 0;
    const offFrames = session.addListener((m) => {
      if (m.method !== "Page.screencastFrame") return;
      const { data, sessionId } = m.params;
      try { session.send("Page.screencastFrameAck", { sessionId }); } catch { /* 会话已关 */ }
      const size = Math.floor((data.length * 3) / 4); // base64 → 字节估算
      if (framesSaved >= MAX_FRAMES || frameBytes + size > FRAME_BUDGET_BYTES) { framesDropped += 1; return; }
      const name = String(framesSaved).padStart(4, "0") + ".jpg";
      const buf = Buffer.from(data, "base64");
      writeFileSync(path.join(packDir, "video", "frames", name), buf);
      framesSaved += 1;
      frameBytes += buf.length;
    });
    await session.send("Page.startScreencast", {
      format: "jpeg", quality: 60, maxWidth: MAX_WIDTH, maxHeight: Math.round(MAX_WIDTH * (VIEWPORT.height / VIEWPORT.width)), everyNthFrame: 1,
    });

    // —— FPS 时间序列：页内持久采样器（rAF 1s 窗口），结束时快照读取 ——
    // 不用长 Promise 的 Runtime.evaluate：命令级超时（20s）会把它掐断，且阻塞一次往返。
    await session.evaluate(`(() => {
      window.__xhFpsSamples = [];
      let frames = 0; const start = performance.now(); let windowStart = start;
      const tick = () => {
        frames++;
        const now = performance.now();
        if (now - windowStart >= 1000) { window.__xhFpsSamples.push({ t: Math.round(now - start), fps: frames }); frames = 0; windowStart = now; }
        if (now - start < ${MAX_TOTAL_MS}) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })()`);

    // —— 逐步执行场景，每步留证 ——
    const stepRecords = [];
    const runNotes = [];
    let firstColorCount = null;
    let prevPoints = null;
    let idleFrameDiff = null;
    for (const [i, step] of scenario.steps.entries()) {
      if (offset() > MAX_TOTAL_MS) break;
      console.log(`  → step ${i + 1}/${scenario.steps.length} ${step.label}（${step.action}）开始`);
      const beforeCounters = await readTouchCounters(session);
      const stepStart = offset();
      let probeResult;
      let probeError;
      switch (step.action) {
        case "navigate":
          await navigate(session, step.params.url || URL_ARG);
          break;
        case "wait":
          await sleep(Math.min(Number(step.params.ms) || 0, MAX_TOTAL_MS));
          break;
        case "tap":
          await tap(session, Number(step.params.x) || 0, Number(step.params.y) || 0);
          await sleep(Number(step.params.settleMs) || 800);
          break;
        case "swipe":
        case "drag":
          await swipe(session, step.params.from || { x: 0, y: 0 }, step.params.to || { x: 0, y: 0 },
            { moveSteps: Number(step.params.moveSteps) || 10 });
          await sleep(Number(step.params.settleMs) || 800);
          break;
        case "pressKey":
          await pressKey(session, String(step.params.key || "ArrowUp"));
          await sleep(400);
          break;
        case "screenshot":
          await sleep(200);
          break;
        case "probe":
          try { probeResult = await session.evaluate(String(step.params.expr)); }
          catch (e) { probeError = String(e.message || e).slice(0, 300); }
          break;
      }
      const afterCounters = await readTouchCounters(session);
      // 截图 + 指纹：**全 Node 侧解码**（页面侧零图像工作）——页内 Image 解码曾在
      // swiftshader 下冻结渲染主线程 40s+，此路不通，不再回头。
      let shot = null;
      try { shot = await captureShot(session); }
      catch (e) { runNotes.push(`step ${step.label} 截图失败: ${String(e.message || e).slice(0, 150)}`); }
      const points = shot?.points ?? null;
      const frameDiff = diffPoints(prevPoints, points);
      const colorCount = new Set(points || []).size;
      if (firstColorCount === null) firstColorCount = colorCount;
      if (idleFrameDiff === null && frameDiff !== null) idleFrameDiff = frameDiff; // 首个观测段（多为加载后静止段）
      prevPoints = points;
      const fileName = `${String(i + 1).padStart(2, "0")}-${step.label.replace(/[^\w.\u4e00-\u9fff-]+/g, "-")}.png`;
      if (shot) writeFileSync(path.join(packDir, "steps", fileName), shot.png);
      const inputArrived = beforeCounters && afterCounters
        ? sumCounters(afterCounters) - sumCounters(beforeCounters) > 0
        : null;
      stepRecords.push({
        id: step.id, label: step.label, action: step.action,
        offsetMs: stepStart, durationMs: offset() - stepStart,
        inputArrived, frameDiff,
        responded: frameDiff === null ? null : frameDiff > 0,
        colorCount, screenshot: shot ? path.posix.join("steps", fileName) : null,
        ...(step.action === "probe" ? { probeResult: probeResult ?? null, probeError: probeError ?? null } : {}),
      });
      console.log(`  step ${step.label}（${step.action}）：frameDiff=${frameDiff} inputArrived=${inputArrived}${probeError ? ` probeError=${probeError}` : ""}`);
    }

    // —— 收尾：停帧采集、回收 FPS 序列 ——
    offFrames();
    try { await session.send("Page.stopScreencast"); } catch { /* 已停 */ }
    let fpsSamples = null;
    try { fpsSamples = await session.evaluate("window.__xhFpsSamples ?? []"); } catch { fpsSamples = null; }

    // —— 侧车文件 ——
    writeFileSync(path.join(packDir, "perf", "fps-series.json"),
      JSON.stringify({ method: "rAF-window-1s", samples: fpsSamples ?? [] }, null, 2));
    writeFileSync(path.join(packDir, "network", "waterfall.json"),
      JSON.stringify({ entries: [...network.values()] }, null, 2));
    writeFileSync(path.join(packDir, "console", "errors.json"),
      JSON.stringify({ errors: consoleErrors }, null, 2));

    // —— manifest（最后写，列出全部证据文件 + sha256）——
    const files = [];
    let packBytes = 0;
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) { walk(p); continue; }
        const rel = path.relative(packDir, p).split(path.sep).join("/");
        files.push({ path: rel, bytes: st.size, sha256: sha256(readFileSync(p)) });
        packBytes += st.size;
      }
    };
    walk(packDir);

    const hasRespondedStep = stepRecords.some((s) => s.responded === true);
    const animatedSomewhere = stepRecords.some((s) => (s.frameDiff ?? 0) > 0);
    const manifest = {
      schemaVersion: 1,
      kind: "experience-pack",
      evidenceOnly: true, // 提醒消费方：本包不含任何判定结论，判定归 G3/人
      generator: { name: "experience-harness", version: "0.1.0", entry: "scripts/pack.mjs" },
      url: URL_ARG,
      scenario: { name: scenario.name, steps: scenario.steps.map((s) => ({ id: s.id, action: s.action, label: s.label })) },
      params: { viewport: { ...VIEWPORT, ua: UA || "(default)" }, maxWidth: MAX_WIDTH, viewportName: VIEWPORT_NAME },
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: offset(),
      summary: {
        firstColorCount,
        idleFrameDiff,
        animatedSomewhere,
        hasRespondedStep,
        steps: stepRecords,
        consoleErrorCount: consoleErrors.length,
        networkRequestCount: network.size,
        networkFailures: [...network.values()].filter((r) => r.status >= 400 || r.status === -1 || r.status === 0).map((r) => `${r.status} ${r.url}`),
        fpsSeriesPoints: fpsSamples?.length ?? 0,
        framesSaved, framesDropped,
        frameBytes,
        packBytes,
      },
      notes: runNotes,
      files,
    };
    // canvasPresent 从 DOM 摘要补齐（单独一次求值，避免污染步骤记录）
    try {
      manifest.summary.canvasPresent = Boolean(await session.evaluate("document.querySelector('canvas') !== null"));
    } catch { manifest.summary.canvasPresent = null; }
    if (packBytes > 25 * 1024 * 1024) {
      manifest.notes.push(`包体积 ${packBytes} 字节超出 25MB 预算——缩短场景或降低帧预算`);
    }
    writeFileSync(path.join(packDir, "pack.json"), JSON.stringify(manifest, null, 2));

    console.log(`\nEXPERIENCE_PACK_DIR ${packDir}`);
    console.log(`EXPERIENCE_PACK: DONE screenshots=${stepRecords.length} frames=${framesSaved}(dropped ${framesDropped}) fpsPoints=${fpsSamples?.length ?? 0} consoleErrors=${consoleErrors.length} bytes=${packBytes}`);
    process.exit(0);
  } finally {
    try { session.close(); } catch { /* already closed */ }
  }
} catch (e) {
  console.error(`EXPERIENCE_PACK: FAIL — ${e.message}`);
  process.exit(1);
} finally {
  cleanup();
}
