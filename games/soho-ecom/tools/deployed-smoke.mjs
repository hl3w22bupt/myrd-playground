#!/usr/bin/env node
// deployed-smoke.mjs — 部署版实测驱动（使用验收 · goal-cmvv02e7a0019m9uwy2nosbkn）：
// headless Chrome（CDP）直接打开**部署 URL**（默认平台网关 /apps/soho-ecom/gw），走产物侧 ?smoke=<游戏日数>
// 无头冒烟协议（与 main.js ?smoke 协议一致），提取 SMOKE JSON + 截图落盘 ——
// 实测对象是「部署版」本身，不是本地重建（部署产物指纹与仓库产物逐字节一致的核验见 docs/acceptance/）。
//
// 用法：node tools/deployed-smoke.mjs [--url <部署URL>] [--days 30] [--case fresh|broke|rich] [--out <json 路径>] [--shot <png 路径>] [--port 9229]
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE_URL = flag("--url", "http://localhost:3111/apps/soho-ecom/gw");
const DAYS = Number(flag("--days", "30"));
const CASE = flag("--case", "fresh");
const OUT = flag("--out", "");
const SHOT = flag("--shot", "");
const PORT = Number(flag("--port", "9229"));
const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

const chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) {
  console.error("DEPLOYED-SMOKE: FAIL — 找不到 Chrome/Chromium（--chrome 指定路径）");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = `${BASE_URL}?smoke=${DAYS}${CASE !== "fresh" ? `&case=${CASE}` : ""}`;

async function connectCdp(port, retries = 75) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

const profile = mkdtempSync(path.join(os.tmpdir(), `soho-accept-${CASE}-`));
const cp = spawn(chrome, [
  "--headless=new", "--remote-debugging-port=" + PORT, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--user-data-dir=" + profile, "--window-size=1280,800", "--disable-gpu-sandbox",
  url,
], { stdio: "ignore" });

let payload = null;
let outcome = "timeout";
let shotData = null;
let crashed = false;
try {
  const wsUrl = await connectCdp(PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Inspector.targetCrashed") crashed = true;
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");

  // 快进 DAYS 个游戏日 + 渲染 30 帧采样，留 90s 余量；crash 立即止损
  const deadline = Date.now() + 90_000 + DAYS * 300;
  while (Date.now() < deadline && !crashed) {
    await sleep(1000);
    const t = (await evaluate("document.title")) || "";
    if (t.startsWith("SMOKE ")) {
      try { payload = JSON.parse(t.slice(6)); outcome = "title"; } catch { outcome = "badjson"; }
      break;
    }
    const raw = await evaluate("document.getElementById('ts-smoke')?.textContent || ''");
    if (raw) {
      try { payload = JSON.parse(raw); outcome = "dom"; } catch { outcome = "badjson"; }
      break;
    }
  }
  if (crashed) outcome = "crashed";
  if (payload && SHOT) {
    try {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      shotData = shot.result?.data || null;
    } catch { shotData = null; }
  }
  ws.close();
} finally {
  cp.kill();
}

const report = {
  schemaVersion: 1,
  kind: "deployed-smoke-report",
  url,
  days: DAYS,
  case: CASE,
  outcome,
  crashed,
  payload,
  capturedAt: new Date().toISOString(),
};
if (OUT) {
  mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
}
if (SHOT && shotData) {
  mkdirSync(path.dirname(path.resolve(SHOT)), { recursive: true });
  writeFileSync(SHOT, Buffer.from(shotData, "base64"));
}
console.log(JSON.stringify({ outcome, crashed, ok: payload != null, day: payload?.day, cash: payload?.cash, orders: payload?.orders, missed: payload?.missed, broke: payload?.broke, stage: payload?.stage, events: payload?.events, scenario: payload?.scenario }));
if (!payload) process.exit(1);
