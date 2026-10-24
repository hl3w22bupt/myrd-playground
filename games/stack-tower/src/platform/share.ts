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

/** 会话分享卡（5:4 = 500×400，wx-share-card-5x4） */
export const SHARE_CARD_SESSION = 'assets/wx/share-card-5x4.png';
/** 朋友圈方图（1:1 = 500×500，wx-share-timeline-1x1） */
export const SHARE_CARD_TIMELINE = 'assets/wx/share-timeline-1x1.png';

/**
 * 平台卡片集（C 抖音移植轮 · dy-share-loop 加法扩展）：
 *  - wx 缺省 = 上述两常量（wx B0 行为字节不变，既有调用零漂移）；
 *  - tt 侧由 platform/tt.ts 引 TT_SHARE_CARDS（dy-share-card，500×400）。
 * 素材 id 唯一来源仍 = 各平台 assets/(平台)/manifest.json（美术产线 sha256 清单），此处只存相对路径。
 */
export interface ShareCards { session: string; timeline: string }
export const WX_SHARE_CARDS: ShareCards = { session: SHARE_CARD_SESSION, timeline: SHARE_CARD_TIMELINE };
/** dy-share-card（500×400 会话分享卡，dy-share-loop 主判据配图） */
export const TT_SHARE_CARDS: ShareCards = { session: 'assets/tt/share-card.png', timeline: 'assets/tt/share-card.png' };

/** 分享标题（与线上版一致的一句话卖点，非玩法文案新增面） */
export const SHARE_TITLE = '霓虹夜塔：看准切面点下去，完美对齐激起塔身涟漪';

/** 分享载荷：sessionId 与埋点 anon_id 同源（UUID v4），零 PII（无昵称/头像/设备号） */
export interface SharePayload {
  title: string;
  imageUrl: string;
  query: string;
}

/** 构造会话分享载荷（主判据面）：query 携带 sessionId 供回环归因 */
export function buildSessionShare(sessionId: string): SharePayload {
  return { title: SHARE_TITLE, imageUrl: SHARE_CARD_SESSION, query: `sid=${encodeURIComponent(sessionId)}` };
}

/** 构造朋友圈分享载荷（附带项，不作为 B0 放行判据） */
export function buildTimelineShare(sessionId: string): SharePayload {
  return { title: SHARE_TITLE, imageUrl: SHARE_CARD_TIMELINE, query: `sid=${encodeURIComponent(sessionId)}` };
}

/** wx 分享注册面（wx.ts 提供实现；接口平台无关） */
export interface ShareRegistrar {
  /** 会话分享：菜单可用 + 回调返回载荷 */
  onShareAppMessage(provider: () => SharePayload): void;
  /** 朋友圈分享（附带项）：注册失败不阻塞主判据 */
  onShareTimeline(provider: () => SharePayload): void;
  /** 主动拉起会话分享（好排行页「邀请好友」入口） */
  showShareMenu(): void;
}

export function installShareMenu(registrar: ShareRegistrar, sessionId: string): void {
  registrar.onShareAppMessage(() => buildSessionShare(sessionId));
  registrar.onShareTimeline(() => buildTimelineShare(sessionId));
  registrar.showShareMenu();
}

// ---------- 平台卡片参数化（C 抖音移植轮 · dy-share-loop 加法面，wx 缺省行为不变） ----------

/** 指定卡片集构造会话分享载荷（query 携带 sid=，零 PII 口径与 buildSessionShare 一致） */
export function buildSessionShareWith(cards: ShareCards, sessionId: string): SharePayload {
  return { title: SHARE_TITLE, imageUrl: cards.session, query: `sid=${encodeURIComponent(sessionId)}` };
}

/** 指定卡片集安装分享菜单（wx = installShareMenu 别名缺省；tt = TT_SHARE_CARDS） */
export function installShareMenuWith(registrar: ShareRegistrar, sessionId: string, cards: ShareCards): void {
  registrar.onShareAppMessage(() => buildSessionShareWith(cards, sessionId));
  registrar.onShareTimeline(() => buildSessionShareWith(cards, sessionId));
  registrar.showShareMenu();
}
