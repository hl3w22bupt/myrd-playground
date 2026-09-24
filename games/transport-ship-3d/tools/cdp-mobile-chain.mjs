// cdp-mobile-chain.mjs — CDP 移动仿真口径五环链取证（验收口径 B/D）：开局 → 触摸移动 → 开火命中 → 暂停 → 重开。
// 口径：iPhone 视口 390×844 + devicePixelRatio=2 + 触摸仿真（coarse 主指针），输入走 Input.dispatchTouchEvent
// —— 与真机同一浏览器输入管线（hit-test → touch/pointer/click 合成），不是页面内 dispatchEvent 模拟。
// 断言（机判，全部读内核/状态机真值）：
//   ①开局：点按开始按钮 → 状态机 title→playing，内核时间推进；
//   ②触摸移动：摇杆区落指上推 → 玩家位移 >0（机判阈值 0.05m，实测数米）；
//   ③开火命中：伺服瞄准最近敌兵 → 短触零位移点按开火 → shotsHit 上升 且 该敌兵 HP 下降/阵亡（非仅 shots 计数）；
//   ④暂停：点按暂停按钮 → 表现层与内核 world.state 双层进入 paused，世界时间冻结，重开按钮可见；
//   ⑤重开：点按重开按钮 → HP/波次/分数/弹药/命中记账/敌兵整体复位（数值常量取自 src/numeric.js）。
// 产出（默认落 .myrd/blackboard/gate-logs/mobile-chain/）：分环截图 PNG + 帧率采样 + JSON 断言报告。
// 用法：node tools/cdp-mobile-chain.mjs [--chrome <path>] [--port 9235] [--out <dir>]
// 纪律：每环完成即输出进度；单条 CDP 命令 15s 截止；任何断言失败 → 汇总非零退出。

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { PLAYER_MAX_HP, MAG_SIZE, RESERVE_AMMO, WAVE_REST } from "../src/numeric.js";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(flag("--port", "9235"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(flag("--out", path.join(root, "../../.myrd/blackboard/gate-logs/mobile-chain")));
const STAMP = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14); // YYYYMMDDHHMMSS（UTC）
const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startedAt = new Date().toISOString();
const checks = [];
const rings = {};
const fps = {};
const check = (ok, label, detail = "") => {
  checks.push({ ok, label, detail: String(detail).slice(0, 400) });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
};

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
  const rawSend = (method, params = {}) => new Promise(async (res) => {
    const mid = ++id;
    pending.set(mid, res);
    await opened;
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  // 反挂起：单条 CDP 命令 15s 截止（超时按失败收敛，绝不无限等待）
  const send = (method, params = {}) => Promise.race([
    rawSend(method, params),
    sleep(15000).then(() => { throw new Error(`CDP 命令超时: ${method}`); }),
  ]);
  return { send, events, close: () => ws.close() };
}

const CHROME = await pickChrome();
if (!CHROME) { console.error("MOBILE-CHAIN: FAIL 找不到本机 Chrome（--chrome 指定路径）"); process.exit(1); }
const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-chain-"));
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "--window-size=390,844", "about:blank",
], { stdio: "ignore" });

let okAll = true;
try {
  const wsUrl = await waitForDebugger();
  const cdp = connect(wsUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const evalJs = async (expr) => (await cdp.send("Runtime.evaluate", {
    expression: expr, returnByValue: true, awaitPromise: true,
  })).result?.result?.value;

  // —— 移动仿真（等效模拟器口径，与 touchcheck 同一配置）：390×844 + dpr=2 + touch + coarse ——
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }] });

  // —— CDP 真触摸原语：浏览器输入管线（hit-test → touch/pointer/click 合成），坐标为 CSS 像素 ——
  const pts = (list) => list.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? 10 + i, radiusX: 0.5, radiusY: 0.5, force: 0.6 }));
  // 事件时戳显式注入（protocol timestamp，秒）：软渲染主线程拥塞下 touchEnd 的派发时点会被 renderer
  // ACK 拖后 250ms+，实测把 80ms 短触撑成 271ms 越过 TAP_MAX_MS(220ms) 被误判长按 ——
  // 时戳由工具显式给值后，点按时长机判恒等于注入值（真机点按 50-150ms 同口径），不受拥塞影响。
  const seq = { t: 0 };
  const bump = (dtMs = 0) => { const now = Date.now() / 1000; seq.t = Math.max(seq.t + dtMs / 1000, now); return seq.t; };
  const dispatch = (type, list, ts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts(list), timestamp: ts });
  const tapAt = async (x, y, holdMs = 60) => {
    const t0 = bump();
    const p = dispatch("touchStart", [{ x, y, id: 1 }], t0);
    await sleep(20);
    await p;
    await dispatch("touchEnd", [], t0 + holdMs / 1000);
  };
  const drag = async (x0, y0, x1, y1, { steps = 6, stepMs = 40, id = 1 } = {}) => {
    const t0 = bump();
    await dispatch("touchStart", [{ x: x0, y: y0, id }], t0);
    for (let i = 1; i <= steps; i++) {
      await sleep(stepMs);
      await dispatch("touchMove", [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps, id }], bump(1));
    }
    await sleep(stepMs);
    await dispatch("touchEnd", [], bump(1)); // 拖拽会话时长天然 > TAP_MAX_MS → 判 drag 不误触点按
  };
  const shot = async (name) => {
    const data = (await cdp.send("Page.captureScreenshot", { format: "png" })).result?.data;
    const file = path.join(OUT, `${name}-${STAMP}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log(`  [shot] ${path.basename(file)}`);
    return file;
  };
  const sampleFps = async (windowMs = 1000) => evalJs(`new Promise((res) => {
    let n = 0; const t0 = performance.now();
    (function tick() { n++; if (performance.now() - t0 < ${windowMs}) requestAnimationFrame(tick);
      else res({ frames: n, ms: Math.round(performance.now() - t0), fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1) }); })();
  })`);

  // —— 内核/状态机真值快照（唯一断言来源：__game.world + 屏显 DOM）——
  const snap = () => evalJs(`(() => {
    const g = window.__game; if (!g) return null;
    const w = g.world, p = w.player;
    const scr = document.getElementById("ts-screen"), rst = document.getElementById("ts-restart");
    // 可见性口径（红队 F2 收口）：getBoundingClientRect 实测 —— 元素或任一祖先 display:none 时
    // 布局盒为 0×0；元素级 style.display 不作为判据（hud 置 "" 复位不回 "none"，父级隐藏下会出伪 true）
    const shown = (n) => { if (!n) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      state: g.state, kernelState: w.state, time: +w.time.toFixed(3),
      hp: p.hp, ammo: p.ammo, reserve: p.reserve,
      score: w.score, kills: w.kills, shotsFired: w.shotsFired, shotsHit: w.shotsHit,
      waveN: w.wave.n, waveState: w.wave.state,
      px: +p.x.toFixed(3), pz: +p.z.toFixed(3), yaw: +p.yaw.toFixed(5),
      enemiesAlive: w.enemies.filter((e) => e.state !== "dead").length,
      enemies: w.enemies.filter((e) => e.state !== "dead")
        .map((e) => ({ id: e.id, hp: e.hp, d: +Math.hypot(e.x - p.x, e.z - p.z).toFixed(2) })),
      screenShown: shown(scr),
      restartShown: shown(rst),
      restartLabel: rst ? rst.textContent : null,
    };
  })()`);
  const pollSnap = async (pred, timeoutMs, everyMs = 150) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const s = await snap();
      if (s && pred(s)) return s;
      if (Date.now() > deadline) return null;
      await sleep(everyMs);
    }
  };
  const centerOf = (sel) => evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  })()`);

  await cdp.send("Page.navigate", { url: `file://${root}/index.html` });
  const ready = await pollSnap((s) => s.state === "title", 20000, 200);
  if (!check(!!ready, "产物加载就绪（__game 暴露 + 标题屏）", "file://index.html")) throw new Error("页面未就绪");

  // —— 环① 开局：点按开始按钮 → playing，内核时间推进 ——
  console.log("[ring] ① 开局（点按 #ts-start）");
  const env = await evalJs(`({ vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
    coarse: matchMedia("(pointer: coarse)").matches, tpoints: navigator.maxTouchPoints,
    ua: navigator.userAgent.includes("Chrome") ? "chrome-headless" : "other" })`);
  rings.env = env;
  check(env.vw === 390 && env.vh === 844, "移动仿真视口 390×844", `${env.vw}×${env.vh}`);
  check(env.dpr === 2, "devicePixelRatio = 2（Retina 口径）", `dpr=${env.dpr}`);
  check(env.coarse === true && (env.tpoints ?? 0) > 0, "触摸仿真生效（coarse 主指针 + 触摸点）",
    `coarse=${env.coarse}, maxTouchPoints=${env.tpoints}`);
  const startBtn = await centerOf("#ts-start");
  await tapAt(startBtn.x, startBtn.y);
  const s1 = await pollSnap((s) => s.state === "playing" && !s.screenShown, 8000);
  check(!!s1, "环① 开局：点按开始按钮 → 状态机进入 playing", `start=(${startBtn.x},${startBtn.y})`);
  await sleep(400);
  const s1b = await snap();
  check(s1b.time > (s1?.time ?? 0), "环① 内核时间推进（对局真实运行）",
    `time ${(s1?.time ?? 0).toFixed(2)}s → ${s1b.time.toFixed(2)}s`);
  rings.start = s1b;
  await shot("ring1-start");

  // —— 环② 触摸移动：摇杆区落指上推 → 位移 >0 ——
  console.log("[ring] ② 触摸移动（虚拟摇杆上推）");
  const rects = await evalJs(`window.__game.touchRects`);
  const jx = rects.joystick.x + rects.joystick.w / 2, jy = rects.joystick.y + rects.joystick.h / 2;
  const m0 = await snap();
  const jt0 = bump();
  const jPending = dispatch("touchStart", [{ x: jx, y: jy, id: 4 }], jt0); // 落指 = 摇杆底座悬浮定位
  await jPending;
  for (let i = 1; i <= 8; i++) { await sleep(60); await dispatch("touchMove", [{ x: jx, y: jy - i * 6, id: 4 }], bump(1)); }
  await sleep(900); // 按住持续推进（摇杆意图保持）
  await dispatch("touchEnd", [], bump(1)); // 抬指：意图清零
  const m1 = await snap();
  const dist = +Math.hypot(m1.px - m0.px, m1.pz - m0.pz).toFixed(3);
  rings.move = { from: { x: m0.px, z: m0.pz }, to: { x: m1.px, z: m1.pz }, dist };
  check(dist > 0.05, "环② 触摸移动：摇杆上推 → 玩家位移 >0（机判阈值 0.05m）",
    `dist=${dist}m (${m0.px},${m0.pz})→(${m1.px},${m1.pz})`);
  fps.moving = await sampleFps(1200);
  check((fps.moving?.frames ?? 0) >= 10, "帧率采样（移动中，rAF 主循环存活）",
    fps.moving ? `${fps.moving.frames} 帧 / ${fps.moving.ms}ms ≈ ${fps.moving.fps}fps` : "无采样");
  await shot("ring2-move");

  // —— 环③ 开火命中：伺服瞄准最近敌兵 → 80ms 短触开火 → shotsHit 上升 且 目标 HP 下降 ——
  console.log("[ring] ③ 开火命中（伺服瞄准 + 点按开火）");
  // 敌兵在开局休整（WAVE_REST=8s 世界时间）后才出生：有界等待 ≤35s（波次时序见 kernel/wave.js）
  const enemySeen = await pollSnap((s) => s.enemiesAlive > 0, 35000, 250);
  check(!!enemySeen, "环③ 前置：第 1 波敌兵出生（休整期结束）",
    enemySeen ? `wave=${enemySeen.waveN}, alive=${enemySeen.enemiesAlive}, t=${enemySeen.time.toFixed(1)}s` : "35s 内无敌兵");
  // 伺服瞄准：与真机同链路的拖拽会话（applyLook: yaw -= dx*k → dx = -Δ/k），k 取 touch.js lookSensitivity 同式
  const AIM_TOL = 0.015; // rad：12m 外残余 ≤0.18m ≪ ENEMY_HIT_RADIUS 0.45m
  const k = 2.4 / Math.min(390, 844);
  const norm = (a) => { const t = (a + Math.PI) / (2 * Math.PI); return (t - Math.floor(t)) * 2 * Math.PI - Math.PI; };
  const aimRead = () => evalJs(`(() => {
    const w = window.__game.world, p = w.player;
    let best = null;
    for (const e of w.enemies) {
      if (e.state === "dead") continue;
      const err = Math.atan2(Math.sin(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw), Math.cos(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw));
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < 1) continue;
      if (!best || Math.abs(err) < Math.abs(best.err)) best = { id: e.id, err, d, hp: e.hp };
    }
    return best ? { id: best.id, err: +best.err.toFixed(5), d: +best.d.toFixed(2), hp: best.hp } : null;
  })()`);
  const servo = async () => {
    const deadline = Date.now() + 5000;
    const slop = Math.max(6, 390 * 0.016); // touch.js TAP_SLOP_RATIO 同式：低于 2×slop 的拖拽会被判成点按
    for (;;) {
      const t = await aimRead();
      if (!t) return null;
      if (Math.abs(t.err) < AIM_TOL || Date.now() > deadline) return t;
      const dx = Math.max(-330, Math.min(330, -(t.err / k)));
      if (Math.abs(dx) < slop * 2) return t; // 残差已低于点按阈值：再拖会误触点按，视为已瞄准
      await drag(200, 200, 200 + dx, 200, { steps: 4, stepMs: 30, id: 21 });
      await sleep(120); // 等内核子步吃到新朝向
    }
  };
  let hit = null;
  let firedAny = false;
  for (let round = 1; round <= 5 && !hit; round++) {
    const t = await servo();
    if (!t) break;
    const before = await snap();
    if (before.shotsFired > 0 && round === 1) firedAny = true; // 前环无开火，正常为 0
    const tTap = Date.now();
    // 非摇杆区落指（x>195）+ 零位移短触 = 点按开火：点按时长 60ms 显式注入事件时戳（机判 dt ≤ TAP_MAX_MS）
    const t0 = bump();
    const pending = dispatch("touchStart", [{ x: 200, y: 200, id: 3 }], t0);
    await sleep(20);
    await pending;
    await dispatch("touchEnd", [], t0 + 0.06);
    const deadline = Date.now() + 1500;
    let ackMs = null;
    for (;;) {
      const s = await snap();
      if (s.shotsFired > before.shotsFired && ackMs === null) ackMs = Date.now() - tTap;
      if (s.shotsHit > before.shotsHit) {
        const e = s.enemies.find((x) => x.id === t.id);
        hit = {
          round, ackMs, aimErr: t.err, aimDist: t.d,
          shotsFiredBefore: before.shotsFired, shotsFiredAfter: s.shotsFired,
          shotsHitBefore: before.shotsHit, shotsHitAfter: s.shotsHit,
          targetId: t.id, targetHpBefore: t.hp, targetHpAfter: e ? e.hp : 0, targetDead: !e,
          score: s.score,
        };
        break;
      }
      if (Date.now() > deadline) break;
      await sleep(50);
    }
    if (ackMs !== null) firedAny = true;
    if (!hit) await sleep(150); // 脱靶 → 重新伺服补射（最多 5 轮）
  }
  rings.fire = hit;
  check(!!hit, "环③ 开火命中：点按开火 → 内核命中记账（shotsHit 上升，非仅 shots 计数）",
    hit ? `rounds=${hit.round}, shotsHit ${hit.shotsHitBefore}→${hit.shotsHitAfter}, aimErr=${hit.aimErr}rad @${hit.aimDist}m, ackMs=${hit.ackMs}` : "5 轮补射均未命中");
  check(!!hit && (hit.targetHpAfter < hit.targetHpBefore || hit.targetDead),
    "环③ 敌方 HP 下降/阵亡（受击实质，非计数口径）",
    hit ? `敌兵#${hit.targetId} HP ${hit.targetHpBefore}→${hit.targetHpAfter}${hit.targetDead ? "（阵亡）" : ""}` : "无命中目标");
  check(firedAny, "环③ 点按 → 开火确认（tapFire 消费为内核 shot）",
    hit ? `shots ${hit.shotsFiredBefore}→${hit.shotsFiredAfter}, ackMs=${hit.ackMs}ms（CDP 链路参考值，含软渲染拥塞；<100ms 内核口径见 touchcheck）` : "未检出开火");
  check((hit?.score ?? 0) > 0, "环③ 命中得分入账（score >0，为重开环复位提供前值）", `score=${hit?.score}`);
  if (hit) await shot("ring3-fire-hit");

  // —— 环④ 暂停：点按暂停按钮 → 双层状态机进入 paused，世界时间冻结 ——
  console.log("[ring] ④ 暂停（点按 #ts-btn-pause）");
  const pauseBtn = rects.pause;
  const pC = { x: Math.round(pauseBtn.x + pauseBtn.w / 2), y: Math.round(pauseBtn.y + pauseBtn.h / 2) };
  await tapAt(pC.x, pC.y);
  const p1 = await pollSnap((s) => s.state === "paused" && s.kernelState === "paused", 6000);
  rings.pause = p1;
  check(!!p1, "环④ 暂停：点按暂停按钮 → 状态机进入 paused（表现层+内核双层）",
    `pause=(${pC.x},${pC.y}) state=${p1?.state}, kernel=${p1?.kernelState}`);
  const frozenA = await snap();
  await sleep(800);
  const frozenB = await snap();
  check(frozenA.state === "paused" && frozenB.time === frozenA.time,
    "环④ 暂停期世界时间冻结（拒意图、停推进）",
    `time ${frozenA.time}s → ${frozenB.time}s（800ms 间隔）`);
  check(p1?.screenShown === true, "环④ 暂停屏弹出", `screenShown=${p1?.screenShown}`);
  check(p1?.restartShown === true, "环④ 暂停屏出现重开按钮（重开环入口）",
    `label="${p1?.restartLabel}"`);
  fps.paused = await sampleFps(600);
  await shot("ring4-paused");

  // —— 环⑤ 重开：点按重开按钮 → HP/波次/分数/弹药/记账/敌兵整体复位 ——
  console.log("[ring] ⑤ 重开（点按 #ts-restart）");
  const pre = await snap();
  const rC = await centerOf("#ts-restart");
  check(!!rC, "环⑤ 重开按钮可命中（DOM 实测中心点）", rC ? `(${rC.x},${rC.y})` : "按钮缺失");
  await tapAt(rC.x, rC.y);
  const r1 = await pollSnap((s) => s.state === "playing" && s.kernelState === "playing" && !s.screenShown, 6000);
  await sleep(400); // 等首帧落位后取复位快照
  const post = await snap();
  rings.restart = { pre, post };
  check(!!r1, "环⑤ 重开：点按重开按钮 → 状态机回到 playing", `restart=(${rC?.x},${rC?.y})`);
  check(pre.score > 0 && post.score === 0, "环⑤ 分数复位 0", `score ${pre.score} → ${post.score}`);
  check(pre.shotsFired > 0 && post.shotsFired === 0 && post.shotsHit === 0,
    "环⑤ 开火/命中记账复位 0", `shotsFired ${pre.shotsFired}→${post.shotsFired}, shotsHit ${pre.shotsHit}→${post.shotsHit}`);
  check(post.hp === PLAYER_MAX_HP, `环⑤ HP 复位 ${PLAYER_MAX_HP}`, `hp ${pre.hp} → ${post.hp}`);
  check(post.ammo === MAG_SIZE && post.reserve === RESERVE_AMMO,
    `环⑤ 弹药复位（弹匣 ${MAG_SIZE} / 备弹 ${RESERVE_AMMO}）`, `ammo ${pre.ammo}→${post.ammo}, reserve ${pre.reserve}→${post.reserve}`);
  check(pre.waveN >= 1 && post.waveN === 0 && post.waveState === "rest",
    "环⑤ 波次复位到开局休整（wave 0 / rest）",
    `wave ${pre.waveN}(${pre.waveState}) → ${post.waveN}(${post.waveState})`);
  check(pre.enemiesAlive >= 1 && post.enemiesAlive === 0, "环⑤ 敌兵清空（波次重排）",
    `alive ${pre.enemiesAlive} → ${post.enemiesAlive}`);
  check(post.time < pre.time, "环⑤ 对局计时复位", `time ${pre.time}s → ${post.time}s`);
  fps.afterRestart = await sampleFps(800);
  check((fps.afterRestart?.frames ?? 0) >= 5, "帧率采样（重开后渲染存活）",
    fps.afterRestart ? `${fps.afterRestart.frames} 帧 ≈ ${fps.afterRestart.fps}fps` : "无采样");
  await shot("ring5-restarted");

  const uncaught = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
  check(uncaught.length === 0, "零未捕获异常", uncaught.length ? JSON.stringify(uncaught[0]).slice(0, 200) : "0 个");
  cdp.close();
} catch (err) {
  okAll = false;
  checks.push({ ok: false, label: "mobile-chain 执行中断", detail: err.message });
  console.error(`  FAIL  mobile-chain 执行中断 — ${err.message}`);
} finally {
  chrome.kill("SIGKILL");
  rmSync(profile, { recursive: true, force: true });
}

okAll = checks.every((c) => c.ok);
const report = {
  tool: "tools/cdp-mobile-chain.mjs",
  purpose: "验收口径 B/D：CDP 移动仿真五环链（开局→触摸移动→开火命中→暂停→重开）机判断言与仿真证据",
  startedAt, finishedAt: new Date().toISOString(),
  emulation: { viewport: "390x844", devicePixelRatio: 2, touch: "Input.dispatchTouchEvent（浏览器输入管线）", maxTouchPoints: 5 },
  numeric: { PLAYER_MAX_HP, MAG_SIZE, RESERVE_AMMO, WAVE_REST },
  env: rings.env ?? null,
  rings: { start: rings.start ?? null, move: rings.move ?? null, fire: rings.fire ?? null, pause: rings.pause ?? null, restart: rings.restart ?? null },
  fps,
  checks,
  ok: okAll,
};
const reportFile = path.join(OUT, `mobile-chain-report-${STAMP}.json`);
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`[report] ${reportFile}`);

console.log(okAll
  ? "MOBILE-CHAIN: PASS 五环链全过（开局/触摸移动/开火命中/暂停/重开）+ 帧率与分环截图落盘"
  : `MOBILE-CHAIN: FAIL ${checks.filter((c) => !c.ok).map((c) => c.label).join("; ")}`);
process.exit(okAll ? 0 : 1);
