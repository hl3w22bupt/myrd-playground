// touchcheck.mjs — 触屏手势自动化用例（验收口径 B/D）：headless Chrome + 移动仿真（CDP，390×844 + touch + dpr=2），
// 打开产物 ?touchdemo=1，在真实监听链路上合成 TouchEvent 序列，机判四类手势：
//   拖拽（yaw 偏转 >0.2rad）· 捏合（fov 收窄 >5° 且 zoom<1）· 摇杆（左下摇杆区上推 → 位移 >0.5m）· 点按（shotsFired 增加，确认时延 <100ms）
// 另断言：控件热区 DOM 实测（≥44px 且在视口内）、帧率采样 60 帧、touch-action 口径（#gl 计算值 none）、
// viewport 禁缩放、零未捕获异常；--screenshot 存证。
// 用法：node tools/touchcheck.mjs [--chrome <path>] [--port 9224] [--screenshot <path>]
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(flag("--port", "9224"));
const SHOT = flag("--screenshot", "");
const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = `file://${root}/index.html`;
const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pickChrome() {
  for (const c of CANDIDATES) {
    try { spawnSync(c, ["--version"], { stdio: "ignore" }); return c; } catch { /* 下一个 */ }
  }
  return null;
}

async function waitForDebugger(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome 尚未就绪 */ }
    await sleep(300);
  }
  throw new Error(`CDP 端口 ${PORT} 未就绪（20s）`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  const opened = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("WS 连接失败")); });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise(async (res) => {
    const mid = ++id;
    pending.set(mid, res);
    await opened;
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, events, close: () => ws.close() };
}

const CHROME = await pickChrome();
if (!CHROME) { console.error("TOUCHCHECK: FAIL 找不到本机 Chrome（--chrome 指定路径）"); process.exit(1); }
const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-touch-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "--window-size=390,844", "about:blank",
], { stdio: "ignore" });

try {
  const wsUrl = await waitForDebugger();
  const cdp = connect(wsUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const evalJs = async (expr) => (await cdp.send("Runtime.evaluate", {
    expression: expr, returnByValue: true, awaitPromise: true,
  })).result?.result?.value;

  // —— 移动仿真（等效模拟器口径）：iPhone 视口 + 触摸仿真 + 主指针 coarse ——
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }] });

  // ① 打开产物 ?touchdemo=1（合成手势驱动，约 2.1s 完成四类手势）
  await cdp.send("Page.navigate", { url: `${base}?touchdemo=1` });
  await sleep(5200);
  const payloadRaw = await evalJs(`document.getElementById("ts-touch")?.textContent ?? ""`);
  check(!!payloadRaw, "touchdemo 报告产出（#ts-touch 落 DOM）", payloadRaw.slice(0, 140));
  const r = payloadRaw ? JSON.parse(payloadRaw) : null;

  // ② 三类手势机判
  check(r?.drag?.moved === true, "手势① 拖拽 = 瞄准偏航",
    `yawDelta=${r?.drag?.yawDelta} rad`);
  check(r?.pinch?.zoomed === true, "手势② 双指捏合 = 视场缩放",
    `fov ${r?.pinch?.fovBefore}° → ${r?.pinch?.fovMin}°, zoom=${r?.pinch?.zoomAfter}`);
  check(r?.tap?.fired === true, "手势③ 点按 = 开火（单发）",
    `shots ${r?.tap?.shotsBefore} → ${r?.tap?.shotsAfter}`);
  check((r?.tap?.ackMs ?? 1e9) < 100, "点按确认时延 <100ms（无 300ms 延迟口径）",
    `ackMs=${r?.tap?.ackMs}`);
  check(r?.stick?.moved === true, "手势④ 虚拟摇杆 = 移动意图（左下摇杆区落指上推 → 位移）",
    `dist=${r?.stick?.dist}m (${r?.stick?.xBefore},${r?.stick?.zBefore})→(${r?.stick?.xAfter},${r?.stick?.zAfter})`);
  check(r?.ok === true, "四类手势汇总判定 ok", JSON.stringify(r));

  // ③ 消除延迟的静态口径：#gl touch-action=none + viewport 禁缩放
  const touchAction = await evalJs(`getComputedStyle(document.getElementById("gl")).touchAction`);
  check(touchAction === "none", "#gl touch-action=none（浏览器手势让位，touchstart 即响应）", touchAction);
  const vp = await evalJs(`document.querySelector('meta[name="viewport"]')?.content ?? ""`);
  check(vp.includes("user-scalable=no"), "viewport 禁缩放（消双击缩放等待）", vp);

  // ④ 仿真形态自证：主指针 coarse + 有触摸点（等效模拟器生效）
  const env = await evalJs(`({ coarse: matchMedia("(pointer: coarse)").matches, tpoints: navigator.maxTouchPoints, mode: window.__game.touchMode })`);
  check(env?.coarse === true && (env?.tpoints ?? 0) > 0 && env?.mode === true,
    "移动仿真生效（coarse 指针 + 触摸点 + 游戏触屏形态）", JSON.stringify(env));

  // ⑤ 移动控件热区（验收口径 B）：DOM 实测 getBoundingClientRect —— 全部 ≥44px（Apple HIG）且在视口内
  const rects = await evalJs(`window.__game.touchRects`);
  check(!!rects, "移动控件 DOM 就位（摇杆 + 开火/换弹/暂停）", JSON.stringify(rects));
  if (rects) {
    const vw = 390, vh = 844;
    const minSide = Math.min(...Object.values(rects).map((z) => Math.min(z.w, z.h)));
    check(minSide >= 44, "按钮热区 ≥44px（Apple HIG 下限，热区按命中算不按贴图算）",
      Object.entries(rects).map(([k, z]) => `${k}:${z.w}×${z.h}`).join(" "));
    const inside = Object.entries(rects).every(([k, z]) => z.x >= -0.5 && z.y >= -0.5 && z.x + z.w <= vw + 0.5 && z.y + z.h <= vh + 0.5);
    check(inside, "控件热区全部落在 390×844 视口内（无越界错位）", JSON.stringify(rects));
    // 摇杆底盘落位：必须在左下半屏（视觉与交互区一致 —— 底盘只做视觉，输入走画布悬浮链路，但落位错=玩家看不见底座）
    const j = rects.joystick;
    check(!!j && j.x + j.w / 2 < vw / 2 && j.y + j.h / 2 > vh / 2,
      "摇杆底盘位于左下半屏（与 controlLayout 布局真源一致）",
      j ? `center=(${(j.x + j.w / 2).toFixed(0)},${(j.y + j.h / 2).toFixed(0)})` : "缺失");
    const fireZone = rects.fire;
    check(!!fireZone && fireZone.w >= 64 && fireZone.h >= 64, "开火主按钮 64px 热区（高频主操作大于下限）",
      fireZone ? `${fireZone.w}×${fireZone.h} @(${fireZone.x},${fireZone.y})` : "缺失");
  }

  // ⑥ 帧率采样（验收口径 D）：rAF 连采 60 帧 → 平均帧时长 / 折算帧率（SwiftShader 软渲染口径 ≥5fps 即链路存活）
  const fps = await evalJs(`new Promise((res) => {
    const ts = [];
    const tick = (t) => { ts.push(t); if (ts.length <= 61) requestAnimationFrame(tick); else res({ frames: ts.length - 1, avgMs: +((ts[60] - ts[0]) / 60).toFixed(2), fps: +(60000 / (ts[60] - ts[0])).toFixed(1) }); };
    requestAnimationFrame(tick);
  })`);
  check((fps?.frames ?? 0) >= 60 && (fps?.fps ?? 0) >= 5, "帧率采样 60 帧（渲染主循环存活，软渲染 ≥5fps 口径）",
    fps ? `${fps.frames} 帧 / 平均 ${fps.avgMs}ms/帧 ≈ ${fps.fps}fps` : "无采样");

  const uncaught = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
  check(uncaught.length === 0, "零未捕获异常", uncaught.length ? JSON.stringify(uncaught[0]).slice(0, 200) : "0 个");

  if (SHOT) {
    const data = (await cdp.send("Page.captureScreenshot", { format: "png" })).result?.data;
    writeFileSync(SHOT, Buffer.from(data, "base64"));
    console.log(`  PASS  触屏仿真截图存证 — ${SHOT}`);
  }
  cdp.close();
} catch (err) {
  failures.push(`touchcheck 执行中断: ${err.message}`);
  console.error(`  FAIL  touchcheck 执行中断 — ${err.message}`);
} finally {
  chrome.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
}

console.log(failures.length === 0 ? "TOUCHCHECK: PASS 四类手势全部可用（拖拽/捏合/摇杆/点按）+ 热区与帧率关全过" : `TOUCHCHECK: FAIL ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
