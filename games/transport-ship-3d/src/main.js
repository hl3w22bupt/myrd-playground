// main.js — 装配根：装配顺序 = 依赖顺序（渲染器 → 场景/布景 → 玩家装配 → HUD/音频 → 输入 → 主循环）。
// 状态机显式：title → playing → paused → gameover。内核事件统一在此翻译成表现（物理层零 UI/音频依赖）。

import * as THREE from "three";
import { createGame } from "./kernel/loop.js";
import { buildMap } from "./render/map.js";
import { buildPlayerRig, attachInput } from "./render/player.js";
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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
const inputState = { yaw: game.world.player.yaw, pitch: 0, firing: false, reloadQueued: false };
const input = attachInput(canvas, inputState);

// —— 状态机 ——
let state = "title"; // title | playing | paused | gameover
hud.showScreen(true);
if (replay.highScore || replay.waveStreak) {
  hud.setBest(`最高 ${(replay.highScore ?? 0).toLocaleString("en-US")} · 上次 第 ${replay.waveStreak ?? 0} 波`);
}
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
        btn: "再来一局（锁定鼠标）",
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
