"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_BADGE_TOKENS = void 0;
exports.createStreakBadge = createStreakBadge;
/**
 * meta HUD 徽章（实体 e-meta-badge，spec v1.4 acc-b4：连胜展示）。
 *
 * 契约：
 *  - 主题令牌占位：样式值全部取自 render/theme.ts NEON 表（内联 CSS 变量），N2 资产过检后即插即换；
 *  - 零连胜不渲染（visible=false → display:none，零占位）；
 *  - doc 注入式（浏览器 = document；契约 = 注入替身），绝不抛错。
 */
const streak_js_1 = require("../meta/streak.js");
const theme_js_1 = require("../render/theme.js");
/** NEON 主题令牌（唯一色源 = render/theme.ts NEON 表，本文件零色值字面量——acc-t1 红线） */
exports.META_BADGE_TOKENS = {
    bg: `${theme_js_1.NEON.NIGHT_SKY_TOP}C6`, // hex8：夜色底 + 78% 不透明
    border: theme_js_1.NEON.UI_BTN_PRIMARY,
    text: theme_js_1.NEON.PERFECT_GLOW,
};
function createStreakBadge(doc, mount) {
    const el = doc.createElement('div');
    el.className = 'st-meta-streak-badge';
    Object.assign(el.style, {
        display: 'none',
        position: 'absolute',
        top: '12px',
        right: '12px',
        padding: '4px 10px',
        borderRadius: '8px',
        background: exports.META_BADGE_TOKENS.bg,
        border: `1px solid ${exports.META_BADGE_TOKENS.border}`,
        color: exports.META_BADGE_TOKENS.text,
        font: '700 14px/1.2 system-ui, sans-serif',
        pointerEvents: 'none',
        zIndex: '30',
    });
    mount.appendChild(el);
    return {
        el,
        update(save) {
            const view = (0, streak_js_1.streakBadgeView)(save);
            el.style.display = view.visible ? 'block' : 'none';
            el.textContent = view.visible ? `×${view.count}` : '';
            return { visible: view.visible, count: view.count };
        },
        applyBadgeSkin(url) {
            el.style.background = `center / contain no-repeat url("${url}")`;
            el.style.border = 'none';
        },
    };
}
