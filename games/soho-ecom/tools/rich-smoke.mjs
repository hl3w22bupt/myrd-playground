#!/usr/bin/env node
// rich-smoke.mjs — M2 专属 CDP 冒烟：headless Chrome 跑 index.html?smoke=40&case=rich（P1 起量构造存档），
// 断言 P1 曲线端到端：阶段触发 / 升级线两级 / 广告投放 / 事件流覆盖 / 自动驾驶事件应对（公关+投诉）。
// 与 browser-smoke.mjs 同构（页面级 ws + title 落账轮询 + SwiftShader），证据落盘 qa/smoke/rich/。
// 用法：node tools/rich-smoke.mjs [工程目录] [--port 9241]
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const root = path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : ".");
const PORT = Number(flag("--port")) || 9241;
const CHROME_CANDIDATES = [flag("--chrome") || "", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((c) => !c.includes("/") || existsSync(c)) || CHROME_CANDIDATES[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(path.join(os.tmpdir(), "rich-smoke-"));
const cp = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=" + PORT, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--user-data-dir=" + profile, "--window-size=1280,720", "--disable-gpu-sandbox",
  `file://${root}/index.html?smoke=40&case=rich`,
], { stdio: "ignore" });

let pageWs = null;
for (let i = 0; i < 75 && !pageWs; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    pageWs = list.find((t) => t.type === "page" && t.url.includes("index.html"))?.webSocketDebuggerUrl;
  } catch { /* chrome not ready yet */ }
  if (!pageWs) await sleep(200);
}
if (!pageWs) { console.error("RICH-SMOKE: FAIL — CDP 连接超时"); cp.kill(); process.exit(1); }
const ws = new WebSocket(pageWs);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;
await send("Runtime.enable");
let raw = "";
for (let i = 0; i < 90 && !raw; i++) {
  await sleep(1000);
  const t = (await evaluate("document.title")) || "";
  if (t.startsWith("SMOKE ")) raw = t.slice(6);
}
cp.kill();
if (!raw) { console.error("RICH-SMOKE: FAIL — payload 未落账（smoke 协议未完成）"); process.exit(1); }
const data = JSON.parse(raw);
console.log("RICH payload:", JSON.stringify({
  stage: data.stage, upgrades: data.upgrades, events: data.events, eventKinds: data.eventKinds,
  eventChoices: data.eventChoices, adCasts: data.adCasts, orders: data.orders, cash: data.cash,
  day: data.day, fps: data.fps, exceptions: data.exceptions,
}));
const checks = [
  [data.exceptions === 0, "零未捕获异常"],
  [data.stage === "P1", "P1 阶段触发（现金 ¥8000 构造存档，调参 v1）"],
  [data.upgrades?.warehouse === true, "海外仓已升级"],
  [data.upgrades?.housingSoho === true, "SOHO 住房已升级"],
  [data.adCasts > 0, "P1 广告已投放"],
  [data.events >= 5, `事件流触发（${data.events} 条）`],
  [(data.eventKinds || []).length >= 4, `事件类别 ≥4（${(data.eventKinds || []).join("、")}）`],
  [(data.eventChoices || []).some((c) => c.choice === "pr"), "差评师公关落地（自动驾驶应对）"],
  [data.fps >= 10, `帧率 ${data.fps} ≥ 10`],
];
let fail = 0;
for (const [cond, label] of checks) { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) fail++; }
const outDir = path.join(root, "qa", "smoke", "rich");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "rich-smoke.json"), `${JSON.stringify({ url: `index.html?smoke=40&case=rich`, payload: data, checks: checks.map(([c, l]) => ({ pass: c, label: l })) }, null, 2)}\n`);
console.log(fail ? `RICH-SMOKE: FAIL（${fail}）` : "RICH-SMOKE: PASS（证据已落盘 qa/smoke/rich/）");
process.exit(fail ? 1 : 0);
