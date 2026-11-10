// hud.js — DOM 表现层：屏幕切换 + 比分/进球/金币/计时 + 事件横幅 + 结算文案。
// 只读内核状态渲染，不持有游戏逻辑。
import { GOALS_TO_WIN, COIN_COUNT } from "../numeric.js";

function $(id) { return document.getElementById(id); }

export function createHud() {
  const el = {
    hud: $("hud"), score: $("score"), time: $("time"), goals: $("goals"), coins: $("coins"),
    banner: $("banner"),
    title: $("screen-title"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"),
  };
  let bannerTimer = null;

  return {
    /** 屏幕切换：null = 只留 HUD（playing 态）；gameover 态的 state 名与 over 屏同名映射 */
    showScreen(name) {
      for (const [key, node] of [["title", el.title], ["paused", el.paused], ["gameover", el.over]]) {
        node.classList.toggle("hidden", key !== name);
      }
      el.hud.classList.toggle("hidden", name === "title");
    },
    setHud(score, timeLeft, goals, coinsCollected) {
      el.score.textContent = String(score);
      el.time.textContent = String(Math.ceil(timeLeft));
      el.goals.textContent = `${goals}/${GOALS_TO_WIN}`;
      el.coins.textContent = `${coinsCollected}/${COIN_COUNT}`;
    },
    /** 事件横幅：进球/扑救短提示（1.2s 自动消失） */
    flash(text, cls = "flash-blue") {
      el.banner.textContent = text;
      el.banner.className = `banner ${cls}`;
      el.banner.classList.remove("hidden");
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.banner.classList.add("hidden"), 1200);
    },
    setOver(won, score, goals, coinsCollected) {
      el.overTitle.textContent = won ? "晋级！" : "终场哨响";
      el.overDetail.textContent = `进球 ${goals} · 金币 ${coinsCollected}/${COIN_COUNT} · 得分 ${score}`;
    },
  };
}
