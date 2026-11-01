#!/usr/bin/env node
// audio_energy_probe.mjs — 无声音双端根因取证：真实音频能量机判（AnalyserNode 插桩）。
//
// 与 mobile-web-smoke（门禁，判定脚本只来自仓库、不自写不改写）的分工：
//   门禁 audio-unlock 项只机判「壳层契约在位（typeof __audioDebug === 'function'）+ 状态标志」，
//   无法回答「游戏到底真的出不出声」。本脚本是无声缺陷的**取证工具**：把 AnalyserNode
//   串进引擎 WebAudio 输出链，逐窗采样真实振幅能量（RMS/dBFS），机判 BGM 与音效是否
//   「真的在响」——状态标志（bgmPlaying=true）与真实能量是两回事，总线静音时前者仍为 true。
//
// 方法：
//   ① 文档创建前注入探针（Page.addScriptToEvaluateOnNewDocument）：包一层 AudioContext
//      构造器捕获引擎实例，拦截 AudioNode.prototype.connect —— 凡连向 ctx.destination 的
//      引擎节点改道 analyser → destination，引擎侧零感知；
//   ② 25ms 逐窗采样 getFloatTimeDomainData → {t, rms, peak}（窗口 1024 样本 ≈ 21ms@48kHz）；
//   ③ 移动仿真（390×844 / DPR3 / iPhone UA / 触摸）+ 严格自动播放策略
//      （--autoplay-policy=document-user-activation-required，对齐 iOS Safari 语义）；
//   ④ 按相位取证：首手势前静音 → 触摸选关（手势解锁 + confirm 音效）→ 布防音效 →
//      BGM 持续能量 → 首波自然到点的波次音效 → 静音即时归零 → 取消静音恢复；
//   ⑤ 部署端一致性在页面内复算：资产通道取线上 pck 解压后 sha256 + 13 个音频资产在包内核对。
//
// 用法：node audio_energy_probe.mjs --url <liveUrl> [--out <证据目录>] [--chrome <路径>]
//        [--policy strict|default] [--expect-pck-sha <sha256>] [--expect-js-sha <sha256>]
// 退出码：0 = PASS；1 = FAIL（任一 check 不通过）；2 = 环境不可用（装环境，不要改代码硬试）
// 证据落盘（--out）：report.json + audio-energy-timeseries.json + phase-*.png

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", path.join("qa", "mobile", "audio-energy")));
const POLICY = flag("--policy", "strict");
const EXPECT_PCK_SHA = flag("--expect-pck-sha", "");
const EXPECT_JS_SHA = flag("--expect-js-sha", "");
// 首波延迟（秒）：GameState.LEVELS[0].first_wave_delay（点中第 1 关）；波次音效在其后自然触发。
const FIRST_WAVE_DELAY = Number(flag("--first-wave-delay", "15"));
const PORT = Number(flag("--port", "0")) || 9400 + (process.pid % 400);
const CANDIDATES = [flag("--chrome", ""),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

// ── 机判阈值（振幅 RMS 线性值；dBFS = 20·log10(rms)）──
// 数字静音 = 精确 0（或浮点噪声），0.0012 ≈ -58 dBFS 远高于本底噪声、远低于任何可闻内容。
const SILENCE_RMS = 0.0012;
// BGM 可闻判定：BGM 是 -13dB 铺底，合成素材 RMS 量级 0.02~0.09；0.004（-48 dBFS）取下限。
const AUDIBLE_RMS = 0.004;
// BGM「持续」判定：采样窗内 rms > SILENCE_RMS 的占比下限（循环曲可能含淡入段）。
const SUSTAIN_RATIO = 0.35;
// 音效尖峰判定：触发后峰值窗比触发前本底高 ≥1.5dB（或 ≥1.4×）且绝对幅值 ≥0.003。
const SFX_DELTA_DB = 1.5;
const SFX_MIN_RMS = 0.003;
// 静音生效时限：点击后 2s 内能量必须落回 SILENCE_RMS 以下。
const MUTE_SETTLE_SEC = 2.0;
// 静音判定窗：跳过点击生效瞬间的残余声（窗口含静音前最后一窗），只看稳定尾段。
const MUTE_TAIL_OFFSET_MS = 800;
// 等首波自然到点：从进关（手势标记）起算 first_wave_delay，检查窗 ±1.5s。
const WAVE_WINDOW_MS = 1500;

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CRITICAL_EXT = [".wasm", ".pck", ".js", ".data", ".json", ".html"];
// project.godot 设计视口（canvas_items + keep 黑边数学的基准）
const DESIGN = { w: 1024, h: 640 };

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

function env2(message) {
  console.error(`AUDIO_PROBE: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`);
  process.exit(2);
}
if (!URL_ARG) env2("缺少 --url <liveUrl>");
if (typeof WebSocket === "undefined") env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
let chrome = CANDIDATES.find((c) => !c.includes("/") || existsSync(c));
if (!chrome) env2("找不到 Chrome/Chromium（--chrome 指定路径）");

// ── 起 headless Chrome（严格自动播放策略 = 移动端浏览器真实语义；软渲染兜底）──
const chromeArgs = [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "audio-probe-"))}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--disable-gpu-sandbox", "--hide-scrollbars",
];
if (POLICY === "strict") chromeArgs.push("--autoplay-policy=document-user-activation-required");
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

// ── 证据收集器（console / 网络）──
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
  // ════ 移动仿真 + 音频能量探针（文档创建前注入，先于壳层与引擎全部脚本）════
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });

  const INJECT = String.raw`
window.__ENERGY_PROBE__ = (function () {
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  var probe = {
    ctx: null, analyser: null, graphReady: false,
    connectCalls: 0, destinationRedirects: 0, otherConnects: 0,
    samples: [], marks: [], samplerErrors: 0,
    ctxState: function () { return this.ctx ? this.ctx.state : 'no-ctx'; },
    mark: function (label) { this.marks.push({ t: Date.now(), label: label }); }
  };
  if (!NativeAudioContext) return probe;

  // ① 捕获引擎实例 + 装 AnalyserNode 串入输出链
  function setupGraph(ctx) {
    if (probe.graphReady) return;
    try {
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;              // 1024 样本 ≈ 21ms@48kHz
      analyser.smoothingTimeConstant = 0;   // 逐窗真实振幅，不做平滑
      var inTap = false;
      var origConnect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest) {
        var rest = Array.prototype.slice.call(arguments, 1);
        probe.connectCalls += 1;
        if (dest === ctx.destination && !inTap) {
          // 引擎节点 → destination 改道：node → analyser → destination（引擎侧零感知）
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
      // ② 25ms 逐窗采样真实能量
      var buf = new Float32Array(analyser.fftSize);
      setInterval(function () {
        try {
          analyser.getFloatTimeDomainData(buf);
          var sum = 0, peak = 0;
          for (var i = 0; i < buf.length; i++) { var v = buf[i]; sum += v * v; var a = v < 0 ? -v : v; if (a > peak) peak = a; }
          probe.samples.push({ t: Date.now(), rms: Math.sqrt(sum / buf.length), peak: peak });
          if (probe.samples.length > 12000) probe.samples.shift();
        } catch (e) { probe.samplerErrors += 1; }
      }, 25);
    } catch (e) { probe.samplerErrors += 1; }
  }

  // ③ 包构造器捕获引擎创建的 AudioContext（链路：引擎 new → 壳层包装 → 本探针 → 原生）
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

  // ════ 打开 liveUrl，等引擎就绪 ════
  const bootStart = Date.now();
  await send("Page.navigate", { url: URL_ARG });
  const canvasSeen = await waitForExpr("document.querySelector('canvas') !== null", 60000);
  if (!canvasSeen) throw new Error("60s 内 canvas 未挂载（引擎没有起来）");
  const engineReady = await waitForExpr(
    "window.__ENERGY_PROBE__ && window.__ENERGY_PROBE__.graphReady && typeof window.__audioDebug === 'function'",
    120000, 1000);
  if (!engineReady) throw new Error("引擎音频上下文未创建（graphReady=false 或 __audioDebug 缺失）");
  const readyAt = Date.now();
  await sleep(4000); // 等选关页首帧渲染稳定

  // ── 设计坐标 → CSS 坐标（canvas_items + keep 黑边数学，同 mobile-web-smoke 校准口径）──
  const canvasRect = await evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const S = Math.min(canvasRect.width / DESIGN.w, canvasRect.height / DESIGN.h);
  const OX = (canvasRect.width - DESIGN.w * S) / 2;
  const OY = (canvasRect.height - DESIGN.h * S) / 2;
  const css = (dx, dy) => ({ x: Math.round(OX + dx * S), y: Math.round(OY + dy * S) });
  const stretch = { scale: S, ox: OX, oy: OY, canvas: canvasRect };
  say(`  画布 ${canvasRect.width}x${canvasRect.height} · 拉伸 s=${S.toFixed(4)} oy=${OY.toFixed(1)}`);

  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: canvasRect.width, height: canvasRect.height, scale: 1 } });
    const data = r.result?.data;
    if (!data) throw new Error("captureScreenshot 失败");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, name), Buffer.from(data, "base64"));
    return data;
  };

  // 像素找按钮（页面内解码 PNG，零依赖）：色相匹配 → 按 x 空隙聚类 → 簇列表。
  // 截图分辨率随 DPR 变化（DPR3 = 1170×2532），坐标统一按 image/canvas 比例归一到 CSS 像素。
  const findClusters = async (base64, matcherSrc, yMin = 0, yMax = 1e9) => await evaluate(`(async () => {
    const image = new Image();
    image.src = "data:image/png;base64," + ${JSON.stringify(base64)};
    await new Promise((res, rej) => { image.onload = res; image.onerror = rej; });
    const k = image.width / ${canvasRect.width};   // 设备像素 → CSS 像素
    const c = document.createElement("canvas");
    c.width = image.width; c.height = image.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const match = ${matcherSrc};
    const pts = [];
    for (let y = ${Math.round(yMin * 1)} * k; y < Math.min(c.height, ${Math.round(yMax)} * k); y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (Math.round(y) * c.width + x) * 4;
        if (match(d[i], d[i + 1], d[i + 2])) pts.push({ x, y });
      }
    }
    if (!pts.length) return [];
    pts.sort((a, b) => a.x - b.x);
    const clusters = [];
    let cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      // 6 CSS px 空隙即分簇：选关按钮间距 20 设计px × s ≈ 7.6 CSS px（25px 阈值曾把 3 关并成一簇）
      if (pts[i].x - cur[cur.length - 1].x > 6 * k) { clusters.push(cur); cur = [pts[i]]; }
      else cur.push(pts[i]);
    }
    clusters.push(cur);
    return clusters.filter((g) => g.length >= 12).map((g) => {
      const xs = g.map((p) => p.x), ys = g.map((p) => p.y);
      return {
        x: Math.round(Math.min(...xs) / k), y: Math.round(Math.min(...ys) / k),
        width: Math.round((Math.max(...xs) - Math.min(...xs)) / k),
        height: Math.round((Math.max(...ys) - Math.min(...ys)) / k),
        points: g.length,
      };
    });
  })()`);

  const touch = async (x, y) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }], modifiers: 0 });
    await sleep(60);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], modifiers: 0 });
  };
  const mark = (label) => evaluate(`__ENERGY_PROBE__.mark(${JSON.stringify(label)})`);
  const snapshot = () => evaluate("JSON.stringify({ debug: window.__audioDebug(), input: window.__INPUT_PROFILE__ || null, probe: { graphReady: __ENERGY_PROBE__.graphReady, connectCalls: __ENERGY_PROBE__.connectCalls, destinationRedirects: __ENERGY_PROBE__.destinationRedirects, otherConnects: __ENERGY_PROBE__.otherConnects, samplerErrors: __ENERGY_PROBE__.samplerErrors, sampleCount: __ENERGY_PROBE__.samples.length, ctxState: __ENERGY_PROBE__.ctxState() } })").then((s) => JSON.parse(s));

  // 取 [t0,t1]（epoch ms）能量窗指标
  const windowStats = (samples, t0, t1) => {
    const win = samples.filter((s) => s.t >= t0 && s.t <= t1);
    if (!win.length) return null;
    let maxRms = 0, sumRms = 0, above = 0;
    for (const s of win) { if (s.rms > maxRms) maxRms = s.rms; sumRms += s.rms; if (s.rms > SILENCE_RMS) above += 1; }
    return { t0, t1, n: win.length, maxRms, maxPeak: Math.max(...win.map((s) => s.peak)), meanRms: sumRms / win.length, maxDbfs: dbfs(maxRms), sustainRatio: above / win.length };
  };

  // ════ 相位 A：首手势前（严格策略 = ctx 应 suspended，BGM 未起播，真实静音）════
  say("── 相位 A：首手势前静音取证（5s）──");
  const preShotData = await shot("phase-a-pre-gesture.png");
  const t0 = Date.now();
  await sleep(5000);
  const snapPre = await snapshot();

  // 选关按钮像素定位（FlatUI.GREEN_LIGHT #58d68d）
  const greenClusters = await findClusters(preShotData, "((r,g,b) => g > 160 && g - r > 60 && g - b > 40 && r > 40)");
  const levelBtn = greenClusters.find((c) => c.width >= 40 && c.height >= 20);
  if (!levelBtn) throw new Error("选关页未渲染出关卡按钮（绿色像素聚类为空）——画面没起来");
  say(`  选关按钮簇 ×${greenClusters.length}，第 1 关按钮 @(${levelBtn.x},${levelBtn.y}) ${levelBtn.width}x${levelBtn.height}`);

  // ════ 相位 B：首次触摸手势（解锁 + confirm 音效 + 选关进第 1 关 + BGM 起播）════
  say("── 相位 B：首次触摸手势解锁 + 选关 ──");
  await mark("gesture-level1");
  await touch(levelBtn.x + Math.round(levelBtn.width / 2), levelBtn.y + Math.round(levelBtn.height / 2));
  await sleep(1500);
  const inGameShotData = await shot("phase-b-in-game.png");
  const snapPost = await snapshot();

  // ════ 相位 C：布防音效（默认已选第 1 卡向日葵 50 ≤ 起始阳光；草坪格 (2,2)）════
  say("── 相位 C：布防音效取证 ──");
  const cell = css(112 + 2.5 * 96, 72 + 2.5 * 96);
  await mark("sfx-place");
  await touch(cell.x, cell.y);
  await sleep(2000);

  // ════ 相位 D：BGM 持续真实能量（8s，避开首波时刻）════
  say("── 相位 D：BGM 真实能量采样（8s）──");
  const tBgm0 = Date.now();
  await sleep(8000);
  const tBgm1 = Date.now();

  // ════ 相位 E：波次音效（等首波自然到点 —— first_wave_delay 后 wave_started 挂 wave 音效，
  //      比点「下一波」按钮更确定：按钮像素检测曾把 HUD 阳光图标误当按钮。
  //      等待窗从进关（手势标记）起算；途经的向日葵 produce 尖峰（10s 周期）属预期背景音）════
  const tGestureMark = await evaluate("__ENERGY_PROBE__.marks.length ? __ENERGY_PROBE__.marks[0].t : Date.now()");
  const waveAt = tGestureMark + FIRST_WAVE_DELAY * 1000;
  const waitMs = waveAt + WAVE_WINDOW_MS + 1000 - Date.now();
  say(`── 相位 E：波次音效取证（预期 +${FIRST_WAVE_DELAY}s ≈ 还需 ${Math.max(0, waitMs / 1000).toFixed(1)}s）──`);
  if (waitMs > 0) await sleep(waitMs);
  await mark("wave-natural");
  await sleep(1500);

  // ════ 相位 F：静音即时归零 + 取消静音恢复（设计 (984,32) = 右上角常驻开关中心）════
  say("── 相位 F：静音开关端到端能量验证 ──");
  const muteBtn = css(984, 32);
  await mark("mute-on");
  await touch(muteBtn.x, muteBtn.y);
  await sleep(2500);
  const mutedShotData = await shot("phase-f-muted.png");
  const snapMuted = await snapshot();
  await mark("mute-off");
  await touch(muteBtn.x, muteBtn.y);
  await sleep(3500);
  const snapUnmuted = await snapshot();
  const tEnd = Date.now();
  await shot("phase-g-final.png");

  // ════ 相位 G：部署端一致性（页面内取线上 pck → 解压 → sha256 + 音频资产核对）════
  say("── 相位 G：部署产物一致性（线上 pck sha256 + 音频资产在包内）──");
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
      // 资产通道是 gzip+b64 文本：先解压再算哈希（漏 gunzip 会哈希到 gzip 层，误报不一致）
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

  // ════ 拉取全部能量样本与标记 ════
  const probeDump = await evaluate("JSON.stringify({ samples: __ENERGY_PROBE__.samples, marks: __ENERGY_PROBE__.marks })").then((s) => JSON.parse(s));
  const samples = probeDump.samples;
  const marks = probeDump.marks;
  const markT = (label) => (marks.find((m) => m.label === label) || {}).t;

  // ════ 机判 ════
  say("── 机判 ──");
  const graph = snapPost.probe;
  check("audio-graph", "AnalyserNode 已串入引擎输出链（connect 改道 >0 且采样窗 >0）",
    graph.graphReady && graph.destinationRedirects > 0 && samples.length > 100,
    graph.destinationRedirects === 0 ? "引擎节点从未连向 destination——音频输出链没接线（无声的直接根因）" : (samples.length <= 100 ? "采样窗不足" : ""),
    graph);

  const preWin = windowStats(samples, t0, markT("gesture-level1") || t0 + 5000);
  check("pre-gesture-silent", "首手势前真实静音（能量 < -58dBFS）" + (POLICY === "strict" ? " + ctx suspended" : ""),
    !!preWin && preWin.maxRms < SILENCE_RMS && (POLICY !== "strict" || (snapPre.debug.state === "suspended" && !snapPre.debug.bgmPlaying)),
    !preWin ? "无采样窗" : (preWin.maxRms >= SILENCE_RMS ? `手势前就有声音 maxRms=${preWin.maxRms.toFixed(5)}（违反 firstInteractionPolicy）` : `ctx state=${snapPre.debug.state} bgmPlaying=${snapPre.debug.bgmPlaying}`),
    { ...preWin, snapshot: snapPre.debug });

  check("gesture-unlock", "首次触摸手势解锁 AudioContext（→ running）",
    snapPost.debug.state === "running" && snapPost.debug.unlocked,
    `手势后 state=${snapPost.debug.state} unlocked=${snapPost.debug.unlocked}（解锁失败 = 移动端全部无声的第一根因）`,
    snapPost.debug);

  const bgmWin = windowStats(samples, tBgm0, tBgm1);
  check("bgm-real-energy", "BGM 真实出声（持续能量 ≥ -48dBFS，非仅 bgmPlaying 标志）",
    !!bgmWin && bgmWin.maxRms >= AUDIBLE_RMS && bgmWin.sustainRatio >= SUSTAIN_RATIO && snapPost.debug.bgmPlaying,
    !bgmWin ? "无采样窗" : `maxRms=${bgmWin.maxRms.toFixed(5)}（${bgmWin.maxDbfs.toFixed(1)} dBFS）sustain=${(bgmWin.sustainRatio * 100).toFixed(0)}% bgmPlaying=${snapPost.debug.bgmPlaying}——能量低于可闻阈值，BGM 未真实出声`,
    { ...bgmWin, snapshot: snapPost.debug });

  const sfxEv = (label, tag, expectedT) => {
    const t = expectedT ?? markT(label);
    if (!t) return { label: tag, present: false };
    const base = windowStats(samples, t - 2000, t - 60);
    const peak = windowStats(samples, t - 60, t + 900);
    const audible = !!base && !!peak && peak.maxRms >= SFX_MIN_RMS &&
      (peak.maxDbfs - base.maxDbfs >= SFX_DELTA_DB || peak.maxRms >= base.maxRms * 1.4);
    return { label: tag, present: true, expectedAt: expectedT ? new Date(t).toISOString() : undefined, baseline: base, peak, deltaDb: base && peak ? peak.maxDbfs - base.maxDbfs : null, audible };
  };
  const sfxPlace = sfxEv("sfx-place", "place（布防）");
  const sfxWave = sfxEv("wave-natural", "wave（首波自然到点）", tGestureMark + FIRST_WAVE_DELAY * 1000);
  const gestureSfx = sfxEv("gesture-level1", "confirm（选关，随手势触发）");
  check("sfx-real-energy", "音效真实出声（触发后出现能量尖峰，非仅事件日志）",
    (sfxPlace.audible ? 1 : 0) + (sfxWave.audible ? 1 : 0) + (gestureSfx.audible ? 1 : 0) >= 2,
    `confirm=${gestureSfx.audible} place=${sfxPlace.audible} wave=${sfxWave.audible}（至少 2 类尖峰才算音效链路真实出声）`,
    { confirm: gestureSfx, place: sfxPlace, wave: sfxWave });

  const tMute = markT("mute-on");
  const mutePre = windowStats(samples, tMute - 800, tMute - 60);
  const muteTail = windowStats(samples, tMute + MUTE_TAIL_OFFSET_MS, tMute + MUTE_SETTLE_SEC * 1000);
  const muteDrop = !!mutePre && !!muteTail && muteTail.maxRms < SILENCE_RMS &&
    (mutePre.maxRms === 0 || mutePre.maxRms / Math.max(muteTail.maxRms, 1e-9) >= 10);
  check("mute-immediate", "静音点击后能量即时归零（端到端，非仅 muted 标志）",
    !!muteTail && muteDrop && snapMuted.debug.muted,
    !muteTail ? "无采样窗" : `静音尾窗 maxRms=${muteTail.maxRms.toFixed(5)}（点击前本底 ${mutePre ? mutePre.maxRms.toFixed(5) : "?"}）muted=${snapMuted.debug.muted}（尾窗能量未归零 = 静音没生效或没点中开关）`,
    { pre: mutePre, tail: muteTail, snapshot: snapMuted.debug });

  const tUnmute = markT("mute-off");
  const unmuteWin = windowStats(samples, tUnmute, tEnd);
  check("unmute-recover", "取消静音后能量恢复（≥ -48dBFS）",
    !!unmuteWin && unmuteWin.maxRms >= AUDIBLE_RMS && !snapUnmuted.debug.muted,
    !unmuteWin ? "无采样窗" : `恢复窗 maxRms=${unmuteWin.maxRms.toFixed(5)}（${unmuteWin.maxDbfs.toFixed(1)} dBFS）muted=${snapUnmuted.debug.muted}`,
    { ...unmuteWin, snapshot: snapUnmuted.debug });

  const audioAssetsAll = deployInfo.ok && Object.values(deployInfo.audioAssets || {}).every(Boolean);
  const shaMatch = !EXPECT_PCK_SHA || deployInfo.sha256 === EXPECT_PCK_SHA;
  check("deploy-artifact", "部署产物含音频构建（线上 pck 解压 sha256 与本地导出一致 + 13 个音频资产在包内）",
    deployInfo.ok && audioAssetsAll && shaMatch,
    !deployInfo.ok ? `线上 pck 取证失败：${deployInfo.reason}` :
      (!audioAssetsAll ? `音频资产缺失：${Object.entries(deployInfo.audioAssets || {}).filter(([, v]) => !v).map(([k]) => k).join(", ")}` :
        (!shaMatch ? `sha256 不一致：线上 ${deployInfo.sha256} ≠ 本地 ${EXPECT_PCK_SHA}（部署的不是含修复的构建）` : "")),
    { ...deployInfo, expectPckSha: EXPECT_PCK_SHA || null, expectJsSha: EXPECT_JS_SHA || null });

  check("console-clean", "取证全程 console 零 error + 零未捕获异常",
    consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  // 线上 index.js 哈希比对（期望值由命令行传入 = 本地导出 sha256）
  let jsShaLive = null;
  try {
    jsShaLive = await evaluate(`(async () => { var p = location.pathname.replace(/index\\.html$/, ''); if (p.charAt(p.length - 1) !== '/') p += '/'; var r = await fetch(p + 'api/public/assets/index.js'); if (!r.ok) return null; var b = new Uint8Array(await r.arrayBuffer()); var d = await crypto.subtle.digest('SHA-256', b); return Array.prototype.map.call(new Uint8Array(d), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); })()`);
  } catch { /* 记 null */ }

  const pass = results.every((r) => r.status === "pass");
  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    tool: "qa/mobile/audio_energy_probe.mjs",
    verdict: pass ? "PASS" : "FAIL",
    url: URL_ARG,
    checkedAt: new Date().toISOString(),
    preset: { ...VIEWPORT, ua: UA },
    // 本机临时 profile 路径不入档（证据仓库保持机器无关）
    chromeArgs: chromeArgs.map((a) => (a.startsWith("--user-data-dir=") ? "--user-data-dir=<tmpdir>" : a)),
    autoplayPolicy: POLICY === "strict" ? "document-user-activation-required（对齐 iOS Safari）" : "default",
    engineBootMs: readyAt - bootStart,
    firstWaveDelaySec: FIRST_WAVE_DELAY,
    notes: "时序中约 10s 周期的能量尖峰为向日葵 produce 音效（sunflower_interval=10s，放置后第 10s 首拍），属预期背景音；天降阳光本身不发声（spawn 无音效挂点）。",
    stretch,
    thresholds: { SILENCE_RMS, AUDIBLE_RMS, SUSTAIN_RATIO, SFX_DELTA_DB, SFX_MIN_RMS, MUTE_SETTLE_SEC },
    phases: {
      preGesture: { window: preWin, snapshot: snapPre.debug },
      gesture: { snapshot: snapPost.debug, screenshot: "phase-b-in-game.png" },
      bgm: { window: bgmWin },
      sfx: { confirm: gestureSfx, place: sfxPlace, wave: sfxWave },
      mute: { pre: mutePre, tail: muteTail, snapshot: snapMuted.debug, screenshot: "phase-f-muted.png" },
      unmute: { window: unmuteWin, snapshot: snapUnmuted.debug },
    },
    audioGraph: graph,
    deployArtifact: { pck: deployInfo, liveIndexJsSha256: jsShaLive, expectIndexJsSha256: EXPECT_JS_SHA || null, jsShaMatch: EXPECT_JS_SHA ? jsShaLive === EXPECT_JS_SHA : null },
    marks,
    checks: results,
    consoleErrors,
    networkFailures: [...network.values()].filter((r) => r.critical && (r.status >= 500 || r.status === 404 || r.status === -1 || (r.status >= 300 && r.status < 400))),
    screenshots: ["phase-a-pre-gesture.png", "phase-b-in-game.png", "phase-f-muted.png", "phase-g-final.png"],
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT_DIR, "audio-energy-timeseries.json"), JSON.stringify({ note: "25ms 逐窗真实振幅采样（rms/peak 线性值，1024 样本窗 ≈21ms@48kHz）", marks, samples }));

  say(`AUDIO_PROBE: ${pass ? "PASS" : "FAIL"}（证据：${OUT_DIR}）`);
  process.exit(pass ? 0 : 1);
} catch (e) {
  say(`AUDIO_PROBE: FAIL — ${e.message}`);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ tool: "audio_energy_probe.mjs", verdict: "ERROR", url: URL_ARG, error: e.message, consoleErrors }, null, 2));
  } catch { /* 尽力而为 */ }
  process.exit(1);
}
