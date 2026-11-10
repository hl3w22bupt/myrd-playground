// hud.js — DOM 表现层：屏幕切换 + 比分/进球/金币/计时 + 事件横幅/底部提示 + 结算文案 + 摇杆可视化。
// 只读内核状态渲染，不持有游戏逻辑；字号三档按风格卡（标题 38 / 正文 15 / HUD 数字 20 / CTA 18）。
import { GOALS_TO_WIN } from "../numeric.js";

function $(id) { return document.getElementById(id); }

export function createHud() {
  const el = {
    hud: $("hud"), score: $("score"), time: $("time"), timeChip: $("chip-time"),
    goals: $("goals"), coins: $("coins"), banner: $("banner"), hint: $("hint"),
    pauseBtn: $("btn-pause"),
    joy: $("joy"), joyBase: $("joy-base"), joyKnob: $("joy-knob"),
    title: $("screen-title"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"),
  };
  let bannerTimer = null;
  let hintTimer = null;
  let hintLastAt = 0;

  return {
    /** 屏幕切换：null = 只留 HUD（playing 态）；gameover 态的 state 名与 over 屏同名映射 */
    showScreen(name) {
      for (const [key, node] of [["title", el.title], ["paused", el.paused], ["gameover", el.over]]) {
        node.classList.toggle("hidden", key !== name);
      }
      el.hud.classList.toggle("hidden", name === "title");
      el.pauseBtn.classList.toggle("hidden", name === "title");
    },
    setHud(score, timeLeft, goals, coinsCollected) {
      el.score.textContent = String(score);
      el.time.textContent = String(Math.ceil(timeLeft));
      el.goals.textContent = `${goals}/${GOALS_TO_WIN}`;
      el.coins.textContent = `×${coinsCollected}`;
      // 终局紧迫态：最后 10 秒时间徽章转强调色（平缓大众 —— 只提注意力，不加难度）
      el.timeChip.classList.toggle("urgent", Math.ceil(timeLeft) <= 10);
    },
    /** 事件横幅：进球/扑救短提示（1.2s 自动消失） */
    flash(text, cls = "flash-blue") {
      el.banner.textContent = text;
      el.banner.className = `banner ${cls}`;
      el.banner.classList.remove("hidden");
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.banner.classList.add("hidden"), 1200);
    },
    /** 底部操作提示（不常驻：1.6s 自动消失，0.8s 节流防连刷） */
    hint(text) {
      const now = performance.now();
      if (now - hintLastAt < 800) return;
      hintLastAt = now;
      el.hint.textContent = text;
      el.hint.classList.remove("hidden");
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => el.hint.classList.add("hidden"), 1600);
    },
    /** 虚拟摇杆可视化：触屏按下才出现（锚点=落指处，旋钮=当前位移），松手即隐 */
    setJoystick(state) {
      if (!state?.active) {
        el.joy.classList.add("hidden");
        return;
      }
      el.joy.classList.remove("hidden");
      el.joyBase.style.transform = `translate(${state.sx - 48}px, ${state.sy - 48}px)`;
      el.joyKnob.style.transform = `translate(${state.sx + state.dx - 22}px, ${state.sy + state.dy - 22}px)`;
    },
    /** 结算屏：胜利/失利分色分文案 —— 失败与胜利反馈必须一眼可辨 */
    setOver(won, score, goals, coinsCollected) {
      el.over.classList.toggle("win", won);
      if (won) {
        el.overTitle.textContent = "胜利！";
        el.overDetail.textContent = goals >= GOALS_TO_WIN
          ? `提前破关 · 进球 ${goals}/${GOALS_TO_WIN} · 金币 ${coinsCollected} · 得分 ${score}`
          : `终场哨响 · 进球 ${goals} · 金币 ${coinsCollected} · 得分 ${score}`;
      } else {
        el.overTitle.textContent = "比赛失利";
        el.overDetail.textContent = `整场未破门 · 金币 ${coinsCollected} · 得分 ${score} —— 进 1 球即获胜，再来！`;
      }
    },
  };
}
