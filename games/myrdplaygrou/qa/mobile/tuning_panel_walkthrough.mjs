#!/usr/bin/env node
// tuning_panel_walkthrough.mjs — 「试玩反馈四问」回填面板线上可交互性走查（取证工具，非门禁）。
//
// 分工：门禁（mobile-web-smoke / audio_energy_probe）判「能不能玩 / 真的出声」；本脚本只回答
// 「调参工作台 ?tuning=1 的四问回填面板在线上是否真的出现、点按是否真的有响应、且走查过程
// 零提交」。判定纪律：面板答案只来自用户亲手点选 —— 本脚本**永不点「提交」按钮、永不向
// api/public/feedback/spec-revision POST 任何答案**，提交前/后各回读一次中继做「零写入」对证；
// 主观评价回填归用户，本脚本只证明「面板可交互」这一客观事实。
//
// 方法（复用 audio_energy_probe.mjs 的零依赖 CDP 管线）：
//   ① 移动仿真打开 <liveUrl>?tuning=1（390×844 / DPR3 / 触摸 / iPhone UA）；
//   ② 等引擎 canvas + 截 phase-1-panel.png（面板在场取证）；
//   ③ --tap x,y 指定 CSS 坐标点按一次（四问答案按钮），截 phase-2-answered.png；
//   ④ 页面内取证：window.__TUNING_FEEDBACK__（提交后才由面板发布）必须恒 undefined；
//   ⑤ 中继零写入对证：走查前/后 GET api/public/feedback/spec-revision/latest，
//      两者都应 no-submission-yet（或前后一致）→ 走查没有代替用户写入任何答案。
//
// 用法：
//   node tuning_panel_walkthrough.mjs --url <liveUrl> [--out <证据目录>] [--tap <x>,<y>] [--chrome <路径>]
// 退出码：0 = 走查完成（取证成功，不代表用户已回填）；2 = 环境不可用。
// 证据落盘（--out）：walkthrough-report.json + phase-1-panel.png + phase-2-answered.png

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile", "tuning-walkthrough")));
const TAP = flag("--tap", "");            // "x,y" CSS 像素；不传 = 只做「面板在场」取证
const PORT = Number(flag("--port", "0")) || 9600 + (process.pid % 300);
const CANDIDATES = [flag("--chrome", ""),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env2(message) {
  console.error(`TUNING_WALKTHROUGH: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`);
  process.exit(2);
}
if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
let chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

// 中继回读（不走浏览器，直连宿主）：走查零写入的客观对证
const relayLatest = async (base) => {
  const p = new URL(base);
  const root = `${p.protocol}//${p.host}${p.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}`;
  try {
    const r = await fetch(`${root}/api/public/feedback/spec-revision/latest`);
    const body = r.text ? await r.text() : "";
    return { status: r.status, body: body.slice(0, 300) };
  } catch (e) {
    return { status: -1, body: String(e) };
  }
};

const before = await relayLatest(URL_ARG);
say(`── 中继回读（走查前）：HTTP ${before.status} ${before.body.slice(0, 120)}`);

const chromeArgs = [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "tuning-walk-"))}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--disable-gpu-sandbox", "--hide-scrollbars",
];
const cp = spawn(chrome, [...chromeArgs, "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { cp.kill(); } catch { /* 已退出 */ } };
process.on("exit", cleanup);

async function connectCdp(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(250);
  }
  throw new Error("CDP 连接超时");
}

const ws = new WebSocket(await connectCdp());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error(`页面侧求值异常: ${d.exception?.description || d.text || "unknown"}`);
  }
  return r.result?.result?.value;
};
const waitForExpr = async (expr, timeoutMs, pollMs = 500) => {
  for (let waited = 0; waited <= timeoutMs; waited += pollMs) {
    try { if (await evaluate(expr)) return true; } catch { /* 页面未就绪 */ }
    await sleep(pollMs);
  }
  return false;
};

const report = {
  tool: "tuning_panel_walkthrough.mjs",
  url: URL_ARG,
  tap: TAP || null,
  checkedAt: new Date().toISOString(),
  relay: { before, after: null },
  panelVisible: null,
  tuningBridgeRaw: null,
  tuningFeedbackWindow: null,
  canvasRect: null,
  screenshots: [],
  notes: "取证工具：只证明面板可交互；不点提交、不代填；主观评价归用户。",
};

try {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });

  // ?tuning=1（=1 与 ?tuning 均命中面板 is_enabled；用显式 =1 对齐交付指引的入口形态）
  const sep = URL_ARG.includes("?") ? "&" : "?";
  await send("Page.navigate", { url: `${URL_ARG}${sep}tuning=1` });

  const canvasReady = await waitForExpr(`!!document.querySelector('canvas')`, 60000);
  if (!canvasReady) throw new Error("canvas 未挂载（页面加载失败）");
  await sleep(4000); // 引擎起播 + 面板 _ready

  const canvasRect = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  report.canvasRect = canvasRect;

  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: canvasRect.width, height: canvasRect.height, scale: 1 } });
    const data = r.result?.data;
    if (!data) throw new Error("captureScreenshot 失败");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, name), Buffer.from(data, "base64"));
    report.screenshots.push(name);
    return data;
  };

  // 面板在场取证：调参桥在壳层 parse 后暴露 __GAME_TUNING__；面板本体是 canvas 内像素，
  // 「在场」由截图 + 下一相位点按响应共同作证。
  report.tuningBridgeRaw = await evaluate(`JSON.stringify({ href: location.href, hasGameTuning: ('__GAME_TUNING__' in window), audioDebug: typeof window.__audioDebug })`);
  const shot1 = await shot("phase-1-panel.png"); // 相位 1 截图：面板在场取证（shot1 供后续相位引用）

  if (TAP) {
    const [tx, ty] = TAP.split(",").map((n) => Number(n.trim()));
    say(`── 点按 (${tx},${ty})（四问答案按钮；绝不点「提交」）──`);
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx, y: ty, id: 1 }], modifiers: 0 });
    await sleep(60);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
    await sleep(1200); // 面板选中态/提交按钮可用态刷新
    await shot("phase-2-answered.png");
    report.tapDispatched = true;
  }

  report.tuningFeedbackWindow = await evaluate(`JSON.stringify({ hasTuningFeedback: ('__TUNING_FEEDBACK__' in window), value: window.__TUNING_FEEDBACK__ === undefined ? "undefined" : JSON.stringify(window.__TUNING_FEEDBACK__).slice(0,200) })`);

  report.after = await relayLatest(URL_ARG);
  report.relay.after = report.after;
  say(`── 中继回读（走查后）：HTTP ${report.after.status} ${report.after.body.slice(0, 120)}`);
  report.zeroWrite = JSON.stringify(report.relay.before.body) === JSON.stringify(report.relay.after.body)
    && !/"received":true/.test(report.relay.after.body);
  say(`── 零写入对证：${report.zeroWrite ? "PASS（中继无新增提交，未代填）" : "FAIL（中继出现新增提交——异常，需人工核查）"}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "walkthrough-report.json"), JSON.stringify(report, null, 2));
  say(`TUNING_WALKTHROUGH: DONE（证据：${OUT_DIR}）`);
  process.exit(0);
} catch (e) {
  report.error = String(e);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "walkthrough-report.json"), JSON.stringify(report, null, 2));
  console.error(`TUNING_WALKTHROUGH: FAIL(1) — ${e}`);
  process.exit(1);
}
