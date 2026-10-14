#!/usr/bin/env node
// playability-probe.mjs — 《牛牛打游戏》线上可玩性观测探针（工程侧，v5 修复轮引入）。
//
// 背景门禁盲区（v4 独立验收报告 §五.4）：godot-smoke / input-fuzz / playtest 全部经
// 引擎级输入注入（Input.actionPress）机判，覆盖不了「真实浏览器键盘/触摸事件 → 世界层响应」
// 这一段；mobile-web-smoke 的触摸管线检查只证明事件到达 DOM。v4 线上实锤：门禁全绿而
// 线上不可玩（A 零刷出 + B 移动失效）。本探针以 CDP 真实事件驱动补上这段观测：
//
//   断言 P1（对应缺陷 A）：开局 10s 内同屏可收集物 > 0 —— 每 2s 截图做五类收集物
//     特征色像素检测（草绿/亮金/天蓝/品红/青碧，口径同 v4 验收），任一帧合计命中
//     ≥ HIT_MIN 像素即通过；
//   断言 P2（对应缺陷 B-键盘）：真实键盘 D 键长按 1.5s，牛牛（橙色斑点簇）质心位移
//     > 30 CSS px；
//   断言 P3（对应缺陷 B-摇杆）：真实触屏从摇杆中心拖动持续 ≈2s，牛牛质心位移 > 30 CSS px。
//
// 与门禁的关系：本脚本不替代任何判定脚本（std-skills/godot-game-dev/scripts/ 权威不变），
// 产出 games/game-8/qa/mobile/playability.json 与 mobile-web-smoke 的 report.json 构成双证。
// 退出码：0 = 三项全过；1 = 任一断言失败；2 = 环境不可用（无 Chrome / 无 WebSocket）。
//
// 用法：node tools/playability-probe.mjs --url <liveUrl> [--out <dir>] [--chrome <path>]

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile")));
const PORT = Number(flag("--port", "0")) || 9410 + (process.pid % 400);
const CHROME = flag("--chrome", "") || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium"].find((c) => !c.includes("/") || existsSync(c));

// —— 判定阈值（2026-10-14 修复后实测校准：修复前 A 恒 0 命中 / B 位移恒 <3px）——
const HIT_MIN = 200;        // P1：五类收集物特征色像素合计下限（单物品 ≈ 数百像素）
const MOVE_MIN_PX = 30;     // P2/P3：牛牛质心位移下限（v5 需求原口径）
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const START_BUTTON = { x: 195, y: 451 };       // 开始按钮（画布 360,694 → 视口 letterbox 换算）
const JOYSTICK = { cx: 50, cy: 719, toY: 773 }; // 摇杆中心与下推终点（判定区已外扩，轨迹全程落区内）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(m);
function env2(msg) { console.error(`PLAYABILITY_PROBE: FAIL(2) — ${msg}`); process.exit(2); }
if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
if (!CHROME) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

const profile = mkdtempSync(path.join(os.tmpdir(), "g8-play-"));
const cp = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--no-default-browser-check", "--use-angle=swiftshader", `--user-data-dir=${profile}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank"],
  { stdio: "ignore" });
process.on("exit", () => { try { cp.kill(); } catch { /* 已退出 */ } });

async function connectCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready */ }
    await sleep(250);
  }
  throw new Error("CDP 连接超时");
}

const ws = new WebSocket(await connectCdp());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const shot = async () => (await send("Page.captureScreenshot", { format: "png" })).result?.data;

try {
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });

  say(`[probe] 打开 ${URL_ARG}`);
  await send("Page.navigate", { url: URL_ARG });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    const boot = await evaluate("document.getElementById('boot') ? document.getElementById('boot').className : 'no-boot'");
    const canvas = await evaluate("!!document.querySelector('canvas')");
    if (canvas && (boot === "hidden" || boot === "no-boot")) { ready = true; say(`[probe] 引擎就绪（${(i * 0.5).toFixed(1)}s）`); break; }
    await sleep(500);
  }
  if (!ready) throw new Error("45s 内引擎未就绪（canvas 未出现/壳页 boot 未隐藏）");
  await sleep(1200);

  // 截图像素检测（页面内原生解码，零依赖）：五类收集物特征色 + 牛牛橙色斑点簇质心
  const scan = async (b64) => evaluate(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64," + ${JSON.stringify(b64)};
    await new Promise((res, rej) => { image.onload = res; image.onerror = rej; });
    const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
    const ctx = c.getContext("2d"); ctx.drawImage(image, 0, 0);
    const img = ctx.getImageData(0, 0, image.width, image.height);
    const near = (r,g,b,R,G,B,tol) => Math.abs(r-R)<=tol && Math.abs(g-G)<=tol && Math.abs(b-B)<=tol;
    const counts = { normal:0, rare:0, clock:0, magnet:0, boost:0, cow:0 };
    let sx=0, sy=0;
    for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
      const i = (y*img.width+x)*4, r=img.data[i], g=img.data[i+1], b=img.data[i+2];
      if (near(r,g,b,140,204,77,26)) counts.normal++;        // 草绿 normal
      else if (near(r,g,b,255,209,64,26)) counts.rare++;     // 亮金 rare
      else if (near(r,g,b,115,191,255,26)) counts.clock++;   // 天蓝 clock
      else if (near(r,g,b,230,102,191,26)) counts.magnet++;  // 品红 magnet
      else if (near(r,g,b,89,230,217,26)) counts.boost++;    // 青碧 boost
      if (near(r,g,b,243,166,74,36) || near(r,g,b,230,145,56,36)) { counts.cow++; sx+=x; sy+=y; } // 牛牛橙
    }
    const total = counts.normal + counts.rare + counts.clock + counts.magnet + counts.boost;
    return JSON.stringify({ ...counts, total,
      cowXY: counts.cow > 4 ? [Math.round(sx/counts.cow/3), Math.round(sy/counts.cow/3)] : null });
  })()`);

  const tap = async (x, y) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }], modifiers: 0 });
    await sleep(80);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  const consoleErrors = [];

  // ============ P1：开局 10s 内同屏可收集物 > 0 ============
  say("[probe] tap 开始按钮");
  await tap(START_BUTTON.x, START_BUTTON.y);
  await sleep(1500);
  let p1 = { ok: false, best: 0, samples: [] };
  for (let i = 0; i < 5; i++) {
    const b = await shot();
    writeFileSync(path.join(OUT_DIR, `playability-p1-${i}.png`), Buffer.from(b, "base64"));
    const s = JSON.parse(await scan(b));
    p1.samples.push({ t: `${(2 + i * 2)}s`, ...s });
    if (s.total > p1.best) p1.best = s.total;
    if (s.total >= HIT_MIN) { p1.ok = true; }
    await sleep(2000);
  }
  results.push({ id: "P1", label: "开局 10s 内同屏可收集物 > 0（五类特征色像素检测）",
    status: p1.ok ? "pass" : "fail", bestHit: p1.best, threshold: HIT_MIN, samples: p1.samples });
  say(`  ${p1.ok ? "PASS" : "FAIL"}  P1 可收集物像素命中峰值 ${p1.best}（阈值 ≥${HIT_MIN}）`);

  // ============ P2：真实键盘 D 长按 → 牛牛位移 > 30px ============
  const before = JSON.parse(await scan(await shot()));
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "d", code: "KeyD", windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(1500);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "d", code: "KeyD", windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(300);
  const afterKey = JSON.parse(await scan(await shot()));
  const p2Move = before.cowXY && afterKey.cowXY
    ? Math.hypot(afterKey.cowXY[0] - before.cowXY[0], afterKey.cowXY[1] - before.cowXY[1]) : 0;
  results.push({ id: "P2", label: "真实键盘 D 长按 1.5s 牛牛位移 > 30px（像素质心口径）",
    status: p2Move > MOVE_MIN_PX ? "pass" : "fail", displacementPx: Math.round(p2Move),
    threshold: MOVE_MIN_PX, from: before.cowXY, to: afterKey.cowXY });
  say(`  ${p2Move > MOVE_MIN_PX ? "PASS" : "FAIL"}  P2 键盘位移 ${Math.round(p2Move)}px（阈值 >${MOVE_MIN_PX}）`);

  // ============ P3：真实触屏摇杆拖动 → 牛牛位移 > 30px ============
  // 方向取「向下推」：P2 已把牛牛推向右墙（clamp 后位移饱和），垂直方向独立可观测。
  const beforeJoy = JSON.parse(await scan(await shot()));
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: JOYSTICK.cx, y: JOYSTICK.cy, id: 1 }], modifiers: 0 });
  await sleep(80);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove",
      touchPoints: [{ x: JOYSTICK.cx, y: JOYSTICK.cy + (JOYSTICK.toY - JOYSTICK.cy) * i / steps, id: 1 }], modifiers: 0 });
    await sleep(40);
  }
  await sleep(1800);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
  await sleep(300);
  const afterJoy = JSON.parse(await scan(await shot()));
  const p3Move = beforeJoy.cowXY && afterJoy.cowXY
    ? Math.hypot(afterJoy.cowXY[0] - beforeJoy.cowXY[0], afterJoy.cowXY[1] - beforeJoy.cowXY[1]) : 0;
  results.push({ id: "P3", label: "真实触屏摇杆拖动牛牛位移 > 30px（像素质心口径）",
    status: p3Move > MOVE_MIN_PX ? "pass" : "fail", displacementPx: Math.round(p3Move),
    threshold: MOVE_MIN_PX, from: beforeJoy.cowXY, to: afterJoy.cowXY });
  say(`  ${p3Move > MOVE_MIN_PX ? "PASS" : "FAIL"}  P3 摇杆位移 ${Math.round(p3Move)}px（阈值 >${MOVE_MIN_PX}）`);

  const failed = results.filter((r) => r.status === "fail");
  const report = {
    verdict: failed.length === 0 ? "PASS" : "FAIL",
    url: URL_ARG, preset: { ...VIEWPORT, ua: UA }, checkedAt: new Date().toISOString(),
    method: "CDP 真实事件驱动（Input.dispatchKeyEvent / dispatchTouchEvent）+ 截图像素检测，非引擎级 Input.actionPress 注入",
    checks: results,
    exemptionNote: "本文件是工程侧可玩性观测（v5 引入，闭合 v4 验收报告 §五.4 门禁盲区）；门禁判定仍以 std-skills 判定脚本与 mobile-web-smoke 的 report.json 为准",
  };
  writeFileSync(path.join(OUT_DIR, "playability.json"), JSON.stringify(report, null, 2));
  say(`\n===== playability-probe 汇总（证据：${OUT_DIR}）=====`);
  if (failed.length > 0) {
    say(`PLAYABILITY_PROBE: FAIL（${failed.map((f) => f.id).join("、")} 未达阈值）`);
    process.exit(1);
  }
  say("PLAYABILITY_PROBE: PASS 线上可玩性三项全过（刷出/键盘移动/摇杆移动，真实事件驱动口径）");
  process.exit(0);
} catch (e) {
  console.error(`PLAYABILITY_PROBE: FAIL — ${e.message}`);
  process.exit(1);
} finally {
  try { ws.close(); } catch { /* already closed */ }
}
