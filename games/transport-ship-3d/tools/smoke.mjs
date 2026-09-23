// smoke.mjs — Web 冒烟门禁：headless Chrome（CDP 驱动）打开产物，断言「打开即玩 + 核心循环推进」。
// 断言链：页面可打开 → 零未捕获异常 → 渲染管线出画（draw calls/triangles）→ 内核时间推进（核心循环在跑）
//         → fastForward 推到 gameover → 重玩钩子落账（localStorage）→ 重开页面标题屏回显最高分。
// 用法：node tools/smoke.mjs [--chrome <path>] [--port 9223] [--fastforward 60]
// 退出码：0 = 冒烟通过；1 = 失败（浏览器不可用 / 页面异常 / 循环未推进 / 钩子未落账）。
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CHROME = flag("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const PORT = Number(flag("--port", "9223"));
const FAST_FORWARD = Number(flag("--fastforward", "60"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = `file://${root}/index.html`;

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
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
  throw new Error(`CDP 端口 ${PORT} 未就绪（20s）`);
}

/** 最小 CDP 客户端：id 化请求 + 事件收集（zero 依赖）*/
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
    const mid = ++id;
    pending.set(mid, res);
    await opened;
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, events, close: () => ws.close() };
}

const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-smoke-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "--window-size=1280,720", "about:blank",
], { stdio: "ignore" });

try {
  const wsUrl = await waitForDebugger();
  const cdp = connect(wsUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const evalJs = async (expr) => (await cdp.send("Runtime.evaluate", {
    expression: expr, returnByValue: true, awaitPromise: true,
  })).result?.result?.value;

  // ① 打开产物（?smoke=8：初始化即快进 8 秒并显式渲染一帧）
  await cdp.send("Page.navigate", { url: `${base}?smoke=8` });
  await sleep(2500);
  const smokePayload = await evalJs(`document.getElementById("ts-smoke")?.textContent ?? ""`);
  const smoke = smokePayload ? JSON.parse(smokePayload) : null;
  check(!!smoke?.ok, "页面打开且冒烟钩子产出结果", smokePayload.slice(0, 120));
  check((smoke?.drawCalls ?? 0) > 0 && (smoke?.triangles ?? 0) > 0,
    "渲染管线出画", `drawCalls=${smoke?.drawCalls} triangles=${smoke?.triangles}`);

  // ② 核心循环推进：等 rAF 真跑，内核 time 必须增长
  const t0 = await evalJs(`window.__game.world.time`);
  await sleep(1200);
  const t1 = await evalJs(`window.__game.world.time`);
  check(t1 > t0, "核心循环推进（内核固定步长累计）", `time ${t0.toFixed(2)}s → ${t1.toFixed(2)}s`);

  // ③ 快进到阵亡 → gameover 分支落账重玩钩子
  await evalJs(`window.__game.fastForward(${FAST_FORWARD})`);
  await sleep(1500);
  const overState = await evalJs(`({ state: window.__game.state, over: window.__game.world.over })`);
  check(overState.over === true && overState.state === "gameover", "血量归零进入结算态", JSON.stringify(overState));
  const replay = await evalJs(`JSON.parse(localStorage.getItem("ts3d.replay") ?? "{}")`);
  check(typeof replay?.waveStreak === "number", "replayHooks 落账 localStorage", JSON.stringify(replay));

  // ④ 重开（同 profile）→ 标题屏回显最高分
  await cdp.send("Page.navigate", { url: base });
  await sleep(1500);
  const best = await evalJs(`document.getElementById("ts-best")?.textContent ?? ""`);
  check(best.includes("最高"), "标题屏回显最高分（spec.content.replayHooks）", best);

  const uncaught = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
  check(uncaught.length === 0, "零未捕获异常", uncaught.length ? JSON.stringify(uncaught[0]).slice(0, 200) : "0 个");

  // 可选：截图存证（--screenshot <path>，标题屏含重玩钩子回显）
  const shotPath = flag("--screenshot", "");
  if (shotPath) {
    const data = (await cdp.send("Page.captureScreenshot", { format: "png" })).result?.data;
    writeFileSync(shotPath, Buffer.from(data, "base64"));
    console.log(`  PASS  截图存证 — ${shotPath}`);
  }

  cdp.close();
} catch (err) {
  failures.push(`smoke 执行中断: ${err.message}`);
  console.error(`  FAIL  smoke 执行中断 — ${err.message}`);
} finally {
  chrome.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
}

console.log(failures.length === 0 ? "SMOKE: PASS 打开即玩 + 核心循环可玩" : `SMOKE: FAIL ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
