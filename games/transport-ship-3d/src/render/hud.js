// hud.js — HUD：DOM 差分直写（血量/弹药/得分/波次/提示）+ 独立 canvas 雷达 + 标题/暂停/结算屏。
// 风格卡口径：DIN 数字字体栈、clip-path 斜切面板、青蓝描边 + 半透明黑底。
// 资产接线：色卡取自 assets/palette.mjs（HUD 与场景同一张色卡）；模板 :root 里的静态值是 fallback，
//          运行时被风格卡覆盖 —— 取色失败也能用模板兜底色照常显示。

import { MINIMAP_RANGE, PLAYER_MAX_HP, MAG_SIZE } from "../numeric.js";
import { DECK_BOUNDS, ENEMY_SPAWNS } from "../levels/level-01-deck.js";
import { HUD_CSS_VARS, PALETTE } from "../../assets/palette.mjs";

const EL = (id) => document.getElementById(id);
const P = PALETTE;

/** 风格卡色卡 → CSS 自定义属性（HUD 与世界同一张色卡，避免两处各改各的）*/
function applyStyleCard() {
  try {
    for (const [k, v] of Object.entries(HUD_CSS_VARS)) document.documentElement.style.setProperty(k, v);
  } catch { /* 模板 :root 静态值兜底 */ }
}

export function buildHud(root) {
  applyStyleCard();
  root.innerHTML = `
  <div id="ts-hud">
    <div id="ts-topline">
      <div id="ts-wave" class="ts-panel">WAVE <b id="ts-wave-n">–</b></div>
      <div id="ts-score" class="ts-panel"><b id="ts-score-v">0</b></div>
      <div id="ts-timer" class="ts-panel"><span id="ts-time-v">0.0</span>s</div>
    </div>
    <div id="ts-bottomline">
      <div id="ts-vitals" class="ts-panel">
        <div id="ts-hpbar"><div id="ts-hpfill"></div></div>
        <div id="ts-hpnum">100</div>
      </div>
      <div id="ts-ammo" class="ts-panel"><b id="ts-ammo-mag">30</b><span>/ <span id="ts-ammo-res">150</span></span><i id="ts-reload-tip">RELOADING…</i></div>
      <canvas id="ts-radar" width="132" height="132"></canvas>
    </div>
    <div id="ts-crosshair"><i></i><i></i><i></i><i></i><em></em></div>
    <div id="ts-hint"></div>
    <div id="ts-damage"></div>
    <i id="ts-vignette"></i>
    <div id="ts-banner"></div>
  </div>
  <div id="ts-screen">
    <h1>运输船 3D <small>单文件 Three.js 复刻原型</small></h1>
    <p class="ts-goal">登上运输船甲板 —— 活过一波强过一波的敌兵，拿高分。</p>
    <p id="ts-best" class="ts-best"></p>
    <ul class="ts-keys">
      <li><b>WASD</b> 移动 · <b>Shift</b> 疾跑</li>
      <li><b>鼠标</b> 瞄准 · <b>左键</b> 射击</li>
      <li><b>R</b> 换弹 · <b>Esc</b> 暂停/释放鼠标</li>
    </ul>
    <button id="ts-start">点击开始（锁定鼠标）</button>
    <p class="ts-foot">零外部资源 · 程序化贴图 / 几何 / 音频 · 确定性内核可无头测试</p>
  </div>`;

  const el = {
    screen: EL("ts-screen"), start: EL("ts-start"),
    waveN: EL("ts-wave-n"), score: EL("ts-score-v"), time: EL("ts-time-v"),
    hpFill: EL("ts-hpfill"), hpNum: EL("ts-hpnum"),
    mag: EL("ts-ammo-mag"), res: EL("ts-ammo-res"), reloadTip: EL("ts-reload-tip"),
    hint: EL("ts-hint"), damage: EL("ts-damage"), banner: EL("ts-banner"), best: EL("ts-best"),
    vignette: EL("ts-vignette"),
    radar: EL("ts-radar"),
  };
  const rctx = el.radar.getContext("2d");
  let lastBanner = "";
  let lowHp = false;

  const api = {
    el,
    onStart(cb) { el.start.addEventListener("click", cb); },
    showScreen(show) { el.screen.style.display = show ? "flex" : "none"; },
    screenText({ title, sub, btn }) {
      if (title) el.screen.querySelector("h1").firstChild.textContent = title;
      if (sub) el.screen.querySelector(".ts-goal").textContent = sub;
      if (btn) el.start.textContent = btn;
    },
    /** 重玩钩子展示位（spec.content.replayHooks：最高分 / 上次波次）*/
    setBest(text) { el.best.textContent = text; },
    /** 差分直写：只在值变化时触碰 DOM（高频字段不整段重排）*/
    update(world, events) {
      const p = world.player;
      const hp = Math.ceil(p.hp);
      if (el.hpNum.textContent !== String(hp)) {
        el.hpNum.textContent = hp;
        el.hpFill.style.width = `${(p.hp / PLAYER_MAX_HP) * 100}%`;
        const nowLow = p.hp <= PLAYER_MAX_HP * 0.3;
        if (nowLow !== lowHp) {
          lowHp = nowLow;
          el.hpFill.classList.toggle("low", nowLow);
          el.vignette?.classList.toggle("low", nowLow); // 低血量暗角（屏边出血，状态一眼可读）
        }
      }
      const mag = String(p.ammo);
      if (el.mag.textContent !== mag) el.mag.textContent = mag;
      const res = String(p.reserve);
      if (el.res.textContent !== res) el.res.textContent = res;
      el.reloadTip.style.display = p.reloading ? "inline" : "none";
      el.mag.parentElement.classList.toggle("dry", p.ammo === 0 && !p.reloading);

      const score = world.score.toLocaleString("en-US");
      if (el.score.textContent !== score) el.score.textContent = score;
      const wave = world.wave.n > 0 ? String(world.wave.n) : "–";
      if (el.waveN.textContent !== wave) el.waveN.textContent = wave;
      el.time.textContent = world.time.toFixed(1);

      for (const ev of events) {
        if (ev.type === "waveStart") api.banner(`第 ${ev.wave} 波 · ${ev.size} 名敌兵`, 2000);
        else if (ev.type === "waveClear") api.banner(`波次清空 +${ev.bonus}${ev.healed ? ` · 回血 +${ev.healed}` : ""}`, 2000);
        else if (ev.type === "playerHit") api.damageFlash();
        else if (ev.type === "gameOver") api.banner(`阵亡 · 波次 ${ev.wave}`, 4000);
      }
      api.radar(world);
    },
    banner(text, ms) {
      if (lastBanner === text) return;
      lastBanner = text;
      el.banner.textContent = text;
      el.banner.classList.add("show");
      clearTimeout(api._bt);
      api._bt = setTimeout(() => { el.banner.classList.remove("show"); lastBanner = ""; }, ms);
    },
    /** 阵亡灰度（对标 uDeath）：只压世界画布，结算屏/HUD 保持可读；重开时移除 */
    setDead(dead) {
      try { document.body.classList.toggle("ts-dead", dead === true); } catch { /* 无 body 环境忽略 */ }
    },
    damageFlash() {
      el.damage.classList.remove("hit");
      void el.damage.offsetWidth; // 重启动画
      el.damage.classList.add("hit");
    },
    /** 命中标记：准星短促张开（爆头加色），纯 CSS 类切换，无新 DOM */
    hitMark(headshot) {
      const ch = EL("ts-crosshair");
      if (!ch) return;
      ch.classList.remove("hit", "head");
      void ch.offsetWidth; // 重启动画
      ch.classList.add("hit");
      if (headshot) ch.classList.add("head");
      clearTimeout(api._ht);
      api._ht = setTimeout(() => ch.classList.remove("hit", "head"), 140);
    },
    /** 雷达：玩家居中朝上，敌点按相对方位（MINIMAP_RANGE 内），出生点常显 */
    radar(world) {
      const s = el.radar.width, c = s / 2, scale = (c - 8) / MINIMAP_RANGE;
      rctx.clearRect(0, 0, s, s);
      rctx.fillStyle = "rgba(6,14,18,0.55)";
      rctx.beginPath(); rctx.arc(c, c, c - 2, 0, 7); rctx.fill();
      rctx.strokeStyle = P.hud.line; rctx.lineWidth = 1.5;
      rctx.stroke();
      const p = world.player;
      const toRadar = (x, z) => {
        const dx = x - p.x, dz = z - p.z;
        // 玩家朝向为上：把世界向量绕 -yaw 旋转（内核 yaw 口径 0=+z）
        const cs = Math.cos(-p.yaw + Math.PI), sn = Math.sin(-p.yaw + Math.PI);
        const rx = dx * cs - dz * sn, rz = dx * sn + dz * cs;
        return [c + rx * scale, c + rz * scale];
      };
      rctx.fillStyle = "rgba(90,200,220,0.35)";
      for (const sp of ENEMY_SPAWNS) {
        const [x, y] = toRadar(sp.x, sp.z);
        rctx.fillRect(x - 2, y - 2, 4, 4);
      }
      rctx.fillStyle = P.hud.radarEnemy;
      for (const e of world.enemies) {
        if (e.state === "dead") continue;
        const dx = e.x - p.x, dz = e.z - p.z;
        if (Math.hypot(dx, dz) > MINIMAP_RANGE) continue;
        const [x, y] = toRadar(e.x, e.z);
        rctx.beginPath(); rctx.arc(x, y, 3, 0, 7); rctx.fill();
      }
      rctx.fillStyle = P.hud.radarSelf;
      rctx.beginPath();
      rctx.moveTo(c, c - 6); rctx.lineTo(c - 4, c + 5); rctx.lineTo(c + 4, c + 5);
      rctx.closePath(); rctx.fill();
    },
  };
  return api;
}
