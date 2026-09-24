// main.js — 装配根：装配顺序 = 依赖顺序（渲染器 → 场景/布景 → 玩家装配 → HUD/音频 → 输入 → 主循环）。
// 状态机显式：title → playing → paused → gameover。内核事件统一在此翻译成表现（物理层零 UI/音频依赖）。

import * as THREE from "three";
import { createGame } from "./kernel/loop.js";
import { buildMap } from "./render/map.js";
import { buildPlayerRig, attachInput } from "./render/player.js";
import { attachTouch, isTouchDevice } from "./render/touch.js";
import { EnemyPool, syncEnemies } from "./render/enemy.js";
import { buildHud } from "./render/hud.js";
import { buildAudio } from "./render/audio.js";
import { buildFx, impactPoint } from "./render/fx.js";
import { PLAYER_START } from "./levels/level-01-deck.js";
import { styleCard, assetManifest } from "../assets/index.mjs";

const canvas = document.getElementById("gl");
const uiRoot = document.getElementById("ui");

// —— 渲染器（对标样本封装：ACESFilmic / sRGB / PCFSoft / dpr 钳制；曝光取风格卡）——
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = styleCard().light.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
// 阴影口径：样本用 PCFSoftShadowMap，但 three r185 已弃用（运行时警告并降级为 PCF）——
// 这里显式声明实际生效的 PCFShadowMap，不再虚报软阴影（控制台零告警）。
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

const scene = new THREE.Scene();

// —— 重玩钩子（spec.content.replayHooks：high_score / wave_streak / daily_seed）——
// daily_seed：当日种子，同一天首局可复现（对标样本「每张图固定随机种子」口径）；
// 对局内重开仍用时间随机（resetMatch），布景复现性不受影响。
function dailySeed() {
  const d = new Date();
  return ((d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 2654435761) >>> 0;
}
const REPLAY_KEY = "ts3d.replay";
function loadReplay() {
  try { return JSON.parse(localStorage.getItem(REPLAY_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
function saveReplay(patch) {
  try { localStorage.setItem(REPLAY_KEY, JSON.stringify({ ...loadReplay(), ...patch })); } catch { /* 隐私模式：静默降级 */ }
}
let replay = loadReplay();

// —— 游戏（确定性内核）与表现装配 ——
const game = createGame({ seed: dailySeed() });
const map = buildMap(scene);
const rig = buildPlayerRig(canvas);
const hud = buildHud(uiRoot);
const audio = buildAudio();
const enemies = new EnemyPool(scene);
const fx = buildFx(scene); // 命中火花（表现层自带降级，失败为空实现）
const inputState = { yaw: game.world.player.yaw, pitch: 0, firing: false, reloadQueued: false, tapFire: false, moveX: 0, moveY: 0 };
const input = attachInput(canvas, inputState);
// —— 触屏形态（验收口径 B）：拖拽瞄准 / 双指捏合缩放 / 点按开火；桌面无触摸时该识别器零副作用 ——
const touchMode = isTouchDevice();
// 触屏没有 Esc：暂停按钮 → onPause 钩子（与桌面 pointerlock 丢失同一状态机路径，见下方 pauseGame）
const pauseGame = () => {
  if (state !== "playing") return;
  game.pause(); // 内核状态机同步（kernel/loop.js 单字段 world.state）：暂停期内核拒意图、停推进 —— 双层口径一致
  state = "paused";
  hud.showScreen(true);
  hud.screenText({ title: "已暂停 ", sub: "点按按钮回到甲板。", btn: "继续（点按）", restart: "重开一局（点按）" });
};
const touchCtl = attachTouch(canvas, inputState, { onZoom: (z) => rig.setZoom(z), onPause: pauseGame });

// —— 状态机 ——
let state = "title"; // title | playing | paused | gameover
hud.showScreen(true);
if (replay.highScore || replay.waveStreak) {
  hud.setBest(`最高 ${(replay.highScore ?? 0).toLocaleString("en-US")} · 上次 第 ${replay.waveStreak ?? 0} 波`);
}
hud.onStart(() => {
  audio.unlock();
  if (state === "gameover") resetMatch();
  else game.resume(); // 继续：内核 paused → playing（幂等；title 态空转）。重开路径走 onRestart → resetMatch
  touchCtl.resetZoom(); // 重开回标准视场
  hud.setDead(false); // 重开：退出阵亡灰度
  if (!touchMode) {
    // 桌面：锁定鼠标；无头/拒绝场景静默降级（Promise 拒绝不外溢，冒烟门禁零未捕获异常口径）
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* pointerLock 不可用 */ }
  } // 触屏：点按即进对局（无 pointerLock、无 300ms 等待）
  state = "playing";
  hud.showScreen(false);
});

// 重开按钮（暂停屏次操作，验收口径 D「重开环」）：整体复位 HP/波次/分数/弹药/敌兵 ——
// 复用对局内随机重开 resetMatch（内核 createWorld 整体替换，引用稳定），与结算屏「再来一局」同一复位口径。
hud.onRestart(() => {
  if (state !== "paused" && state !== "gameover") return; // 仅暂停/结算态可重开（对局中不误触）
  audio.unlock();
  resetMatch();
  touchCtl.resetZoom();
  hud.setDead(false);
  state = "playing";
  hud.showScreen(false);
});

function resetMatch() {
  enemies.clear();
  const seed = (Math.random() * 0xffffffff) >>> 0; // 对局内随机（布景复现性不受影响）
  const fresh = createGame({ seed });
  Object.assign(game.world, fresh.world); // 内核状态整体替换（保持 game/game.world 引用稳定）
  inputState.yaw = game.world.player.yaw;
  inputState.pitch = 0;
  inputState.firing = false;
  inputState.reloadQueued = false;
  inputState.moveX = 0; // 摇杆轴清零（触屏重开不漂移；摇杆指仍按住时下一帧 move 会重新写入）
  inputState.moveY = 0;
}

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && state === "playing") {
    game.pause(); // 内核状态机同步（与 pauseGame 同一口径）
    state = "paused";
    hud.showScreen(true);
    hud.screenText({ title: "已暂停 ", sub: "点击按钮回到甲板。", btn: touchMode ? "继续（点按）" : "继续（锁定鼠标）", restart: touchMode ? "重开一局（点按）" : "重开一局" });
  }
});

// 触屏没有 Esc：切后台即暂停，回前台点按继续（防后台白跑内核）
document.addEventListener("visibilitychange", () => {
  if (document.hidden && touchMode && state === "playing") {
    game.pause(); // 内核状态机同步（与 pauseGame 同一口径）
    state = "paused";
    hud.showScreen(true);
    hud.screenText({ title: "已暂停 ", sub: "点按按钮回到甲板。", btn: "继续（点按）", restart: "重开一局（点按）" });
  }
});

// —— 主循环：rAF 可变渲染 + 内核固定步长累加器 ——
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  let events = [];

  if (state === "playing") {
    events = game.frame(dt, input.read());
    // 内核事件 → 表现统一翻译（物理层零 UI/音频/特效依赖）
    for (const ev of events) {
      if (ev.type === "shot") rig.fire();
      else if (ev.type === "enemyHit") {
        fx.burst(impactPoint(rig.camera, ev.dist), ev.headshot === true);
        hud.hitMark(ev.headshot === true);
      }
    }
    audio.handle(events);
    if (game.world.over) {
      state = "gameover";
      hud.setDead(true); // 阵亡灰度（纯表现，结算屏/HUD 不受影响）
      // 重玩钩子落账：最高分取历史最大值，波次连击记本次成绩
      replay = {
        highScore: Math.max(replay.highScore ?? 0, game.world.score),
        waveStreak: game.world.wave.n,
      };
      saveReplay(replay);
      hud.showScreen(true);
      hud.screenText({
        title: `结算 · ${game.world.score.toLocaleString("en-US")} 分 `,
        sub: `波次 ${game.world.wave.n} · 击杀 ${game.world.kills} · 爆头 ${game.world.headshots} · 存活 ${game.world.time.toFixed(1)}s`,
        btn: touchMode ? "再来一局（点按）" : "再来一局（锁定鼠标）",
      });
      hud.setBest(`最高 ${replay.highScore.toLocaleString("en-US")} · 上次 第 ${replay.waveStreak} 波`);
      document.exitPointerLock?.();
    }
  }

  rig.apply(game.world);
  syncEnemies(enemies, game.world, dt);
  fx.update(dt);
  map.update(rig.camera);
  hud.update(game.world, events);

  renderer.render(scene, rig.camera);
  // 武器视图双 pass：清深度不清颜色（对标样本 RenderPass clear=false / clearDepth=true）
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(rig.vmScene, rig.vmCamera);
  renderer.autoClear = true;
}
requestAnimationFrame(loop);

// —— 自适应 ——
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  rig.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

// —— 调试/测试钩子（对标样本 window.__game + fastForward 无头接口 + URL 参数调试）——
window.__game = {
  get world() { return game.world; },
  get state() { return state; },
  /** 调试口：世界场景（美术自检用 —— 核验资产是否真的进了场景）*/
  get scene() { return scene; },
  /** 触屏调试口（验收口径 B/D）：世界相机视场角 + 当前捏合缩放系数 */
  get fov() { return rig.camera.fov; },
  get zoom() { return touchCtl.zoom; },
  get touchMode() { return touchMode; },
  /** 触屏控件热区（viewport 坐标，验收口径 B/D 机判口）：摇杆 + 开火/换弹/暂停，桌面触屏形态外为 null */
  get touchRects() { return touchCtl.rects(); },
  fastForward: (seconds) => game.fastForward(seconds),
  /** spec.content.replayHooks 的读取口：最高分 / 波次连击 / 当日种子 */
  get replayHooks() {
    return { highScore: replay.highScore ?? 0, waveStreak: replay.waveStreak ?? 0, dailySeed: dailySeed() };
  },
  /** 资产台账（spec.assets[] → 落点/接线点，供审计与调试读取）*/
  get assets() { return assetManifest(); },
};

// ?smoke=<秒>：无头冒烟 —— 跳过交互直接快进，把结果写进 DOM/标题供 headless chrome 断言。
const smoke = new URLSearchParams(location.search).get("smoke");
if (smoke !== null) {
  const seconds = Math.max(0, Number(smoke) || 0);
  state = "playing";
  hud.showScreen(false); // 冒烟截屏要看真实画面
  const result = game.fastForward(seconds, { yaw: PLAYER_START.yaw }); // 保持出生朝向（面向舰桥）
  // 显式渲染一帧再取统计（headless virtual-time 下 rAF 不保证已跑，draw call 才是「真渲染了」的证据）
  rig.apply(game.world);
  syncEnemies(enemies, game.world, 0);
  map.update(rig.camera);
  renderer.render(scene, rig.camera);
  renderer.clearDepth();
  renderer.render(rig.vmScene, rig.vmCamera);
  const payload = JSON.stringify({
    ok: true, score: result.score, kills: result.kills, wave: result.wave,
    hp: result.hp, over: result.over, time: +result.time.toFixed(2),
    shotsFired: result.shotsFired, shotsHit: result.shotsHit,
    drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  });
  const box = document.createElement("div");
  box.id = "ts-smoke";
  box.textContent = payload;
  document.body.appendChild(box);
  document.title = `SMOKE ${payload}`;
  console.log("[smoke]", payload);
}

// ?fire=<秒>：表现层调试驱动（默认关闭）—— 模拟按住扳机 N 秒，让「开火→命中→火光/火花/命中标记」
// 这条纯表现链路可被无头截图与机判取证（对标样本「URL 参数即调试接口」口径；不碰内核，不改数值）。
const fireSec = new URLSearchParams(location.search).get("fire");
if (fireSec !== null) {
  const ms = Math.max(0, Number(fireSec) || 0) * 1000;
  setTimeout(() => { inputState.firing = true; }, 300);
  setTimeout(() => { inputState.firing = false; }, 300 + ms);
}

// ?touchdemo=1：触屏手势无头取证（验收口径 B/D）—— 在真实浏览器里合成 TouchEvent 序列
// （拖拽 → 双指捏合 → 点按开火+命中），把机判结果写进 DOM(#ts-touch)/标题/控制台，
// 供 CDP 冒烟断言与证据归档；不碰内核、不改数值，只走与真机完全相同的监听链路。
// 点按环含「开火→命中」闭环：先以同一拖拽链路伺服瞄准最近敌兵，命中以内核 shotsHit 计数上升机判。
const touchdemo = new URLSearchParams(location.search).get("touchdemo");
if (touchdemo !== null) {
  const fire = (type, touchList, changed = touchList) => canvas.dispatchEvent(
    new TouchEvent(type, {
      touches: touchList, targetTouches: touchList, changedTouches: changed,
      bubbles: true, cancelable: true,
    }),
  );
  const mk = (id, x, y) => new Touch({ identifier: id, target: canvas, clientX: x, clientY: y });
  const report = {
    ok: false, touchMode: touchMode,
    drag: { moved: false, yawDelta: 0 },
    pinch: { zoomed: false, fovBefore: 0, fovMin: 0, zoomAfter: 1 },
    stick: { moved: false, dist: 0, xBefore: 0, zBefore: 0, xAfter: 0, zAfter: 0 },
    tap: {
      fired: false, hit: false, shotsBefore: 0, shotsAfter: 0,
      shotsHitBefore: 0, shotsHitAfter: 0, ackMs: null, hitMs: null,
      aimErr: null, rounds: 0, hitMarkSeen: false, targetHpBefore: null, targetHpAfter: null,
    },
  };
  const finish = () => {
    if (document.getElementById("ts-touch")) return; // 报告只落一次
    report.pinch.zoomed = report.pinch.fovMin < report.pinch.fovBefore - 5 && report.pinch.zoomAfter < 1;
    report.drag.moved = Math.abs(report.drag.yawDelta) > 0.2;
    report.stick.moved = report.stick.dist > 0.5;
    report.tap.shotsHitAfter = game.world.shotsHit;
    report.tap.fired = report.tap.shotsAfter > report.tap.shotsBefore;
    report.tap.hit = report.tap.shotsHitAfter > report.tap.shotsHitBefore; // 敌兵受击（内核命中记账）
    report.ok = report.drag.moved && report.pinch.zoomed && report.stick.moved
      && report.tap.fired && report.tap.hit;
    const payload = JSON.stringify(report);
    const box = document.createElement("div");
    box.id = "ts-touch";
    box.textContent = payload;
    document.body.appendChild(box);
    document.title = `TOUCH ${payload}`;
    console.log("[touchdemo]", payload);
  };

  document.getElementById("ts-start")?.click(); // 走真实按钮链路进对局
  // headless（SwiftShader）首帧 rAF 有 ~1s 预热：等内核首帧真正跑起来再开始手势取证（真机无此预热）
  const beginGestures = (fn) => {
    const t0 = performance.now();
    (function wait() {
      if ((state === "playing" && game.world.time > 0) || performance.now() - t0 > 10000) fn();
      else setTimeout(wait, 100);
    })();
  };
  beginGestures(() => {
    const at = (ms, fn) => setTimeout(fn, ms);
    at(150, () => {
      report.pinch.fovBefore = rig.camera.fov;
      report.tap.shotsBefore = game.world.shotsFired;
      report.drag.yawBefore = game.world.player.yaw;
      fire("touchstart", [mk(1, 200, 200)]);
    });
    // —— 拖拽：单指右扫 300px（6 步），位移远超点按阈值 → 必须判为拖拽且不开火 ——
    for (let i = 1; i <= 6; i++) at(200 + i * 40, () => fire("touchmove", [mk(1, 200 + i * 50, 200)]));
    at(500, () => fire("touchend", [], [mk(1, 500, 200)]));
    // —— 捏合：双指从 100px 张开到 240px（5 步）→ zoom 变小 / fov 收窄 ——
    at(650, () => fire("touchstart", [mk(1, 140, 320), mk(2, 240, 320)]));
    for (let i = 1; i <= 5; i++) at(700 + i * 40, () => fire("touchmove", [mk(1, 140 - i * 28, 320), mk(2, 240 + i * 28, 320)]));
    at(950, () => {
      report.pinch.fovMin = rig.camera.fov;
      report.pinch.zoomAfter = touchCtl.zoom;
      report.drag.yawAfter = game.world.player.yaw;
      report.drag.yawDelta = +(report.drag.yawAfter - report.drag.yawBefore).toFixed(4);
      fire("touchend", [], [mk(1, 0, 320), mk(2, 380, 320)]);
    });
    // —— 摇杆：左下摇杆区落指上推（悬浮底座=落指处）→ 移动意图 → 玩家位移（>0.5m 机判）——
    at(1050, () => {
      report.stick.xBefore = game.world.player.x;
      report.stick.zBefore = game.world.player.z;
      fire("touchstart", [mk(4, 100, 700)]); // (100,700)：390×844 下在摇杆区（x≤195 且 y≥422）
    });
    for (let i = 1; i <= 7; i++) at(1100 + i * 80, () => fire("touchmove", [mk(4, 100, 700 - i * 10)]));
    at(1760, () => {
      report.stick.xAfter = game.world.player.x;
      report.stick.zAfter = game.world.player.z;
      report.stick.dist = +Math.hypot(report.stick.xAfter - report.stick.xBefore, report.stick.zAfter - report.stick.zBefore).toFixed(3);
      fire("touchend", [], [mk(4, 100, 630)]); // 抬指：移动意图立即清零（不漂移）
    });
    // —— 点按开火 → 命中（验收口径D「开火命中」环）：hitscan 只沿当前朝向打一发，不瞄准必脱靶，
    // 先用与真机完全相同的拖拽链路把准星伺服到最近存活敌兵方向，再 80ms 短触零位移开火。
    // 命中机判 = 内核 shotsHit 计数上升（敌兵受击/血量下降的确定性记账），并顺带记录表现层命中标记。
    // 伺服与补射均有界：转向 ≤1.2s、最多 6 轮补射、轮内确认 ≤700ms，卡死由兜底 finish 落报告。
    // 前置：开局休整 WAVE_REST=8s（世界时间）内场上无敌兵 —— 先有界等待 ≤20s 再进环，否则六轮补射必落空。——
    const beginHitRing = () => {
      const AIM_TOL = 0.015; // rad：残余瞄准误差在 12m 外 ≤0.18m，远小于 ENEMY_HIT_RADIUS 0.45m
      const slop = Math.max(6, Math.min(window.innerWidth, window.innerHeight) * 0.016);
      const k = 2.4 / Math.min(window.innerWidth, window.innerHeight); // touch.js lookSensitivity 同式
      const norm = (a) => { const t = (a + Math.PI) / (2 * Math.PI); return (t - Math.floor(t)) * 2 * Math.PI - Math.PI; };
      const target = (avoidId = 0) => {
        const p = game.world.player;
        let best = null;
        for (const e of game.world.enemies) {
          if (e.state === "dead" || e.id === avoidId) continue;
          const err = norm(Math.atan2(e.x - p.x, e.z - p.z) - p.yaw);
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < 1) continue;
          if (!best || Math.abs(err) < Math.abs(best.err)) best = { id: e.id, err, d, hp: e.hp };
        }
        return best;
      };
      report.tap.shotsHitBefore = game.world.shotsHit;
      // 伺服瞄准：每次一轮完整拖拽会话（按下 → 一步平移 → 抬指），applyLook: yaw -= dx*k → dx = -Δ/k
      const aim = (done) => {
        const deadline = performance.now() + 1200;
        const step = () => {
          const t = target();
          if (!t || Math.abs(t.err) < AIM_TOL || performance.now() > deadline) {
            report.tap.aimErr = t ? +t.err.toFixed(4) : null;
            return done();
          }
          const dx = Math.max(-330, Math.min(330, -(t.err / k)));
          if (Math.abs(dx) < slop * 2) { report.tap.aimErr = +t.err.toFixed(4); return done(); } // 位移低于点按阈值即视为已瞄准
          fire("touchstart", [mk(7, 200, 200)]);
          fire("touchmove", [mk(7, 200 + dx, 200)]);
          fire("touchend", [], [mk(7, 200 + dx, 200)]);
          setTimeout(step, 100); // 等内核子步吃到新朝向
        };
        step();
      };
      // 补射轮：脱靶（或被掩体挡住）则换下一个最近敌兵再打，最多 6 轮 —— 任何一轮命中即收口
      const shoot = (attempt, avoidId = 0) => {
        report.tap.rounds = attempt;
        const tgt = target(avoidId);
        report.tap.targetHpBefore = tgt ? tgt.hp : null;
        fire("touchstart", [mk(3, 200, 200)]);
        at(80, () => {
          const t0 = performance.now();
          const shotsBeforeRound = game.world.shotsFired;
          fire("touchend", [], [mk(3, 200, 200)]);
          const cross = document.getElementById("ts-crosshair");
          const poll = () => {
            if (cross?.classList.contains("hit")) report.tap.hitMarkSeen = true; // 表现层命中标记（佐证）
            if (game.world.shotsFired > shotsBeforeRound && report.tap.ackMs === null) {
              report.tap.ackMs = Math.round(performance.now() - t0); // 点按 → 内核开出这一发（应 <100ms）
              report.tap.shotsAfter = game.world.shotsFired;
            }
            if (game.world.shotsHit > report.tap.shotsHitBefore) {
              report.tap.hitMs = Math.round(performance.now() - t0);
              report.tap.shotsAfter = game.world.shotsFired;
              report.tap.targetHpAfter = target()?.hp ?? 0;
              finish();
            } else if (performance.now() - t0 < 700) requestAnimationFrame(poll);
            else if (attempt < 6) shoot(attempt + 1, tgt ? tgt.id : 0);
            else { report.tap.shotsAfter = game.world.shotsFired; finish(); }
          };
          requestAnimationFrame(poll);
        });
      };
      aim(() => shoot(1));
    };
    at(1900, () => {
      const t0e = performance.now();
      (function waitEnemy() {
        if (game.world.enemies.some((e) => e.state !== "dead") || performance.now() - t0e > 20000) beginHitRing();
        else setTimeout(waitEnemy, 200);
      })();
    });
    at(31000, finish); // 兜底：任何一环卡死也落报告（敌兵等待 ≤20s + 伺服 ≤1.2s + 补射 ≤4.2s 有界预算）
  });
}
