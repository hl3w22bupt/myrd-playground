// hud.js — DOM 表现层：屏幕切换 + 计分/计时 + 结算文案。只读内核状态渲染，不持有游戏逻辑。
function $(id) { return document.getElementById(id); }

export function createHud() {
  const el = {
    hud: $("hud"), score: $("score"), time: $("time"),
    title: $("screen-title"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"),
  };
  return {
    /** 屏幕切换：null = 只留 HUD（playing 态） */
    showScreen(name) {
      for (const [key, node] of [["title", el.title], ["paused", el.paused], ["over", el.over]]) {
        node.classList.toggle("hidden", key !== name);
      }
      el.hud.classList.toggle("hidden", name === "title");
    },
    setHud(score, timeLeft) {
      el.score.textContent = String(score);
      el.time.textContent = String(Math.ceil(timeLeft));
    },
    setOver(won, score, collected, total) {
      el.overTitle.textContent = won ? "全部收集！" : "时间到";
      el.overDetail.textContent = `得分 ${score} · 收集 ${collected}/${total}`;
    },
  };
}
