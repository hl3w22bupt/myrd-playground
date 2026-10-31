// main.js — 装配根：内核状态机 ↔ DOM/输入/渲染循环。
// 输入（键盘/触摸/DOM 按钮）只产 intent 或经 game.dispatch() 走唯一动作入口，不直接改游戏状态；
// 表现层每帧只读内核渲染。?smoke=<游戏日数> 无头冒烟协议 / ?modal=1 弹窗路径冒烟协议见文件尾部。
import { createGame } from "./kernel/loop.js";
import { bizIntent } from "./kernel/autopilot.js";
import { EVENT_BY_ID } from "./kernel/events.js";
import { SEED_DEFAULT, SECONDS_PER_GAME_DAY, SESSION_DAYS } from "./numeric.js";
import { buildRenderer, buildScene, buildComposer, buildCamera, buildRoom, syncRoom, roomEvent, orbitCamera, onResize } from "./render/scene.js";
import { createHud } from "./render/hud.js";
import { unlockAudio, sfx } from "./render/audio.js";
import { createTouchControls } from "./render/touch.js";

const params = new URLSearchParams(location.search);
const smokeParam = params.get("smoke");
const modalParam = params.get("modal"); // ?modal=1：弹窗路径冒烟协议（tools/modal-smoke.mjs 门禁专用）
const caseParam = params.get("case");
const canvas = document.getElementById("gl");
const hud = createHud();
const scenario = caseParam === "broke" ? "broke" : caseParam === "rich" ? "rich" : "fresh";
const game = createGame({ seed: SEED_DEFAULT, scenario });

// —— 场景装配 ——
const renderer = buildRenderer(canvas);
const scene = buildScene();
const camera = buildCamera();
const composer = buildComposer(renderer, scene, camera);
const room = buildRoom(scene);
window.addEventListener("resize", () => onResize(renderer, composer, camera));

// —— 未捕获异常计数（冒烟 payload 断言口径之一）——
let exceptions = 0;
window.addEventListener("error", () => exceptions++);
window.addEventListener("unhandledrejection", () => exceptions++);

// —— 输入 ——
const touch = createTouchControls(canvas, { onConfirm: () => primary() });

/** 确认动作（回车 / 画面点按）：唯一的状态推进入口之一；事件决策卡打开时不抢占（防误触恢复） */
function primary() {
  unlockAudio();
  if (smokeParam === null && !modalEl.classList.contains("hidden")) return;
  if (game.state === "title") { game.start(); sfx.resume(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
  else if (game.state === "gameover") { game.restart(); sfx.resume(); }
}

const SPEEDS = [1, 2, 4, 8];
let speed = 4; // 默认 4×：M0 时间口径 75s/日 ÷ 4 ≈ 19s/日，一局 10 分钟左右能跑满 30 日与两轮 T+14

function setSpeed(next) {
  if (!SPEEDS.includes(next)) return;
  speed = next;
  hud.setSpeed(speed, game.state === "paused");
  sfx.click();
}

function togglePause() {
  unlockAudio();
  if (game.state === "playing") { game.pause(); sfx.pause(); }
  else if (game.state === "paused") { game.resume(); sfx.resume(); }
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space") togglePause();
  else if (e.code === "Enter") primary();
  else if (e.code === "KeyR" && game.state !== "title") { game.restart(); sfx.resume(); }
  else if (e.code === "Digit1") setSpeed(1);
  else if (e.code === "Digit2") setSpeed(2);
  else if (e.code === "Digit3" || e.code === "Digit4") setSpeed(4);
  else if (e.code === "Digit8") setSpeed(8);
});

// 顶栏按钮
document.getElementById("btn-pause").addEventListener("click", togglePause);
for (const b of document.querySelectorAll("[data-speed]")) {
  b.addEventListener("click", () => setSpeed(Number(b.dataset.speed)));
}
// 面板动作按钮 → 唯一派发口
function bindAction(id, action, arg) {
  document.getElementById(id).addEventListener("click", () => {
    unlockAudio();
    const evs = game.dispatch(action, arg);
    if (evs.length === 0) sfx.missed(); // 被守卫拒绝（现金不足/趴窝等）
  });
}
for (const b of document.querySelectorAll("[data-lot]")) {
  b.addEventListener("click", () => {
    unlockAudio();
    const evs = game.dispatch("restock", Number(b.dataset.lot));
    if (evs.length > 0) sfx.restock(); else sfx.missed();
  });
}
for (const b of document.querySelectorAll("[data-product]")) {
  b.addEventListener("click", () => {
    unlockAudio();
    const listed = game.world.products.find((p) => p.id === b.dataset.product)?.listed;
    const evs = game.dispatch(listed ? "delist" : "list", b.dataset.product);
    if (evs.length > 0) sfx.list(); else sfx.missed();
  });
}
bindAction("btn-noodle", "noodle");
bindAction("btn-meal", "meal");
bindAction("btn-sleep", "sleepVan");
bindAction("btn-motel", "motel");
bindAction("btn-reply", "replyReview");
bindAction("btn-ad", "ad");
bindAction("btn-up-warehouse", "upgradeWarehouse");
bindAction("btn-up-housing", "upgradeHousing");
document.getElementById("btn-start").addEventListener("click", primary);
document.getElementById("btn-restart").addEventListener("click", primary);
document.getElementById("btn-restart-life").addEventListener("click", () => {
  if (game.state !== "title") { game.restart(); sfx.resume(); }
});

// —————— M2 事件弹窗与提示 ——————
// 决策卡（差评师公关 / 跟卖狗投诉）：打开即暂停（时间冻结 → 弹窗期间每日结算不跳变），选择后恢复；
// 通知卡（货代延误等自动事件 / P1 阶段提升）：4s 自散，不打断节奏；事件流水区永久留痕。
const modalEl = document.getElementById("event-modal");
let toastTimer = null;

function showToast(title, sub) {
  document.getElementById("stage-toast")?.remove();
  const box = document.createElement("div");
  box.id = "stage-toast";
  box.innerHTML = `<div class="t1"></div><div class="t2"></div>`;
  box.querySelector(".t1").textContent = title;
  box.querySelector(".t2").textContent = sub;
  document.getElementById("ui").appendChild(box);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.remove(), 4000);
}

function renderEffectsText(log) {
  return log.effects.map((e) => {
    const name = { demand: "需求", mood: "心情", inTransit: "在途时效", cash: "现金", shopHealth: "店铺健康", energy: "精力" }[e.account] || e.account;
    return `${name} ${e.amount < 0 ? "−" : "+"}${Math.abs(e.amount)}${e.unit === "点" ? "" : e.unit}（${e.note}）`;
  });
}

function closeModal() {
  modalEl.classList.add("hidden");
}

/** 决策卡：弹窗期间暂停（内核零推进）；选择经 game.dispatch("eventChoice") 唯一入口落账 */
function openDecisionCard(pe) {
  const def = EVENT_BY_ID[pe.id];
  if (!def) { closeModal(); return; }
  const card = document.getElementById("event-card");
  card.className = `card ${def.mood === "good" ? "good" : "bad"}`;
  document.getElementById("event-kind").textContent = def.mood === "good" ? "暖心事件" : "奇葩事件";
  document.getElementById("event-kind").className = `kind ${def.mood === "good" ? "good" : "bad"}`;
  document.getElementById("event-name").textContent = `${def.name} · 第 ${pe.day} 天`;
  document.getElementById("event-desc").textContent = def.desc;
  document.getElementById("event-effects").innerHTML = "";
  for (const line of renderEffectsText(pe.log)) {
    const div = document.createElement("div");
    div.textContent = line;
    document.getElementById("event-effects").appendChild(div);
  }
  const actions = document.getElementById("event-actions");
  actions.innerHTML = "";
  const mk = (label, primary, enabled, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (primary) b.className = "primary";
    b.disabled = !enabled;
    if (!enabled && label !== "知道了") b.title = "应对条件不满足（窗口/资源）";
    b.addEventListener("click", () => { unlockAudio(); fn(); });
    actions.appendChild(b);
  };
  const choiceOf = { "bad-reviewer": "pr", "follow-seller": "complain" };
  if (def.counterLabel) {
    mk(def.counterLabel, true, def.counter(game.world, pe), () => {
      const evs = game.dispatch("eventChoice", { id: pe.id, choice: choiceOf[pe.id] });
      if (evs.length > 0) sfx.reply();
      closeModal();
      resumeAfterModal();
      processPendingEvents(); // 队列里还有下一个待决策事件就继续弹
    });
  }
  mk("知道了", def.counterLabel == null, true, () => {
    game.dispatch("eventChoice", { id: pe.id, choice: "dismiss" });
    closeModal();
    resumeAfterModal();
    processPendingEvents();
  });
  modalEl.classList.remove("hidden");
}

function resumeAfterModal() {
  if (game.state === "paused" && !document.hidden) game.resume();
}

/** 决策队列：有待应对事件就逐个弹（冒烟模式交给自动驾驶，不弹窗） */
function processPendingEvents() {
  if (smokeParam !== null) return;
  const pe = game.world.pendingEvents[0];
  if (!pe) { closeModal(); return; }
  if (game.state === "playing") game.pause();
  openDecisionCard(pe);
}

// —— 内核事件 → 反馈（音效/房间表现/弹窗）。结果性事件必须挂反馈 ——
function handleEvents(events) {
  for (const ev of events) {
    roomEvent(room, ev);
    switch (ev.type) {
      case "order": sfx.order(); break;
      case "missed": sfx.missed(); break;
      case "payout": sfx.payout(); break;
      case "broke-on": sfx.broke(); break;
      case "restock": sfx.restock(); break;
      case "noodle": case "meal": sfx.eat(); break;
      case "sleep-van": case "sleep-home": case "motel": sfx.sleep(); break;
      case "reply-review": sfx.reply(); break;
      case "ad": sfx.click(); break;
      case "upgrade": sfx.upgrade(); showToast("升级完成", ev.id === "warehouse" ? "海外仓上线：补货 ¥20/件 · 毛利 ¥35/单" : "SOHO 一人居：房租 ¥60/日 · 睡家里 精+60"); break;
      case "stage-up": sfx.upgrade(); showToast("阶段提升 · P1 SOHO 起量", "单位经济 ¥35/单 —— 广告、海外仓与 SOHO 住房升级已解锁"); break;
      case "game-event": {
        if (ev.mood === "bad") sfx.eventBad(); else sfx.eventGood();
        if (ev.modal) processPendingEvents();
        else showToast(`${ev.name}`, "详情已记入「事件」流水");
        break;
      }
      case "gameover": sfx.gameover(ev.won); hud.setOver(ev.won, game.world); break;
      default: break;
    }
  }
}

// —— 主循环 ——
let last = performance.now();
let clock = 0;
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dtReal;
  // 真实秒 × 速率 → 游戏日（M0 time 口径：75 真实秒 = 1 游戏日 @1×）
  const r = game.tick((dtReal * speed) / SECONDS_PER_GAME_DAY);
  handleEvents(r.events);
  touch.relax(Math.pow(0.5, dtReal * 1.2));
  syncRoom(room, game.world, dtReal);
  orbitCamera(camera, clock, touch.dragOffset());
  hud.sync(game.world);
  hud.setSpeed(speed, game.state === "paused");
  // 决策卡打开时不显示 paused/over 全屏（弹窗优先，避免「已暂停」屏盖在事件卡后面）
  const modalUp = !modalEl.classList.contains("hidden");
  hud.showScreen(game.state === "playing" || modalUp ? null : game.state);
  composer.render();
  if (!smokeParam) requestAnimationFrame(frame);
}

// —— 初始渲染一帧（title 屏也要有场景底图）——
syncRoom(room, game.world, 0);
orbitCamera(camera, 0, { x: 0, y: 0 });
hud.sync(game.world);
composer.render();
if (!smokeParam) requestAnimationFrame(frame);

// 切后台自动暂停（时间冻结语义；冒烟模式不挂）
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing" && !smokeParam) game.pause();
});

// —— ?smoke=<游戏日数>：无头冒烟协议 —— 跳过交互按「经营自动驾驶」快进 N 个游戏日，
// 结果 JSON 写 #ts-smoke + document.title（SMOKE {...}）供 CDP 断言。
// browser-smoke.mjs（技能包 scripts/）以桌面 + 移动双视口各跑一遍，逐视口断言：
// payload 可解析 / exceptions=0 / frames>0 / fps≥10 / 状态推进 / 截图 400 点采样非纯色。
// 兼容字段：score=累计回款（有限数）、timeLeft=剩余游戏日（有限数）—— 与门禁断言口径对齐。
if (smokeParam !== null) {
  const days = Math.max(0, Math.min(60, Number(smokeParam) || 0));
  game.start();
  for (let d = 0; d < days && game.state === "playing"; d++) {
    // 真实玩家替身：每日派发到无动作为止（选品/上架/补货/吃睡/回评），再快进一天
    for (let k = 0; k < 10; k++) {
      const intent = bizIntent(game.world);
      if (!intent) break;
      game.dispatch(intent.action, intent.arg);
    }
    game.fastForward(1);
  }
  syncRoom(room, game.world, 0);
  // 帧率采样：渲染 30 帧取均值（headless SwiftShader 下限口径 ≥10fps）
  let frames = 0;
  const t0 = performance.now();
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
      const info = renderer.info;
      const w = game.world;
      const payload = {
        ok: true,
        state: game.state,
        score: Math.round(w.settledTotal),
        timeLeft: Math.max(0, SESSION_DAYS - w.day),
        day: w.day,
        won: w.won,
        cash: Math.round(w.cash),
        inventory: Math.floor(w.inventory),
        inTransit: Math.round(w.inTransit),
        orders: w.ordersTotal,
        missed: w.missedTotal,
        broke: w.brokeCount,
        journal: w.journal.length,
        scenario: w.scenario,
        // —— M2 冒烟扩展字段：阶段 / 升级线 / 事件流（门禁断言口径）——
        stage: w.stage,
        stageUpDay: w.stageUpDay,
        upgrades: { ...w.upgrades },
        mood: w.mood,
        events: w.eventLog.length,
        eventKinds: [...new Set(w.eventLog.map((e) => e.id))],
        eventChoices: w.eventLog.filter((e) => e.choice).map((e) => ({ id: e.id, choice: e.choice })),
        adCasts: w.journal.filter((e) => e.kind === "ad-spend").length,
        frames,
        fps,
        exceptions,
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

// —— ?modal=1：弹窗路径冒烟协议（tools/modal-smoke.mjs 门禁专用）——
// 与 ?smoke 同一「真实玩家替身」派发循环（autopilot.bizIntent），但走真实帧推进（4× ≈ 19s/游戏日）且
// 不短路 processPendingEvents：事件决策卡沿真实 DOM 路径弹出（打开即暂停），由门禁脚本真实点击按钮结算。
// 存在理由：?smoke 协议把事件决策交给自动驾驶（processPendingEvents 对冒烟短路），「暂停态人手点 DOM
// 按钮」这条真实玩家路径此前零覆盖 —— 线上 P0 弹窗软锁死（paused 态 dispatch(eventChoice) 被守卫拒收 →
// pendingEvents 残留 → closeModal → 同一张卡同步弹回）正出在这里，本协议专堵该盲区。
if (modalParam !== null) {
  setInterval(() => {
    if (game.state !== "playing") return; // 弹窗暂停 / 结算态不抢决策：把按钮留给真实 DOM 点击
    for (let k = 0; k < 10; k++) {
      const intent = bizIntent(game.world);
      if (!intent) break;
      game.dispatch(intent.action, intent.arg);
    }
  }, 500);
}
