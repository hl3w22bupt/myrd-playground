// diagnose-tap.mjs —— touch-response FAIL 的取证脚本（诊断用，非判定器）。
// 复刻 mobile-web-smoke.mjs 的 CDP 移动仿真方案，对比两个 tap 点的行为：
//   A. (195,422) 门禁几何中心 —— 预期落在菜单两难度按钮的空隙，无响应；
//   B. (195,490) 「开始（轻松 4×4）」按钮 —— 预期进局，证明触摸管线端到端可用。
// 证据落本目录：diag-menu.png / diag-center-tap.png / diag-start-tap.png + diag.json
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const URL_ARG = "https://leomac-studio.tail49399e.ts.net/apps/game-9/";
const OUT = path.dirname(new URL(import.meta.url).pathname);
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PORT = 9300 + (process.pid % 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].find((c) => !c.includes("/") || existsSync(c));
const profile = mkdtempSync(path.join(os.tmpdir(), "diag-tap-"));
const cp = spawn(chrome, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--use-angle=swiftshader", `--user-data-dir=${profile}`, `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
  "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
process.on("exit", () => { try { cp.kill(); } catch { /* 已退出 */ } });

for (let i = 0; i < 60; i++) {
  try { const l = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    var page = l.find((t) => t.type === "page"); if (page) break; } catch { /* 未就绪 */ }
  await sleep(200);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails?.exception?.description || "eval fail");
  return r.result?.result?.value;
};
const touch = async (points, type) => send("Input.dispatchTouchEvent", { type, touchPoints: points, modifiers: 0 });
const tap = async (x, y) => {
  await touch([{ x, y, id: 1 }], "touchStart"); await sleep(60);
  await touch([{ x, y, id: 1 }], "touchEnd"); await sleep(60);
};
const shot = async (file) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, "base64"));
  return file;
};

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setUserAgentOverride", { userAgent: UA });
await send("Page.navigate", { url: URL_ARG });

// 等引擎启动 + 引导层隐藏（最长 90s），再等菜单动画收敛
let bootHidden = false;
for (let i = 0; i < 90; i++) {
  bootHidden = await evaluate("(function(){var b=document.getElementById('boot');return !b||b.classList.contains('hidden');})()");
  if (bootHidden) break;
  await sleep(1000);
}
await sleep(4000);
const findings = { bootHiddenMs: bootHidden, steps: [] };
await shot("diag-menu.png");

// —— A. 门禁几何中心 ——
const beforeA = await evaluate("document.body.innerHTML.length");
await tap(195, 422); await sleep(1500);
await shot("diag-center-tap.png");
findings.steps.push({ step: "A center(195,422)", note: "gate tap point" });

// —— B. 开始按钮 ——
await tap(195, 490); await sleep(2500);
await shot("diag-start-tap.png");
findings.steps.push({ step: "B start(195,490)", note: "开始（轻松 4×4）按钮" });
findings.consoleErrors = await evaluate("window.__diagErrors || []");
writeFileSync(path.join(OUT, "diag.json"), JSON.stringify(findings, null, 1));
console.log("DIAG DONE", JSON.stringify(findings));
process.exit(0);
