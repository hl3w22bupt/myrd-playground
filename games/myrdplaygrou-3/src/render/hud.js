// hud.js — DOM 表现层：屏幕切换 + 比分/计时 + 进球横幅 + 摇杆可视化 +
// 新手引导三层（教学卡/常驻标签/气泡，缺陷单 cmwbumwtv）+ 进球比分弹跳/蓄力条/再来一局结算（v3 打磨项）。
// 只读内核状态渲染，不持有游戏逻辑；教学卡已读标记走 localStorage（同档案不再展示）。
function $(id) { return document.getElementById(id); }

const TUTORIAL_SEEN_KEY = "gr-tutorial-seen-v3"; // 本地档案已读标记（v3 onboarding）
export const isTutorialSeen = () => {
  try { return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === "1"; } catch { return false; }
};
export const markTutorialSeen = () => {
  try { window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch { /* 隐私模式无痕会话：跳过持久化 */ }
};

export function createHud() {
  const el = {
    hud: $("hud"), homeScore: $("home-score"), awayScore: $("away-score"), time: $("time"),
    banner: $("banner"), bannerText: $("banner-text"),
    title: $("screen-title"), tutorial: $("screen-tutorial"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"), overHint: $("over-hint"), overChase: $("over-chase"),
    joyBase: $("joy-base"), joyStick: $("joy-stick"),
    joyTag: $("joy-tag"), actions: $("actions"),
    bubble: $("bubble"), bubbleText: $("bubble-text"),
    chargeWrap: $("charge-wrap"), chargeBar: $("charge-bar"),
  };
  let bannerTimer = 0;
  let bubbleTimer = 0;
  let bubbleSeen = {};   // 每档案一次性提示：{ firstTouch: n, firstTackled: n }（TUTORIAL 提示每档案 1 次）
  let popTimer = 0;

  return {
    /** 屏幕切换：null = 只留 HUD（playing 态）；"tutorial" = 教学卡（盖过 title）；
     *  内核终态名 gameover 归一到结算屏节点 over（v16 线上终审缺陷修复：此前 showScreen
     *  收到 "gameover" 时四个屏键全不匹配 → 结算屏/再来一局按钮终局后永不显示） */
    showScreen(name) {
      const screenName = name === "gameover" ? "over" : name;
      for (const [key, node] of [["title", el.title], ["tutorial", el.tutorial], ["paused", el.paused], ["over", el.over]]) {
        node.classList.toggle("hidden", key !== screenName);
      }
      el.hud.classList.toggle("hidden", screenName === "title" || screenName === "tutorial");
    },
    /** 教学卡是否需要展示（本地档案首次进入） */
    shouldShowTutorial() { return !isTutorialSeen(); },
    completeTutorial() { markTutorialSeen(); },
    setHud(home, away, timeLeft) {
      el.homeScore.textContent = String(home);
      el.awayScore.textContent = String(away);
      el.time.textContent = String(Math.ceil(timeLeft));
      // 比分弹跳计时回收（进球方高亮 0.4s 后摘类）
      if (popTimer > 0) {
        popTimer -= 1 / 60;
        if (popTimer <= 0) {
          el.homeScore.classList.remove("score-pop", "score-pop-home");
          el.awayScore.classList.remove("score-pop", "score-pop-away");
        }
      }
    },
    /** 进球方比分数字弹跳 + 基色高亮（v3 gameFeel：scorePopScale=1.6 / scorePopSec=0.4） */
    popScore(team) {
      const node = team === 0 ? el.homeScore : el.awayScore;
      node.classList.remove("score-pop", "score-pop-home", "score-pop-away");
      void node.offsetWidth; // 重启动画
      node.classList.add("score-pop", team === 0 ? "score-pop-home" : "score-pop-away");
      popTimer = 0.4;
    },
    /** 蓄力条（按住射门期间线性填充 0→1；松手隐藏） */
    setCharge(progress) {
      if (progress === null) { el.chargeWrap.classList.add("hidden"); return; }
      el.chargeWrap.classList.remove("hidden");
      el.chargeBar.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
    },
    /** 一次性气泡提示（每档案每类 1 次；FIRST_TOUCH_PROMPT_SEC 秒后自动淡出） */
    bubbleOnce(kind, text) {
      const seen = bubbleSeen[kind] || 0;
      if (seen >= 1) return false;
      bubbleSeen[kind] = seen + 1;
      el.bubbleText.textContent = text;
      el.bubble.classList.remove("hidden", "fade");
      bubbleTimer = 3;
      return true;
    },
    /** 进球横幅（表现层计时器，1.4s 自动消隐；v3 缺口修复：goal 事件反馈链必需，
     *  缺失会在 handleEvents 抛 TypeError 掐断冒烟快进 —— browser-smoke timeout 根因） */
    flashBanner(text) {
      el.bannerText.textContent = text;
      el.banner.classList.remove("hidden");
      bannerTimer = 1.4;
    },
    /** 任一操作后气泡立即淡出（v3 onboarding 语义） */
    fadeBubble() {
      if (bubbleTimer > 0) { bubbleTimer = Math.min(bubbleTimer, 0.3); el.bubble.classList.add("fade"); }
    },
    tickOverlays(dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.banner.classList.add("hidden");
      }
      if (bubbleTimer > 0) {
        bubbleTimer -= dt;
        if (bubbleTimer <= 0.3) el.bubble.classList.add("fade");
        if (bubbleTimer <= 0) el.bubble.classList.add("hidden");
      }
    },
    setOver(won, score, lastScore = null) {
      const title = won === "home" ? "🏆 你赢了！" : won === "away" ? "惜败" : "平局";
      el.overTitle.textContent = title;
      el.overDetail.textContent = `全场 ${score.home} : ${score.away}（主队 : 客队）`;
      // 败局改进提示（v3 replayHooks：一句针对性建议；平局给均衡提示）
      el.overHint.textContent =
        won === "away" ? "改进提示：多按 X 传球找开阔队友，别一个人带到底"
        : won === "draw" ? "平局：射门蓄力拉满再松手，远角更容易进"
        : "漂亮！保持传切配合，冲击零封金靴";
      // 再来一局动机：保留上局比分作追赶目标（v3 replayHooks · 一键再来一局）
      el.overChase.textContent = lastScore
        ? `上一局 ${lastScore.home} : ${lastScore.away} —— 再来一局追上它！`
        : "";
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
    /** 对局 HUD 元素随状态显隐（常驻标签只在 playing 态展示） */
    setPlayVisible(playing) {
      el.actions.classList.toggle("hidden", !playing);
      el.joyTag.classList.toggle("hidden", !playing);
      if (!playing) { el.chargeWrap.classList.add("hidden"); }
    },
    resetSessionPrompts() {
      bubbleSeen = {}; // 重开 = 新对局档案：一次性提示计数清零（教学卡已读标记不重置）
    },
  };
}
