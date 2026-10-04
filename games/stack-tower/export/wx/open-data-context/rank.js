/**
 * 开放数据域 · 好友排行渲染器（B0 · spec v1.3 content.platform wx-open-data-rank 条目）。
 *
 * 纪律：
 *  - token 引主包同一份变量文件：色板只从 ./tokens.js 取（tools/build-wx.mjs 自主包编译产物
 *    theme.js NEON 表生成，头部带 GENERATED 标记），本文件禁止出现第二份色值字面量；
 *  - 排行数据仅来自 wx.getFriendCloudStorage（开放数据域内），主包零好友数据落点；
 *  - 纯函数绘制（ctx + 数据 → 画布），Node 结构门禁可静态断言（零 wx 顶层调用）。
 */

/** 面板绘制：半透明夜色底 + 霓虹描边 + 标题 + 条目列表（头像圆 + 昵称 + 分数） */
function renderRank(ctx, width, height, tokens, data) {
  const NEON = tokens.NEON || {};
  ctx.clearRect(0, 0, width, height);

  // 面板底（UI_PANEL_HUD @ UI_PANEL_HUD_ALPHA，与主包 HUD 面板同源）
  const pad = Math.round(width * 0.06);
  const panelX = pad;
  const panelY = Math.round(height * 0.12);
  const panelW = width - pad * 2;
  const panelH = height - panelY - pad;
  ctx.globalAlpha = NEON.UI_PANEL_HUD_ALPHA;
  ctx.fillStyle = NEON.UI_PANEL_HUD;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.globalAlpha = 1;

  // 霓虹描边（UI_BTN_PRIMARY）
  ctx.strokeStyle = NEON.UI_BTN_PRIMARY;
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // 标题
  ctx.fillStyle = NEON.UI_ICON_SOUND;
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('好友排行 · 塔层', panelX + 16, panelY + 24);

  // 条目（rank UI 素材 wx-friend-rank-ui 同构：头像圆 + 昵称 + 分数）
  const friends = Array.isArray(data.friends) ? data.friends : [];
  const rowH = Math.min(56, Math.floor((panelH - 48) / Math.max(friends.length, 1)));
  friends.slice(0, 20).forEach((f, i) => {
    const y = panelY + 44 + i * rowH;
    const blockColor = tokens.BLOCK_NEON_CYCLE[i % tokens.BLOCK_NEON_CYCLE.length];
    // 头像占位圆（开放数据域内不上屏头像图时以霓虹色圆代之）
    ctx.fillStyle = blockColor;
    ctx.beginPath();
    ctx.arc(panelX + 28, y + rowH / 2 - 4, Math.min(14, rowH / 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NEON.UI_ICON_SOUND;
    ctx.font = '13px sans-serif';
    ctx.fillText(String(f.nickname || '好友'), panelX + 52, y + rowH / 2 - 10);
    ctx.fillStyle = NEON.PERFECT_GLOW;
    ctx.fillText(String(f.score ?? 0) + ' 层', panelX + 52, y + rowH / 2 + 8);
    ctx.fillStyle = NEON.HORIZON;
    ctx.fillRect(panelX + 16, y + rowH - 6, panelW - 32, 1);
  });

  if (!friends.length) {
    ctx.fillStyle = NEON.UI_ICON_SOUND;
    ctx.font = '13px sans-serif';
    ctx.fillText('暂无好友数据（devtools 合成数据渲染口径）', panelX + 16, panelY + 48);
  }
}

module.exports = { renderRank };
