// hud.js — DOM 表现层：屏幕切换 + 比分/计时 + 进球横幅 + 摇杆可视化。只读内核状态渲染，不持有游戏逻辑。
function $(id) { return document.getElementById(id); }

export function createHud() {
  const el = {
    hud: $("hud"), homeScore: $("home-score"), awayScore: $("away-score"), time: $("time"),
    banner: $("banner"), bannerText: $("banner-text"),
    title: $("screen-title"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"),
    joyBase: $("joy-base"), joyStick: $("joy-stick"),
  };
  let bannerTimer = 0;

  return {
    /** 屏幕切换：null = 只留 HUD（playing 态） */
    showScreen(name) {
      for (const [key, node] of [["title", el.title], ["paused", el.paused], ["over", el.over]]) {
        node.classList.toggle("hidden", key !== name);
      }
      el.hud.classList.toggle("hidden", name === "title");
    },
    setHud(home, away, timeLeft) {
      el.homeScore.textContent = String(home);
      el.awayScore.textContent = String(away);
      el.time.textContent = String(Math.ceil(timeLeft));
    },
    setOver(won, score) {
      const title = won === "home" ? "🏆 你赢了！" : won === "away" ? "惜败" : "平局";
      el.overTitle.textContent = title;
      el.overDetail.textContent = `全场 ${score.home} : ${score.away}（主队 : 客队）· 按 回车 / 点按右侧 再来一局`;
    },
    /** 进球横幅（表现层计时器，1.4s 自动消隐） */
    flashBanner(text) {
      el.bannerText.textContent = text;
      el.banner.classList.remove("hidden");
      bannerTimer = 1.4;
    },
    tickBanner(dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.banner.classList.add("hidden");
      }
    },
    /** 摇杆可视化（触屏反馈；锚点出现在首触位置） */
    syncJoystick(state, anchor) {
      if (!state.active) {
        el.joyBase.classList.add("hidden");
        el.joyStick.classList.add("hidden");
        return;
      }
      el.joyBase.classList.remove("hidden");
      el.joyStick.classList.remove("hidden");
      if (anchor) {
        el.joyBase.style.left = `${anchor.x - 56}px`;
        el.joyBase.style.top = `${anchor.y - 56}px`;
      }
      const k = Math.min(1, Math.hypot(state.dx, state.dy) / state.max);
      const ang = Math.atan2(state.dy, state.dx);
      const r = k * 36;
      el.joyStick.style.left = `${56 + Math.cos(ang) * r - 26}px`;
      el.joyStick.style.top = `${56 + Math.sin(ang) * r - 26}px`;
    },
  };
}
