#!/usr/bin/env node
// webapp-smoke.mjs — Web 应用移动端可用性模拟门禁：headless Chrome 以移动仿真
// （390×844 / DPR3 / 触摸 / iPhone UA）打开**部署后的 liveUrl**，机判「移动端能不能用」。
//
// 与 godot-game-dev 的 mobile-web-smoke.mjs 同范式（CDP 直驱 Chrome，零 npm 依赖，
// Node ≥22），但检查面按 Web 应用而非游戏产物裁剪：
//   ✂ 不要求 canvas / 渲染循环 / FPS / 音频解锁契约（静态页、无动画页都是合法形态）；
//   ✅ 新增「首屏有内容」硬检查（截图非纯色 + DOM 非空）；
//   ✅ 触摸事件到达 DOM 是硬检查；触摸后画面/状态响应降为 warning（静态页点击无反馈合理）。
//
// 用法：node webapp-smoke.mjs --url <liveUrl> [--out <证据目录>] [--chrome <路径>] [--seconds 60]
// 判定协议（对齐 GODOT_SMOKE / MOBILE_SMOKE 语义）：
//   退出码 0 = 通过；1 = 门禁失败；2 = 环境不可用（找不到 Chrome / Node 无 WebSocket——装环境不要改代码）
//   stdout 打印 WEBAPP_SMOKE: PASS / WEBAPP_SMOKE: FAIL <原因>（每条一行）
// 证据落盘（--out，默认 ./qa/mobile/）：report.json + phase-load.png / phase-tap.png
//
// 检查项（详见 report.json 的 checks 数组）：
//   1. 网络全通：关键资源（html/js/css/json/字体/svg/bin）非 2xx、任意请求 ≥500、
//      关键资源 3xx 跳登录页 → FAIL（附失败请求表）
//   2. console 零 error + 零未捕获异常（附错误文本表）
//   3. 首屏有内容：截图非纯色（400 点 16 级量化采样 ≥2 色）且 DOM 有内容（文本或内容元素）
//   4. 触摸/交互管线：tap 与滚动 swipe 后事件到达 DOM（壳没挡输入）——硬检查；
//      触摸后画面变化 → warning（静态页点击无视觉反馈是合法的）
//   5. 视口健康：无横向溢出（硬）；缺 viewport meta → warning

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile")));
const SECONDS = Number(flag("--seconds", "60"));
const PORT = Number(flag("--port", "0")) || 9400 + (process.pid % 500);
const CANDIDATES = [flag("--chrome", ""),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

// —— 移动仿真参数（iPhone 13 档：CSS 390×844 / DPR 3 / 触摸 / Safari UA）——
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// 关键资源后缀：缺一个页面就白屏/功能不可用；其余（favicon 等）404 只记 warning
const CRITICAL_EXT = [".html", ".js", ".mjs", ".css", ".json", ".ttf", ".woff", ".woff2", ".svg", ".bin"];

const say = (m) => console.log(m);
const results = [];   // { id, label, status: 'pass'|'fail'|'warn', detail }
const check = (id, label, ok, detail, warnOnly = false) => {
  const status = ok ? "pass" : warnOnly ? "warn" : "fail";
  results.push({ id, label, status, detail: detail ?? "" });
  say(`  ${status.toUpperCase().padEnd(4)}  ${label}${detail && !ok ? ` —— ${detail}` : ""}`);
  return ok;
};

function env2(message) { console.error(`WEBAPP_SMOKE: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`); process.exit(2); }

if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
let chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// —— 起 headless Chrome（CDP 端口 + 软件渲染兜底 + 独立 user-data-dir + 移动窗口尺寸）——
const profile = mkdtempSync(path.join(os.tmpdir(), "wa-smoke-"));
const cp = spawn(chrome, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${profile}`, `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
  "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const cleanup = () => { try { cp.kill(); } catch { /* 已退出 */ } };
process.on("exit", cleanup);

async function connectCdp(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

// ============ CDP 会话 ============
const ws = new WebSocket(await connectCdp());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  for (const l of listeners) l(m);
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const waitFor = (method, timeoutMs) => new Promise((res) => {
  const timer = setTimeout(() => { listeners.splice(listeners.indexOf(fn), 1); res(null); }, timeoutMs);
  const fn = (m) => { if (m.method === method) { clearTimeout(timer); listeners.splice(listeners.indexOf(fn), 1); res(m); } };
  listeners.push(fn);
});
// 在页面上下文执行表达式（awaitPromise 支持异步采样）
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error(`页面侧求值异常: ${d.exception?.description || d.text || "unknown"}`);
  }
  return r.result?.result?.value;
};

// ============ 证据收集器 ============
const consoleErrors = [];
const network = new Map();  // requestId → { url, status, critical }
const onEvent = (m) => {
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    consoleErrors.push(`未捕获异常: ${d?.exception?.description || d?.text || "unknown"}`);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push(`console.error: ${m.params.args?.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500)}`);
  }
  if (m.method === "Network.requestWillBeSent") {
    const { requestId, request, redirectResponse } = m.params;
    if (redirectResponse) network.set(requestId, { url: request.url, status: redirectResponse.status, location: redirectResponse.headers?.Location || "", critical: true });
    else network.set(requestId, { url: request.url, status: 0, location: "", critical: CRITICAL_EXT.some((e) => new URL(request.url, URL_ARG).pathname.toLowerCase().endsWith(e)) });
  }
  if (m.method === "Network.responseReceived") {
    const r = network.get(m.params.requestId);
    if (r) { r.status = m.params.response.status; r.location = m.params.response.headers?.Location || ""; }
    else network.set(m.params.requestId, { url: m.params.response.url, status: m.params.response.status, location: m.params.response.headers?.Location || "", critical: CRITICAL_EXT.some((e) => new URL(m.params.response.url, URL_ARG).pathname.toLowerCase().endsWith(e)) });
  }
  if (m.method === "Network.loadingFailed") {
    const r = network.get(m.params.requestId);
    if (r) r.status = r.status || -1;
  }
};
listeners.push(onEvent);

try {
  // ============ 移动仿真 + 预注入触摸探针 ============
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });
  // 触摸探针必须在文档创建前注入（capture+passive，不消费事件，不改变页面行为）
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__msTouch = { touchstart: 0, touchmove: 0, touchend: 0 };
    for (const t of ["touchstart", "touchmove", "touchend"]) {
      document.addEventListener(t, () => { window.__msTouch[t]++; }, { capture: true, passive: true });
    }` });

  // ============ 打开 liveUrl，等 load（或超时兜底）+ 首屏内容稳定 ============
  const loaded = waitFor("Page.loadEventFired", SECONDS * 1000);
  await send("Page.navigate", { url: URL_ARG });
  await loaded;
  // JS 渲染的内容可能晚于 load 事件：给首屏渲染留 settle 窗口（对齐真人打开页体的感知节奏）
  await sleep(2000);

  // —— 证据截图 helper：截图 + 页面内像素采样（浏览器原生解码 PNG，零依赖）——
  const shot = async () => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    const data = r.result?.data;
    if (!data) throw new Error(`captureScreenshot 失败: ${JSON.stringify(r.error ?? r).slice(0, 300)}`);
    return data;
  };
  const sampleFingerprint = async (base64) => await evaluate(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64," + ${JSON.stringify(base64)};
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const points = [];
    for (let i = 0; i < 400; i += 1) {
      const x = Math.floor((i * 7919) % image.width), y = Math.floor((i * 104729) % image.height);
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      points.push((r >> 4) + "," + (g >> 4) + "," + (b >> 4));   // 16 级量化，容忍压缩噪声
    }
    return points;
  })()`);

  mkdirSync(OUT_DIR, { recursive: true });
  const loadShot = await shot();
  writeFileSync(path.join(OUT_DIR, "phase-load.png"), Buffer.from(loadShot, "base64"));
  const loadFingerprint = await sampleFingerprint(loadShot);
  const colorCount = new Set(loadFingerprint).size;

  // ============ 触摸：tap 屏幕中心 → 垂直滚动 swipe ============
  const touch = async (points, type) => send("Input.dispatchTouchEvent", {
    type, touchPoints: points, modifiers: 0,
  });
  const cx = Math.round(VIEWPORT.width / 2), cy = Math.round(VIEWPORT.height / 2);
  await touch([{ x: cx, y: cy, id: 1 }], "touchStart");
  await touch([], "touchEnd");
  await sleep(1200);
  const tapShot = await shot();
  writeFileSync(path.join(OUT_DIR, "phase-tap.png"), Buffer.from(tapShot, "base64"));
  const tapFingerprint = await sampleFingerprint(tapShot);
  const tapDiff = loadFingerprint.filter((c, i) => c !== tapFingerprint[i]).length;
  const tapCounters = await evaluate("window.__msTouch ? JSON.parse(JSON.stringify(window.__msTouch)) : null");
  const errorsAfterTap = consoleErrors.length;

  // 垂直滚动 swipe：屏幕中部 (195, 500) → (195, 300)（列表/长页滚动的典型手势）
  await touch([{ x: 195, y: 500, id: 1 }], "touchStart");
  for (let y = 490; y >= 300; y -= 20) { await touch([{ x: 195, y, id: 1 }], "touchMove"); await sleep(40); }
  await touch([], "touchEnd");
  await sleep(800);
  const swipeCounters = await evaluate("window.__msTouch ? JSON.parse(JSON.stringify(window.__msTouch)) : null");

  // ============ 页面状态采样 ============
  const domContent = await evaluate(`(() => {
    const text = (document.body?.innerText || "").trim();
    const contentEl = document.querySelector("img, svg, canvas, form, input, button, table, video, iframe");
    return { textLength: text.length, hasContentElement: Boolean(contentEl), textHead: text.slice(0, 60) };
  })()`);
  const viewportInfo = await evaluate(`(() => {
    const de = document.documentElement;
    return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth,
             hasViewportMeta: !!document.querySelector('meta[name="viewport"]') };
  })()`);

  // ============ 判定 ============
  say(`\n===== webapp-smoke（${URL_ARG}，${VIEWPORT.width}×${VIEWPORT.height} 移动仿真）=====`);

  // 1. 网络全通
  const failures = [];
  const warnings = [];
  for (const r of network.values()) {
    const isLoginRedirect = r.status >= 300 && r.status < 400 && /login|auth|signin/i.test(r.location || "");
    if (r.status >= 500 || r.status === 0 || r.status === -1) failures.push(`${r.status || "无响应"} ${r.url}`);
    else if (isLoginRedirect && r.critical) failures.push(`${r.status}→${r.location} ${r.url}（登录墙：公网路径未走 /api/public/* 放行通道）`);
    else if ((r.status === 404 || r.status === 403) && r.critical) failures.push(`${r.status} ${r.url}（关键资源不可得：相对路径/资产清单排查）`);
    else if (r.status >= 400) warnings.push(`${r.status} ${r.url}`);
  }
  check("network", "关键资源网络全通（无 5xx / 404 / 登录墙重定向）", failures.length === 0, failures.slice(0, 6).join("；"));
  if (warnings.length) check("network-warn", "非关键资源异常（不阻断）", false, warnings.slice(0, 4).join("；"), true);

  // 2. console 零 error
  check("console", "console 零 error + 零未捕获异常", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  // 3. 首屏有内容（Web 应用的「画面真渲染」等价物：白屏 = 致命缺陷）
  check("render", "首屏截图非纯色（400 点采样 ≥2 种量化色）", colorCount >= 2, `采样仅 ${colorCount} 种颜色——页面没渲染出来（白屏/黑屏）`);
  const hasDomContent = domContent.textLength > 0 || domContent.hasContentElement;
  check("content", "DOM 有内容（文本非空或存在内容元素）", hasDomContent,
    `innerText=${domContent.textLength} 字、无 img/svg/form/button 等内容元素——结构没挂载或被壳挡住`);

  // 4. 触摸/交互管线（事件到达是硬检查；到达后的视觉响应只告警——静态页点击无反馈合法）
  const touchArrived = tapCounters && (tapCounters.touchstart > 0 || tapCounters.touchend > 0);
  check("touch-pipeline", "触摸事件到达 DOM（tap 与滚动 swipe 均被派发）",
    Boolean(touchArrived && swipeCounters && swipeCounters.touchmove > 0),
    `tap=${JSON.stringify(tapCounters)} swipe=${JSON.stringify(swipeCounters)}——事件没到页面=壳层挡了输入`);
  const touchResponded = tapDiff > 0 || errorsAfterTap > 0;
  if (!touchResponded) check("touch-response", "触摸后画面有变化或产生新活动（静态页可为 0，仅提示）", false,
    "tap 后画面零变化——若页面本就无点击交互属正常；有按钮/交互元素则检查事件绑定", true);

  // 5. 视口健康
  check("viewport", "无横向溢出（scrollWidth ≤ clientWidth+1）",
    viewportInfo.scrollWidth <= viewportInfo.clientWidth + 1, `scrollWidth=${viewportInfo.scrollWidth} vs clientWidth=${viewportInfo.clientWidth}`);
  if (!viewportInfo.hasViewportMeta) check("viewport-meta", "viewport meta 存在", false, "缺少 <meta name=viewport>——移动端会按桌面宽度渲染后缩放", true);

  // ============ report.json ============
  const failed = results.filter((r) => r.status === "fail");
  const report = {
    verdict: failed.length === 0 ? "PASS" : "FAIL",
    url: URL_ARG, preset: { ...VIEWPORT, ua: UA }, checkedAt: new Date().toISOString(),
    checks: results, metrics: { colorCount, tapDiff, ...domContent, ...viewportInfo },
    networkFailures: failures, networkWarnings: warnings,
    consoleErrors: consoleErrors.slice(0, 20),
    touchCounters: { afterTap: tapCounters, afterSwipe: swipeCounters },
    evidence: ["phase-load.png", "phase-tap.png"],
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  say(`\n===== webapp-smoke 汇总（证据：${OUT_DIR}）=====`);
  if (failed.length > 0) {
    say(`WEBAPP_SMOKE: FAIL（${failed.length} 项未过：${failed.map((f) => f.id).join("、")}）——诊断先读 ${path.join(OUT_DIR, "report.json")} 与分阶段截图`);
    process.exit(1);
  }
  say("WEBAPP_SMOKE: PASS 移动端模拟全绿（网络/console/首屏内容/触摸管线/视口）");
  process.exit(0);
} catch (e) {
  console.error(`WEBAPP_SMOKE: FAIL — CDP 阶段异常：${e.message}`);
  process.exit(1);
} finally {
  try { ws.close(); } catch { /* already closed */ }
}
