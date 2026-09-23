// artshot.mjs — 美术自检截图（CDP 驱动，零依赖）：打开 ?smoke=<秒> 的游玩中视角，存证甲板画面。
// 用途：风格统一核对（调色板/光照/线条/比例）、资产接线后的视觉回归。不改玩法，只截图。
// 用法：node tools/artshot.mjs --out <path.png> [--seconds 6] [--port 9227] [--chrome <path>]
// 退出码：0 = 已截图；1 = 失败（浏览器不可用 / 渲染未出画）。
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CHROME = flag("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const PORT = Number(flag("--port", "9227"));
const SECONDS = Number(flag("--seconds", "6"));
const OUT = flag("--out", path.join(os.tmpdir(), "ts3d-artshot.png"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTRA_QUERY = flag("--query", ""); // 附加查询串（如 "&fire=4"），驱动表现层调试钩子
const url = `${flag("--url", `file://${root}/index.html`)}?smoke=${SECONDS}${EXTRA_QUERY}`;
const fail = (m) => { console.error(`ARTSHOT: FAIL ${m}`); process.exit(1); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForDebugger(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome 尚未就绪 */ }
    await sleep(300);
  }
  fail(`CDP 端口 ${PORT} 未就绪（20s）`);
}
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  const opened = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("WS 连接失败")); });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise(async (res) => {
    const mid = ++id; pending.set(mid, res); await opened; ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, events, close: () => ws.close() };
}

const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-art-"));
// --gpu 1：走真 GPU（默认 SwiftShader 软渲染，用于可复现的 CI 冒烟；软渲染可能有纹理绑定伪影）
const useGpu = flag("--gpu", "") === "1";
const chromeFlags = useGpu
  ? ["--headless=new", "--use-angle=metal", "--no-sandbox", "--disable-dev-shm-usage",
     `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1280,720", "about:blank"]
  : ["--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
     "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${PORT}`,
     `--user-data-dir=${profile}`, "--window-size=1280,720", "about:blank"];
const chrome = spawn(CHROME, chromeFlags, { stdio: "ignore" });

try {
  const cdp = connect(await waitForDebugger());
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable").catch(() => {});
  const evalJs = async (expr) => (await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

  await cdp.send("Page.navigate", { url });
  await sleep(Number(flag("--sleep", "2500"))); // 等 fastForward + 首帧渲染（长局表现取证可加大）
  const info = await evalJs(`(() => {
    const s = document.getElementById("ts-smoke");
    if (!s) return null;
    return { smoke: JSON.parse(s.textContent), errors: window.__errs ?? 0 };
  })()`);
  if (!info?.smoke?.ok) fail(`冒烟钩子未产出结果：${JSON.stringify(info)}`);
  if ((info.smoke.drawCalls ?? 0) <= 0) fail("渲染未出画（drawCalls=0）");

  // 可选：场景探针/改装（--eval <js>，先于截图执行 —— 可临时隐藏对象做「排除法」美术自检）
  const expr = flag("--eval", "");
  if (expr) {
    const v = await evalJs(expr);
    console.log(`  eval = ${JSON.stringify(v)}`);
  }

  // 可选：控制台采集（--console，查 shader 警告 / 资产降级告警）
  if (flag("--console", "")) {
    const logs = cdp.events
      .filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Log.entryAdded")
      .map((e) => {
        const t = e.params.type ?? e.params.entry?.level ?? "log";
        const txt = e.params.args?.map((a) => a.value ?? a.description).join(" ")
          ?? e.params.entry?.text ?? "";
        return `[${t}] ${String(txt).slice(0, 220)}`;
      });
    console.log(`  console(${logs.length} 条):`);
    for (const l of logs.slice(0, 12)) console.log(`    ${l}`);
  }

  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const data = shot.result?.data;
  if (!data) fail("captureScreenshot 未返回数据");
  writeFileSync(OUT, Buffer.from(data, "base64"));
  console.log(`ARTSHOT: PASS ${OUT}`);
  console.log(`  smoke = ${JSON.stringify(info.smoke)}`);
} catch (e) {
  fail(e?.message ?? String(e));
} finally {
  chrome.kill("SIGKILL");
}
