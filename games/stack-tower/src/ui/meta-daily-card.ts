/**
 * 每日挑战卡呈现面（N2 资产 daily-challenge-card / icon-badge 即插即换 · spec v1.4 content.retention）。
 *
 * 契约：
 *  - 主题令牌占位：色值全部取自 render/theme.ts NEON 表（本文件零色值字面量——acc-t1 红线）；
 *  - 9-slice 即插即换：applyCardSkin(url) → border-image slice 24px（spec 尺寸 360×160，四角 24px 安全区）；
 *    资产缺失保持令牌态（fallback 恒在，绝不抛错——黑板 assets.md UI 接线纪律）；
 *  - 奖励角标：applyIconSkin(url)（icon-badge 64×64）→ 当日已领取态点亮；未皮肤化用 NEON 令牌 ✓ 占位；
 *  - 非交互（pointer-events:none）/ 零弹窗（acc-j5 红线）；零连胜/零挂载不占玩法区；
 *  - doc 注入式（浏览器 = document；查表 = 注入替身），绝不抛错。
 */
import { NEON } from '../render/theme.js';

/** 最小 DOM 替身接口（契约/查表注入；浏览器 document 天然满足） */
export interface CardNode {
  style: Record<string, string>;
  textContent: string;
  className: string;
  appendChild?(node: unknown): void;
}

export interface CardDoc {
  createElement(tag: string): CardNode;
}

export interface DailyCardHandle {
  el: CardNode;
  /** 依挑战日/领取态刷新文案（纯呈现，零玩法判定） */
  update(challengeDate: string, claimed: boolean): { visible: boolean; claimed: boolean };
  /** N2 资产即插即换：daily-challenge-card.png（9-slice 24px）装载成功后注入 */
  applyCardSkin(url: string): void;
  /** N2 资产即插即换：icon-badge.png 装载成功后注入领取角标 */
  applyIconSkin(url: string): void;
}

/** NEON 主题令牌（唯一色源 = render/theme.ts NEON 表；透明度由 UI_PANEL_HUD_ALPHA 派生，零私设色值） */
const alphaHex = Math.round(NEON.UI_PANEL_HUD_ALPHA * 255)
  .toString(16)
  .padStart(2, '0');

export const DAILY_CARD_TOKENS = {
  bg: `${NEON.UI_PANEL_HUD}${alphaHex}`, // hex8：面板夜色底 + 72% 不透明（UI_PANEL_HUD_ALPHA）
  border: NEON.UI_BTN_PRIMARY,
  title: NEON.CUT_FACE,
  date: NEON.UI_ICON_SOUND,
  claimed: NEON.BLOCK_NEON_04,
} as const;

/** 9-slice 安全区（spec v1.4 daily-challenge-card：四角 24px） */
const CARD_SLICE_PX = 24;

export function createDailyCard(doc: CardDoc, mount: { appendChild(node: unknown): void }): DailyCardHandle {
  const el = doc.createElement('div');
  el.className = 'st-meta-daily-card';
  Object.assign(el.style, {
    position: 'absolute',
    top: '12px',
    right: '12px', // 右上角：左上角是 HUD 文案区（分数/连击），left 会压住首行（v1.4 部署版回归）
    padding: '8px 14px',
    borderRadius: '10px',
    background: DAILY_CARD_TOKENS.bg,
    border: `1px solid ${DAILY_CARD_TOKENS.border}`,
    font: '700 13px/1.35 system-ui, sans-serif',
    color: DAILY_CARD_TOKENS.title,
    pointerEvents: 'none',
    zIndex: '29',
    display: 'none', // 挑战日写入前零占位
  });
  mount.appendChild(el);

  let iconUrl: string | null = null;

  return {
    el,
    update(challengeDate, claimed) {
      el.style.display = 'block';
      // 领取角标：皮肤化 → icon-badge 图（右侧背景）；未皮肤化 → NEON 令牌 ✓ 字形（fallback 恒在）
      const mark = claimed ? (iconUrl ? '' : ' ✓') : '';
      el.textContent = `每日挑战 ${challengeDate}${mark}`;
      el.style.color = claimed ? DAILY_CARD_TOKENS.claimed : DAILY_CARD_TOKENS.title;
      el.style.paddingRight = claimed ? '32px' : '14px';
      return { visible: true, claimed };
    },
    applyCardSkin(url) {
      // 9-slice：slice 24（spec 四角安全区）+ fill 保留面板身体；令牌底色保持为缺项 fallback
      el.style.border = 'none';
      el.style.borderImage = `url("${url}") ${CARD_SLICE_PX} fill / ${CARD_SLICE_PX}px stretch`;
    },
    applyIconSkin(url) {
      iconUrl = url;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'right 8px center';
      el.style.backgroundSize = '18px 18px';
    },
  };
}
