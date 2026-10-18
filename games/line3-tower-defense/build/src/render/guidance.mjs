// guidance.ts — 首屏文案单源（渲染层 GUIDANCE 常量）
// spec: world.firstScreenCopy 12 条逐字枚举 · a5 判据「三方逐字同名」=
//       spec.world.firstScreenCopy ≡ 本文件 ≡ hint_shown.text（copy-hint-place 逐字）
// 本文件为唯一可写字面处；改文案必须先走 spec revision（spec/world/firstScreenCopy 同轮）。

                                                       

/** 12 条逐字（id 与 text 均以 spec.world.firstScreenCopy 为唯一事实，零改写） */
export const GUIDANCE                                   = Object.freeze({
  "copy-title": "敌潮将至",
  "copy-subtitle": "布防 · 升级 · 守住核心",
  "copy-start": "开始布防",
  "copy-hint-place": "点击空地，放置第一座炮塔",
  "copy-hint-upgrade": "选中炮塔，升级火力",
  "copy-core-label": "核心",
  "copy-gold-label": "军费",
  "copy-wave-label": "波次",
  "copy-speed-label": "加速",
  "copy-result-win": "守住啦",
  "copy-result-lose": "核心失守",
  "copy-restart": "再来一局",
});

export const COPY_IDS                    = Object.keys(GUIDANCE);

/** fnd/a5 共用锚：hint_shown.text 取值处 */
export const HINT_TEXT         = GUIDANCE["copy-hint-place"];
