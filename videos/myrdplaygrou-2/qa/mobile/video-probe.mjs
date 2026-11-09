#!/usr/bin/env node
// video-probe.mjs —— 《以柔克刚》放映页「播放/下载」自查探针（一次性取证工具，非门禁判定源）。
// 门禁判定源 = std-skills/web-app-dev/scripts/webapp-smoke.mjs（仓库脚本，已全绿）。
// 本探针回答 smoke 覆盖不到的两问：<video> 真的解出帧并前进吗？下载链接真的指向完整 mp4 Blob 吗？
// 用法：node video-probe.mjs --url <liveUrl> [--out <证据目录>] [--budget 180]
// 输出：VIDEO_PROBE: PASS / FAIL <原因>；证据 report-video-probe.json + probe-playing.png
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const URL_ARG = flag("--url", "");
const OUT_DIR = path.resolve(flag("--out", "qa/mobile"));
const BUDGET = Number(flag("--budget", "180"));
const PORT = Number(flag("--port", "0")) || 9800 + (process.pid % 400);
const CHROME = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "chromium"].find((c) => c && (c.includes("/") ? existsSync(c) : true));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(m);
if (!URL_ARG || typeof WebSocket === "undefined" || !CHROME) {
  console.error("VIDEO_PROBE: FAIL(2) — 环境不可用（缺 --url / Node 无 WebSocket / 找不到 Chrome）");
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });

const profile = mkdtempSync(path.join(os.tmpdir(), "video-probe-"));
const cp = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", `--user-data-dir=${profile}`, "--window-size=1280,860",
  "--autoplay-policy=no-user-gesture-required", "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => { try { cp.kill(); } catch { /* 已退出 */ } });

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch { /* chrome 启动中 */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.error("VIDEO_PROBE: FAIL(2) — CDP 连接超时"); process.exit(2); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const assetRequests = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push("未捕获异常: " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "?").slice(0, 300));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push("console.error: " + m.params.args?.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 300));
  if (m.method === "Network.responseReceived" && /part\d+\.b64/.test(m.params.response.url)) assetRequests.push({ url: m.params.response.url.split("/").pop(), status: m.params.response.status, bytes: Number(m.params.response.headers?.["content-length"] || 0) });
};
const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error("页面侧求值异常: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); if (r.result?.data) writeFileSync(path.join(OUT_DIR, file), Buffer.from(r.result.data, "base64")); };

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Page.navigate", { url: URL_ARG });
await sleep(4000);

const fails = [];
const t0 = Date.now();
// 点击封面上的「加载并播放」（用户手势语义与真人一致）
await evaluate(`document.getElementById('playBtn').click(); 'clicked'`);
say("  … 已点击「加载并播放」，等待分片装载 + 解码 + 首帧（预算 ${BUDGET}s）".replace("${BUDGET}", String(BUDGET)));

let loaded = null;
while (Date.now() - t0 < BUDGET * 1000) {
  await sleep(3000);
  loaded = await evaluate(`(() => {
    const v = document.getElementById('player');
    const st = document.getElementById('st-final');
    return { status: st ? st.textContent : '', ready: v.readyState, vw: v.videoWidth, vh: v.videoHeight,
             dur: v.duration, cur: v.currentTime, paused: v.paused, src: (v.src || '').slice(0, 20), err: v.error ? v.error.code : null };
  })()`);
  say(`  [${Math.round((Date.now() - t0) / 1000)}s] status=${loaded.status} ready=${loaded.ready} ${loaded.vw}x${loaded.vh} dur=${loaded.dur?.toFixed?.(2)} cur=${loaded.cur?.toFixed?.(2)} paused=${loaded.paused} err=${loaded.err}`);
  if (loaded.err) { fails.push("video.error code=" + loaded.err); break; }
  if (loaded.ready >= 2 && loaded.vw === 1920 && loaded.vh === 1080) break;
}

if (!loaded || loaded.ready < 2) fails.push("video 未就绪（readyState<2）");
if (!loaded || loaded.vw !== 1920 || loaded.vh !== 1080) fails.push("分辨率非 1920×1080: " + (loaded && loaded.vw + "x" + loaded.vh));
if (!loaded || !(loaded.dur > 58 && loaded.dur < 62)) fails.push("时长超出 58–62s 窗: " + (loaded && loaded.dur));

// 播放 3.2s 验证 currentTime 真前进（帧真的在动）
if (!fails.length) {
  const c0 = loaded.cur;
  await evaluate(`document.getElementById('player').play(); 'play'`);
  await sleep(3200);
  const c1 = await evaluate(`document.getElementById('player').currentTime`);
  say(`  播放 3.2s：currentTime ${Number(c0).toFixed(2)} → ${Number(c1).toFixed(2)}`);
  if (!(c1 > c0 + 2.5)) fails.push("currentTime 未前进（" + Number(c0).toFixed(2) + "→" + Number(c1).toFixed(2) + "）");
}

// 下载链接：必须已指向 blob: 且带 download 文件名
const dl = await evaluate(`(() => { const a = document.getElementById('dl-final');
  return { blob: (a.getAttribute('href') || '').startsWith('blob:'), name: a.getAttribute('download'), sz: a.href.length }; })()`);
say(`  下载链接：blob=${dl.blob} download=${dl.name}`);
if (!dl.blob) fails.push("下载链接未指向 blob（装载未完成或接线断）");
if (!/以柔克刚/.test(dl.name || "")) fails.push("下载文件名缺失: " + dl.name);

// 分片请求统计：17 片必须全 200（网络面证据）
const bad = assetRequests.filter((r) => r.status !== 200);
say(`  分片请求：${assetRequests.length} 个，非 200 = ${bad.length}${bad.length ? " → " + JSON.stringify(bad) : ""}`);
if (assetRequests.length < 17 || bad.length) fails.push("分片请求异常（" + assetRequests.length + " 个 / 非 200 " + bad.length + "）");
if (consoleErrors.length) fails.push("console/未捕获异常 " + consoleErrors.length + " 条: " + consoleErrors[0]);

await shot("probe-playing.png");
const report = {
  url: URL_ARG, checkedAt: new Date().toISOString(), verdict: fails.length ? "FAIL" : "PASS",
  video: loaded, download: dl, assetRequests, consoleErrors, fails,
};
writeFileSync(path.join(OUT_DIR, "report-video-probe.json"), JSON.stringify(report, null, 2));
if (fails.length) { say("VIDEO_PROBE: FAIL — " + fails.join("；")); process.exit(1); }
say("VIDEO_PROBE: PASS 播放器装载成功、1920×1080 首帧解出、时长 58–62s 窗内、currentTime 前进、下载链接为完整 mp4 Blob、17 分片全 200、console 零错误");
