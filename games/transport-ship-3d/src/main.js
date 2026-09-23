// main.js — 装配根：装配顺序 = 依赖顺序（渲染器 → 场景/布景 → 玩家装配 → HUD/音频 → 输入 → 主循环）。
// 状态机显式：title → playing → paused → gameover。内核事件统一在此翻译成表现（物理层零 UI/音频依赖）。

import * as THREE from "three";
import { createGame } from "./kernel/loop.js";
import { buildMap } from "./render/map.js";
import { buildPlayerRig, attachInput } from "./render/player.js";
import { EnemyPool, syncEnemies } from "./render/enemy.js";
import { buildHud } from "./render/hud.js";
import { buildAudio } from "./render/audio.js";
import { PLAYER_START } from "./levels/level-01-deck.js";

const canvas = document.getElementById("gl");
const uiRoot = document.getElementById("ui");

// —— 渲染器（对标样本封装：ACESFilmic / sRGB / PCFSoft / dpr 钳制）——
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

const scene = new THREE.Scene();

// —— 游戏（确定性内核）与表现装配 ——
const game = createGame({ seed: 20260923 });
const map = buildMap(scene);
const rig = buildPlayerRig(canvas);
const hud = buildHud(uiRoot);
const audio = buildAudio();
const enemies = new EnemyPool(scene);
const inputState = { yaw: game.world.player.yaw, pitch: 0, firing: false, reloadQueued: false };
const input = attachInput(canvas, inputState);

// —— 状态机 ——
let state = "title"; // title | playing | paused | gameover
hud.showScreen(true);
hud.onStart(() => {
  audio.unlock();
  if (state === "gameover") resetMatch();
  canvas.requestPointerLock();
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
}

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && state === "playing") {
    state = "paused";
    hud.showScreen(true);
    hud.screenText({ title: "已暂停 ", sub: "点击按钮回到甲板。", btn: "继续（锁定鼠标）" });
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
    for (const ev of events) if (ev.type === "shot") rig.fire();
    audio.handle(events);
    if (game.world.over) {
      state = "gameover";
      hud.showScreen(true);
      hud.screenText({
        title: `结算 · ${game.world.score.toLocaleString("en-US")} 分 `,
        sub: `波次 ${game.world.wave.n} · 击杀 ${game.world.kills} · 爆头 ${game.world.headshots} · 存活 ${game.world.time.toFixed(1)}s`,
        btn: "再来一局（锁定鼠标）",
      });
      document.exitPointerLock?.();
    }
  }

  rig.apply(game.world);
  syncEnemies(enemies, game.world, dt);
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
  fastForward: (seconds) => game.fastForward(seconds),
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
