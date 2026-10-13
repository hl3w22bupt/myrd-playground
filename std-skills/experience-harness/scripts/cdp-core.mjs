// cdp-core.mjs — experience-harness 的共享 CDP 核心（pack.mjs / sessiond.mjs 共用）。
//
// 范式与 mobile-web-smoke.mjs / browser-smoke.mjs 同源但**独立实现**（复用思路不复用文件）：
// 零 npm 依赖，Node ≥22 内置 fetch/WebSocket 直驱 Chrome DevTools Protocol。
// 既有门禁脚本一行不动（G1 验收 7），本模块是 harness 自己的核心。
//
// 提供：Chrome 启动/回收、CDP 会话（send/waitFor/evaluate/事件监听）、移动仿真、
// 触摸探针注入、tap/swipe/drag/pressKey 输入、截图（≤maxWidth 页内降采样）、
// 400 点 16 级量化指纹采样、帧差计算。

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import os from "node:os";

// —— 移动仿真参数（390×844 触摸 / Safari UA；DPR 取 1.8：物理 702×1519，证据截图天然
//    ≤720 宽，无需页内降采样——页内 Image 解码曾在 swiftshader 下冻结渲染主线程 40s+，
//    所有像素处理一律在 Node 侧做，页面侧零图像工作）——
export const MOBILE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 1.8, mobile: true };
export const DESKTOP_VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function env2(message) {
  console.error(`EXPERIENCE_HARNESS: FAIL(2) — ${message}（环境问题：装环境/换机器，不要改代码硬试）`);
  process.exit(2);
}

/** 断言运行环境可用（缺全局 WebSocket 等 → 退出码 2，语义对齐 MOBILE_SMOKE 协议） */
export function assertEnv() {
  if (typeof WebSocket === "undefined") {
    env2(`Node ${process.version} 无全局 WebSocket（需 Node ≥22）`);
  }
}

/** 解析 Chrome 可执行文件：显式参数 > 常见安装位置 */
export function resolveChrome(explicit = "") {
  const candidates = [explicit,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);
  const found = candidates.find((c) => !c.includes("/") || existsSync(c));
  if (!found) env2("找不到 Chrome/Chromium（--chrome 指定路径）");
  return found;
}

/**
 * 启动 headless Chrome（CDP 端口随机、软件渲染兜底、独立 user-data-dir）。
 * 返回 { cp, profileDir, port, cleanup }。
 */
export function launchChrome({ chrome, port, viewport }) {
  const profileDir = mkdtempSync(path.join(os.tmpdir(), "xh-harness-"));
  const cp = spawn(chrome, [
    "--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check",
    "--use-angle=swiftshader", `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "--disable-gpu-sandbox", "--hide-scrollbars", "about:blank",
  ], { stdio: "ignore" });
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { cp.kill(); } catch { /* 已退出 */ }
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* 尽力而为 */ }
  };
  process.on("exit", cleanup);
  return { cp, profileDir, port, cleanup };
}

/** 等 CDP 就绪并返回页面目标的 webSocketDebuggerUrl */
export async function connectCdp(port, retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

/** 建立 CDP 会话：send / waitFor / evaluate / addListener / close */
export async function openSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const listeners = [];
  let closed = false;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    for (const l of listeners) l(m);
  };
  // 断连快速失败：所有挂起命令立即拒绝（否则 Chrome 消失后 send 永远挂着——实测教训）
  const failAll = (reason) => {
    closed = true;
    for (const [id, res] of pending) res({ error: { message: `CDP 会话不可用: ${reason}` } });
    pending.clear();
  };
  ws.onclose = () => failAll("WebSocket 已关闭");
  ws.onerror = () => failAll("WebSocket 错误");
  // 命令级超时：renderer 卡死时命令不会回——超时拒绝而不是永久挂起
  const SEND_TIMEOUT_MS = 20_000;
  const send = (method, params = {}) => new Promise((res) => {
    if (closed) return res({ error: { message: "CDP 会话已关闭" } });
    const id = ++msgId;
    const timer = setTimeout(() => {
      if (pending.delete(id)) res({ error: { message: `CDP 命令超时（${SEND_TIMEOUT_MS / 1000}s）: ${method}` } });
    }, SEND_TIMEOUT_MS);
    pending.set(id, (m) => { clearTimeout(timer); res(m); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = (method, timeoutMs) => new Promise((res) => {
    const timer = setTimeout(() => { listeners.splice(listeners.indexOf(fn), 1); res(null); }, timeoutMs);
    const fn = (m) => { if (m.method === method) { clearTimeout(timer); listeners.splice(listeners.indexOf(fn), 1); res(m); } };
    listeners.push(fn);
  });
  const addListener = (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
  /** 页面上下文执行表达式（awaitPromise 支持异步采样）；异常时抛错（含页面侧描述） */
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error(`页面侧求值异常: ${d.exception?.description || d.text || "unknown"}`);
    }
    return r.result?.result?.value;
  };
  const close = () => { try { ws.close(); } catch { /* already closed */ } };
  return { ws, send, waitFor, addListener, evaluate, close };
}

/** 移动仿真 + 预注入触摸探针（capture+passive，不消费事件、不改游戏行为）——必须在导航前调用 */
export async function setupEmulation(session, { viewport, ua }) {
  await session.send("Runtime.enable");
  await session.send("Page.enable");
  await session.send("Network.enable");
  await session.send("Emulation.setDeviceMetricsOverride", viewport);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  if (ua) await session.send("Emulation.setUserAgentOverride", { userAgent: ua });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__xhTouch = { touchstart: 0, touchmove: 0, touchend: 0, click: 0, keydown: 0 };
    for (const t of ["touchstart", "touchmove", "touchend", "click", "keydown"]) {
      document.addEventListener(t, () => { window.__xhTouch[t]++; }, { capture: true, passive: true });
    }` });
}

/** 打开 URL 并等 load 事件（超时返回继续——证据照收） */
export async function navigate(session, url, timeoutMs = 30000) {
  const loaded = session.waitFor("Page.loadEventFired", timeoutMs);
  await session.send("Page.navigate", { url });
  await loaded;
}

// ============ 输入注入 ============
const touch = (session, points, type) =>
  session.send("Input.dispatchTouchEvent", { type, touchPoints: points, modifiers: 0 });

export async function tap(session, x, y) {
  await touch(session, [{ x: Math.round(x), y: Math.round(y), id: 1 }], "touchStart");
  await touch(session, [], "touchEnd");
}

export async function swipe(session, from, to, { moveSteps = 10, holdMs = 40 } = {}) {
  const fx = Math.round(from.x), fy = Math.round(from.y);
  await touch(session, [{ x: fx, y: fy, id: 1 }], "touchStart");
  for (let i = 1; i <= moveSteps; i++) {
    const x = Math.round(fx + ((to.x - fx) * i) / moveSteps);
    const y = Math.round(fy + ((to.y - fy) * i) / moveSteps);
    await touch(session, [{ x, y, id: 1 }], "touchMove");
    await sleep(holdMs);
  }
  await touch(session, [], "touchEnd");
}

// 常用键的 keycode 映射（够游戏场景用；其余键走 key 字符默认 0）
const KEYCODES = {
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  Enter: 13, Space: 32, w: 87, a: 65, s: 83, d: 68,
};
/**
 * 按键注入。⚠️ nativeVirtualKeyCode 必须为 0：非零会让 Chrome 在 macOS 上合成**原生**
 * 按键事件（撞系统输入法路径），实测 key 事件后下一次输入/渲染阻塞 ~40s
 * （A/B 试验：native=38 → tap 卡 40005ms；native=0 → 606ms）。网页读键走
 * windowsVirtualKeyCode（event.keyCode/which），native 码对 web 输入无意义。
 */
export async function pressKey(session, key) {
  const code = KEYCODES[key] ?? 0;
  const params = {
    key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    windowsVirtualKeyCode: code, nativeVirtualKeyCode: 0,
  };
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", ...params });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
}

/** 读触摸/键盘探针计数器（页面未就绪返回 null） */
export async function readTouchCounters(session) {
  return session.evaluate("window.__xhTouch ? JSON.parse(JSON.stringify(window.__xhTouch)) : null");
}

// ============ 截图与指纹 ============
/**
 * 截图：Page.captureScreenshot 原图直落 + **Node 侧**解码采样（零页面侧图像工作）。
 * 返回 { png: Buffer, width, height, points }；points = 400 点 16 级量化指纹（帧差/色数用）。
 * 宽度由视口 DPR 决定（mobile=702 ≤720；desktop 视 DPR 可能更宽，仅辅助模式）。
 */
export async function captureShot(session) {
  const r = await session.send("Page.captureScreenshot", { format: "png" });
  const data = r.result?.data;
  if (!data) throw new Error(`captureScreenshot 失败: ${JSON.stringify(r.error ?? r).slice(0, 300)}`);
  const png = Buffer.from(data, "base64");
  const decoded = decodePng(png);
  return { png, width: decoded.width, height: decoded.height, points: samplePoints(decoded) };
}

/**
 * 最小 PNG 解码器（Chrome 截图口径：8-bit、非隔行、RGB/RGBA），zlib 用 Node 内置。
 * 不引第三方依赖的代价是手写 unfilter（5 种过滤器）——约 50 行，换来页面侧零解码。
 */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG（magic 错误）");
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`不支持的 PNG 形态（bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}）`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`未知 PNG 过滤器 ${filter}`);
      }
      out[x] = v;
    }
    prev = out;
  }
  return { width, height, channels, pixels };
}

/** 400 点 16 级量化采样（与 mobile-web-smoke 口径一致），直接在解码像素上取 */
export function samplePoints({ width, height, channels, pixels }) {
  const points = [];
  for (let i = 0; i < 400; i++) {
    const x = (i * 7919) % width, y = (i * 104729) % height;
    const o = (y * width + x) * channels;
    points.push((pixels[o] >> 4) + "," + (pixels[o + 1] >> 4) + "," + (pixels[o + 2] >> 4));
  }
  return points;
}

/** 指纹差分：不同点数；任一侧非数组（采样失败）返回 null —— 调用方按「无法观测」处理 */
export function diffPoints(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  return a.filter((c, i) => c !== b[i]).length;
}

/** DOM 摘要：标题/canvas 存在性/可见文本片段/可交互元素计数/视口 —— 会话每步随证据返回 */
export async function domSummary(session) {
  return session.evaluate(`(() => {
    const text = (document.body ? document.body.innerText : "").replace(/\\s+/g, " ").trim();
    return {
      title: document.title,
      hasCanvas: document.querySelector('canvas') !== null,
      textSnippet: text.slice(0, 300),
      interactiveCount: document.querySelectorAll('button, a, [onclick], input, select').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);
}
