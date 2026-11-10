// main.js — 装配根：内核状态机 ↔ DOM/输入/渲染循环。
// 输入（键盘/触摸）只产 intent 或触发 primary()/射门脉冲，不直接改游戏状态；
// 表现层每帧只读内核渲染。?smoke=<秒> 无头冒烟协议见文件尾部。
import { createGame } from "./kernel/loop.js";
import { greedyIntent } from "./kernel/autopilot.js";
import { SEED_DEFAULT, KEEPER_Z, GOAL_LINE, GOAL_SCORE, GOALS_TO_WIN, SHOOT_MIN_Z } from "./numeric.js";
import {
  buildRenderer, buildScene, buildComposer, buildCamera, buildArena,
  buildPlayer, buildKeeper, buildBall, buildCoins, followCamera, snapCamera, onResize,
  buildStands, buildParticles, emitBurst, updateParticles,
} from "./render/scene.js";
import { createHud } from "./render/hud.js";
import { unlockAudio, sfx, bgm } from "./render/audio.js";
import { createTouchControls } from "./render/touch.js";

const smokeParam = new URLSearchParams(location.search).get("smoke");
const canvas = document.getElementById("gl");
const hud = createHud();
const game = createGame({ seed: SEED_DEFAULT });

// —— 试玩桥（IP8）：只读内核快照，供无头会话 probe（session-step --probe 'window.__footballProbe()'）
// 与后续调参桥取数。render 装配层钩子，零回写；?smoke 协议不受影响。
window.__footballProbe = () => ({
  state: game.state,
  score: game.world.score,
  goals: game.world.goals,
  coinsCollected: game.world.coinsCollected,
  coinTotal: game.world.coins.length,
  shots: game.world.shots,
  saves: game.world.saves,
  timeLeft: game.world.timeLeft,
  player: { x: game.world.player.x, z: game.world.player.z, angle: game.world.player.angle },
  ball: { x: game.world.ball.x, z: game.world.ball.z, state: game.world.ball.state },
  keeperX: game.world.keeper.x,
});

// —— 场景装配 ——
const renderer = buildRenderer(canvas);
const scene = buildScene();
const camera = buildCamera();
const composer = buildComposer(renderer, scene, camera);
buildArena(scene);
buildStands(scene);      // 看台色带（轮 3：填门后死区）
buildParticles(scene);   // 事件粒子池（IP5：进球/扑救/收集爆点）
const playerMesh = buildPlayer(scene);
const keeperMesh = buildKeeper(scene);
const ballMesh = buildBall(scene);
const coinMeshes = buildCoins(scene, game.world);
onResize(renderer, composer, camera);
window.addEventListener("resize", () => onResize(renderer, composer, camera));

// —— 未捕获异常计数（冒烟 payload 断言口径之一）——
let exceptions = 0;
window.addEventListener("error", () => exceptions++);
window.addEventListener("unhandledrejection", () => exceptions++);

// —— 输入：键盘 + 触摸合并为一个 intent；shoot 为一次性脉冲（读走即清零）——
const keys = new Set();
let shootQueued = false;
function keyboardIntent() {
  // moveZ：W/↑ = +Z = 画面上方 = 进攻方向（与触屏上推同相，IP9；相机视线朝 +Z）
  return {
    moveX: (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    moveZ: (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
  };
}
const touch = createTouchControls(canvas, { onConfirm: () => confirmTouch() });

function mergeIntent() {
  const k = keyboardIntent();
  const t = touch.intent();
  const intent = { moveX: k.moveX + t.moveX, moveZ: k.moveZ + t.moveZ, shoot: shootQueued };
  shootQueued = false;
  return intent;
}

/** 确认动作（回车 / 右半屏点按的非 playing 态）：唯一的状态推进入口之一 */
function primary() {
  unlockAudio();
  if (game.state === "title") { game.start(); sfx.whistle(); bgm.start(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); bgm.start(); }
  else if (game.state === "gameover") { game.restart(); sfx.whistle(); bgm.start(); }
  // playing 态：确认不做事（防误触重开；重开走 R 键 / 暂停菜单）
}

/** playing 态右半屏点按 = 射门脉冲（触屏优先的主操作） */
function confirmTouch() {
  unlockAudio();
  if (game.state === "playing") shootQueued = true;
  else primary();
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) keys.add(e.code);
  else if (e.code === "Space") {
    unlockAudio();
    if (game.state === "playing") shootQueued = true;
    else if (game.state === "paused") { game.resume(); sfx.resume(); bgm.start(); }
    else primary();
  }
  else if (e.code === "Enter") primary();
  else if (e.code === "KeyP" || e.code === "Escape") {
    unlockAudio();
    if (game.state === "playing") { game.pause(); sfx.pause(); bgm.stop(); }
    else if (game.state === "paused") { game.resume(); sfx.resume(); bgm.start(); }
  }
  else if (e.code === "KeyR" && game.state !== "title") {
    unlockAudio();
    game.restart(); sfx.whistle(); bgm.start();
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));

/** 暂停/恢复（暂停按钮 + P/Esc 共用；暂停屏「继续」按钮也走这里） */
function togglePause() {
  unlockAudio();
  if (game.state === "playing") { game.pause(); sfx.pause(); bgm.stop(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); bgm.start(); }
}
document.getElementById("btn-pause").addEventListener("click", togglePause);
document.getElementById("btn-start").addEventListener("click", () => primary());
document.getElementById("btn-resume").addEventListener("click", () => {
  unlockAudio();
  if (game.state === "paused") { game.resume(); sfx.resume(); bgm.start(); }
});
document.getElementById("btn-restart").addEventListener("click", () => primary());

// —— 事件（内核结果）→ 反馈（音效/横幅/提示）。结果性事件必须挂反馈 ——
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === "collect") {
      sfx.collect();
      // IP5：收集小爆点（球员脚下蓝白屑）—— 收集瞬间补画面反馈（金币当步已补位，原点位不再可取）
      emitBurst(game.world.player.x, 0.7, game.world.player.z, "#bde6ff", 5, 2.6, 0.45);
    }
    else if (ev.type === "kick") sfx.kick();
    else if (ev.type === "save") {
      sfx.save();
      hud.flash("被扑出！", "flash-orange");
      emitBurst(game.world.keeper.x, 1.3, KEEPER_Z, "#ffffff", 8, 4, 0.6); // IP5：扑救白闪爆点
    }
    else if (ev.type === "goal") {
      sfx.goal();
      hud.flash(`进球！ +${GOAL_SCORE}`, "flash-orange");
      // IP5：进球门区爆点（强调橙 + 主色蓝双色两连爆，喂 Bloom）
      emitBurst(0, 1.3, GOAL_LINE - 0.8, "#f39c12", 12, 5.5, 0.8);
      emitBurst(0, 1.6, GOAL_LINE - 0.8, "#3498db", 8, 4, 0.9);
      // 难度梯度反馈：守门员随进球提速 —— 梯度必须可感知，不能只发生在内核里
      if (ev.goals < GOALS_TO_WIN) hud.hint("守门员提速了，抓紧空当！");
    }
    else if (ev.type === "gameover") {
      bgm.stop();
      sfx.gameover(ev.won);
      hud.setOver(ev.won, game.world.score, game.world.goals, game.world.coinsCollected);
    }
    // respawn：补位无音效（避免收集音被稀释），表现层只同步金币位置（syncVisuals）
  }
}

// —— 表现层同步：只读内核，驱动 mesh/相机/HUD ——
let coinClock = 0;                     // 金币自转/浮动的表现层时钟（纯装饰，允许非确定性，不回写内核）
function syncVisuals(dt) {
  const w = game.world;
  coinClock += dt;
  playerMesh.position.set(w.player.x, 0, w.player.z);
  playerMesh.rotation.y = w.player.angle;
  keeperMesh.position.set(w.keeper.x, 0, KEEPER_Z); // 只读驱动，数值真源在 numeric
  ballMesh.position.set(w.ball.x, 0.45, w.ball.z);
  ballMesh.rotation.x += (w.ball.state === "shot" ? 10 : 2) * dt; // 滚动自转：纯装饰，不回写内核
  for (const g of coinMeshes) {
    const c = w.coins[g.userData.id];
    g.visible = c.alive;
    g.position.set(c.x, 0.9 + Math.sin(coinClock * 3 + g.userData.id * 1.7) * 0.12, c.z); // x/z 跟内核（收集即补位），y 浮动纯装饰
    g.rotation.y = coinClock * 2.6 + g.userData.id * 0.9;                                // 绕世界 Y 扫盘自转（IP4）
  }
  followCamera(camera, w.player, dt);
  updateParticles(dt);   // IP5：粒子步进（表现层时钟，与内核无关）
  hud.setHud(w.score, w.timeLeft, w.goals, w.coinsCollected);
  hud.setJoystick(touch.joystickState());
}

// —— 主循环 ——
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const secondBefore = Math.ceil(game.world.timeLeft);
  const intent = mergeIntent();
  // 射门出界外反馈：白虚线（SHOOT_MIN_Z）前起脚无效 —— 静默失败必须给一句提示（节流在 hud.hint）
  if (game.state === "playing" && intent.shoot && game.world.player.z < SHOOT_MIN_Z) {
    hud.hint("带球压过白虚线才能射门");
  }
  const r = game.tick(dt, intent);
  handleEvents(r.events);
  // 终局紧迫感：最后 10 秒每秒滴答（视觉侧时间徽章同步转橙）
  const secondAfter = Math.ceil(game.world.timeLeft);
  if (game.state === "playing" && secondAfter !== secondBefore && secondAfter <= 10 && secondAfter >= 1) sfx.tick();
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
  if (document.hidden && game.state === "playing" && !smokeParam) { game.pause(); bgm.stop(); }
});

// —— ?smoke=<秒>：无头冒烟协议 —— 跳过交互直接快进，结果 JSON 写 #ts-smoke + title。
// browser-smoke.mjs（技能包 scripts/）以桌面 + 移动双视口各跑一遍，逐视口断言：
// payload 可解析 / exceptions=0 / frames>0 / fps≥10 / 状态推进 / 截图 400 点采样非纯色；
// render 字段（drawCalls/triangles/memory）为性能证据链，只记录不做硬门禁。
if (smokeParam !== null) {
  const seconds = Math.max(0, Number(smokeParam) || 0);
  game.start();
  // 贪心进攻（每秒重瞄）：快进是真实对局 —— 会推进、会射门、会进球，而不是直冲角落的死路径
  for (let s = 0; s < seconds && game.state === "playing"; s++) {
    game.fastForward(1, greedyIntent(game.world));
  }
  syncVisuals(0);
  // 相机快照：冒烟截图必须反映真实对局机位（dt=0 时 lerp 不会推进，需显式落位防假象构图）
  snapCamera(camera, game.world.player);
  // HUD 屏幕态与内核终态同步：截图必须反映真实画面（终局屏/对局 HUD），不留 title 蒙层假象。
  // 冒烟路径丢弃事件流（无音效），终局文案由内核终态直接装配（胜负分色与真实对局一致）。
  const sw = game.world;
  if (game.state === "gameover") hud.setOver(sw.won, sw.score, sw.goals, sw.coinsCollected);
  hud.setHud(sw.score, sw.timeLeft, sw.goals, sw.coinsCollected);
  hud.showScreen(game.state === "playing" ? null : game.state);
  // 帧率采样：先渲染 6 帧预热（着色器编译/JIT 尖峰不进样本），再采样 30 帧取稳态均值
  // （headless SwiftShader 下限口径 ≥10fps —— 门禁意图是稳态可玩帧率，不是冷启动峰值）
  let frames = 0;
  let t0 = 0;
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
      // 排版硬底线证据：横向溢出机判读数（scrollW ≤ innerW = 无溢出；只记录，判定在 QA 复核）
      const doc = document.documentElement;
      const payload = {
        ok: true, state: game.state, score: game.world.score,
        goals: game.world.goals, shots: game.world.shots,
        collected: game.world.coinsCollected, total: game.world.coins.length,
        timeLeft: game.world.timeLeft, frames, fps, exceptions,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        layout: {
          scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight,
          overflowX: doc.scrollWidth > window.innerWidth,
          overflowY: doc.scrollHeight > window.innerHeight,
        },
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
  let warm = 0;
  const warmup = () => {
    renderer.info.reset();
    composer.render();
    if (++warm < 6) requestAnimationFrame(warmup);
    else { t0 = performance.now(); frames = 0; requestAnimationFrame(sampleFps); }
  };
  requestAnimationFrame(warmup);
}
