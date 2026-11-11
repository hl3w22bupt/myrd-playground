// main.js — 装配根：内核状态机 ↔ DOM/输入/渲染循环。
// 输入（键盘/触摸）只产 intent 或触发 primary()/动作沿，不直接改游戏状态；
// 表现层每帧只读内核渲染。?smoke=<秒> 无头冒烟协议见文件尾部。
// v3 落地：新手引导三层（教学卡/常驻标签/一次性气泡，缺陷单 cmwbumwtv）+
// 控制权切换规范（全场唯一池化环 + 切换确认音，缺陷单 cmwbumwrj）+
// 打磨项（射门蓄力音调/hit-stop/庆祝冻结与 BGM duck/比分弹跳/再来一局追赶目标）。
import { createGame } from "./kernel/loop.js";
import { footballIntent } from "./kernel/autopilot.js";
import {
  SEED_DEFAULT, PITCH_HALF_Z,
  SHOOT_HIT_STOP_MS, TACKLE_RUMBLE_MS, CELEBRATION_TIME_SCALE,
} from "./numeric.js";
import { buildRenderer, buildScene, buildComposer, buildCamera, buildArena, buildBall, buildPlayers, syncPlayers, syncBall, followCamera, onResize } from "./render/scene.js";
import { createHud } from "./render/hud.js";
import { unlockAudio, installAudioDebug, sfx } from "./render/audio.js";
import { createTouchControls } from "./render/touch.js";
import { createCelebration, createPunch } from "./render/celebrate.js";
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
const playersBundle = buildPlayers(scene, game.world); // { visList, selectionRing }（v3：全场唯一池化环）
const celebration = createCelebration(scene); // IP-3：进球彩带粒子（单 drawCall 池）
const punch = createPunch();                  // IP-3：镜头 FOV 冲击
let punchActive = false;
let goalHold = null; // IP-3 进球特写机位计时器：{ x, z, t }（进球后镜头锁球门再回中圈）
let hitStopLeft = 0;        // v3 手感：射门瞬间打击停顿（表现层冻结窗口，内核零改动）
let celebrationPrev = false; // 庆祝窗边沿检测（BGM duck 进/出）
let chargeActive = false;    // v3 手感：射门蓄力（表现层；蓄力只驱动音调/蓄力条，不造力度数值）
let chargeT = 0;
const CHARGE_FULL_SEC = 0.8; // 蓄力到满时长（视觉/音调满格口径；力度映射需人工试玩校准，不进内核）
let lastControlledId = -1;   // 切换检测（确认音沿）
let hadFirstTouch = false;   // 首次持球气泡（每档案 1 次，hud.bubbleOnce 内部再计数）
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
  // onShoot 不经 touch.js 绑定：射门改为「按住蓄力 / 松手起脚」（下方 pointer 事件接管）
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
  if (hud.shouldShowTutorial() && game.state === "title") { startFromTutorial(); return; }
  if (game.state === "title") { game.start(); sfx.whistle(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
  else if (game.state === "gameover") { startRematch(); }
  // playing 态：确认不做事（防误触重开；重开走 R 键 / 暂停菜单 / 结算主按钮）
}

/** 教学卡 → 开始比赛（开始与跳过同语义：写已读标记，同档案不再展示；v3 onboarding） */
function startFromTutorial() {
  hud.completeTutorial();
  game.start();
  sfx.whistle();
}

/** 再来一局（结算屏主按钮 / 回车 / R）：同步重建 world，载入远低于 REMATCH_LOAD_SECONDS_MAX */
function startRematch() {
  game.restart(); // lastScore 捕获在内核侧（结算屏追赶目标）
  hud.resetSessionPrompts();
  hadFirstTouch = false;
  sfx.whistle();
}

// —— 开屏教学卡（首次进入对局前展示；展示期间比赛未开始 = 倒计时天然暂停）——
// 冒烟协议跳过教学卡（无头断言不依赖人工点击）。
if (!smokeParam && hud.shouldShowTutorial() && game.state === "title") {
  hud.showScreen("tutorial");
} else {
  hud.showScreen("title");
}
document.getElementById("btn-tutorial-start").addEventListener("click", () => { unlockAudio(); startFromTutorial(); });
document.getElementById("btn-tutorial-skip").addEventListener("click", () => { unlockAudio(); startFromTutorial(); });
["btn-tutorial-start", "btn-tutorial-skip"].forEach((id) => {
  document.getElementById(id).addEventListener("touchstart", (e) => { e.preventDefault(); unlockAudio(); startFromTutorial(); }, { passive: false });
});

// —— 结算屏「再来一局」主按钮（v3 replayHooks：一键重赛同局）——
const btnRematch = document.getElementById("btn-rematch");
btnRematch.addEventListener("click", () => { unlockAudio(); if (game.state === "gameover") startRematch(); });
btnRematch.addEventListener("touchstart", (e) => { e.preventDefault(); unlockAudio(); if (game.state === "gameover") startRematch(); }, { passive: false });

// —— 射门蓄力（v3 gameFeel：按住蓄力音调线性升高，松手起脚 + 60ms hit-stop）——
function chargeBegin() {
  unlockAudio();
  if (game.state !== "playing" || chargeActive) return;
  chargeActive = true;
  chargeT = 0;
  sfx.startCharge();
}
function chargeRelease() {
  if (!chargeActive) return;
  chargeActive = false;
  sfx.stopCharge();
  hud.setCharge(null);
  if (game.state === "playing") pendingShoot = true; // 动作沿：本帧 tick 消费
}
document.getElementById("btn-shoot").addEventListener("pointerdown", (e) => { e.preventDefault(); chargeBegin(); });
document.getElementById("btn-shoot").addEventListener("pointerup", (e) => { e.preventDefault(); chargeRelease(); });
document.getElementById("btn-shoot").addEventListener("pointercancel", () => chargeRelease());

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (MOVE_KEYS.includes(e.code)) keys.add(e.code);
  else if (e.code === "Space") { chargeBegin(); }
  else if (e.code === "KeyX") { pendingPass = true; unlockAudio(); hud.fadeBubble(); }
  else if (e.code === "KeyP") { unlockAudio(); if (game.state === "playing") { game.pause(); sfx.pause(); } else if (game.state === "paused") { game.resume(); sfx.resume(); } }
  else if (e.code === "Enter") primary();
  else if (e.code === "KeyR" && game.state !== "title") { startRematch(); }
});
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Space") chargeRelease();
});
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
    if (ev.type === "pass" || ev.type === "clear") { sfx.kick(); kickAnim(ev.from); hud.fadeBubble(); }
    if (ev.type === "shot") {
      sfx.shoot(); kickAnim(ev.from);
      hitStopLeft = SHOOT_HIT_STOP_MS / 1000; // 打击停顿（≤100ms；表现层冻结，内核步数不减）
    }
    if (ev.type === "tackle") {
      sfx.tackle(); // 低通噪声段 —— 与 switchConfirm 高频正弦互不打断
      try { navigator.vibrate?.(TACKLE_RUMBLE_MS); } catch { /* 无振动设备 no-op */ }
      // 首次被抢断气泡：预告自动切换（v3 onboarding；每档案 1 次）
      if (ev.from === lastControlledId || ev.from === game.world.controlledId) {
        hud.bubbleOnce("firstTackled", "被抢断啦 —— 即将自动切换到离球最近的队友（脚下光环）");
      }
    }
    if (ev.type === "goal") {
      sfx.goal();
      hud.flashBanner(ev.team === 0 ? "进球！主队" : "进球！客队");
      hud.popScore(ev.team);      // 比分数字弹跳 + 得分方基色高亮
      celebration.burst(ev.team); // IP-3：球门 mouth 彩带爆发（纯表现层，内核零改动）
      punch.fire();               // IP-3：镜头 FOV 冲击
      goalHold = { x: 0, z: ev.team === 0 ? -PITCH_HALF_Z : PITCH_HALF_Z, t: 2.2 }; // 特写机位锁被进球方球门
      sfx.duckBgm(true);          // 庆祝期间 BGM 压低 30%（边沿恢复在 syncVisuals）
    }
    if (ev.type === "kickoff") { /* 开球：横幅已由 goal 播报，无重复音 */ }
    if (ev.type === "gameover") { sfx.gameover(ev.won); hud.setOver(ev.won, ev.score, game.lastScore); }
  }
}

/** 踢腿装饰：事件来自哪名球员，就让哪个人形摆一下腿（表现层本地计时，不回写内核） */
function kickAnim(playerId) {
  const vis = playersBundle.visList.find((v) => v.id === playerId);
  if (vis) vis.kickTimer = 0.22;
}

// —— 只读状态钩子（试玩/取证消费；v1 轮 IP7/IP8 判例同款，零写副作用）——
window.__tsState = () => {
  const w = game.world;
  return {
    state: game.state,
    score: { ...w.score },
    timeLeft: Math.round(w.timeLeft * 10) / 10,
    celebrationLeft: Math.round(w.celebrationLeft * 100) / 100,
    controlledId: w.controlledId,
    switchRingCount: playersBundle.selectionRing.instanceCount,
    switchCount: playersBundle.selectionRing.switchCount,
    controlled: (({ team, role, num, x, z }) => ({ team, role, num, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }))(w.players[w.controlledId] ?? {}),
    ball: { x: Math.round(w.ball.x * 10) / 10, z: Math.round(w.ball.z * 10) / 10, owner: w.ball.owner },
    players: w.players.map(({ id, team, role, num, x, z }) => ({ id, team, role, num, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })),
  };
};

// —— 表现层同步：只读内核，驱动 mesh/相机/HUD ——
function syncVisuals(dt) {
  const w = game.world;
  const celebrating = w.celebrationLeft > 0;
  syncPlayers(scene, playersBundle, w, dt, game.state === "playing" || celebrating);
  syncBall(ballMesh, w, dt);
  if (goalHold) { // IP-3：进球特写机位——锁球门（粒子/网窝/横幅同框），到时回跟球
    goalHold.t -= dt;
    followCamera(camera, w, dt, goalHold);
    if (goalHold.t <= 0) goalHold = null;
  } else {
    followCamera(camera, w, dt);
  }
  // 庆祝窗表现层慢动作（CELEBRATION_TIME_SCALE=0.3；内核零影响，彩带读得完）
  celebration.points.visible = celebration.update(dt * (celebrating ? CELEBRATION_TIME_SCALE : 1));
  const punchAdd = punch.step(dt);
  if (punchAdd !== 0 || punchActive) {
    camera.fov = 58 + punchAdd; // FOV 冲击仅活动窗口内动投影矩阵
    camera.updateProjectionMatrix();
    punchActive = punchAdd !== 0;
  }
  // 庆祝窗边沿：进出各一次 duck（BGM 压低 30% / 恢复）
  if (celebrating !== celebrationPrev) {
    celebrationPrev = celebrating;
    sfx.duckBgm(celebrating);
  }
  // 蓄力条 + 蓄力音调（线性爬升）
  if (chargeActive) {
    chargeT += dt;
    const p = Math.min(1, chargeT / CHARGE_FULL_SEC);
    hud.setCharge(p);
    sfx.chargeTone(p);
  }
  // 控制权切换沿 → 确认音（v3：切换反馈 = 单环脉冲 + 确认音，全队零闪烁）
  if (w.controlledId !== lastControlledId) {
    lastControlledId = w.controlledId;
    if (game.state === "playing") sfx.switchConfirm();
    // 首次持球气泡：教学第二层（教学卡之后即时救场；每档案 1 次）
    if (!hadFirstTouch && w.ball.owner === w.controlledId && game.state === "playing") {
      hadFirstTouch = true;
      hud.bubbleOnce("firstTouch", "带球啦 —— 按 X / 点「传球」传给队友 · 按住空格 / 射门钮蓄力射门");
    }
  }
  hud.setHud(w.score.home, w.score.away, w.timeLeft);
  hud.tickOverlays(dt);
  const js = touch.joystickState();
  hud.syncJoystick(js, joyAnchor);
  hud.setPlayVisible(game.state === "playing");
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
  if (hitStopLeft > 0) {
    // 打击停顿：冻结本帧内核推进（acc 不动 = 少推固定步），渲染照常 —— 60ms 内无任何位移
    hitStopLeft -= dt;
  } else {
    const intent = mergeIntent();
    const r = game.tick(dt, intent);
    handleEvents(r.events);
  }
  pendingPass = false; // 动作沿消费（一帧最多触发一次）
  pendingShoot = false;
  syncVisuals(dt);
  // 状态机 → 屏幕（放在事件后兜底：restart/start/pause 均会在此收敛到正确屏幕）
  const showingTutorial = !smokeParam && hud.shouldShowTutorial() && game.state === "title";
  hud.showScreen(game.state === "playing" ? null : showingTutorial ? "tutorial" : game.state);
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
// 玩法契约字段（playtest/polish 断言消费）：playersOnField / teams / inputProbe / goals / possessionChanges
// + v3 断言面：switchRing（单环实例）/ onboarding（教学卡+常驻标签 DOM）/ celebration（庆祝冻结）。
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

  // 足球自动驾驶快进：真对局（抢断/传递/射门/进球/庆祝冻结），意图 0.1s 重算一次。
  let smokeControlledChanges = 0;
  let lastSmokeControlledId = game.world.controlledId;
  // IP-P5（polish v16）：粒度 1s → 0.1s —— v15 控制权稳定化后，1Hz 意图下 autopilot
  // 攻击效力塌陷（同 seed 同语义整场 2 射门 0 进球；旧内核同语义 10 射门 1 球；
  // 归因见 qa/playtest/round-16.md：旧内核逐帧抢切换 = 1Hz 意图的「免费外挂」，
  // 稳定化后意图陈旧代价显形）。真人输入为 ~60Hz 意图，10Hz 更接近真实对局代表性；
  // 游戏侧协议参数（零内核改动、零门禁改动），冒烟证据面恢复进球/庆祝等对局活力。
  for (let s = 0; s < seconds * 10 && game.state === "playing"; s++) {
    handleEvents(game.fastForward(0.1, footballIntent(game.world)).events); // 事件→反馈在冒烟下同样在链（彩带/特写机位/横幅），快进不再丢事件
    // 控制权切换计数（内核只读口径，与 selection-ring.switchCount 同语义但与渲染采样解耦 ——
    // 快进打满全场时采样发生在 gameover 态、环已失权停更，渲染侧计数会漏计全程切换）
    if (game.world.controlledId !== lastSmokeControlledId) {
      smokeControlledChanges += 1;
      lastSmokeControlledId = game.world.controlledId;
    }
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
    syncVisuals(1 / 60); // 跟屏相机逐帧逼近目标机位（IP-1：此前快进后相机停在 buildCamera 初始位，截图不反映真实取景）
    renderer.info.reset();
    composer.render();
    frameStats = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    playerSegments = playersBundle.visList.reduce((n, v) => n + (v.meshCount || 0), 0); // 段件口径 = 关节树 mesh 总数
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
        controlledChanges: smokeControlledChanges,
        // —— v3 断言面：切换单环 + 引导 DOM + 庆祝冻结 ——
        switchRing: {
          instanceCount: playersBundle.selectionRing.instanceCount,
          switchCount: playersBundle.selectionRing.switchCount,
          visible: playersBundle.selectionRing.group.visible,
        },
        onboarding: {
          tutorialCardPresent: !!document.getElementById("screen-tutorial"),
          tutorialSkipPresent: !!document.getElementById("btn-tutorial-skip"),
          tutorialStartPresent: !!document.getElementById("btn-tutorial-start"),
          hudLabels: [...document.querySelectorAll("[data-hud-label]")].map((n) => n.getAttribute("data-hud-label")),
          bubblePresent: !!document.getElementById("bubble"),
          rematchButtonPresent: !!document.getElementById("btn-rematch"),
          // 终局结算屏可见性自检（v16 线上终审缺陷回归锚点）：终局态结算屏必须解除隐藏，
          // 否则「再来一局」主按钮与追赶目标文案对玩家不可达（smoke 快进打满全场时为 true）。
          overScreenVisibleAtGameover: game.state === "gameover"
            ? !document.getElementById("screen-over").classList.contains("hidden")
            : null,
        },
        celebration: { celebrationLeft: Math.round(w.celebrationLeft * 100) / 100 },
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
