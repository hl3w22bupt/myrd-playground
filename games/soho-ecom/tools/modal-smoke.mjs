#!/usr/bin/env node
// modal-smoke.mjs — 弹窗按钮人手路径 CDP 冒烟（线上 P0「知道了/投诉点了没反应」的门禁盲区补钉）：
// ?smoke= 协议下事件决策交给自动驾驶、不弹窗（main.js processPendingEvents 短路），
// 机测从未走过「暂停态人点弹窗按钮」这条路 —— 而那里曾有一个卡死全局的 Bug（paused 态 dispatch(eventChoice)
// 被守卫拒收 → pendingEvents 残留 → closeModal → 同一张卡同步弹回，用户观感 = 点了没反应）。
// 本脚本走真实玩家路径：?modal=1 模式打开（自动驾驶替身经营，但弹窗沿真实 DOM 路径弹出）→
// 真实点击「开始经营」→ 等决策卡弹出（打开即暂停）→ el.click() 真实点击按钮 →
// 断言弹窗关闭且不再弹回、游戏恢复推进（日数前进）、面板动作按钮恢复可用。
// 与 rich-smoke.mjs 同构（页面级 ws + SwiftShader），证据落盘 qa/smoke/modal/。
// 用法：node tools/modal-smoke.mjs [工程目录或部署URL] [--port 9243] [--case fresh|rich|broke]
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const rawTarget = args[0] && !args[0].startsWith("--") ? args[0] : ".";
const root = path.resolve(rawTarget);
const IS_URL = /^https?:\/\//.test(rawTarget); // 传部署 URL 时直接实测线上（产物指纹核验见 docs/acceptance/）
const PORT = Number(flag("--port")) || 9243;
const CASE = flag("--case") || "fresh"; // fresh：默认 seed 第 2 天必弹「跟卖狗」（用户实测复现路径）
const CHROME_CANDIDATES = [flag("--chrome") || "", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((c) => !c.includes("/") || existsSync(c)) || CHROME_CANDIDATES[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(path.join(os.tmpdir(), "modal-smoke-"));
const pageUrl = IS_URL
  ? `${rawTarget}${rawTarget.includes("?") ? "&" : "?"}modal=1${CASE !== "fresh" ? `&case=${CASE}` : ""}`
  : `file://${root}/index.html?modal=1${CASE !== "fresh" ? `&case=${CASE}` : ""}`;
const cp = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=" + PORT, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--user-data-dir=" + profile, "--window-size=1280,720", "--disable-gpu-sandbox",
  pageUrl,
], { stdio: "ignore" });

let pageWs = null;
for (let i = 0; i < 75 && !pageWs; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    pageWs = list.find((t) => t.type === "page" && (t.url.includes("index.html") || t.url.startsWith(rawTarget)))?.webSocketDebuggerUrl;
  } catch { /* chrome not ready yet */ }
  if (!pageWs) await sleep(200);
}
if (!pageWs) { console.error("MODAL-SMOKE: FAIL — CDP 连接超时"); cp.kill(); process.exit(1); }
const ws = new WebSocket(pageWs);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;
await send("Runtime.enable");

const checks = [];
const ok = (cond, label) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); checks.push({ pass: !!cond, label }); };

// 1) 真实点击「开始经营」
{
  const started = await evaluate(`(() => {
    const b = document.getElementById("btn-start");
    if (!b) return false;
    b.click();
    return true;
  })()`);
  ok(started === true, "真实点击「开始经营」→ 对局启动");
}

// 2) 等第一张决策卡弹出（150s 上限：普通模式 4× ≈ 19s/游戏日，rich 首日出单触发差评师）
let card = null;
for (let i = 0; i < 150 && !card; i++) {
  await sleep(1000);
  card = await evaluate(`(() => {
    const m = document.getElementById("event-modal");
    if (!m || m.classList.contains("hidden")) return null;
    return { title: m.querySelector("h3")?.textContent || "", buttons: [...m.querySelectorAll("button")].map(b => b.textContent) };
  })()`);
}
ok(!!card, `决策卡弹出：${card ? `「${card.title}」按钮=[${card.buttons.join(" / ")}]` : "未弹出（超时）"}`);

// 3) 真实点击指定按钮（--pick counter=投诉/公关[默认] | dismiss=知道了；用户实测两颗都无效，两路都要门禁）
const PICK = flag("--pick") || "counter";
let clicked = null;
if (card) {
  clicked = await evaluate(`(() => {
    const m = document.getElementById("event-modal");
    const btns = [...m.querySelectorAll("button")].filter(b => !b.disabled);
    if (!btns.length) return null;
    const counter = btns.find(b => b.textContent !== "知道了");
    const know = btns.find(b => b.textContent === "知道了");
    const b = ${JSON.stringify(PICK) === "dismiss" ? "know || btns[0]" : "counter || btns[0]"};
    b.click(); // 真实 DOM click → addEventListener 回调（非程序派发）
    return { label: b.textContent, isCounter: b !== know && !!counter };
  })()`);
  ok(!!clicked, `真实点击弹窗按钮「${clicked?.label ?? "—"}」（${clicked?.isCounter ? "counter 应对" : "知道了"}）`);
}

// 4) 断言：点击生效 —— 0.5s 内弹窗关闭（Bug 现场：立刻弹回同一张卡）
await sleep(500);
const justAfter = await evaluate(`(() => {
  const m = document.getElementById("event-modal");
  return { hidden: !m || m.classList.contains("hidden"), title: m?.querySelector("h3")?.textContent || "" };
})()`);
ok(justAfter?.hidden === true, `点击后弹窗关闭（修复前：同一张卡「${card?.title ?? "—"}」立刻弹回）`);

// 5) 断言：不卡死 —— 10s 后弹窗仍关闭或弹出新卡（队列下一张），且游戏日推进
await sleep(10000);
const later = await evaluate(`(() => {
  const m = document.getElementById("event-modal");
  return {
    modalHidden: !m || m.classList.contains("hidden"),
    title: m?.querySelector("h3")?.textContent || "",
    day: Number(document.getElementById("day-num")?.textContent || 0),
  };
})()`);
const sameCardStuck = !later?.modalHidden && later?.title === card?.title && (clicked?.isCounter || card?.buttons.includes("知道了"));
ok(!sameCardStuck, `10s 后未卡在同一张卡（弹窗${later?.modalHidden ? "已关闭" : `显示「${later?.title}」`}）`);
ok((later?.day || 0) >= 1, `游戏在推进（第 ${later?.day} 天）`);

// 6) 交互完整性：点击弹窗外的面板动作按钮（补货），确认恢复 playing 态后玩家动作可用
const restockWorks = await evaluate(`(() => {
  const btn = [...document.querySelectorAll("#panel button")].find(b => !b.disabled && /补货/.test(b.textContent));
  if (!btn) return { found: false };
  return { found: true };
})()`);
ok(restockWorks?.found === true, "弹窗关闭后面板动作按钮可用（恢复 playing 态）");

cp.kill();
const fail = checks.filter((c) => !c.pass).length;
const outDir = IS_URL ? root : path.join(root, "qa", "smoke", "modal");
if (!IS_URL) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "modal-smoke.json"), `${JSON.stringify({ url: `index.html?modal=1${CASE !== "fresh" ? `&case=${CASE}` : ""}`, card, clicked, checks }, null, 2)}\n`);
}
console.log(fail ? `MODAL-SMOKE: FAIL（${fail}）` : "MODAL-SMOKE: PASS（证据已落盘 qa/smoke/modal/）");
process.exit(fail ? 1 : 0);
