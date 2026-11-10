// main.js — 装配根：内核状态机 ↔ DOM/输入/渲染循环。
// 输入（键盘/触摸）只产 intent 或触发 primary()/暂停，不直接改游戏状态；
// 表现层每帧只读内核渲染。?smoke=<秒> 无头冒烟协议见文件尾部。
import { createGame } from "./kernel/loop.js";
import { greedyIntent } from "./kernel/autopilot.js";
import { SEED_DEFAULT } from "./numeric.js";
import { buildRenderer, buildScene, buildComposer, buildCamera, buildArena, buildPlayer, buildGems, followCamera, onResize } from "./render/scene.js";
import { createHud } from "./render/hud.js";
import { unlockAudio, sfx } from "./render/audio.js";
import { createTouchControls } from "./render/touch.js";

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
const playerMesh = buildPlayer(scene);
const gemMeshes = buildGems(scene, game.world);
window.addEventListener("resize", () => onResize(renderer, composer, camera));

// —— 未捕获异常计数（冒烟 payload 断言口径之一）——
let exceptions = 0;
window.addEventListener("error", () => exceptions++);
window.addEventListener("unhandledrejection", () => exceptions++);

// —— 输入：键盘 + 触摸合并为一个 intent ——
const keys = new Set();
function keyboardIntent() {
  return {
    moveX: (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    moveZ: (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0),
  };
}
const touch = createTouchControls(canvas, { onConfirm: () => primary() });

function mergeIntent() {
  const k = keyboardIntent();
  const t = touch.intent();
  return { moveX: k.moveX + t.moveX, moveZ: k.moveZ + t.moveZ };
}

/** 确认动作（回车 / 右半屏点按）：唯一的状态推进入口之一 */
function primary() {
  unlockAudio();
  if (game.state === "title") game.start();
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
  else if (game.state === "gameover") { game.restart(); sfx.resume(); }
  // playing 态：确认不做事（防误触重开；重开走 R 键 / 暂停菜单）
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) keys.add(e.code);
  else if (e.code === "Space") { unlockAudio(); if (game.state === "playing") { game.pause(); sfx.pause(); } else if (game.state === "paused") { game.resume(); sfx.resume(); } }
  else if (e.code === "Enter") primary();
  else if (e.code === "KeyR" && game.state !== "title") { game.restart(); }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
document.getElementById("btn-pause").addEventListener("click", () => {
  unlockAudio();
  if (game.state === "playing") { game.pause(); sfx.pause(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
});

// —— 事件（内核结果）→ 反馈（音效/界面）。结果性事件必须挂反馈 ——
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === "collect") sfx.collect();
    if (ev.type === "gameover") { sfx.gameover(ev.won); hud.setOver(ev.won, game.world.score, game.world.collected, game.world.gems.length); }
  }
}

// —— 表现层同步：只读内核，驱动 mesh/相机/HUD ——
function syncVisuals(dt) {
  const w = game.world;
  playerMesh.position.set(w.player.x, 0, w.player.z);
  playerMesh.rotation.y = w.player.angle;
  for (const m of gemMeshes) {
    const g = w.gems[m.userData.id];
    m.visible = g.alive;
    m.rotation.y += dt * 2; // 纯装饰自转：不回写内核
  }
  followCamera(camera, w.player, dt);
  hud.setHud(w.score, w.timeLeft);
}

// —— 主循环 ——
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const r = game.tick(dt, mergeIntent());
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
// render 字段（drawCalls/triangles/memory）为性能证据链，只记录不做硬门禁。
if (smokeParam !== null) {
  const seconds = Math.max(0, Number(smokeParam) || 0);
  game.start();
  // 贪心追宝石（每秒重瞄）：快进是真实对局 —— 会收集、会终局，而不是直冲角落的死路径
  for (let s = 0; s < seconds && game.state === "playing"; s++) {
    game.fastForward(1, greedyIntent(game.world));
  }
  syncVisuals(0);
  // 帧率采样：渲染 30 帧取均值（headless SwiftShader 下限口径 ≥10fps）
  let frames = 0;
  const t0 = performance.now();
  // 性能快照前置：EffectComposer 多 pass 下 info 默认 autoReset，读到的是链尾 OutputPass
  // （全屏三角形，drawCalls=1）的统计而非整帧 —— 关 autoReset + 每帧手动 reset，
  // render() 后读到的才是整帧全 pass 总和。
  renderer.info.autoReset = false;
  let frameStats = { drawCalls: 0, triangles: 0 };
  const sampleFps = (now) => {
    frames++;
    renderer.info.reset();
    composer.render();
    frameStats = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    if (frames < 30) requestAnimationFrame(sampleFps);
    else {
      const fps = Math.round((frames / ((now - t0) / 1000)) * 10) / 10;
      // renderer.info 性能快照：drawCalls/triangles/memory 追加进证据链。
      // 触发纪律：画面/资产/shader/后处理变更时必跑 smoke —— 但只记录不做硬门禁
      // （headless SwiftShader 软渲染测不出真实性能，阈值待采集基线后另行设定）。
      const info = renderer.info;
      const payload = {
        ok: true, state: game.state, score: game.world.score,
        collected: game.world.collected, total: game.world.gems.length,
        timeLeft: game.world.timeLeft, frames, fps, exceptions,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        render: {
          drawCalls: frameStats.drawCalls,
          triangles: frameStats.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.programs.length,
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
