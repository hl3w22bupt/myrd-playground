#!/usr/bin/env node
// shell-energy-contract.mjs — 本地诊断：验证壳层 __audioDebug().getOutputEnergy 契约
// （spec audio.outputEnergyProbe = playtest 节点「真实输出能量>阈值」机判的数据面）。
// 与 audio_energy_probe.mjs 的区别：本脚本不注入任何探针 —— 完全生产形态，只靠壳层自身插桩。
// 判据（spec outputEnergyProbe）：
//   debug.energyProbe === true
//   手势后 getOutputEnergy(250) × 2 → 连续两窗 rms > 0.01
//   静音后 getOutputEnergy(400) → rms ≤ 0.001
//   取消静音后 getOutputEnergy(400) → rms > 0.01
// 退出码：0 = PASS；1 = FAIL；2 = 环境不可用。仅本地诊断用，不是门禁。
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const URL_ARG = process.argv[2] || "";
const PORT = 9777;
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESIGN = { w: 1024, h: 640 };
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env2(m) { console.error(`SHELL_ENERGY: FAIL(2) — ${m}`); process.exit(2); }
if (!URL_ARG) env2("缺少 URL 参数");
if (typeof WebSocket === "undefined") env2("需 Node ≥22（全局 WebSocket）");
const CANDIDATES = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"];
const chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome");

const cp = spawn(chrome, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "shell-energy-"))}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--disable-gpu-sandbox", "--hide-scrollbars",
  "--autoplay-policy=document-user-activation-required", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => { try { cp.kill(); } catch { /* noop */ } });

let wsUrl = null;
for (let i = 0; i < 60; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const page = list.find((t) => t.type === "page");
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch { /* not ready */ }
  await sleep(250);
}
if (!wsUrl) env2("CDP 连接超时");

const ws = new WebSocket(wsUrl);
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
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
  return r.result?.result?.value;
};
const waitForExpr = async (expr, timeoutMs, pollMs = 500) => {
  for (let w = 0; w <= timeoutMs; w += pollMs) {
    try { if (await evaluate(expr)) return true; } catch { /* not ready */ }
    await sleep(pollMs);
  }
  return false;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setUserAgentOverride", { userAgent: UA });
await send("Page.navigate", { url: URL_ARG });
if (!await waitForExpr("document.querySelector('canvas') !== null", 60000)) env2("canvas 未挂载");
if (!await waitForExpr("typeof window.__audioDebug === 'function'", 120000, 1000)) env2("__audioDebug 缺失");
await sleep(4000);

const rect = await evaluate("(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()");
const S = Math.min(rect.width / DESIGN.w, rect.height / DESIGN.h);
const OX = (rect.width - DESIGN.w * S) / 2, OY = (rect.height - DESIGN.h * S) / 2;
const css = (dx, dy) => ({ x: Math.round(OX + dx * S), y: Math.round(OY + dy * S) });
const touch = async (x, y) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }], modifiers: 0 });
  await sleep(60);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
};
const energy = (ms) => evaluate(`window.__audioDebug().getOutputEnergy(${ms}).then(e => JSON.stringify(e))`).then((s) => JSON.parse(s));

// 契约 0：探针标志位
const dbg = await evaluate("(() => { const d = window.__audioDebug(); return { energyProbe: d.energyProbe, state: d.state }; })()");
say(`energyProbe=${dbg.energyProbe} state=${dbg.state}`);
let ok = true;
ok = ok && dbg.energyProbe === true;

// 手势前：getOutputEnergy 应报告未运行/零能量
const pre = await energy(250);
say(`手势前 energy=${JSON.stringify(pre)}`);
ok = ok && (pre.running === false || pre.rms <= 0.001);

// 找选关绿色按钮（FlatUI.GREEN_LIGHT）
const shotR = await send("Page.captureScreenshot", { format: "png" });
const greenCenter = await evaluate(`(async () => {
  const image = new Image();
  image.src = "data:image/png;base64," + ${JSON.stringify(shotR.result.data)};
  await new Promise((res) => { image.onload = res; });
  const k = image.width / ${rect.width};
  const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
  const ctx = c.getContext("2d"); ctx.drawImage(image, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    const i = (Math.round(y) * c.width + x) * 4;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 160 && g - r > 60 && g - b > 40 && r > 40) pts.push({ x, y });
  }
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x: Math.round(Math.min(...xs) / k), y: Math.round(Math.min(...ys) / k),
    width: Math.round((Math.max(...xs) - Math.min(...xs)) / k), height: Math.round((Math.max(...ys) - Math.min(...ys)) / k) };
})()`);
if (!greenCenter) env2("选关页绿色按钮未找到（画面没起来）");
await touch(greenCenter.x + Math.round(greenCenter.width / 2), greenCenter.y + Math.round(greenCenter.height / 2));
await sleep(2500);

// 契约 1：手势后连续两窗 rms > 0.01
const w1 = await energy(250), w2 = await energy(250);
say(`手势后 W1=${JSON.stringify(w1)}`);
say(`手势后 W2=${JSON.stringify(w2)}`);
const audible = w1.rms > 0.01 && w2.rms > 0.01;
ok = ok && audible;
say(`${audible ? "PASS" : "FAIL"} 真实出声（连续两窗 RMS > 0.01）`);

// 契约 2：静音后 rms ≤ 0.001
await touch(css(984, 32).x, css(984, 32).y);
await sleep(2500);
const wm = await energy(400);
say(`静音后=${JSON.stringify(wm)}`);
const silenced = wm.rms <= 0.001;
ok = ok && silenced;
say(`${silenced ? "PASS" : "FAIL"} 静音后真实静默（RMS ≤ 0.001）`);

// 契约 3：取消静音后恢复
await touch(css(984, 32).x, css(984, 32).y);
await sleep(3000);
const wu = await energy(400);
say(`取消静音后=${JSON.stringify(wu)}`);
const recovered = wu.rms > 0.01;
ok = ok && recovered;
say(`${recovered ? "PASS" : "FAIL"} 取消静音后恢复出声（RMS > 0.01）`);

console.log(ok ? "SHELL_ENERGY: PASS" : "SHELL_ENERGY: FAIL");
process.exit(ok ? 0 : 1);
