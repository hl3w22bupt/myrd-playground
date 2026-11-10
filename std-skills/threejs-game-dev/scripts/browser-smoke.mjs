#!/usr/bin/env node
// browser-smoke.mjs — CDP 真浏览器冒烟门禁：headless Chrome 打开产物 index.html?smoke=<秒>，
// **桌面（1280×720）+ 移动（720×1280）双视口各跑一遍**，逐视口断言：
//   ① SMOKE payload 可解析 / 零未捕获异常 / 渲染确已开始 / 状态机推进 / 帧率下限
//   ② 截图非纯色（400 点 16 级量化采样，纯色 = 画面没渲染出来——移植 cocos tools/smoke.mjs L81-102）
//   ③ renderer.info 性能快照进证据链（drawCalls/triangles/memory）——**只记录不做硬门禁**
//     （headless SwiftShader 软渲染测不出真实性能，阈值待采集基线；触发纪律：画面/资产/shader/
//      后处理变更时必跑本门禁，让每次视觉变更都留一份性能快照）
// 证据落盘 --out（默认 <工程目录>/qa/smoke/）：smoke-<视口>.png + report.json。
// 用法：node browser-smoke.mjs <工程目录> [--seconds 62] [--chrome <path>] [--port 9226] [--out <目录>]
// 产物侧协议：?smoke=<秒> 跳过交互直接快进内核，结果 JSON 写 #ts-smoke + document.title（模板已内置）。

import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SECONDS = Number(flag("--seconds", "62"));
const PORT = Number(flag("--port", "9226"));
const OUT_DIR = path.resolve(flag("--out", path.join(dir, "qa", "smoke")));
const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

// —— 双视口：桌面横屏 + 移动竖屏（720×1280，对齐 cocos smoke 的移动视口；像素量与桌面完全相等，
//    fps 口径可比）。移动视口补触摸仿真 + 移动 UA，让模板的触摸控件跑在移动语义下（断言口径不变）。
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const VIEWPORTS = [
  { id: "desktop", width: 1280, height: 720, mobile: false },
  { id: "mobile", width: 720, height: 1280, mobile: true },
];

const target = path.join(dir, "index.html");
if (!existsSync(target)) {
  console.error(`BROWSER-SMOKE: FAIL — ${target} 不存在，先 node tools/build.mjs`);
  process.exit(1);
}

const chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) {
  console.error("BROWSER-SMOKE: FAIL(2) — 找不到 Chrome/Chromium（--chrome 指定路径），先装环境不要改代码");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectCdp(port, retries = 75) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page" && t.url.includes("index.html"));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

// —— 单视口跑一遍冒烟：起 Chrome → 等 payload 落账 → 截图喂回浏览器采样 → 杀 Chrome。
// 任一阶段异常都向上抛，由调用方按视口记 FAIL 后继续跑另一视口（诊断信息不全损）。
async function runOnce(vp, port) {
  const profile = mkdtempSync(path.join(os.tmpdir(), `ts3d-smoke-${vp.id}-`));
  const cp = spawn(chrome, [
    "--headless=new", "--remote-debugging-port=" + port, "--no-first-run", "--no-default-browser-check",
    "--use-angle=swiftshader", "--user-data-dir=" + profile, `--window-size=${vp.width},${vp.height}`, "--disable-gpu-sandbox",
    `file://${target}?smoke=${SECONDS}`,
  ], { stdio: "ignore" });

  let payload = null;
  let outcome = "timeout";
  let consoleErrors = 0;
  let pixelColors = null;
  let shotData = null;
  let crashed = false;

  try {
    const wsUrl = await connectCdp(port);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown") consoleErrors++;
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors++;
      // 渲染进程 crash（SwiftShader 偶发）：与「产物未落账」是两种根因，必须分开报
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
    if (vp.mobile) {
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await send("Emulation.setUserAgentOverride", { userAgent: MOBILE_UA });
    }

    // 轮询等待产物侧落账（快进 SECONDS 秒 + 余量）；页面 crash 时立即止损并如实归因
    const deadline = Date.now() + Math.min(SECONDS * 1000 + 60000, 180000);
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

    // —— 像素采样：截图（CDP）→ 喂回浏览器 canvas 解码 → 400 点 16 级量化去重计数。
    // 浏览器原生解码 PNG，零额外依赖；纯色（≤1 种量化色）= 黑屏/白屏/没渲染出来。
    try {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      shotData = shot.result?.data || null;
      if (shotData) {
        pixelColors = await evaluate(`(async () => {
          const image = new Image();
          image.src = "data:image/png;base64," + ${JSON.stringify(shotData)};
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const seen = new Set();
          for (let i = 0; i < 400; i += 1) {
            const x = Math.floor((i * 7919) % image.width);   // 质数步长撒点
            const y = Math.floor((i * 104729) % image.height);
            const [r, g, b] = context.getImageData(x, y, 1, 1).data;
            seen.add((r >> 4) + "/" + (g >> 4) + "/" + (b >> 4));  // 16 级量化，容忍压缩噪声
          }
          return seen.size;
        })()`);
      }
    } catch { pixelColors = null; }  // crash/页面已死：采样不可用，交给断言与 crash 归因
    ws.close();
  } finally {
    cp.kill();
  }
  return { vp, payload, outcome, consoleErrors, pixelColors, shotData, crashed };
}

// ============ 双视口逐个跑 ============
const runs = [];
for (const [i, vp] of VIEWPORTS.entries()) {
  if (i > 0) await sleep(1500);  // 等上一实例退净再起下一个（连续 spawn 的端口/profile 抖动）
  try {
    runs.push(await runOnce(vp, PORT + i));
  } catch (e) {
    console.error(`BROWSER-SMOKE: [${vp.id}] CDP 阶段异常：${e.message}`);
    runs.push({ vp, payload: null, outcome: `error: ${e.message}`, consoleErrors: 0, pixelColors: null, shotData: null, crashed: false });
  }
}

// ============ 逐视口断言 ============
const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

for (const run of runs) {
  const vp = run.vp;
  const tag = `[${vp.id} ${vp.width}×${vp.height}]`;
  console.log(`\n===== browser-smoke · ${tag}（smoke=${SECONDS}s，${run.outcome}）=====`);
  ok(run.payload !== null, `${tag} SMOKE payload 已落账（title/#ts-smoke，模板 ?smoke= 协议）`);
  if (run.crashed) {
    console.log(`  WARN  ${tag} 渲染进程 crash（Inspector.targetCrashed）——SwiftShader 偶发环境抖动与产物缺陷都可能，先原样重跑一次：稳定复现才是产物问题`);
  }
  if (run.payload) {
    ok(run.payload.exceptions === 0, `${tag} 零未捕获异常（exceptions=${run.payload.exceptions}，CDP 侧计数=${run.consoleErrors}）`);
    ok((run.payload.frames || 0) > 0, `${tag} 渲染确已开始（frames=${run.payload.frames}）`);
    ok((run.payload.fps ?? 0) >= 10, `${tag} 帧率下限（fps=${run.payload.fps}，headless SwiftShader ≥10）`);
    ok(run.payload.state === "gameover" || run.payload.state === "playing",
      `${tag} 状态机推进（state=${run.payload.state}，快进 ${SECONDS}s 应达 gameover 或 playing）`);
    ok(Number.isFinite(run.payload.score) && Number.isFinite(run.payload.timeLeft),
      `${tag} 数值健康（score=${run.payload.score}，timeLeft=${run.payload.timeLeft}）`);
    ok(run.pixelColors !== null && run.pixelColors >= 2,
      `${tag} 截图非纯色（400 点采样 ${run.pixelColors ?? "不可用"} 种量化色，纯色 = 画面没渲染出来）`);

    // —— 性能快照：证据记录，不做硬门禁（headless 软渲染阈值待基线；缺字段按协议补齐后才有证据链）
    const r = run.payload.render;
    if (r && Number.isFinite(r.drawCalls)) {
      console.log(`  INFO  ${tag} 性能快照（证据记录）：drawCalls=${r.drawCalls} triangles=${r.triangles} geometries=${r.geometries} textures=${r.textures} programs=${r.programs ?? "?"}`);
    } else {
      console.log(`  WARN  ${tag} payload 缺 render 性能快照（drawCalls/triangles/memory）——按模板 main.js 的 ?smoke= 协议补齐，否则交付无性能证据链`);
    }
    if (run.consoleErrors > 0 && run.payload.exceptions === 0) {
      failures.push(`${tag} CDP 侧捕获 ${run.consoleErrors} 条 console error（payload.exceptions=0 与之矛盾，查 [smoke] 日志）`);
    }
  }
}

// ============ 证据落盘（截图 + 双视口 report.json，含性能快照） ============
mkdirSync(OUT_DIR, { recursive: true });
const evidence = [];
for (const run of runs) {
  const file = `smoke-${run.vp.id}.png`;
  if (run.shotData) {
    writeFileSync(path.join(OUT_DIR, file), Buffer.from(run.shotData, "base64"));
    evidence.push(file);
  }
}
const report = {
  schemaVersion: 1,
  kind: "browser-smoke-report",
  product: target,
  seconds: SECONDS,
  checkedAt: new Date().toISOString(),
  note: "render 性能快照为证据记录，非硬门禁（headless SwiftShader 软渲染，阈值待采集基线）",
  viewports: runs.map((run) => ({
    id: run.vp.id, width: run.vp.width, height: run.vp.height, mobile: run.vp.mobile,
    outcome: run.outcome, payload: run.payload, pixelColors: run.pixelColors,
    consoleErrors: run.consoleErrors, screenshot: run.shotData ? `smoke-${run.vp.id}.png` : null,
  })),
  evidence,
};
writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

console.log(`\n===== browser-smoke 汇总（证据已落盘：${OUT_DIR}）=====`);
if (failures.length) {
  console.error(`BROWSER-SMOKE: FAIL（${failures.length} 项未过：${failures.join("；")}）`);
  process.exit(1);
}
console.log("BROWSER-SMOKE: PASS");
