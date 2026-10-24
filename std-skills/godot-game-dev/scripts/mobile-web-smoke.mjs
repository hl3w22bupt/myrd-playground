#!/usr/bin/env node
// mobile-web-smoke.mjs — 移动端可玩性模拟门禁：headless Chrome 以移动仿真（390×844 / DPR3 /
// 触摸 / iPhone UA）打开**部署后的 liveUrl**，机判「移动端能不能玩」。
//
// 为什么测部署后 URL 而不是本地导出目录：M1 网关只透传文本（wasm/pck 走 base64 文本通道、
// 壳端 DecompressionStream 解压、子资源必须相对路径）—— 移动端黑屏的三大根因
// （壳解压失败 / 绝对路径 404 / 网关 502 UNSUPPORTED_BINARY）只在真实部署链路上暴露，
// 本地静态伺服测不到。
//
// 与 godot-smoke（无头 Godot，引擎层「能不能跑」）互补：本门禁测的是 Web 产物在移动
// viewport + 触摸语义下「能不能玩」。范式复用 threejs browser-smoke.mjs：零 npm 依赖，
// CDP 直驱 Chrome（Node ≥22 内置 fetch/WebSocket）。
//
// 用法：node mobile-web-smoke.mjs --url <liveUrl> [--out <证据目录>] [--chrome <路径>] [--seconds 60]
// 判定协议（对齐 GODOT_SMOKE 语义）：
//   退出码 0 = 通过；1 = 门禁失败；2 = 环境不可用（找不到 Chrome / Node 无 WebSocket——装环境不要改代码）
//   stdout 打印 MOBILE_SMOKE: PASS / MOBILE_SMOKE: FAIL <原因>（每条一行）
// 证据落盘（--out，默认 ./qa/mobile/）：report.json + phase-load.png / phase-tap.png / phase-joystick.png
//
// 检查项（详见 report.json 的 checks 数组）：
//   1. 网络全通：关键资源（wasm/pck/js/data/json/html/字体/bin）非 2xx、任意请求 ≥500、
//      关键资源 3xx 跳登录页 → FAIL（附失败请求表）
//   2. console 零 error + 零未捕获异常（附错误文本表）
//   3. 画面真渲染：canvas 存在、首帧截图非纯色（400 点 16 级量化像素采样）、双时点帧差 > 0
//   4. 触摸管线：tap/swipe 后事件到达 DOM（壳没挡输入）；到达但画面无响应 → FAIL
//   5. 音频解锁契约：typeof window.__audioDebug === 'function'（壳硬契约的机判化）
//   6. 视口健康：无横向溢出；缺 viewport meta 记 warning
//   7. FPS 采样（informational，<8 才 FAIL；swiftshader 软渲染阈值放宽防假阳性）

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile")));
const SECONDS = Number(flag("--seconds", "60"));
const PORT = Number(flag("--port", "0")) || 9300 + (process.pid % 500);
const CANDIDATES = [flag("--chrome", ""),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

// —— 移动仿真参数（iPhone 13 档：CSS 390×844 / DPR 3 / 触摸 / Safari UA）——
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// 关键资源后缀：缺一个游戏就起不来/黑屏；其余（favicon 等）404 只记 warning
const CRITICAL_EXT = [".wasm", ".pck", ".js", ".mjs", ".data", ".json", ".html", ".ttf", ".woff", ".woff2", ".bin"];
const FPS_MIN = 8;

const say = (m) => console.log(m);
const results = [];   // { id, label, status: 'pass'|'fail'|'warn', detail }
const check = (id, label, ok, detail, warnOnly = false) => {
  const status = ok ? "pass" : warnOnly ? "warn" : "fail";
  results.push({ id, label, status, detail: detail ?? "" });
  say(`  ${status.toUpperCase().padEnd(4)}  ${label}${detail && !ok ? ` —— ${detail}` : ""}`);
  return ok;
};

function env2(message) { console.error(`MOBILE_SMOKE: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`); process.exit(2); }

if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
let chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// —— 起 headless Chrome（CDP 端口 + 软件渲染兜底 + 独立 user-data-dir + 移动窗口尺寸）——
const profile = mkdtempSync(path.join(os.tmpdir(), "ms-smoke-"));
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
  // 触摸探针必须在文档创建前注入（capture+passive，不消费事件，不改变游戏行为）
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__msTouch = { touchstart: 0, touchmove: 0, touchend: 0 };
    for (const t of ["touchstart", "touchmove", "touchend"]) {
      document.addEventListener(t, () => { window.__msTouch[t]++; }, { capture: true, passive: true });
    }` });

  // ============ 打开 liveUrl，等 load（或超时兜底） ============
  const loaded = waitFor("Page.loadEventFired", SECONDS * 1000);
  await send("Page.navigate", { url: URL_ARG });
  await loaded;
  // 引擎加载可能远晚于 load 事件：等 canvas 出现（godot/cocos/threejs 产物都有 canvas）
  let canvasSeen = false;
  for (let waited = 0; waited <= 20000; waited += 500) {
    canvasSeen = Boolean(await evaluate("document.querySelector('canvas') !== null"));
    if (canvasSeen) break;
    await sleep(500);
  }

  // —— 证据截图 helper：截图 + 页面内 canvas 像素采样（浏览器原生解码 PNG，零依赖）——
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
  await sleep(1500);
  const idleShot = await shot();
  const idleFingerprint = await sampleFingerprint(idleShot);
  const idleDiff = loadFingerprint.filter((c, i) => c !== idleFingerprint[i]).length;

  // ============ 触摸：tap 屏幕中心 → 摇杆区 swipe（左下 1/4） ============
  const errorsBeforeTouch = consoleErrors.length;
  const touch = async (points, type) => send("Input.dispatchTouchEvent", {
    type, touchPoints: points, modifiers: 0,
  });
  const cx = Math.round(VIEWPORT.width / 2), cy = Math.round(VIEWPORT.height / 2);
  await touch([{ x: cx, y: cy, id: 1 }], "touchStart");
  await touch([], "touchEnd");
  await sleep(1500);
  const tapShot = await shot();
  writeFileSync(path.join(OUT_DIR, "phase-tap.png"), Buffer.from(tapShot, "base64"));
  const tapFingerprint = await sampleFingerprint(tapShot);
  const tapDiff = idleFingerprint.filter((c, i) => c !== tapFingerprint[i]).length;
  const tapCounters = await evaluate("window.__msTouch ? JSON.parse(JSON.stringify(window.__msTouch)) : null");
  const errorsAfterTap = consoleErrors.length;

  // 摇杆区 swipe：起点左下 (90, 700)，向右推到 (170, 700)（TouchUI 虚拟摇杆典型热区）
  const joyY = VIEWPORT.height - 144;
  await touch([{ x: 90, y: joyY, id: 1 }], "touchStart");
  for (let x = 100; x <= 170; x += 10) { await touch([{ x, y: joyY, id: 1 }], "touchMove"); await sleep(40); }
  await touch([], "touchEnd");
  await sleep(1500);
  const joyShot = await shot();
  writeFileSync(path.join(OUT_DIR, "phase-joystick.png"), Buffer.from(joyShot, "base64"));
  const joyCounters = await evaluate("window.__msTouch ? JSON.parse(JSON.stringify(window.__msTouch)) : null");

  // ============ 页面状态采样 ============
  const audioDebug = await evaluate("typeof window.__audioDebug");
  const viewportInfo = await evaluate(`(() => {
    const de = document.documentElement;
    return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth,
             hasViewportMeta: !!document.querySelector('meta[name="viewport"]') };
  })()`);
  const fps = await evaluate(`new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => { frames++; if (performance.now() - start < 2000) requestAnimationFrame(tick); else resolve(Math.round(frames / 2)); };
    requestAnimationFrame(tick);
  })`);

  // ============ 判定 ============
  say(`\n===== mobile-web-smoke（${URL_ARG}，${VIEWPORT.width}×${VIEWPORT.height} 移动仿真）=====`);

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

  // 3. 画面真渲染
  check("canvas", "canvas 存在（引擎产物已挂载）", canvasSeen, canvasSeen ? "" : "20s 内未出现 canvas——引擎未启动/加载挂死");
  check("render", "首帧截图非纯色（400 点采样 ≥2 种量化色）", colorCount >= 2, `采样仅 ${colorCount} 种颜色——画面没渲染出来（黑屏/白屏）`);
  check("animate", "画面在动（1.5s 双时点帧差 > 0）", idleDiff > 0, `400 采样点零变化——主循环挂死或渲染冻结`);

  // 4. 触摸管线
  const touchArrived = tapCounters && (tapCounters.touchstart > 0 || tapCounters.touchend > 0);
  check("touch-pipeline", "触摸事件到达 DOM（tap/swipe 均被派发）",
    Boolean(touchArrived && joyCounters && joyCounters.touchmove > 0),
    `tap=${JSON.stringify(tapCounters)} swipe=${JSON.stringify(joyCounters)}——事件没到页面=壳层挡了输入`);
  const touchResponded = tapDiff > 0 || errorsAfterTap > errorsBeforeTouch;
  check("touch-response", "触摸后画面有响应（tap 后帧差 > 0 或产生新活动）", touchResponded,
    touchResponded ? "" : "输入到达但 3s 内画面零变化零活动——引擎忽略触摸（TouchUI/输入映射坏）。若游戏确为开局静止画面，在 qa/mobile/ 放说明文件并在产物 detail 注明豁免依据");

  // 5. 音频解锁契约（壳硬契约机判化：iOS AudioContext suspended/interrupted 需手势 resume）
  check("audio-unlock", "音频手势解锁器存在（window.__audioDebug）", audioDebug === "function",
    `typeof __audioDebug === ${JSON.stringify(audioDebug)}——缺解锁层 = 移动端全部音效静默且控制台零报错（取证：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md）`);

  // 6. 视口健康
  check("viewport", "无横向溢出（scrollWidth ≤ clientWidth+1）",
    viewportInfo.scrollWidth <= viewportInfo.clientWidth + 1, `scrollWidth=${viewportInfo.scrollWidth} vs clientWidth=${viewportInfo.clientWidth}`);
  if (!viewportInfo.hasViewportMeta) check("viewport-meta", "viewport meta 存在", false, "缺少 <meta name=viewport>——移动端会按桌面宽度渲染后缩放", true);

  // 7. FPS（软渲染阈值放宽，informational）
  check("fps", `FPS ≥ ${FPS_MIN}（swiftshader 软渲染口径）`, fps >= FPS_MIN, `实测 ${fps} fps`);

  // ============ report.json ============
  const failed = results.filter((r) => r.status === "fail");
  const report = {
    verdict: failed.length === 0 ? "PASS" : "FAIL",
    url: URL_ARG, preset: { ...VIEWPORT, ua: UA }, checkedAt: new Date().toISOString(),
    checks: results, metrics: { colorCount, idleDiff, tapDiff, fps, ...viewportInfo },
    networkFailures: failures, networkWarnings: warnings,
    consoleErrors: consoleErrors.slice(0, 20),
    touchCounters: { afterTap: tapCounters, afterSwipe: joyCounters },
    evidence: ["phase-load.png", "phase-tap.png", "phase-joystick.png"],
    exemptionNote: "touch-response 判 FAIL 但游戏确为开局静止画面时：在本目录放 EXEMPTION.md 说明依据，产物 detail 注明——不得无据豁免",
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  say(`\n===== mobile-web-smoke 汇总（证据：${OUT_DIR}）=====`);
  if (failed.length > 0) {
    say(`MOBILE_SMOKE: FAIL（${failed.length} 项未过：${failed.map((f) => f.id).join("、")}）——诊断先读 ${path.join(OUT_DIR, "report.json")} 与三张分阶段截图`);
    process.exit(1);
  }
  say("MOBILE_SMOKE: PASS 移动端模拟全绿（网络/渲染/触摸/音频契约/视口/FPS）");
  process.exit(0);
} catch (e) {
  console.error(`MOBILE_SMOKE: FAIL — CDP 阶段异常：${e.message}`);
  process.exit(1);
} finally {
  try { ws.close(); } catch { /* already closed */ }
}
