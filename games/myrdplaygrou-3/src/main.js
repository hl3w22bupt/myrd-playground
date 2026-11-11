// main.js — 装配根：内核状态机 ↔ DOM/输入/渲染循环。
// 输入（键盘/触摸）只产 intent 或触发 primary()/动作沿，不直接改游戏状态；
// 表现层每帧只读内核渲染。?smoke=<秒> 无头冒烟协议见文件尾部。
import { createGame } from "./kernel/loop.js";
import { footballIntent } from "./kernel/autopilot.js";
import { SEED_DEFAULT } from "./numeric.js";
import { buildRenderer, buildScene, buildComposer, buildCamera, buildArena, buildBall, buildPlayers, syncPlayers, syncBall, followCamera, onResize } from "./render/scene.js";
import { createHud } from "./render/hud.js";
import { unlockAudio, installAudioDebug, sfx } from "./render/audio.js";
import { createTouchControls } from "./render/touch.js";
import { keyboardIntent, MOVE_KEYS } from "./render/keyboard.js";

installAudioDebug();

const smokeParam = new URLSearchParams(location.search).get("smoke");
const canvas = document.getElementById("gl");
const hud = createHud();
const game = createGame({ seed: SEED_DEFAULT });

// —— 场景装配 ——
const renderer = buildRenderer(canvas);
const scene = buildScene();
const camera = buildCamera();
const composer = buildComposer(renderer, scene, camera);
buildArena(scene);
const ballMesh = buildBall(scene);
const playerVis = buildPlayers(scene, game.world);
window.addEventListener("resize", () => onResize(renderer, composer, camera));

// —— 未捕获异常计数（冒烟 payload 断言口径之一）——
let exceptions = 0;
window.addEventListener("error", () => exceptions++);
window.addEventListener("unhandledrejection", () => exceptions++);

// —— 输入：键盘 + 触摸合并为一个 intent（动作按钮为「沿」标志，tick 后即清）——
const keys = new Set();
let pendingPass = false;
let pendingShoot = false;
let joyAnchor = null;
const touch = createTouchControls(canvas, {
  onConfirm: () => primary(),
  onPass: () => { pendingPass = true; },
  onShoot: () => { pendingShoot = true; },
});

function mergeIntent() {
  const k = keyboardIntent(keys);
  const t = touch.intent();
  return {
    moveX: k.moveX + t.moveX,
    moveZ: k.moveZ + t.moveZ,
    pass: pendingPass,
    shoot: pendingShoot,
  };
}

/** 确认动作（回车 / 右半屏点按）：唯一的状态推进入口之一 */
function primary() {
  unlockAudio();
  if (game.state === "title") { game.start(); sfx.whistle(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
  else if (game.state === "gameover") { game.restart(); sfx.whistle(); }
  // playing 态：确认不做事（防误触重开；重开走 R 键 / 暂停菜单）
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (MOVE_KEYS.includes(e.code)) keys.add(e.code);
  else if (e.code === "Space") { pendingShoot = true; unlockAudio(); }
  else if (e.code === "KeyX") { pendingPass = true; unlockAudio(); }
  else if (e.code === "KeyP") { unlockAudio(); if (game.state === "playing") { game.pause(); sfx.pause(); } else if (game.state === "paused") { game.resume(); sfx.resume(); } }
  else if (e.code === "Enter") primary();
  else if (e.code === "KeyR" && game.state !== "title") { game.restart(); sfx.whistle(); }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
document.getElementById("btn-pause").addEventListener("click", () => {
  unlockAudio();
  if (game.state === "playing") { game.pause(); sfx.pause(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
});
// 触屏优先：暂停钮也接 touchstart（E-04 禁 click 延迟）
document.getElementById("btn-pause").addEventListener("touchstart", (e) => {
  e.preventDefault();
  unlockAudio();
  if (game.state === "playing") { game.pause(); sfx.pause(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
}, { passive: false });

// —— 事件（内核结果）→ 反馈（音效/界面）。结果性事件必须挂反馈 ——
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === "pass" || ev.type === "clear") { sfx.kick(); kickAnim(ev.from); }
    if (ev.type === "shot") { sfx.shoot(); kickAnim(ev.from); }
    if (ev.type === "tackle") sfx.tackle();
    if (ev.type === "goal") {
      sfx.goal();
      hud.flashBanner(ev.team === 0 ? "进球！主队" : "进球！客队");
    }
    if (ev.type === "kickoff") { /* 开球：横幅已由 goal 播报，无重复音 */ }
    if (ev.type === "gameover") { sfx.gameover(ev.won); hud.setOver(ev.won, ev.score); }
  }
}

/** 踢腿装饰：事件来自哪名球员，就让哪个人形摆一下腿（表现层本地计时，不回写内核） */
function kickAnim(playerId) {
  const vis = playerVis.find((v) => v.id === playerId);
  if (vis) vis.kickTimer = 0.22;
}

// —— 表现层同步：只读内核，驱动 mesh/相机/HUD ——
function syncVisuals(dt) {
  const w = game.world;
  syncPlayers(scene, playerVis, w, dt);
  syncBall(ballMesh, w, dt);
  followCamera(camera, w, dt);
  hud.setHud(w.score.home, w.score.away, w.timeLeft);
  hud.tickBanner(dt);
  const js = touch.joystickState();
  hud.syncJoystick(js, joyAnchor);
  // 动作按钮只在 playing 态可点（避免结算屏误触）
  const actions = document.getElementById("actions");
  actions.classList.toggle("hidden", game.state !== "playing");
}

// —— 主循环 ——
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (joyAnchor === null) {
    const js = touch.joystickState();
    if (js.active) joyAnchor = { x: canvas.clientWidth * 0.25, y: canvas.clientHeight * 0.72 };
  } else if (!touch.joystickState().active) {
    joyAnchor = null;
  }
  const intent = mergeIntent();
  const r = game.tick(dt, intent);
  pendingPass = false; // 动作沿消费（一帧最多触发一次）
  pendingShoot = false;
  handleEvents(r.events);
  syncVisuals(dt);
  // 状态机 → 屏幕（放在事件后兜底：restart/start/pause 均会在此收敛到正确屏幕）
  hud.showScreen(game.state === "playing" ? null : game.state);
  composer.render();
  if (!smokeParam) requestAnimationFrame(frame);
}

// —— 初始渲染一帧（title 屏也要有场景底图）——
syncVisuals(0);
composer.render();
if (!smokeParam) requestAnimationFrame(frame);

// 切后台自动暂停（时间冻结语义；冒烟模式不挂）
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing" && !smokeParam) game.pause();
});

// —— ?smoke=<秒>：无头冒烟协议 —— 跳过交互直接快进，结果 JSON 写 #ts-smoke + title。
// browser-smoke.mjs（技能包 scripts/）以桌面 + 移动双视口各跑一遍，逐视口断言：
// payload 可解析 / exceptions=0 / frames>0 / fps≥10 / 状态推进 / 截图 400 点采样非纯色；
// 玩法契约字段（playtest/polish 断言消费）：playersOnField / teams / inputProbe / goals / possessionChanges。
if (smokeParam !== null) {
  const seconds = Math.max(0, Number(smokeParam) || 0);
  game.start();

  // —— 输入方向探针（sf-bug-controls 的线上机判）：独立沙盒内核，单位意图下受控球员位移符号 ——
  // 屏幕左推（moveX=-1）→ 位移 dx<0；屏幕上推（moveZ=-1）→ 位移 dz<0。
  function directionProbe() {
    const g = createGame({ seed: SEED_DEFAULT });
    g.start();
    const probe = (mx, mz) => {
      const id = g.world.controlledId;
      const x0 = g.world.players[id].x, z0 = g.world.players[id].z;
      g.fastForward(0.25, { moveX: mx, moveZ: mz, pass: false, shoot: false });
      return { dx: g.world.players[id].x - x0, dz: g.world.players[id].z - z0 };
    };
    const left = probe(-1, 0), right = probe(1, 0), up = probe(0, -1), down = probe(0, 1);
    return {
      leftDx: left.dx, rightDx: right.dx, upDz: up.dz, downDz: down.dz,
      ok: left.dx < 0 && right.dx > 0 && up.dz < 0 && down.dz > 0,
    };
  }
  const inputProbe = directionProbe();

  // 足球自动驾驶快进：真对局（抢断/传递/射门/进球），每秒重算意图
  for (let s = 0; s < seconds && game.state === "playing"; s++) {
    game.fastForward(1, footballIntent(game.world));
  }
  syncVisuals(0);

  // 帧率采样：渲染 30 帧取均值（headless SwiftShader 下限口径 ≥10fps）
  let frames = 0;
  const t0 = performance.now();
  // 性能快照前置：EffectComposer 多 pass 下 info 默认 autoReset，读到的是链尾 OutputPass
  renderer.info.autoReset = false;
  let frameStats = { drawCalls: 0, triangles: 0 };
  let playerSegments = 0;
  const WARMUP_FRAMES = 5;   // 跳过冷启动 JIT/着色器首编译帧，测稳态性能（口径同 30 帧均值）
  const sampleFps = (now) => {
    frames++;
    hud.showScreen(game.state === "playing" ? null : game.state); // 冒烟截图对齐运行态（勿停在 title 遮罩）
    renderer.info.reset();
    composer.render();
    frameStats = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    playerSegments = playerVis.reduce((n, v) => n + (v.meshCount || 0), 0); // 段件口径 = 关节树 mesh 总数
    if (frames < 30 + WARMUP_FRAMES) requestAnimationFrame(sampleFps);
    else {
      frames -= WARMUP_FRAMES; // fps 口径 = 稳态 30 帧
      const fps = Math.round((frames / ((now - t0) / 1000)) * 10) / 10;
      const info = renderer.info;
      const w = game.world;
      const payload = {
        ok: true, state: game.state,
        // score = 双方进球总数（判定器口径要求有限数值）；分项见 scoreHome/scoreAway
        score: w.score.home + w.score.away,
        scoreHome: w.score.home, scoreAway: w.score.away,
        timeLeft: w.timeLeft, frames, fps, exceptions,
        // —— 玩法契约字段（多球员 + 输入方向断言）——
        playersOnField: w.players.length,
        teams: 2,
        inputProbe,
        goals: w.goals, shots: w.shots, possessionChanges: w.possessionChanges,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        render: {
          drawCalls: frameStats.drawCalls,
          triangles: frameStats.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.programs.length,
          playerSegments,
        },
      };
      const box = document.createElement("div");
      box.id = "ts-smoke";
      box.textContent = JSON.stringify(payload);
      document.body.appendChild(box);
      document.title = `SMOKE ${JSON.stringify(payload)}`;
      console.log("[smoke]", JSON.stringify(payload));
    }
  };
  requestAnimationFrame(sampleFps);
}
