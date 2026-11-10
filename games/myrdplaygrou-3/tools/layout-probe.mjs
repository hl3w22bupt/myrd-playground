#!/usr/bin/env node
// layout-probe.mjs — 窄屏排版硬底线取证工具（**非门禁**：判定器只有仓库内 std-skills/
// threejs-game-dev/scripts/ 三脚本，本工具只产 QA 证据，不判定、不拦截任何流程）。
// 取证口径：headless Chrome 以真机竖屏宽度（默认 390×844，DPR 3）打开产物 ?smoke=<秒>，
// 读取冒烟 payload 的 layout 段（scrollWidth/innerWidth 溢出布尔）+ HUD 行数几何 +
// 触控目标热区（≥44px），并截屏留证。
// 注意：--window-size 在 headless Chrome 有最小窗宽（实测 ~500），必须叠加
// Emulation.setDeviceMetricsOverride 才是真 390 布局 —— 否则截图是「500 布局裁 390」的假象。
// --title 档：不带 ?smoke 直开产物（title 屏），额外断言可见屏段落全部在视口内。
// 用法：node tools/layout-probe.mjs [--width 390] [--height 844] [--seconds 3] [--title] [--out qa/layout]

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const WIDTH = Number(flag("--width", "390"));
const HEIGHT = Number(flag("--height", "844"));
const SECONDS = Number(flag("--seconds", "3"));
const TITLE_MODE = args.includes("--title");
const PORT = Number(flag("--port", "9229"));
const OUT_DIR = path.resolve(flag("--out", path.join(process.cwd(), "qa", "layout")));
const CANDIDATES = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"];
const target = path.resolve(process.cwd(), "index.html");

const chrome = CANDIDATES.find((c) => c.includes("/") ? true : false) || CANDIDATES[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-layout-"));
const cp = spawn(chrome, [
  "--headless=new", "--remote-debugging-port=" + PORT, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--user-data-dir=" + profile, `--window-size=${WIDTH},${HEIGHT}`, "--disable-gpu-sandbox",
  `file://${target}${TITLE_MODE ? "" : `?smoke=${SECONDS}`}`,
], { stdio: "ignore" });

let payload = null;
let shotData = null;
let hudGeometry = null;
let controls = null;
let titleParagraphs = null;
try {
  const wsUrl = await connectCdp(PORT);
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
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 3, mobile: true });

  if (TITLE_MODE) {
    await sleep(1500); // title 屏：等首帧渲染 + 字体布局稳定
    titleParagraphs = await evaluate(`(() => {
      const vw = window.innerWidth;
      const out = [];
      for (const p of document.querySelectorAll(".screen:not(.hidden) p, .screen:not(.hidden) h1, .screen:not(.hidden) button")) {
        const r = p.getBoundingClientRect();
        out.push({ tag: p.tagName, text: p.textContent.slice(0, 16), left: Math.round(r.left), right: Math.round(r.right), inViewport: r.left >= 0 && r.right <= vw });
      }
      return { viewport: vw, paras: out };
    })()`);
  }
  const deadline = Date.now() + (TITLE_MODE ? 5000 : SECONDS * 1000) + 60000;
  while (!TITLE_MODE && Date.now() < deadline) {
    await sleep(1000);
    const t = (await evaluate("document.title")) || "";
    if (t.startsWith("SMOKE ")) { payload = JSON.parse(t.slice(6)); break; }
  }
  if (payload || TITLE_MODE) {
    // HUD 行数几何：chip 底边不许超过两行（排版硬底线 ≤3 行，HUD 常驻占 ≤2 行 + 按钮）
    hudGeometry = await evaluate(`(() => {
      const hud = document.getElementById("hud");
      const chips = [...hud.querySelectorAll(".chip")].map((c) => c.getBoundingClientRect());
      const tops = [...new Set(chips.map((r) => Math.round(r.top)))];
      return { rows: tops.length, chipCount: chips.length, hudRect: hud.getBoundingClientRect().toJSON() };
    })()`);
    // 触控目标热区：当前可见的可点元素 ≥44px（隐藏屏 display:none 无几何，不在此列）
    controls = await evaluate(`(() => {
      const els = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
      return els.map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.id, w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 44 && r.height >= 44 };
      });
    })()`);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    shotData = shot.result?.data || null;
  }
  ws.close();
} finally {
  cp.kill();
}

mkdirSync(OUT_DIR, { recursive: true });
const failures = [];
if (!TITLE_MODE && !payload) failures.push("SMOKE payload 未落账（先 node tools/build.mjs）");
if (payload?.layout?.overflowX) failures.push(`横向溢出：scrollWidth=${payload.layout.scrollWidth} > ${payload.viewport.width}`);
if (payload?.layout?.overflowY) failures.push(`纵向溢出：scrollHeight=${payload.layout.scrollHeight} > ${payload.viewport.height}`);
if (hudGeometry && hudGeometry.rows > 2) failures.push(`HUD 行数 ${hudGeometry.rows} > 2（常驻 HUD ≤3 行硬底线）`);
for (const c of controls || []) {
  if (!c.ok) failures.push(`触控目标 ${c.id} 热区 ${c.w}×${c.h} < 44px`);
}
for (const p of titleParagraphs?.paras || []) {
  if (!p.inViewport) failures.push(`title 屏元素越视口：${p.tag}「${p.text}」 (${p.left}..${p.right} vs vw=${titleParagraphs.viewport})`);
}
const shotName = TITLE_MODE ? `title-${WIDTH}x${HEIGHT}.png` : `layout-${WIDTH}x${HEIGHT}.png`;
if (shotData) writeFileSync(path.join(OUT_DIR, shotName), Buffer.from(shotData, "base64"));
const report = {
  schemaVersion: 1,
  kind: "layout-probe-report",
  mode: TITLE_MODE ? "title" : "playing",
  note: "QA 取证工具，非门禁（判定器 = std-skills/threejs-game-dev/scripts/ 三脚本）",
  viewport: { width: WIDTH, height: HEIGHT, dpr: 3 },
  checkedAt: new Date().toISOString(),
  payload, hudGeometry, controls, titleParagraphs,
  failures,
};
writeFileSync(path.join(OUT_DIR, TITLE_MODE ? "report-title.json" : "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(`LAYOUT-PROBE: ${failures.length} 项待修（见 ${OUT_DIR}）`);
  process.exit(1);
}
console.log(`LAYOUT-PROBE: OK（${WIDTH}×${HEIGHT} ${TITLE_MODE ? "title 屏段落全部在视口内" : `无横向溢出 / HUD ${hudGeometry?.rows} 行 / 触控热区全 ≥44px`}；证据 ${OUT_DIR}）`);
