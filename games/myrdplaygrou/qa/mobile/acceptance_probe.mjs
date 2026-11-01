#!/usr/bin/env node
// acceptance_probe.mjs — 试玩验收终审探针（r4，验证手段较上轮升级，禁止弱断言）。
//
// 与既有工具的分工：
//   mobile-web-smoke.mjs 是**门禁**（判定脚本只来自仓库、不自写不改写），测「移动端能不能玩」；
//   audio_energy_probe.mjs 是上轮**取证工具**（能量级机判：BGM/静音/泛化尖峰）；
//   本脚本是本轮**验收仪器**，把断言从「有尖峰」升级到「逐类音效声学指纹机判 + 逐关难度行为
//   观测 + 逐关可进入/通关证据」，全部从**真实部署 liveUrl** 上取证：
//
// ① 音频真实出声机判（升级点：频谱指纹，不再只看 RMS 尖峰）
//    AnalyserNode 串入引擎输出链，25ms 逐窗采样 {rms, peak, 6 频段能量}；按触发事件
//    分窗机判四类音效的**声学指纹**（音色 recipes 来自 tools/gen_sfx.gd + tests/sfx-recipes.json，
//    播放路径 juice.sfx 无 pitch/volume 随机化 → 指纹确定）：
//      种植 place  = 三角波 196Hz 固频 blip 140ms   → 低频段(b0/b1)主导、质心不漂移、非宽谱
//      射击 shoot  = 方波扫频 740→480Hz 70ms        → 中频段(b2/b3)主导、b0/b5 受抑、时长 ≤150ms
//      命中 hit    = 白噪声 120ms                   → 宽带抬升（≥4 频段且含 b4/b5）、时长 ≤175ms
//                                                    （长宽谱 = breach 280ms，另归 it-not-hit）
//      收阳光 score= 三角波上行扫频 523→1046Hz      → 中频段主导 + **质心前→后半段上升**（上行扫频特征，
//                                                    与固频 produce 523Hz blip、下行扫频区分开）
//    外加：AudioContext 手势解锁（pre=suspended+真静音 → post=running）、BGM 持续能量
//    （500ms 基线行 sustain 比率）、静音即时归零/解除恢复、victory 上行扫频（胜局窗口）。
//
// ② 8 关逐关可进入 + 难度递增可测（升级点：行为观测，不只静态参数）
//    - 逐关进入：选关页 4×2 网格首关点按；后续关经胜利浮层「下一关」直进 —— 「进第 k 关」
//      本身即「第 1..k-1 关已通关」的解锁链行为证据（level_select.gd 锁定链）
//    - 逐关行为指纹：章节色（底部提示条取色 vs LEVELS[k].chapter_tint）、出战卡数（L4=4 其余 5）、
//      夜幕迷雾（L5 右半场暗像素占比）、坦克巨尸（L7/L8 灰簇宽度 ≥52 设计px）、首波延迟
//    - 难度递增机判：相邻已测关卡**僵尸行进速度实测**（灰簇跨帧位移/时间，设计px/s）严格递增，
//      并对照 pck 锚定的 walker 18.0×speedScale 预期值
//    - 逐关通关：机器人单指点按游玩（收阳光/选卡/布防/防御），胜利浮层 + 截图 + victory 扫频留证
//
// ③ 部署一致性：线上 pck（资产通道 gzip+b64 → 解压）sha256 与本地导出逐字节比对 + 13 音频资产在包内
//
// 用法：node acceptance_probe.mjs --url <liveUrl> [--out <证据目录>] [--chrome <路径>]
//        [--expect-pck-sha <sha256>] [--max-level <n>] [--level-budget-sec <s>]
// 退出码：0 = PASS；1 = FAIL（任一必判项不通过）；2 = 环境不可用
// 证据落盘（--out）：report.json + audio-timeseries.json + select-*.png / level-*.png / mute-*.png

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile", "acceptance-v14")));
const EXPECT_PCK_SHA = flag("--expect-pck-sha", "");
const MAX_LEVEL = Number(flag("--max-level", "8"));
const LEVEL_BUDGET_SEC = Number(flag("--level-budget-sec", "330"));
const PORT = Number(flag("--port", "0")) || 9500 + (process.pid % 300);
const CANDIDATES = [flag("--chrome", ""),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

// ── 机判阈值（与 audio_energy_probe.mjs 同源；新增频段指纹/时长维度）──
const SILENCE_RMS = 0.0012;      // 数字静音（-58 dBFS）
const AUDIBLE_RMS = 0.004;       // BGM 可闻下限（-48 dBFS）
const SUSTAIN_RATIO = 0.35;      // BGM 持续占比下限
const SPIKE_MIN_RMS = 0.01;      // 音效尖峰绝对下限（音效理论 RMS 0.12~0.25，≥8× 余量）
const SPIKE_RATIO = 1.5;         // 尖峰门槛 = 基线 EMA × 1.5 + 0.004
const MUTE_SETTLE_SEC = 2.0;
const MUTE_TAIL_OFFSET_MS = 800;
const DB_RANGE = 90;             // AnalyserNode minDecibels(-100)~maxDecibels(-10)，本探针显式设置
const MIN_DB = -100;
const WIN_MS = 25;               // 采样窗
const MIN_EVENTS = { place: 2, score: 4, shoot: 3, hit: 3 }; // 每类音效最少确认次数
const SPEED_TOL_ABS = 3.5;       // 实测速度 vs 预期容差（设计px/s；取 abs 与 22% 比例的较大者）

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CRITICAL_EXT = [".wasm", ".pck", ".js", ".data", ".json", ".html"];
// 设计视口（field.gd VIEW_SIZE 1024×640；v14 线上 stretch 实测一致）
const DESIGN = { w: 1024, h: 640 };
const GRID_ORIGIN = { x: 112, y: 72 };
const CELL = 96;

// ── 关卡预期参数（pck 锚定：线上 pck sha256 == 本地导出 ⇒ levels_inventory.py 对 game_state.gd
//    的机判结论适用于线上内容。walker 行进速度 = 18.0 × speedScale）──
const LEVELS_EXPECT = [
  { name: "第 1 关", tint: "d5f0dd", speedScale: 1.0, walkerSpeed: 18.0, firstWave: 15, waves: 4, startSun: 100, cards: 5 },
  { name: "第 2 关", tint: "f7e3c8", speedScale: 1.05, walkerSpeed: 18.9, firstWave: 12, waves: 6, startSun: 150, cards: 5 },
  { name: "第 3 关", tint: "f7e3c8", speedScale: 1.1, walkerSpeed: 19.8, firstWave: 10, waves: 7, startSun: 150, cards: 5 },
  { name: "第 4 关", tint: "fdebd0", speedScale: 1.22, walkerSpeed: 21.96, firstWave: 12, waves: 8, startSun: 100, cards: 4 },
  { name: "第 5 关", tint: "cfdff2", speedScale: 1.25, walkerSpeed: 22.5, firstWave: 11, waves: 8, startSun: 150, cards: 5, fog: true },
  { name: "第 6 关", tint: "cfdff2", speedScale: 1.3, walkerSpeed: 23.4, firstWave: 10, waves: 9, startSun: 200, cards: 5 },
  { name: "第 7 关", tint: "cfdff2", speedScale: 1.35, walkerSpeed: 24.3, firstWave: 10, waves: 9, startSun: 250, cards: 5, boss: true },
  { name: "第 8 关", tint: "cfdff2", speedScale: 1.42, walkerSpeed: 25.56, firstWave: 10, waves: 10, startSun: 250, cards: 5, boss: true },
];
const hex2rgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

const say = (m) => console.log(m);
const results = [];
const check = (id, label, ok, detail, metrics) => {
  const status = ok ? "pass" : "fail";
  results.push({ id, label, status, detail: detail ?? "", metrics: metrics ?? null });
  say(`  ${status.toUpperCase().padEnd(4)}  ${label}${detail && !ok ? ` —— ${detail}` : ""}`);
  return ok;
};
const dbfs = (rms) => (rms <= 0 ? -Infinity : 20 * Math.log10(rms));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (arr) => {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function env2(message) {
  console.error(`ACCEPTANCE_PROBE: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`);
  process.exit(2);
}
if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
let chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

const chromeArgs = [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "accept-probe-"))}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--disable-gpu-sandbox", "--hide-scrollbars",
  "--autoplay-policy=document-user-activation-required", // 严格自动播放策略 = iOS Safari 真实语义
];
const cp = spawn(chrome, [...chromeArgs, "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { cp.kill(); } catch { /* 已退出 */ } };
process.on("exit", cleanup);

async function connectCdp(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(250);
  }
  throw new Error("CDP 连接超时");
}

const ws = new WebSocket(await connectCdp());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  for (const l of listeners) l(m);
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error(`页面侧求值异常: ${d.exception?.description || d.text || "unknown"}`);
  }
  return r.result?.result?.value;
};
const waitForExpr = async (expr, timeoutMs, pollMs = 500) => {
  for (let waited = 0; waited <= timeoutMs; waited += pollMs) {
    try { if (await evaluate(expr)) return true; } catch { /* 页面未就绪 */ }
    await sleep(pollMs);
  }
  return false;
};

// ── console / 网络取证 ──
const consoleErrors = [];
const network = new Map();
listeners.push((m) => {
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    consoleErrors.push(`未捕获异常: ${d?.exception?.description || d?.text || "unknown"}`);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push(`console.error: ${m.params.args?.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500)}`);
  }
  if (m.method === "Network.requestWillBeSent") {
    const { requestId, request, redirectResponse } = m.params;
    network.set(requestId, { url: request.url, status: redirectResponse?.status ?? 0, critical: CRITICAL_EXT.some((e) => new URL(request.url, URL_ARG).pathname.toLowerCase().endsWith(e)) });
  }
  if (m.method === "Network.responseReceived") {
    const r = network.get(m.params.requestId);
    if (r) r.status = m.params.response.status;
  }
  if (m.method === "Network.loadingFailed") {
    const r = network.get(m.params.requestId);
    if (r) r.status = -1;
  }
});

try {
  // ════ 移动仿真 + 探针注入（文档创建前，先于壳层与引擎全部脚本）════
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });

  // 音频探针：包 AudioContext 捕获引擎实例；AudioNode.connect 改道 analyser → destination；
  // 25ms 逐窗采样时间域（rms/peak）+ 频域（6 频段 byte 能量）；尖峰触发 burst 捕获
  // （事件前 2.25s 环形缓冲 + 后 0.8s 全分辨率），其余每 500ms 落一条基线行（BGM 持续性证据）。
  const INJECT = String.raw`
window.__ACCPROBE__ = (function () {
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  var probe = {
    ctx: null, analyser: null, graphReady: false,
    connectCalls: 0, destinationRedirects: 0, otherConnects: 0, samplerErrors: 0,
    samples: 0, baseline: [], bursts: [], marks: [],
    _ring: [], _inBurst: false, _burstEnd: 0, _lastBase: 0, _ema: 0, _emaInit: false,
    BANDS: [[60,200],[200,450],[450,800],[800,1600],[1600,4000],[4000,11000]],
    mark: function (label, meta) { this.marks.push({ t: Date.now(), label: label, meta: meta || null }); },
    ctxState: function () { return this.ctx ? this.ctx.state : 'no-ctx'; }
  };
  if (!NativeAudioContext) return probe;

  function setupGraph(ctx) {
    if (probe.graphReady) return;
    try {
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;    // 逐窗真实振幅，不平滑
      analyser.minDecibels = -100;           // 拉宽 dB 映射上限：默认 -30 会钳制 -12~-18dBFS 的
      analyser.maxDecibels = -10;            // 音效（byte 全饱和 → 频谱形状失真，噪声/音色无法区分）
      var inTap = false;
      var origConnect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest) {
        var rest = Array.prototype.slice.call(arguments, 1);
        probe.connectCalls += 1;
        if (dest === ctx.destination && !inTap) {
          probe.destinationRedirects += 1;
          inTap = true;
          try { origConnect.call(analyser, ctx.destination); } catch (e) { probe.samplerErrors += 1; }
          var r = origConnect.apply(this, [analyser].concat(rest));
          inTap = false;
          return r;
        }
        probe.otherConnects += 1;
        return origConnect.apply(this, [dest].concat(rest));
      };
      probe.ctx = ctx;
      probe.analyser = analyser;
      probe.graphReady = true;

      var tbuf = new Float32Array(2048);
      var fbuf = new Uint8Array(analyser.frequencyBinCount);
      var binHz = ctx.sampleRate / analyser.fftSize;
      probe.binHz = binHz;
      var bandIdx = probe.BANDS.map(function (b) {
        var lo = Math.max(1, Math.floor(b[0] / binHz));
        var hi = Math.min(fbuf.length - 1, Math.ceil(b[1] / binHz));
        return [lo, hi];
      });
      var SPIKE_MIN = ${SPIKE_MIN_RMS}, SPIKE_RATIO = ${SPIKE_RATIO};

      setInterval(function () {
        try {
          analyser.getFloatTimeDomainData(tbuf);
          analyser.getByteFrequencyData(fbuf);
          var sum = 0, peak = 0, i, v, a;
          for (i = 0; i < tbuf.length; i++) { v = tbuf[i]; sum += v * v; a = v < 0 ? -v : v; if (a > peak) peak = a; }
          var rms = Math.sqrt(sum / tbuf.length);
          var bands = bandIdx.map(function (r) {
            var s = 0; for (var k = r[0]; k <= r[1]; k++) s += fbuf[k];
            return Math.round(s / (r[1] - r[0] + 1));
          });
          probe.samples += 1;
          var now = Date.now();
          probe._ring.push({ t: now, rms: rms, peak: peak, b: bands });
          if (probe._ring.length > 90) probe._ring.shift();
          if (!probe._emaInit) { probe._ema = rms; probe._emaInit = true; }
          else probe._ema = probe._ema * 0.97 + rms * 0.03;
          var isSpike = rms >= SPIKE_MIN && rms >= probe._ema * SPIKE_RATIO + 0.004;
          if (isSpike && !probe._inBurst) {
            probe._inBurst = true;
            probe._burstEnd = now + 800;
            probe.bursts.push({ t0: now, peakRms: rms, rows: probe._ring.slice() });
          } else if (probe._inBurst) {
            var cur = probe.bursts[probe.bursts.length - 1];
            cur.rows.push({ t: now, rms: rms, peak: peak, b: bands });
            if (rms > cur.peakRms) cur.peakRms = rms;
            if (now > probe._burstEnd) { probe._inBurst = false; probe._ema = rms; }
            if (cur.rows.length > 300) cur.rows.splice(0, cur.rows.length - 300);
          } else if (now - probe._lastBase >= 500) {
            probe._lastBase = now;
            probe.baseline.push({ t: now, rms: rms, peak: peak, b: bands });
            if (probe.baseline.length > 6000) probe.baseline.shift();
          }
        } catch (e) { probe.samplerErrors += 1; }
      }, 25);
    } catch (e) { probe.samplerErrors += 1; }
  }

  var Wrapped = function (options) {
    var ctx = new NativeAudioContext(options);
    setupGraph(ctx);
    return ctx;
  };
  Wrapped.prototype = NativeAudioContext.prototype;
  window.AudioContext = Wrapped;
  return probe;
}());`;
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INJECT });

  // 页内像素分析器的注入放在引擎就绪后（见下方 evaluate(DETECT_SRC)）。
  const bootStart = Date.now();
  await send("Page.navigate", { url: URL_ARG });
  const canvasSeen = await waitForExpr("document.querySelector('canvas') !== null", 60000);
  if (!canvasSeen) throw new Error("60s 内 canvas 未挂载（引擎没有起来）");
  const engineReady = await waitForExpr(
    "window.__ACCPROBE__ && window.__ACCPROBE__.graphReady && typeof window.__audioDebug === 'function'",
    120000, 1000);
  if (!engineReady) throw new Error("引擎音频上下文未创建（graphReady=false 或 __audioDebug 缺失）");
  const readyAt = Date.now();
  await sleep(4500); // 等选关页首帧渲染稳定

  // 设计坐标 → CSS 坐标（canvas_items + keep 黑边数学，与 mobile-web-smoke 校准口径一致）
  const canvasRect = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const S = Math.min(canvasRect.width / DESIGN.w, canvasRect.height / DESIGN.h);
  const OX = (canvasRect.width - DESIGN.w * S) / 2;
  const OY = (canvasRect.height - DESIGN.h * S) / 2;
  const css = (dx, dy) => ({ x: Math.round(OX + dx * S), y: Math.round(OY + dy * S) });
  const stretch = { scale: S, ox: OX, oy: OY, canvas: canvasRect };
  say(`  画布 ${canvasRect.width}x${canvasRect.height} · 拉伸 s=${S.toFixed(4)} oy=${OY.toFixed(1)}`);

  // 页内像素分析器（零依赖）：decode PNG → ImageData 逐像素扫描 → 4 邻接聚簇 → 设计坐标。
  // 色板锚（scripts/flat_ui.gd，全扁平纯色无渐变）：
  //   SUN_PICKUP f1c40f（阳光拾取物/向日葵花瓣/选中卡描边/阳光计数）
  //   ZOMBIE_BODY bdc3c7（僵尸四类统一浅灰基底）　UI_PRIMARY 3498db（出战卡/选关蓝钮）
  //   GREEN 2ecc71（射手头/结算主按钮）　GREEN_DARK 27ae60（胜局标题/植物茎叶）
  //   RED e74c3c（败局标题）　ORANGE f39c12（向日葵花盘/坚果）
  const DETECT_SRC = String.raw`
window.__ACCPROBE__.detect = function (b64, cfg) {
  return new Promise(function (res, rej) {
    var image = new Image();
    image.onload = function () { try { res(JSON.stringify(scan())); } catch (e) { rej(e); } };
    image.onerror = function () { rej(new Error('png decode fail')); };
    image.src = 'data:image/png;base64,' + b64;

    function scan() {
      var k = image.width / cfg.canvasW;            // 截图像素 → CSS 像素
      var c = document.createElement('canvas');
      c.width = image.width; c.height = image.height;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(image, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var pts = { sun: [], zombie: [], card: [], cardBright: [], greenBtn: [], bluePanel: [], plant: [], nextWave: [], greenDark: 0, red: 0 };
      var tintSamples = [], fogDark = 0, fogTotal = 0;
      for (var y = 0; y < c.height; y++) {
        for (var x = 0; x < c.width; x++) {
          var i = (y * c.width + x) * 4;
          var r = d[i], gg = d[i + 1], b = d[i + 2];
          var P = toD(x, y);
          var inField = P.x >= cfg.field[0] && P.x <= cfg.field[2] && P.y >= cfg.field[1] && P.y <= cfg.field[3];
          var inTopBar = P.y >= 4 && P.y <= 62;
          var inPanel = P.x >= cfg.panel[0] && P.x <= cfg.panel[2] && P.y >= cfg.panel[1] && P.y <= cfg.panel[3];
          if (inField) {
            if (Math.abs(r - 241) <= 30 && Math.abs(gg - 196) <= 32 && b <= 70) pts.sun.push([x, y]);
            // 僵尸两种渲染态：常态 ZOMBIE_BODY bdc3c7；被击中后 2s 内乘 SLOW_TINT(0.72,0.86,1.0)
            // → 蓝灰 (136,168,199)（apply_slow 不论 slow=0 都上 tint，射击中僵尸恒为蓝灰态）
            else if ((Math.abs(r - 189) <= 32 && Math.abs(gg - 195) <= 32 && Math.abs(b - 199) <= 32) ||
                     (Math.abs(r - 136) <= 28 && Math.abs(gg - 168) <= 28 && Math.abs(b - 199) <= 30)) pts.zombie.push([x, y]);
            if ((Math.abs(r - 46) <= 34 && Math.abs(gg - 204) <= 36 && Math.abs(b - 113) <= 40) ||
                (Math.abs(r - 39) <= 34 && Math.abs(gg - 174) <= 34 && Math.abs(b - 96) <= 34)) pts.plant.push([x, y]);
            if (P.x >= 520 && P.y >= 84 && P.x <= 1010 && P.y <= 544) {
              fogTotal += 1;
              if (r < 38 && gg < 66 && b < 60) fogDark += 1;
            }
          }
          if (inTopBar && r >= 28 && r <= 84 && gg >= 92 && gg <= 182 && b >= 128 && b <= 240) {
            pts.card.push([x, y]); pts.cardBright.push(gg);
          }
          // 「下一波」按钮（波间等待态可见；ORANGE_DARK e67e22，按 dx<300 与右侧「重开」ORANGE 区分）
          if (inTopBar && P.x <= 300 && r >= 195 && gg >= 95 && gg <= 165 && b <= 80) pts.nextWave.push([x, y]);
          // 章节色取样：底部提示条（field 底 552 以下、视口底以上的章节色实心条）
          if (P.x >= 16 && P.x <= 330 && P.y >= 556 && P.y <= 636) tintSamples.push([r, gg, b]);
          if (inPanel) {
            if (Math.abs(r - 46) <= 30 && Math.abs(gg - 204) <= 32 && Math.abs(b - 113) <= 38) pts.greenBtn.push([x, y]);
            else if (r >= 28 && r <= 84 && gg >= 92 && gg <= 182 && b >= 128 && b <= 240) pts.bluePanel.push([x, y]);
            else if (Math.abs(r - 39) <= 44 && Math.abs(gg - 174) <= 44 && Math.abs(b - 96) <= 44) pts.greenDark += 1;
            else if (r >= 186 && gg <= 118 && b <= 118 && r - gg >= 70) pts.red += 1;
          }
        }
      }
      function toD(px, py) { return { x: (px / k - cfg.ox) / cfg.s, y: (py / k + (cfg.clipY || 0) - cfg.oy) / cfg.s }; }
      function cluster(list, gap, minN) {
        if (!list.length) return [];
        var cell = Math.max(4, gap), map = {}, seen = {}, out = [];
        list.forEach(function (p, idx) {
          var key = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell);
          (map[key] = map[key] || []).push(idx);
        });
        list.forEach(function (p, idx) {
          if (seen[idx]) return;
          var q = [idx], comp = [];
          seen[idx] = true;
          while (q.length) {
            var ci = q.pop(), cp = list[ci];
            comp.push(cp);
            var cx = Math.floor(cp[0] / cell), cy = Math.floor(cp[1] / cell);
            for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
              var arr = map[(cx + dx) + ',' + (cy + dy)];
              if (!arr) continue;
              for (var z = 0; z < arr.length; z++) {
                var oi = arr[z];
                if (seen[oi]) continue;
                var op = list[oi];
                if (Math.abs(op[0] - cp[0]) <= gap && Math.abs(op[1] - cp[1]) <= gap) { seen[oi] = true; q.push(oi); }
              }
            }
          }
          if (comp.length < minN) return;
          var xs = comp.map(function (p) { return p[0]; }), ys = comp.map(function (p) { return p[1]; });
          out.push({ x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys), n: comp.length });
        });
        return out;
      }
      var px2design = 1 / (k * cfg.s);
      var mk = function (cl) {
        var P = toD((cl.x0 + cl.x1) / 2, (cl.y0 + cl.y1) / 2);
        return { dx: Math.round(P.x), dy: Math.round(P.y), wDesign: Math.round((cl.x1 - cl.x0) * px2design), hDesign: Math.round((cl.y1 - cl.y0) * px2design), n: cl.n };
      };
      var suns = cluster(pts.sun, 4, 14).map(mk);
      var zombies = cluster(pts.zombie, 4, 24).map(mk);
      var plants = cluster(pts.plant, 4, 24).map(mk);
      var nextWaveBtn = cluster(pts.nextWave, 4, 100).map(mk)[0] || null;
      var cards = cluster(pts.card, 4, 60).map(function (cl, idx) {
        var m = mk(cl);
        // 出战卡可用性：modulate 0.55（禁用态）在深底上混色后 g 通道显著低于常亮态（~152 → ~106）
        var gsum = 0, gn = 0;
        for (var z = 0; z < pts.card.length; z++) {
          var p = pts.card[z];
          var P = toD(p[0], p[1]);
          if (Math.abs(P.x - m.dx) <= m.wDesign / 2 + 2 && Math.abs(P.y - m.dy) <= m.hDesign / 2 + 2) { gsum += pts.cardBright[z]; gn += 1; }
        }
        m.bright = gn ? Math.round(gsum / gn) : 0;
        m.enabled = m.bright >= 125;
        // 选中态：SUN_PICKUP 描边（黄色像素出现在簇 bbox 外扩 5 设计px 环内）
        var yellow = 0;
        for (var w = 0; w < pts.sun.length; w++) {
          var q = toD(pts.sun[w][0], pts.sun[w][1]);
          if (Math.abs(q.x - m.dx) <= m.wDesign / 2 + 5 && Math.abs(q.y - m.dy) <= m.hDesign / 2 + 5) yellow += 1;
        }
        m.yellowRing = yellow;
        return m;
      }).sort(function (a, b) { return a.dx - b.dx; });
      var selectedIndex = -1, bestYellow = 40;
      cards.forEach(function (cd, idx) { if (cd.yellowRing > bestYellow) { bestYellow = cd.yellowRing; selectedIndex = idx; } });
      var greenBtns = cluster(pts.greenBtn, 4, 200).map(mk);
      var bluePanels = cluster(pts.bluePanel, 4, 100).map(mk);
      var tint = null;
      if (tintSamples.length > 30) {
        tintSamples.sort(function (a, b) { return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]); });
        tint = tintSamples[Math.floor(tintSamples.length / 2)];
      }
      return {
        suns: suns, zombies: zombies, plants: plants, cards: cards, selectedIndex: selectedIndex,
        greenBtns: greenBtns, bluePanels: bluePanels, nextWave: nextWaveBtn,
        greenDarkPx: pts.greenDark, redPx: pts.red,
        tint: tint, fogRatio: fogTotal ? Math.round((fogDark / fogTotal) * 1000) / 1000 : 0,
        imgW: image.width,
      };
    }
  });
};`;
  // 注入时机：引擎就绪后直接 evaluate 进当前文档（应用为单页，战役全程不再 reload；
  // addScriptToEvaluateOnNewDocument 只对新文档生效，导航后注入会静默失效）
  await evaluate(DETECT_SRC);

  const FIELD = [GRID_ORIGIN.x, GRID_ORIGIN.y, GRID_ORIGIN.x + 9 * CELL, GRID_ORIGIN.y + 5 * CELL];
  const PANEL = [230, 160, 800, 480];
  // 检测截图只裁设计视口（CSS y 300-546 = 画布内容区），比全屏截图少 ~30× 像素 —— 逐帧
  // getImageData/扫描是探针的主要 CPU 负载，直接决定 RAF 驱动的引擎游戏时钟膨胀率
  //（首轮实证：全屏 3M 像素扫描下游戏时间 ≈ 0.3× 墙钟，波次推进被拖慢 3 倍）。
  const detClip = { x: 0, y: Math.max(0, Math.floor(OY) - 2), width: canvasRect.width, height: Math.min(canvasRect.height - Math.max(0, Math.floor(OY) - 2), Math.ceil(DESIGN.h * S) + 4) };
  const detScale = 1.0;
  const detClipCssY = detClip.y;
  const detectCfg = JSON.stringify({ canvasW: canvasRect.width, ox: OX, oy: OY, s: S, field: FIELD, panel: PANEL, clipY: detClipCssY });
  const detect = async () => JSON.parse(await evaluate(`__ACCPROBE__.detect(${JSON.stringify(await shotData(detScale, detClip))}, ${detectCfg})`));

  const shotData = async (scale, clip = null) => {
    const r = await send("Page.captureScreenshot", {
      format: "png", clip: clip
        ? { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale }
        : { x: 0, y: 0, width: canvasRect.width, height: canvasRect.height, scale },
    });
    return r.result?.data;
  };
  const saveShot = async (name, scale = 1) => {
    const data = await shotData(scale);
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, name), Buffer.from(data, "base64"));
    return data;
  };
  const touch = async (x, y) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }], modifiers: 0 });
    await sleep(60);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
  };
  const tapDesign = async (dx, dy, label, meta) => {
    const p = css(dx, dy);
    await evaluate(`__ACCPROBE__.mark(${JSON.stringify(label)}, ${JSON.stringify(meta ?? null)})`);
    await touch(p.x, p.y);
  };
  const mark = (label, meta) => evaluate(`__ACCPROBE__.mark(${JSON.stringify(label)}, ${JSON.stringify(meta ?? null)})`);
  const snapshot = () => evaluate("JSON.stringify({ debug: window.__audioDebug(), probe: { graphReady: __ACCPROBE__.graphReady, connectCalls: __ACCPROBE__.connectCalls, destinationRedirects: __ACCPROBE__.destinationRedirects, samplerErrors: __ACCPROBE__.samplerErrors, sampleCount: __ACCPROBE__.samples, bursts: __ACCPROBE__.bursts.length, ctxState: __ACCPROBE__.ctxState() } })").then((s) => JSON.parse(s));

  // ── 选关页 4×2 关卡按钮（GREEN_LIGHT 58d68d；锁定按钮 0.55 透明度混色仍可辨）──
  // 用全分辨率截图：按钮间隙 12 设计px ≈ 4.6 CSS px ≈ 13.7 设备px（DPR3），半分辨率下会粘连成一簇。
  const findLevelButtons = async (base64) => JSON.parse(await evaluate(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64," + ${JSON.stringify(base64)};
    await new Promise((res, rej) => { image.onload = res; image.onerror = rej; });
    const k = image.width / ${canvasRect.width};
    const c = document.createElement("canvas");
    c.width = image.width; c.height = image.height;
    const g = c.getContext("2d");
    g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (gg > 118 && gg - r > 42 && gg - b > 28) pts.push([x, y]);
      }
    }
    const cell = 8, map = {}, seen = {}, clusters = [];
    pts.forEach((p, idx) => {
      const key = Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell);
      (map[key] = map[key] || []).push(idx);
    });
    pts.forEach((p, idx) => {
      if (seen[idx]) return;
      const q = [idx], comp = [];
      seen[idx] = true;
      while (q.length) {
        const ci = q.pop(), cp = pts[ci];
        comp.push(cp);
        const cx = Math.floor(cp[0] / cell), cy = Math.floor(cp[1] / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const arr = map[(cx + dx) + "," + (cy + dy)];
          if (!arr) continue;
          for (const oi of arr) {
            if (seen[oi]) continue;
            const op = pts[oi];
            if (Math.abs(op[0] - cp[0]) <= 6 && Math.abs(op[1] - cp[1]) <= 6) { seen[oi] = true; q.push(oi); }
          }
        }
      }
      if (comp.length >= 1200) {
        const xs = comp.map((p) => p[0]), ys = comp.map((p) => p[1]);
        clusters.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), n: comp.length });
      }
    });
    const px2design = 1 / (k * ${S});
    const list = clusters.map((cl) => ({
      cx: Math.round((cl.x0 + cl.x1) / 2 / k),
      cy: Math.round((cl.y0 + cl.y1) / 2 / k),
      w: Math.round((cl.x1 - cl.x0) * px2design), h: Math.round((cl.y1 - cl.y0) * px2design), n: cl.n,
    }));
    list.sort((a, b) => (Math.abs(a.cy - b.cy) < 22 ? a.cx - b.cx : a.cy - b.cy)); // 行优先 = L1..L8
    return JSON.stringify(list);
  })()`));

  // ════ 相位 A：首手势前（严格策略 = ctx suspended + 真实静音）════
  say("── 相位 A：首手势前静音取证（5s）──");
  await saveShot("select-initial.png");
  const t0 = Date.now();
  await sleep(5000);
  const snapPre = await snapshot();
  const buttons = await findLevelButtons(await shotData(1));
  say(`  选关页绿色按钮簇 ×${buttons.length}（首簇 ${(buttons[0] || {}).w}x${(buttons[0] || {}).h} 设计px）`);
  if (!buttons.length) throw new Error("选关页未渲染出关卡按钮（绿色像素聚类为空）——画面没起来");

  // ════ 相位 B：首手势进第 1 关（解锁 + confirm + level_started + BGM 起播）════
  say("── 相位 B：首手势 → 点第 1 关卡片进关 ──");
  const b0 = buttons[0];
  await mark("gesture-level1", { button: b0 });
  await touch(b0.cx, b0.cy);
  await sleep(2000);
  const snapPostGesture = await snapshot();

  // ════ 战役机器人：逐关进入 → 行为指纹 → 单指点按游玩 → 通关/失败处理 ════
  const campaign = { levels: [], tStart: Date.now() };
  const cellCenter = (col, row) => ({ dx: GRID_ORIGIN.x + (col + 0.5) * CELL, dy: GRID_ORIGIN.y + (row + 0.5) * CELL });
  const laneOf = (dy) => Math.max(0, Math.min(4, Math.round((dy - (GRID_ORIGIN.y + CELL / 2)) / CELL)));

  const playLevel = async (levelIdx, enteredVia) => {
    const expect = LEVELS_EXPECT[levelIdx];
    const rec = {
      level: levelIdx + 1, name: expect.name, enteredVia, enteredAt: new Date().toISOString(),
      entryScreenshot: null, winScreenshot: null, defeatScreenshot: null,
      tint: null, tintMatch: null, cardsObserved: null, cardsExpect: expect.cards,
      firstZombieAtSec: null, firstWaveExpectSec: expect.firstWave,
      speedSamples: [], speedExpect: expect.walkerSpeed,
      bossSeen: false, fogRatio: null, fogExpect: !!expect.fog,
      sunTaps: 0, placeTaps: 0, waveSkips: 0, retries: 0, outcome: "unknown",
    };
    say(`── 第 ${levelIdx + 1} 关 ${expect.name}（经 ${enteredVia} 进入）──`);
    await sleep(1500);
    const entryShot = await saveShot(`level-${levelIdx + 1}-entry.png`);
    rec.entryScreenshot = `level-${levelIdx + 1}-entry.png`;
    let det = await detect();
    rec.cardsObserved = det.cards.length;
    if (det.tint) {
      rec.tint = det.tint;
      const e = hex2rgb(expect.tint);
      rec.tintMatch = Math.abs(det.tint[0] - e[0]) <= 16 && Math.abs(det.tint[1] - e[1]) <= 16 && Math.abs(det.tint[2] - e[2]) <= 16;
    }
    rec.fogRatio = det.fogRatio;
    await mark(`level-${levelIdx + 1}-entered`, { cards: det.cards.length, tint: det.tint, fogRatio: det.fogRatio });
    say(`  指纹：卡 ${det.cards.length}/${expect.cards} · 章节 ${det.tint ? det.tint.join(",") : "n/a"} (预期 ${expect.tint}) · 迷雾比 ${det.fogRatio}`);

    // 布防簿记
    const defenders = {};                    // "col,row" -> {kind, pendingSince}
    const laneShooters = [0, 0, 0, 0, 0];
    const tEntry = Date.now();
    // 后期关（6+）波数多（9-10 波），预算放宽 1.5×；超时如实记录（不伪造通关）
    const budgetMs = (levelIdx >= 5 ? LEVEL_BUDGET_SEC * 1.5 : LEVEL_BUDGET_SEC) * 1000;
    let overlay = null;
    let prevSuns = [];
    let tracks = [];                          // 僵尸速度轨道：{lane, dx, t, speeds[]}
    let firstZombieAt = null;
    let prevSel = 0;                          // 选中卡（选中态由 yellowRing 观测，失败时以此兜底）
    let tick = 0;

    while (Date.now() - tEntry < budgetMs) {
      tick += 1;
      det = await detect();
      const now = Date.now();

      // ① 结算浮层（绿色主按钮 ≥100 设计px + 标题绿/红像素；浮层 dim 压暗场地 ⇒ 场内色不干扰）
      const greenBig = det.greenBtns.filter((c) => c.wDesign >= 90);
      if (greenBig.length && (det.greenDarkPx > 140 || det.redPx > 140)) {
        const win = det.greenDarkPx >= det.redPx;
        overlay = { win, btn: greenBig[0], at: now };
        const name = win ? `level-${levelIdx + 1}-win.png` : `level-${levelIdx + 1}-defeat.png`;
        await saveShot(name);
        if (win) rec.winScreenshot = name; else rec.defeatScreenshot = name;
        await mark(win ? "victory-overlay" : "defeat-overlay", { level: levelIdx + 1, greenDarkPx: det.greenDarkPx, redPx: det.redPx });
        rec.outcome = win ? "victory" : "defeat";
        say(`  结算浮层：${win ? "防守成功 ✓" : "防线失守 ✗"}（greenDark=${det.greenDarkPx} red=${det.redPx}）`);
        break;
      }

      // ② 僵尸观测：首现时间 / 速度轨道（同车道最近邻匹配，轨距 ≤18 设计px）/ boss 宽度
      if (det.zombies.length && firstZombieAt === null) {
        firstZombieAt = (now - tEntry) / 1000;
        rec.firstZombieAtSec = Math.round(firstZombieAt * 10) / 10;
        say(`  首只僵尸可见 @ +${rec.firstZombieAtSec}s（预期首波 +${expect.firstWave}s + 出场 ~2s）簇=${JSON.stringify(det.zombies)}`);
      }
      for (const z of det.zombies) {
        if (z.wDesign >= 52) rec.bossSeen = true;
        const lane = laneOf(z.dy);
        let tr = tracks.find((t) => t.lane === lane && Math.abs(t.dx - z.dx) <= 18);
        if (!tr) { tr = { lane, dx: z.dx, t: now, speeds: [] }; tracks.push(tr); continue; }
        const dt = (now - tr.t) / 1000;
        const dd = tr.dx - z.dx;
        if (dt >= 1.5 && dd >= 14) tr.speeds.push(Math.round((dd / dt) * 10) / 10);
        if (dt >= 1.5 || Math.abs(dd) >= 6) { tr.dx = z.dx; tr.t = now; }
      }
      tracks = tracks.filter((t) => now - t.t <= 7000);
      for (const tr of tracks) if (tr.speeds.length) rec.speedSamples.push(...tr.speeds);
      if (tick % 10 === 0) say(`  tick ${tick}: 僵尸 ${det.zombies.length} 阳光簇 ${det.suns.length} 植物 ${det.plants.length} 车道射手 [${laneShooters}] 轨道 ${tracks.length}`);

      if (overlay) { await sleep(800); continue; }

      // ③ 收阳光：新出现的黄簇 = 瞬态拾取物（花瓣常驻、拾取物 ≤10s 消失）；tap 半径 44 设计px
      const newSuns = det.suns.filter((s) => !prevSuns.some((p) => Math.abs(p.dx - s.dx) <= 12 && Math.abs(p.dy - s.dy) <= 12));
      prevSuns = det.suns;
      let collected = 0;
      for (const s of newSuns.slice(0, 3)) {
        await tapDesign(s.dx, s.dy, "sfx-score", { dx: s.dx, dy: s.dy, level: levelIdx + 1 });
        rec.sunTaps += 1;
        collected += 1;
      }

      // ③b 提前召唤下一波（可选操作）：仅在五条车道全部有射手驻守时使用 —— 压缩波间等待，
      //     不降低防守强度（防止预算超时导致战役断链，通关难度语义不变）
      if (det.nextWave && laneShooters.every((s) => s >= 1) && collected === 0) {
        await tapDesign(det.nextWave.dx, det.nextWave.dy, "skip-wave", { level: levelIdx + 1, laneShooters: [...laneShooters] });
        rec.waveSkips += 1;
        await sleep(700);
      }

      // ④ 布防决策（每拍至多 1 次；只点「常亮」的卡 = 非冷却且阳光足够）
      const laneThreat = [0, 0, 0, 0, 0];
      for (const z of det.zombies) laneThreat[laneOf(z.dy)] += 1;
      const wantShooters = levelIdx <= 1 ? 1 : levelIdx <= 4 ? 2 : 3;
      const flowerCount = Object.values(defenders).filter((d) => d.kind === 0).length;
      const wantFlowers = levelIdx <= 3 ? 2 : 3;
      let kindIdx = -1;
      if (flowerCount < wantFlowers && det.cards[0]?.enabled) kindIdx = 0;
      else {
        const repeater = det.cards[3]?.enabled ? 3 : -1;
        const pea = det.cards[1]?.enabled ? 1 : -1;
        kindIdx = repeater >= 0 ? repeater : pea;   // 双发 DPS 4× 豌豆，优先
      }
      let target = -1;
      for (let lane = 0; lane < 5; lane++) if (laneThreat[lane] > 0 && laneShooters[lane] < wantShooters) { target = lane; break; }
      if (target < 0 && now - tEntry > 20000) {
        for (const lane of [2, 1, 3, 0, 4]) if (laneShooters[lane] < Math.min(wantShooters, 2)) { target = lane; break; }
      }
      if (kindIdx >= 0 && target >= 0 && collected === 0) {
        const sel = det.selectedIndex >= 0 ? det.selectedIndex : prevSel;
        if (sel !== kindIdx) {
          const cardCl = det.cards[kindIdx];
          await tapDesign(cardCl.dx, cardCl.dy, "card-select", { card: kindIdx, level: levelIdx + 1 });
          prevSel = kindIdx;
          await sleep(400);
          det = await detect();
        }
        const free = [1, 0, 2, 3].find((col) => !defenders[col + "," + target]);
        if (free !== undefined && det.cards[kindIdx]?.enabled) {
          const p = cellCenter(free, target);
          await tapDesign(p.dx, p.dy, "sfx-place", { card: kindIdx, cell: free + "," + target, level: levelIdx + 1 });
          defenders[free + "," + target] = { kind: kindIdx, pendingSince: now };
          rec.placeTaps += 1;
          if (kindIdx > 0) laneShooters[target] += 1;
          await sleep(700);
        }
      }

      // ⑤ 布防验证：pending 布防下一拍若该格无植物像素簇 → 回滚簿记（放置失败：阳光/冷却不足）
      for (const key of Object.keys(defenders)) {
        const d = defenders[key];
        if (d.confirmed || !d.pendingSince) continue;
        const [col, row] = key.split(",").map(Number);
        const p = cellCenter(col, row);
        const near = det.plants.some((pl) => Math.abs(pl.dx - p.dx) <= 40 && Math.abs(pl.dy - p.dy) <= 40);
        if (near) d.confirmed = true;
        else if (now - d.pendingSince > 5000) {
          delete defenders[key];
          if (d.kind > 0) laneShooters[row] = Math.max(0, laneShooters[row] - 1);
          prevSel = d.kind;   // 放置失败不消耗选卡态
        }
      }

      await sleep(1500);
    }

    // 速度实测汇总（中位数 + 分位）
    if (rec.speedSamples.length) {
      const arr = rec.speedSamples.slice().sort((a, b) => a - b);
      rec.speedMedian = arr[Math.floor(arr.length / 2)];
      rec.speedP25 = arr[Math.floor(arr.length * 0.25)];
      rec.speedP75 = arr[Math.floor(arr.length * 0.75)];
      rec.speedSampleCount = arr.length;
      rec.speedMedian = Math.round(rec.speedMedian * 10) / 10;
      say(`  速度实测：中位 ${rec.speedMedian} 设计px/s（P25 ${rec.speedP25} / P75 ${rec.speedP75}，n=${arr.length}，预期 ${expect.walkerSpeed}）`);
    }
    campaign.levels.push(rec);
    return rec;
  };

  // ── 相位 B2：逐关战役（解锁链：胜 k → 下一关直进 k+1）──
  let levelIdx = 0;
  let retryBudget = 2;
  while (levelIdx < Math.min(MAX_LEVEL, LEVELS_EXPECT.length)) {
    const rec = await playLevel(levelIdx, levelIdx === 0 ? "select-button" : "victory-next-button");
    if (rec.outcome === "victory") {
      retryBudget = 2;
      if (levelIdx + 1 >= Math.min(MAX_LEVEL, LEVELS_EXPECT.length)) {
        say("── 已达战役终点（最后一关通关）──");
        const det2 = await detect();
        const selBtn = det2.bluePanels.filter((c) => c.wDesign >= 60 && c.hDesign >= 24);
        if (selBtn.length) await tapDesign(selBtn[0].dx, selBtn[0].dy, "back-to-select", {});
        break;
      }
      const det2 = await detect();
      const greenBig = det2.greenBtns.filter((c) => c.wDesign >= 90);
      if (greenBig.length) {
        await tapDesign(greenBig[0].dx, greenBig[0].dy, "next-level", { from: levelIdx + 1, to: levelIdx + 2 });
        levelIdx += 1;
        await sleep(1800);
        continue;
      }
      say("  未找到「下一关」按钮 —— 战役中断");
      break;
    } else if (rec.outcome === "defeat") {
      if (retryBudget > 0) {
        retryBudget -= 1;
        rec.retries = 2 - retryBudget;
        const det2 = await detect();
        const greenBig = det2.greenBtns.filter((c) => c.wDesign >= 90);
        if (greenBig.length) {
          say(`  失败重试（剩 ${retryBudget} 次）`);
          await tapDesign(greenBig[0].dx, greenBig[0].dy, "retry-level", { level: levelIdx + 1 });
          await sleep(1800);
          continue;
        }
      }
      say(`  第 ${levelIdx + 1} 关重试用尽 —— 解锁链到此为止（后续关保持锁定，如实记录）`);
      break;
    } else {
      say(`  第 ${levelIdx + 1} 关未在预算内结算（timeout）—— 战役停在此关，如实记录`);
      break;
    }
  }
  campaign.tEnd = Date.now();
  campaign.levelsEntered = [...new Set(campaign.levels.map((lv) => lv.level))];
  campaign.levelsCleared = [...new Set(campaign.levels.filter((lv) => lv.outcome === "victory").map((lv) => lv.level))];

  // ════ 相位 C：静音即时归零 + 解除恢复（任意 BGM 在播画面）════
  say("── 相位 C：静音端到端能量验证 ──");
  await sleep(2500);
  const muteBtn = css(984, 32);
  await mark("mute-on");
  await touch(muteBtn.x, muteBtn.y);
  await sleep(2500);
  await saveShot("mute-on.png");
  const snapMuted = await snapshot();
  await mark("mute-off");
  await touch(muteBtn.x, muteBtn.y);
  await sleep(3500);
  const snapUnmuted = await snapshot();
  await saveShot("mute-off-recovered.png");

  // ════ 相位 D：部署一致性（线上 pck 解压 sha256 + 13 音频资产在包内）════
  say("── 相位 D：部署产物一致性 ──");
  const deploy = await evaluate(`(async () => {
    try {
      var p = location.pathname.replace(/index\\.html$/, '');
      if (p.charAt(p.length - 1) !== '/') p += '/';
      var r = await fetch(p + 'api/public/assets/index.pck.gz.b64');
      if (!r.ok) return JSON.stringify({ ok: false, reason: 'HTTP ' + r.status });
      var text = await r.text();
      var b64 = text;
      try { var obj = JSON.parse(text); b64 = obj.content || obj.data || obj.b64 || text; } catch (e) {}
      var bin = atob(b64);
      var gz = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
      if (typeof DecompressionStream === 'undefined') return JSON.stringify({ ok: false, reason: '浏览器缺少 DecompressionStream' });
      var stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
      var bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      var dig = await crypto.subtle.digest('SHA-256', bytes);
      var hex = Array.prototype.map.call(new Uint8Array(dig), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      var names = ['bgm','score','confirm','hit','fail','shoot','place','produce','zombie_die','breach','victory','defeat','wave'];
      var audioAssets = {};
      names.forEach(function (n) {
        var pat = ('assets/sfx/' + n + '.wav').split('').map(function (c) { return c.charCodeAt(0); });
        var found = false;
        outer: for (var i = 0; i + pat.length <= bytes.length; i++) {
          for (var j = 0; j < pat.length; j++) if (bytes[i + j] !== pat[j]) continue outer;
          found = true; break;
        }
        audioAssets['assets/sfx/' + n + '.wav'] = found;
      });
      return JSON.stringify({ ok: true, size: bytes.length, sha256: hex, audioAssets: audioAssets });
    } catch (e) { return JSON.stringify({ ok: false, reason: String(e && e.message || e) }); }
  })()`);
  const deployInfo = JSON.parse(deploy);

  // ════ 相位 E：拉取能量数据 + 机判 ════
  say("── 相位 E：音频能量机判（频谱指纹）──");
  const dump = await evaluate("JSON.stringify({ baseline: __ACCPROBE__.baseline, bursts: __ACCPROBE__.bursts, marks: __ACCPROBE__.marks })").then((s) => JSON.parse(s));
  const { baseline, bursts, marks } = dump;
  const marksByLabel = {};
  for (const m of marks) (marksByLabel[m.label] = marksByLabel[m.label] || []).push(m.t);

  // 频段：b0 60-200 / b1 200-450 / b2 450-800 / b3 800-1600 / b4 1600-4000 / b5 4000-11000
  // 分类维度（声学指纹三件套）：
  //   ① 频段增益形状 dDb（峰值窗 vs 事件前基线，逐频段 dB 增量）
  //   ② 谱平坦度 flatness（峰值窗 6 频段线性功率的几何/算术均值比）：白噪声(hit/breach)≈平坦，
  //      音色扫频(place/score/shoot)能量集中 → 低平坦度 —— 区分「噪声」与「音」的物理量
  //   ③ 响音段质心漂移（rms ≥ 半峰的连续段内，前半 vs 后半频谱质心）：上行扫频(score/victory)
  //      质心上升、下行(fail/zombie_die/wave)下降、固频(place/produce)不动
  const classifyBurst = (burst) => {
    const rows = burst.rows;
    const pre = rows.filter((r) => r.t < burst.t0 - 60);
    const post = rows.filter((r) => r.t >= burst.t0 - 60);
    if (!pre.length || !post.length) return null;
    const avg = (arr, f) => arr.reduce((s, r) => s + f(r), 0) / Math.max(arr.length, 1);
    const baseB = [0, 1, 2, 3, 4, 5].map((i) => avg(pre, (r) => r.b[i]));
    const peakRow = post.slice().sort((a, b) => b.rms - a.rms)[0];
    const dDb = peakRow.b.map((v, i) => (v - baseB[i]) * DB_RANGE / 255);
    const argmax = dDb.indexOf(Math.max(...dDb));
    // 谱平坦度（峰值窗线性功率；byte → dB → 功率）
    const p = peakRow.b.map((v) => Math.pow(10, (MIN_DB + (v * DB_RANGE) / 255) / 10));
    const geo = Math.pow(p.reduce((a, b) => a * b, 1), 1 / 6);
    const arith = p.reduce((a, b) => a + b, 0) / 6;
    const flatness = arith > 0 ? geo / arith : 0;
    // 响音段（rms ≥ 半峰且 ≥0.015）的质心漂移
    const loudRows = post.filter((r) => r.rms >= Math.max(burst.peakRms * 0.5, 0.015));
    const durationMs = loudRows.length * WIN_MS;
    const centroid = (row) => row.b.reduce((s, v, i) => s + v * (i + 1), 0) / Math.max(row.b.reduce((s, v) => s + v, 0), 1);
    const half = Math.max(1, Math.floor(loudRows.length / 2));
    const c0 = loudRows.length >= 2 ? avg(loudRows.slice(0, half), centroid) : null;
    const c1 = loudRows.length >= 2 ? avg(loudRows.slice(half), centroid) : null;
    const rising = c0 !== null && (c1 - c0) >= 0.12;
    const falling = c0 !== null && (c0 - c1) >= 0.12;
    const broadband = dDb.filter((v) => v >= 4).length >= 4;
    let kind = "other";
    if (durationMs > 200) kind = falling ? "sweep-down-long" : "long";
    else if (broadband && flatness >= 0.5) kind = durationMs <= 175 ? "hit" : "noise-long";
    else if ((argmax === 2 || argmax === 3) && rising) kind = "sweep-up";
    else if ((argmax === 2 || argmax === 3) && dDb[0] < dDb[argmax] - 3 && dDb[5] < dDb[argmax] - 3 && durationMs <= 150) kind = "shoot";
    else if (argmax <= 1 && !rising && !falling) kind = "place";
    else if (argmax <= 1 && falling) kind = "sweep-down";
    else if ((argmax === 2 || argmax === 3) && falling) kind = "sweep-down";
    return {
      kind, t: peakRow.t, rms: Math.round(peakRow.rms * 100000) / 100000,
      dDb: dDb.map((v) => Math.round(v * 10) / 10), argmax, durationMs,
      flatness: Math.round(flatness * 1000) / 1000,
      centroid: { first: c0 === null ? null : Math.round(c0 * 100) / 100, second: c1 === null ? null : Math.round(c1 * 100) / 100, rising, falling },
      broadband,
    };
  };
  const classified = bursts.map(classifyBurst).filter(Boolean).filter((b) => b.rms >= SPIKE_MIN_RMS);
  const nearMark = (t, labels, winMs) => (marksByLabel[labels[0]] || []).some((mt) => Math.abs(mt - t) <= winMs) ||
    labels.slice(1).some((lb) => (marksByLabel[lb] || []).some((mt) => Math.abs(mt - t) <= winMs));

  const eventsByClass = { place: [], score: [], shoot: [], hit: [], other: [] };
  for (const c of classified) {
    if (c.kind === "place" && nearMark(c.t, ["sfx-place"], 1400)) eventsByClass.place.push({ ...c, confirmedBy: "place-attempt mark ±1.4s" });
    else if (c.kind === "sweep-up" && nearMark(c.t, ["sfx-score"], 1400)) eventsByClass.score.push({ ...c, confirmedBy: "sun-collect mark ±1.4s" });
    else if (c.kind === "shoot") eventsByClass.shoot.push(c);
    else if (c.kind === "hit") eventsByClass.hit.push(c);
    else eventsByClass.other.push(c);
  }
  // victory：胜局浮层 mark 前后窗口内的「上行扫频/宽谱抬升」大尖峰（浮层检测滞后 ≤~2s，向前放宽）
  const victoryMarks = marksByLabel["victory-overlay"] || [];
  const victoryBursts = classified.filter((c) =>
    victoryMarks.some((t) => c.t >= t - 4000 && c.t <= t + 1500) &&
    (c.kind === "sweep-up" || (c.broadband && c.durationMs > 175)) && c.rms >= SPIKE_MIN_RMS * 1.5);
  const anyWin = campaign.levels.some((lv) => lv.outcome === "victory");

  const graph = (await snapshot()).probe;
  const sustain = baseline.length ? baseline.filter((r) => r.rms > SILENCE_RMS).length / baseline.length : 0;
  const maxBgmrms = baseline.length ? Math.max(...baseline.map((r) => r.rms)) : 0;

  // ════ 机判 ════
  check("audio-graph", "AnalyserNode 已串入引擎输出链（connect 改道>0、25ms 采样窗>500）",
    graph.graphReady && graph.destinationRedirects > 0 && graph.sampleCount > 500,
    graph.destinationRedirects === 0 ? "引擎节点从未连向 destination——音频输出链没接线（无声直接根因）" : "", graph);

  check("gesture-unlock-running", "首触手势解锁 AudioContext：pre=suspended 且未起播 → post=running 且 unlocked（状态机判）",
    snapPre.debug.state === "suspended" && snapPre.debug.bgmPlaying === false &&
    snapPostGesture.debug.state === "running" && snapPostGesture.debug.unlocked === true,
    `pre: state=${snapPre.debug.state} bgmPlaying=${snapPre.debug.bgmPlaying} / post: state=${snapPostGesture.debug.state} unlocked=${snapPostGesture.debug.unlocked} unlockedFlag=${snapPostGesture.debug.unlocked}`,
    { pre: snapPre.debug, post: snapPostGesture.debug });

  const preRows = baseline.filter((r) => r.t >= t0 && r.t <= ((marksByLabel["gesture-level1"] || [t0 + 5000])[0]));
  const preMax = preRows.length ? Math.max(...preRows.map((r) => r.rms)) : null;
  check("pre-gesture-silent", "首手势前真实静音（能量 < -58dBFS，非仅状态标志）",
    preRows.length > 0 && preMax < SILENCE_RMS,
    preRows.length ? `手势前基线窗 ${preRows.length} 行 maxRms=${preMax.toFixed(5)}（应 ≈0）` : "无采样窗",
    { rows: preRows.length, maxRms: preMax, snapshot: snapPre.debug });

  check("bgm-sustained", "BGM 持续真实出声（500ms 基线行 sustain 比率 + 可闻能量，非仅 bgmPlaying 标志）",
    baseline.length > 200 && sustain >= SUSTAIN_RATIO && maxBgmrms >= AUDIBLE_RMS && snapPostGesture.debug.bgmPlaying === true,
    `基线行 ${baseline.length} 条，sustain=${(sustain * 100).toFixed(0)}%（阈值 ${SUSTAIN_RATIO * 100}%），maxRms=${maxBgmrms.toFixed(5)}（${dbfs(maxBgmrms) === -Infinity ? "-Inf" : dbfs(maxBgmrms).toFixed(1)} dBFS）`,
    { rows: baseline.length, sustainRatio: Math.round(sustain * 1000) / 1000, maxRms: maxBgmrms, maxDbfs: Number.isFinite(dbfs(maxBgmrms)) ? Math.round(dbfs(maxBgmrms) * 10) / 10 : null });

  const clsCheck = (id, evs, label, min, fingerprint) => {
    check(id, `${label}：确认 ${evs.length} 次（阈值 ≥${min}）`, evs.length >= min,
      evs.length ? `示例：rms=${evs[0].rms} ΔdB(b0..b5)=${JSON.stringify(evs[0].dDb)} 时长=${evs[0].durationMs}ms` : "0 次指纹匹配",
      { count: evs.length, min, fingerprint, sample: evs.slice(0, 4) });
  };
  clsCheck("sfx-place", eventsByClass.place, "种植音效 place 真实触发（三角波 196Hz 固频：低频段主导、质心不漂移）", MIN_EVENTS.place, "argmax∈{b0,b1} 非扫频非宽谱");
  clsCheck("sfx-score", eventsByClass.score, "收阳光音效 score 真实触发（三角波上行扫频 523→1046Hz：质心上升）", MIN_EVENTS.score, "argmax∈{b2,b3} 且质心前→后半段上升");
  clsCheck("sfx-shoot", eventsByClass.shoot, "射击音效 shoot 真实触发（方波扫频 740→480Hz 70ms：中频段主导、低/高频受抑）", MIN_EVENTS.shoot, "argmax∈{b2,b3} b0/b5 受抑 时长≤150ms");
  clsCheck("sfx-hit", eventsByClass.hit, "命中音效 hit 真实触发（白噪声 120ms：宽带抬升含高频、时长≤175ms）", MIN_EVENTS.hit, "≥4 频段 ΔdB≥4 且 b4/b5 显著 时长≤175ms");

  check("sfx-victory", "通关音效 victory 真实触发（胜局浮层窗口内上行扫频大尖峰）",
    anyWin ? victoryBursts.length >= 1 : true,
    !anyWin ? "本轮无胜局（不作判定）" : (victoryBursts.length ? `${victoryBursts.length} 次上行扫频尖峰 @ 胜局窗口` : "有胜局但窗口内无上行扫频尖峰"),
    { bursts: victoryBursts.slice(0, 3), wins: campaign.levelsCleared });

  const tMute = (marksByLabel["mute-on"] || [])[0];
  const tUnmute = (marksByLabel["mute-off"] || [])[0];
  const tailRows = baseline.filter((r) => r.t >= tMute + MUTE_TAIL_OFFSET_MS && r.t <= tMute + MUTE_SETTLE_SEC * 1000);
  const recoverRows = baseline.filter((r) => r.t >= tUnmute + 500 && r.t <= tUnmute + 3500);
  const tailMax = tailRows.length ? Math.max(...tailRows.map((r) => r.rms)) : null;
  const recoverMax = recoverRows.length ? Math.max(...recoverRows.map((r) => r.rms)) : null;
  check("mute-immediate", "静音点击后能量即时归零（端到端，非仅 muted 标志）",
    tailMax !== null && tailMax < SILENCE_RMS && snapMuted.debug.muted === true,
    `静音尾窗 ${tailRows.length} 行 maxRms=${tailMax === null ? "无样本" : tailMax.toFixed(5)}（应 <${SILENCE_RMS}），muted=${snapMuted.debug.muted}`,
    { tailMax, rows: tailRows.length, snapshot: snapMuted.debug });
  check("unmute-recover", "解除静音后能量恢复（≥ -48dBFS）",
    recoverMax !== null && recoverMax >= AUDIBLE_RMS && snapUnmuted.debug.muted === false,
    `恢复窗 ${recoverRows.length} 行 maxRms=${recoverMax === null ? "无样本" : recoverMax.toFixed(5)}，muted=${snapUnmuted.debug.muted}`,
    { recoverMax, rows: recoverRows.length, snapshot: snapUnmuted.debug });

  const audioAssetsAll = deployInfo.ok && Object.values(deployInfo.audioAssets || {}).every(Boolean);
  const shaMatch = !EXPECT_PCK_SHA || deployInfo.sha256 === EXPECT_PCK_SHA;
  check("deploy-artifact", "部署产物一致性（线上 pck 解压 sha256 == 本地导出 + 13 音频资产在包内）",
    deployInfo.ok && audioAssetsAll && shaMatch,
    !deployInfo.ok ? `线上 pck 取证失败：${deployInfo.reason}` :
      (!audioAssetsAll ? `音频资产缺失：${Object.entries(deployInfo.audioAssets || {}).filter(([, v]) => !v).map(([k]) => k).join(", ")}` :
        (!shaMatch ? `sha256 不一致：线上 ${deployInfo.sha256} ≠ 本地 ${EXPECT_PCK_SHA}` : `sha256=${deployInfo.sha256} 与本地导出逐字节一致`)),
    deployInfo);

  check("levels-entered", `逐关可进入（解锁链行为证据）：本轮进入 ${campaign.levelsEntered.length} 关（${campaign.levelsEntered.join("→") || "无"}）`,
    campaign.levelsEntered.length >= 3,
    campaign.levelsEntered.length >= 3 ? "" : `仅 ${campaign.levelsEntered.length} 关（<3）`,
    { entered: campaign.levelsEntered, details: campaign.levels.map((lv) => ({ level: lv.level, outcome: lv.outcome, via: lv.enteredVia, retries: lv.retries, placeTaps: lv.placeTaps, sunTaps: lv.sunTaps })) });

  const winLevels = campaign.levels.filter((lv) => lv.outcome === "victory");
  check("levels-cleared", `通关证据（胜利浮层 + 截图 + victory 扫频）：通关 ${campaign.levelsCleared.length} 关（${campaign.levelsCleared.join(",") || "无"}）`,
    campaign.levelsCleared.length >= 3,
    campaign.levelsCleared.length >= 3 ? "" : `仅 ${campaign.levelsCleared.length} 关通关（<3）`,
    winLevels.map((w) => ({ level: w.level, screenshot: w.winScreenshot, outcome: w.outcome })));

  const measured = campaign.levels.filter((lv) => lv.speedMedian !== undefined);
  let speedsRising = measured.length >= 2;
  const speedPairs = [];
  for (let i = 1; i < measured.length; i++) {
    const a = measured[i - 1], b = measured[i];
    const ok = b.speedMedian > a.speedMedian;
    speedsRising = speedsRising && ok;
    speedPairs.push({ from: `L${a.level}=${a.speedMedian}`, to: `L${b.level}=${b.speedMedian}`, expect: `L${a.level}=${a.speedExpect}→L${b.level}=${b.speedExpect}`, rising: ok });
  }
  const vsExpect = measured.map((lv) => ({
    level: lv.level, measured: lv.speedMedian, expect: lv.speedExpect, samples: lv.speedSampleCount,
    withinTolerance: Math.abs(lv.speedMedian - lv.speedExpect) <= Math.max(SPEED_TOL_ABS, lv.speedExpect * 0.25),
  }));
  check("difficulty-speeds-rising", `难度递增行为机判：僵尸行进速度实测（设计px/s）相邻已测关严格递增且落在 pck 锚定预期容差内`,
    speedsRising && vsExpect.length >= 2 && vsExpect.every((s) => s.withinTolerance),
    [speedPairs.map((p) => `${p.from} → ${p.to} ${p.rising ? "↑" : "✗"}`).join(" | "),
     vsExpect.filter((s) => !s.withinTolerance).map((s) => `L${s.level} 实测 ${s.measured} 偏离预期 ${s.expect}`).join("; ")].filter(Boolean).join(" || ") || "不足 2 关取得速度实测",
    { pairs: speedPairs, vsExpect });

  const fpIssues = [
    ...campaign.levels.filter((lv) => lv.tintMatch === false).map((lv) => `L${lv.level} 章节色 ${JSON.stringify(lv.tint)} ≠ 预期 ${LEVELS_EXPECT[lv.level - 1].tint}`),
    ...campaign.levels.filter((lv) => lv.cardsObserved !== lv.cardsExpect).map((lv) => `L${lv.level} 出战卡 ${lv.cardsObserved} ≠ 预期 ${lv.cardsExpect}`),
    ...campaign.levels.filter((lv) => LEVELS_EXPECT[lv.level - 1].fog && (lv.fogRatio ?? 0) < 0.15).map((lv) => `L${lv.level} 未检出夜幕迷雾（fogRatio=${lv.fogRatio}）`),
    ...campaign.levels.filter((lv) => LEVELS_EXPECT[lv.level - 1].boss && !lv.bossSeen).map((lv) => `L${lv.level} 未检出坦克巨尸宽簇`),
  ];
  check("level-fingerprints", "逐关行为指纹：章节色 / 出战卡数（L4=4 其余 5）/ L5 迷雾 / L7·L8 坦克巨尸",
    fpIssues.length === 0,
    fpIssues.join("; ") || `指纹全对齐（观测 ${campaign.levels.length} 关次）`,
    campaign.levels.map((lv) => ({ level: lv.level, tint: lv.tint, tintMatch: lv.tintMatch, cards: lv.cardsObserved, fogRatio: lv.fogRatio, bossSeen: lv.bossSeen, firstZombieAtSec: lv.firstZombieAtSec, speedMedian: lv.speedMedian ?? null })));

  check("console-clean", "取证全程 console 零 error + 零未捕获异常",
    consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  // ════ 落盘 ════
  const pass = results.every((r) => r.status === "pass");
  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    tool: "qa/mobile/acceptance_probe.mjs",
    verdict: pass ? "PASS" : "FAIL",
    url: URL_ARG,
    checkedAt: new Date().toISOString(),
    preset: { ...VIEWPORT, ua: UA },
    chromeArgs: chromeArgs.map((a) => (a.startsWith("--user-data-dir=") ? "--user-data-dir=<tmpdir>" : a)),
    autoplayPolicy: "document-user-activation-required（对齐 iOS Safari）",
    engineBootMs: readyAt - bootStart,
    stretch,
    thresholds: { SILENCE_RMS, AUDIBLE_RMS, SUSTAIN_RATIO, SPIKE_MIN_RMS, SPIKE_RATIO, DB_RANGE, WIN_MS, MIN_EVENTS, SPEED_TOL_ABS, MUTE_SETTLE_SEC },
    bandDefinitionHz: "b0:60-200 b1:200-450 b2:450-800 b3:800-1600 b4:1600-4000 b5:4000-11000（bin=sampleRate/2048）",
    sfxRecipes: "tools/gen_sfx.gd + tests/sfx-recipes.json：place=triangle196Hz固频140ms / shoot=square740→480Hz70ms / hit=whiteNoise120ms / score=triangle523→1046Hz上行180ms / victory=triangle523→1568Hz550ms；juice.sfx 无 pitch/volume 随机化",
    levelsExpect: LEVELS_EXPECT,
    campaign: { ...campaign, durationSec: Math.round((campaign.tEnd - campaign.tStart) / 1000) },
    audioGraph: graph,
    audioEvents: {
      counts: Object.fromEntries(Object.entries(eventsByClass).map(([k, v]) => [k, v.length])),
      place: eventsByClass.place.slice(0, 6), score: eventsByClass.score.slice(0, 8),
      shoot: eventsByClass.shoot.slice(0, 8), hit: eventsByClass.hit.slice(0, 8),
      victoryBursts: victoryBursts.slice(0, 3),
      burstsTotal: bursts.length, classifiedTotal: classified.length,
      kindHistogram: classified.reduce((acc, c) => { acc[c.kind] = (acc[c.kind] || 0) + 1; return acc; }, {}),
    },
    bgm: { baselineRows: baseline.length, sustainRatio: Math.round(sustain * 1000) / 1000, maxRms: maxBgmrms, maxDbfs: Number.isFinite(dbfs(maxBgmrms)) ? Math.round(dbfs(maxBgmrms) * 10) / 10 : null },
    deployArtifact: deployInfo,
    marksCount: marks.length,
    checks: results,
    consoleErrors,
    networkFailures: [...network.values()].filter((r) => r.critical && (r.status >= 500 || r.status === 404 || r.status === -1)),
    screenshots: ["select-initial.png", ...campaign.levels.flatMap((lv) => [lv.entryScreenshot, lv.winScreenshot, lv.defeatScreenshot].filter(Boolean)), "mute-on.png", "mute-off-recovered.png"],
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT_DIR, "audio-timeseries.json"), JSON.stringify({
    note: "基线行=500ms 聚合（BGM 持续性证据）；bursts=尖峰事件全分辨率 25ms 序列（含 6 频段能量）；marks=触发事件标记",
    bandDefinitionHz: report.bandDefinitionHz,
    marks, baseline, bursts,
  }));

  say(`ACCEPTANCE_PROBE: ${pass ? "PASS" : "FAIL"}（证据：${OUT_DIR}）`);
  for (const r of results.filter((x) => x.status === "fail")) say(`  FAIL  ${r.id}: ${r.detail}`);
  process.exit(pass ? 0 : 1);
} catch (e) {
  say(`ACCEPTANCE_PROBE: FAIL — ${e.message}`);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ tool: "acceptance_probe.mjs", verdict: "ERROR", url: URL_ARG, error: e.message, consoleErrors }, null, 2));
  } catch { /* 尽力而为 */ }
  process.exit(1);
}
