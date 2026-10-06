/**
 * meta HUD 徽章（实体 e-meta-badge，spec v1.4 acc-b4：连胜展示）。
 *
 * 契约：
 *  - 主题令牌占位：样式值全部取自 render/theme.ts NEON 表（内联 CSS 变量），N2 资产过检后即插即换；
 *  - 零连胜不渲染（visible=false → display:none，零占位）；
 *  - doc 注入式（浏览器 = document；契约 = 注入替身），绝不抛错。
 */
import { streakBadgeView } from '../meta/streak.js';
import { NEON } from '../render/theme.js';
/** NEON 主题令牌（唯一色源 = render/theme.ts NEON 表，本文件零色值字面量——acc-t1 红线） */
export const META_BADGE_TOKENS = {
    bg: `${NEON.NIGHT_SKY_TOP}C6`, // hex8：夜色底 + 78% 不透明
    border: NEON.UI_BTN_PRIMARY,
    text: NEON.PERFECT_GLOW,
};
export function createStreakBadge(doc, mount) {
    const el = doc.createElement('div');
    el.className = 'st-meta-streak-badge';
    Object.assign(el.style, {
        display: 'none',
        position: 'absolute',
        top: '64px', // 每日挑战卡（右上角 top:12）下方避让；同占右上会互相叠压
        right: '12px',
        padding: '4px 10px',
        borderRadius: '8px',
        background: META_BADGE_TOKENS.bg,
        border: `1px solid ${META_BADGE_TOKENS.border}`,
        color: META_BADGE_TOKENS.text,
        font: '700 14px/1.2 system-ui, sans-serif',
        pointerEvents: 'none',
        zIndex: '30',
    });
    mount.appendChild(el);
    return {
        el,
        update(save) {
            const view = streakBadgeView(save);
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
