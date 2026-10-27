"use strict";
/**
 * 分享闭环接口（B0 · spec v1.3 content.platform wx-share-loop 条目）。
 *
 * 纪律：
 *  - 平台无关：接口与载荷构造在此，wx 侧装配（onShareAppMessage / onShareTimeline）由 wx.ts 调用
 *    installShareMenu 完成；抖音日后新增装配体复用同一接口，零改。
 *  - 验收口径原文（写死于 spec）：主判据 = 会话分享 5:4 卡（wx-share-card-5x4 实收）；
 *    朋友圈 = 附带项（wx-share-timeline-1x1）；载荷 sessionId 零 PII。
 *  - 素材 id 唯一来源：assets/wx/manifest.json（美术产线 sha256 清单），此处只存相对路径常量。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARE_TITLE = exports.TT_SHARE_CARDS = exports.WX_SHARE_CARDS = exports.SHARE_CARD_TIMELINE = exports.SHARE_CARD_SESSION = void 0;
exports.buildSessionShare = buildSessionShare;
exports.buildTimelineShare = buildTimelineShare;
exports.installShareMenu = installShareMenu;
exports.buildSessionShareWith = buildSessionShareWith;
exports.installShareMenuWith = installShareMenuWith;
/** 会话分享卡（5:4 = 500×400，wx-share-card-5x4） */
exports.SHARE_CARD_SESSION = 'assets/wx/share-card-5x4.png';
/** 朋友圈方图（1:1 = 500×500，wx-share-timeline-1x1） */
exports.SHARE_CARD_TIMELINE = 'assets/wx/share-timeline-1x1.png';
exports.WX_SHARE_CARDS = { session: exports.SHARE_CARD_SESSION, timeline: exports.SHARE_CARD_TIMELINE };
/** dy-share-card（500×400 会话分享卡，dy-share-loop 主判据配图） */
exports.TT_SHARE_CARDS = { session: 'assets/tt/share-card.png', timeline: 'assets/tt/share-card.png' };
/** 分享标题（与线上版一致的一句话卖点，非玩法文案新增面） */
exports.SHARE_TITLE = '霓虹夜塔：看准切面点下去，完美对齐激起塔身涟漪';
/** 构造会话分享载荷（主判据面）：query 携带 sessionId 供回环归因 */
function buildSessionShare(sessionId) {
    return { title: exports.SHARE_TITLE, imageUrl: exports.SHARE_CARD_SESSION, query: `sid=${encodeURIComponent(sessionId)}` };
}
/** 构造朋友圈分享载荷（附带项，不作为 B0 放行判据） */
function buildTimelineShare(sessionId) {
    return { title: exports.SHARE_TITLE, imageUrl: exports.SHARE_CARD_TIMELINE, query: `sid=${encodeURIComponent(sessionId)}` };
}
function installShareMenu(registrar, sessionId) {
    registrar.onShareAppMessage(() => buildSessionShare(sessionId));
    registrar.onShareTimeline(() => buildTimelineShare(sessionId));
    registrar.showShareMenu();
}
// ---------- 平台卡片参数化（C 抖音移植轮 · dy-share-loop 加法面，wx 缺省行为不变） ----------
/** 指定卡片集构造会话分享载荷（query 携带 sid=，零 PII 口径与 buildSessionShare 一致） */
function buildSessionShareWith(cards, sessionId) {
    return { title: exports.SHARE_TITLE, imageUrl: cards.session, query: `sid=${encodeURIComponent(sessionId)}` };
}
/** 指定卡片集安装分享菜单（wx = installShareMenu 别名缺省；tt = TT_SHARE_CARDS） */
function installShareMenuWith(registrar, sessionId, cards) {
    registrar.onShareAppMessage(() => buildSessionShareWith(cards, sessionId));
    registrar.onShareTimeline(() => buildSessionShareWith(cards, sessionId));
    registrar.showShareMenu();
}
