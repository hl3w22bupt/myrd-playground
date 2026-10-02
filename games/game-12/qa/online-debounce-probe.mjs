#!/usr/bin/env node
// online-debounce-probe.mjs — game-12 线上防重复核探针（QA 证据工具，非门禁判定器）。
//
// 目的：mobile-web-smoke 门禁只证「触摸有响应」，证不了「300ms 窗口内连点只计一次」。
// 本探针打**部署后的 liveUrl**，三层机判：
//   A. 事件交付：一次 tap 恰好 1 个 touchstart/touchend、0 个 compat 鼠标事件
//      （双事件交付 = 一次触碰计两次，防重语义的前提；CDP capture 级监听取证）
//   B. 计数语义：CountLabel 数字区像素指纹 —— 单击 +1 / 窗口内连点只 +1 / 跨窗恢复累加
//   C. 重开契约：触屏/鼠标点「重开」归零（touch 30ms → touch 120ms → mouse 递进对照）
// 判定协议：退出码 0 且 stdout 含 ONLINE_PROBE: PASS；1 = 线上语义不成立；2 = 环境不可用。
// 工程事实（探针校准结论，改参数前先读）：
//   - CDP Input 每条指令往返 ~70ms：await 回包再发下一击会把 80ms 设定间隔放大到 ~260ms，
//     正好压在 300ms 窗口边缘 → 连击必须用不等待回包的排队发送（ws 保序），到达间隔 ≈ 设定值；
//   - 场景隔离用刷新归零（AC5 原语义：极简版无持久化）；首击前先预热一轮跨过冷加载抖动。

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", "games/game-12/qa/online"));
const PORT = 9500 + (process.pid % 400);

// 场景几何（games/game-12/scenes/main.tscn，画布 720×1280 / canvas_items+keep）
const GAME_W = 720, GAME_H = 1280, VIEW = { width: 390, height: 844 };
const LABEL = { l: 240, t: 250, r: 480, b: 410 };         // CountLabel 中央数字区
const BTN = { x: (80 + 640) / 2, y: (520 + 760) / 2 };    // +1 按钮中心
const RST_G = { x: (240 + 480) / 2, y: (1160 + 1244) / 2 }; // 重开按钮中心（游戏坐标）
const SCALE = Math.min(VIEW.width / GAME_W, VIEW.height / GAME_H);
const OFF_Y = (VIEW.height - GAME_H * SCALE) / 2;
const toScreen = (gx, gy) => ({ x: Math.round(gx * SCALE), y: Math.round(gy * SCALE + OFF_Y) });
const TAP = toScreen(BTN.x, BTN.y);
const RST = toScreen(RST_G.x, RST_G.y); // 重开按钮屏幕坐标（保持与 TAP 同一套换算）
const REGION = (() => { const a = toScreen(LABEL.l, LABEL.t), b = toScreen(LABEL.r, LABEL.b);
  return { x0: a.x / VIEW.width, y0: a.y / VIEW.height, x1: b.x / VIEW.width, y1: b.y / VIEW.height }; })();

const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "chromium"].filter((c) => !c.includes("/") || existsSync(c));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(m);
const fail2 = (m) => { console.error(`ONLINE_PROBE: FAIL(2) — ${m}`); process.exit(2); };

if (!URL_ARG) fail2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") fail2("Node 需 ≥22（内置 WebSocket）");
const chrome = CANDIDATES.find(Boolean);
if (!chrome) fail2("找不到 Chrome/Chromium");

const profile = os.tmpdir() + "/g12-probe-" + process.pid;
const cp = spawn(chrome, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--use-angle=swiftshader", `--user-data-dir=${profile}`, `--window-size=${VIEW.width},${VIEW.height}`,
  "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
process.on("exit", () => { try { cp.kill(); } catch { /* 已退出 */ } });

const list = await (async () => { for (let i = 0; i < 50; i++) {
  try { const l = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const p = l.find((t) => t.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch { /* 未就绪 */ }
  await sleep(200); } fail2("CDP 连接超时"); })();

const ws = new WebSocket(list);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId;
  pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(`页面求值异常: ${r.result.exceptionDetails?.exception?.description ?? "?"}`);
  return r.result?.result?.value; };
const evalSafe = async (expr) => { try { return await evaluate(expr); } catch { return null; } };
const shot = async () => { const r = await send("Page.captureScreenshot", { format: "png" });
  if (!r.result?.data) throw new Error("captureScreenshot 失败"); return r.result.data; };

// 计数数字区网格均值指纹：数字字形不同必变指纹；16 级量化容忍压缩/抗锯齿噪声
const fingerprint = (b64) => evaluate(`(async () => {
  const img = new Image(); img.src = "data:image/png;base64," + ${JSON.stringify(b64)};
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
  const R = ${JSON.stringify(REGION)};
  const N = 16, out = [];
  const x0 = Math.floor(R.x0 * cv.width), x1 = Math.ceil(R.x1 * cv.width);
  const y0 = Math.floor(R.y0 * cv.height), y1 = Math.ceil(R.y1 * cv.height);
  const cw = (x1 - x0) / N, ch = (y1 - y0) / N;
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const d = cx.getImageData(Math.floor(x0 + gx * cw), Math.floor(y0 + gy * ch),
      Math.max(1, Math.floor(cw)), Math.max(1, Math.floor(ch))).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    out.push(Math.round(s / (d.length / 4) / 16)); }
  return out.join(","); })()`);

try {
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { ...VIEW, deviceScaleFactor: 3, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // 事件交付探针：capture+passive，不消费事件，只记时间线（每次导航自动重装）
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__evlog = [];
    for (const t of ["touchstart", "touchend", "mousedown", "mouseup", "click"]) {
      document.addEventListener(t, (e) => window.__evlog.push({ t, at: performance.now() }),
        { capture: true, passive: true });
    }` });

  const touch = async (points, type) => send("Input.dispatchTouchEvent", { type, touchPoints: points, modifiers: 0 });
  const tap = async (x, y, hold = 30) => { await touch([{ x, y, id: 1 }], "touchStart"); await sleep(hold); await touch([], "touchEnd"); };
  // 连击：send 不 await 回包（ws 保序）→ 到达间隔 ≈ 设定间隔，而非 间隔+2×RTT
  const tapSeq = async (x, y, n, gap, hold = 20) => { for (let i = 0; i < n; i++) {
    if (i) await sleep(gap);
    send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }], modifiers: 0 });
    await sleep(hold);
    send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 }); } };
  const mouseTap = async (x, y) => { await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await sleep(40); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
  const open = async () => { await send("Page.navigate", { url: URL_ARG });
    for (let w = 0; w <= 30000; w += 500) {
      if (await evalSafe("!!document.querySelector('canvas')")) break; await sleep(500); }
    await sleep(3000); };
  const evlog = async () => JSON.parse(await evalSafe("JSON.stringify(window.__evlog || [])") || "[]");

  say(`online-debounce-probe → ${URL_ARG}`);
  say(`  触摸点=(${TAP.x},${TAP.y}) 重开点=(${RST.x},${RST.y}) 指纹区=CountLabel 中央数字区`);
  const steps = []; const save = async (name, b64, fp, note) => {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, name), Buffer.from(b64, "base64"));
    steps.push({ step: name, fingerprint: fp, note }); say(`  [shot] ${name} ${note}`); };

  // 场景隔离 = 刷新归零；每场景先预热单击一轮再刷新，跨过冷加载首帧抖动
  const warm = async () => { await tap(TAP.x, TAP.y); await sleep(1000); await open(); await sleep(1500); };

  await open(); await tap(TAP.x, TAP.y); await sleep(1000); await open(); await sleep(1500); // 预热一轮
  const baseB = await shot(); const F0 = await fingerprint(baseB);
  await save("01-baseline.png", baseB, F0, "刷新归零后空局 count=0");

  // A. 单击 + 事件交付
  await warm(); await evalSafe("window.__evlog = []");
  await tap(TAP.x, TAP.y); await sleep(700);
  const oneB = await shot(); const F1 = await fingerprint(oneB);
  await save("02-single.png", oneB, F1, "单击一次 count=1");
  const log1 = await evlog();
  const cnt = (lg, t) => lg.filter((e) => e.t === t).length;
  const delivery = { touchstart: cnt(log1, "touchstart"), touchend: cnt(log1, "touchend"),
    compatMouse: cnt(log1, "mousedown") + cnt(log1, "mouseup") + cnt(log1, "click") };

  // B1. 100ms 双击（窗口内）
  await warm();
  await tapSeq(TAP.x, TAP.y, 2, 100); await sleep(700);
  const dblB = await shot(); const F2 = await fingerprint(dblB);
  await save("03-double-tap-100ms.png", dblB, F2, "100ms 双击（窗口内）");
  const starts2 = (await evlog()).filter((e) => e.t === "touchstart").map((e) => Math.round(e.at));
  const spread2 = starts2.length >= 2 ? starts2[starts2.length - 1] - starts2[0] : -1;

  // B2. 60ms 三连击（窗口内）
  await warm();
  await tapSeq(TAP.x, TAP.y, 3, 60); await sleep(700);
  const trpB = await shot(); const F3 = await fingerprint(trpB);
  await save("04-triple-tap-60ms.png", trpB, F3, "60ms 三连击（窗口内）");
  const log3 = await evlog();
  const starts3 = log3.filter((e) => e.t === "touchstart").map((e) => Math.round(e.at));
  const spread3 = starts3.length >= 2 ? starts3[starts3.length - 1] - starts3[0] : -1;

  // B3. 40ms × 5 连点风暴（AC2 原文口径）
  await warm();
  await tapSeq(TAP.x, TAP.y, 5, 40); await sleep(700);
  const bstB = await shot(); const F4 = await fingerprint(bstB);
  await save("05-burst-5x40ms.png", bstB, F4, "40ms×5 连点风暴（AC2）");
  const log4 = await evlog();
  const starts4 = log4.filter((e) => e.t === "touchstart").map((e) => Math.round(e.at));
  const spread4 = starts4.length >= 2 ? starts4[starts4.length - 1] - starts4[0] : -1;

  // B4. 跨窗两次（500ms）→ 恢复累加
  await warm();
  await tap(TAP.x, TAP.y); await sleep(500); await tap(TAP.x, TAP.y); await sleep(700);
  const spcB = await shot(); const F5 = await fingerprint(spcB);
  await save("06-spaced-500ms.png", spcB, F5, "跨窗两次(500ms) count=2");

  // C. 重开契约：touch 30ms → touch 120ms → mouse 递进
  await warm(); await tap(TAP.x, TAP.y); await sleep(500);
  let restartOk = null;
  for (const [kind, hold] of [["touch", 30], ["touch", 120], ["mouse", 40]]) {
    if (kind === "touch") await tap(RST.x, RST.y, hold); else await mouseTap(RST.x, RST.y);
    await sleep(900);
    const fp = await fingerprint(await shot());
    if (fp === F0) { restartOk = `${kind}/${hold}ms`; break; }
  }
  await save("07-restart.png", await shot(), restartOk ?? "≠F0", restartOk ? `重开归零 ✓（${restartOk}）` : "三段尝试均未归零 ✗");

  const eq = (a, b) => a === b;
  const checks = [
    { id: "single-delivery", ok: delivery.touchstart === 1 && delivery.touchend === 1 && delivery.compatMouse === 0,
      label: "一次 tap 交付 1 组触摸事件、0 个 compat 鼠标事件（防重前提）",
      detail: `touchstart=${delivery.touchstart} touchend=${delivery.touchend} compat=${delivery.compatMouse}` },
    { id: "tap-counts", ok: !eq(F1, F0), label: "单击后计数变化（点击真被计入）", detail: `F1==F0 ? ${eq(F1, F0)}` },
    { id: "double-rejected", ok: eq(F2, F1), label: "300ms 内双击只计一次（防重拦截）", detail: `F2==F1 ? ${eq(F2, F1)}；touchstart spread=${spread2}ms` },
    { id: "triple-rejected", ok: eq(F3, F1), label: "300ms 内三连击只计一次", detail: `F3==F1 ? ${eq(F3, F1)}；touchstart spread=${spread3}ms` },
    { id: "burst-rejected", ok: eq(F4, F1), label: "40ms×5 连点风暴只计一次（AC2）", detail: `F4==F1 ? ${eq(F4, F1)}；touchstart spread=${spread4}ms` },
    { id: "window-recovers", ok: !eq(F5, F1) && !eq(F5, F4), label: "窗口结束恢复累加（count=2 ≠ 1）", detail: `F5!=F1 && F5!=F4` },
    { id: "restart-clears", ok: Boolean(restartOk), label: "重开归零（touch 30→120ms→mouse 递进）", detail: restartOk ?? "三段尝试均未归零" },
  ];
  const failed = checks.filter((c) => !c.ok);
  const report = { verdict: failed.length ? "FAIL" : "PASS", url: URL_ARG, probe: "online-debounce-probe",
    tapPoint: TAP, restartPoint: RST, region: REGION, delivery, checks, steps,
    touchArrivalSpreadsMs: { double: starts2,
      triple: starts3, burst5: starts4 },
    checkedAt: new Date().toISOString(),
    note: "指纹口径：CountLabel 中央数字区 16×16 网格均值 16 级量化；同指纹 = 计数未变；重开三段对照防误报" };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  for (const c of checks) say(`  ${c.ok ? "PASS" : "FAIL"}  ${c.label} (${c.detail})`);
  say(failed.length ? `ONLINE_PROBE: FAIL（${failed.map((f) => f.id).join("、")}）`
    : "ONLINE_PROBE: PASS 线上防重语义成立（单事件交付 + 连点拦截 + 跨窗恢复 + 重开归零）");
  process.exit(failed.length ? 1 : 0);
} catch (e) {
  console.error(`ONLINE_PROBE: FAIL — ${e.message}`); process.exit(1);
} finally { try { ws.close(); } catch { /* 已关闭 */ } }
