// renderer.ts — 表现层渲染器（e-renderer · 极简几何色块，零贴图）
//
// 色值唯一来源 = theme.ts 单源（spec palette + 美术 token）；本文件零 hex 字面量（ac-11/13 机判）。
import { PALETTE, UI, SHAPE, MATERIAL, TYPE_SCALE, HUD_TEXT, BACKDROP, FEEL_UI, withAlpha } from './theme.mjs';
                                              

                              
                  
               
               
                
                
                           
                   
                          
                                    
                                      
                  
               
                                                                             
                                                                 
                                                   
                                                                
 

                         
            
            
               
                 
                 
                    
               
                
                                                                      
 

export function computeLayout(w        , h        )         {
  const hudH = h * 0.12;
  const hintH = h * 0.08;
  const boardArea = h - hudH - hintH;
  const boardSize = Math.min(w * 0.94, boardArea * 0.94);
  return {
    w,
    h,
    hudY: hudH * 0.5,
    boardX: (w - boardSize) / 2,
    boardY: hudH + (boardArea - boardSize) / 2,
    boardSize,
    cell: boardSize / 8,
    hintY: h - hintH * 0.5,
    restartRect: (() => {
      const size = Math.max(44, h * 0.052);
      return { x: w - size - 12, y: h - hintH - size - 10, size };
    })(),
  };
}

function roundRect(ctx                          , x        , y        , w        , h        , r        )       {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawBackdrop(ctx                          , layout        , heat        )       {
  const g = ctx.createLinearGradient(0, 0, 0, layout.h);
  for (const s of BACKDROP.stops) g.addColorStop(s.at, s.hex);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, layout.w, layout.h);
  // 炉温氛围（连击热感插值，纯渐变零贴图）
  if (BACKDROP.heatGlow.enabled) {
    const alpha = BACKDROP.heatGlow.alphaCool + (BACKDROP.heatGlow.alphaWarm - BACKDROP.heatGlow.alphaCool) * Math.min(1, Math.max(0, heat));
    const rg = ctx.createRadialGradient(layout.w / 2, layout.h, 0, layout.w / 2, layout.h, layout.h * 0.7);
    rg.addColorStop(0, withAlpha(BACKDROP.heatGlow.hex, alpha));
    rg.addColorStop(1, withAlpha(MATERIAL.tint.ink, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, layout.w, layout.h);
  }
  if (BACKDROP.vignette.enabled) {
    const vg = ctx.createRadialGradient(layout.w / 2, layout.h / 2, layout.h * 0.35, layout.w / 2, layout.h / 2, layout.h * 0.75);
    vg.addColorStop(0, withAlpha(MATERIAL.tint.ink, 0));
    vg.addColorStop(1, withAlpha(BACKDROP.vignette.hex, BACKDROP.vignette.alpha));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, layout.w, layout.h);
  }
}

export function drawHud(ctx                          , layout        , st             )       {
  ctx.textBaseline = 'middle';
  const fs = layout.h * TYPE_SCALE.labelRatio;
  ctx.font = `${fs}px system-ui, sans-serif`;
  ctx.fillStyle = UI.textDim;
  const cellsTop                          = [
    [HUD_TEXT.scoreLabel, String(st.score)],
    [`${HUD_TEXT.chainLabel}×`, st.chain > 0 ? ` ${st.chain}` : '—'],
    [HUD_TEXT.movesLabel, st.movesLeft === null ? '∞' : String(st.movesLeft)],
  ];
  const colW = layout.w / cellsTop.length;
  // 连击三档视觉态（V1.2 · FEEL_UI 单源查表：色 token / 强调型 / 值缩放）
  const tierMap = FEEL_UI.comboTokenMap.find((m) => m.tier === st.comboTier) ?? FEEL_UI.comboTokenMap[0];
  const tierToken = (String(tierMap.valueToken).startsWith('UI.') ? UI[String(tierMap.valueToken).slice(3)] : UI.textPrimary) ?? UI.textPrimary;
  const pulse = tierMap.accent !== 'none' ? 0.72 + 0.28 * Math.sin(st.time / 120) : 1;
  const valueScale = typeof tierMap.valueScale === 'number' ? tierMap.valueScale : 1;
  cellsTop.forEach(([label, value], i) => {
    const cx = colW * i + colW / 2;
    const isChain = label === `${HUD_TEXT.chainLabel}×`;
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.textDim;
    ctx.fillText(label, cx - fs * 2.2, layout.hudY);
    if (isChain && st.comboTier > 1) {
      // 档位强调：alpha 脉冲（globalAlpha）+ 值缩放
      ctx.globalAlpha = pulse;
      ctx.fillStyle = tierToken;
      ctx.font = `${layout.h * TYPE_SCALE.scoreRatio * valueScale}px system-ui, sans-serif`;
      ctx.fillText(value, cx + fs * 0.6, layout.hudY);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = UI.textPrimary;
      ctx.font = `${layout.h * TYPE_SCALE.scoreRatio}px system-ui, sans-serif`;
      ctx.fillText(value, cx + fs * 0.6, layout.hudY);
    }
    ctx.font = `${fs}px system-ui, sans-serif`;
  });
  // 目标行
  ctx.fillStyle = UI.textDim;
  ctx.font = `${fs * 0.72}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${HUD_TEXT.goalLabel}：${st.goalText}`, layout.w / 2, layout.hudY + fs * 1.6);
}

export function drawBoard(ctx                          , layout        , st             )       {
  const radius = layout.cell * SHAPE.cornerRadiusRatio;
  const stroke = Math.max(1, layout.cell * SHAPE.innerStrokeRatio);
  const highlight = layout.cell * SHAPE.topHighlightRatio;
  // 硬降震屏：整板平移（feel 查表偏移 × cell；V1.2）
  ctx.save();
  ctx.translate(st.shake.x * layout.cell, st.shake.y * layout.cell);
  for (let i = 0; i < st.board.length; i += 1) {
    const col = i % st.cols;
    const row = Math.floor(i / st.cols);
    const x = layout.boardX + col * layout.cell;
    const y = layout.boardY + row * layout.cell;
    const pad = layout.cell * 0.06;
    const type = st.board[i];
    if (type < 0) continue;
    const base = PALETTE[`block-0${type + 1}`];
    if (!base) continue;
    const popping = st.popping.includes(i);
    const squash = st.squash[i];
    ctx.save();
    if (popping) ctx.globalAlpha = 0.35;
    if (squash) {
      // 落地挤压形变：绕格中心缩放（feel 查表 sx/sy，V1.2）
      const cx = x + layout.cell / 2;
      const cy = y + layout.cell / 2;
      ctx.translate(cx, cy);
      ctx.scale(squash.sx, squash.sy);
      ctx.translate(-cx, -cy);
    }
    // 块体
    roundRect(ctx, x + pad, y + pad, layout.cell - pad * 2, layout.cell - pad * 2, radius);
    ctx.fillStyle = base;
    ctx.fill();
    // 1px 级内描边（暗块防糊底，风格卡要素 2）
    ctx.strokeStyle = withAlpha(MATERIAL.innerStroke.hex, MATERIAL.innerStroke.alpha);
    ctx.lineWidth = stroke;
    ctx.stroke();
    // 顶部高光条（风格卡要素 2）
    ctx.fillStyle = withAlpha(MATERIAL.topHighlight.hex, MATERIAL.topHighlight.alpha);
    roundRect(ctx, x + pad + stroke, y + pad + stroke, layout.cell - pad * 2 - stroke * 2, highlight, radius * 0.6);
    ctx.fill();
    ctx.restore();
  }
  // 选中框
  if (st.selected !== null && st.selected >= 0) {
    const col = st.selected % st.cols;
    const row = Math.floor(st.selected / st.cols);
    ctx.strokeStyle = UI.textPrimary;
    ctx.lineWidth = Math.max(2, layout.cell * 0.04);
    roundRect(ctx, layout.boardX + col * layout.cell + 2, layout.boardY + row * layout.cell + 2, layout.cell - 4, layout.cell - 4, radius);
    ctx.stroke();
  }
  // 教学提示（level-1）：高亮一对可成三消的相邻交换
  if (st.hintPair) {
    const pulse = 0.5 + 0.5 * Math.sin(st.time / 120);
    ctx.strokeStyle = UI.accentWarm;
    ctx.globalAlpha = 0.4 + 0.6 * pulse;
    ctx.lineWidth = Math.max(2, layout.cell * 0.05);
    for (const idx of st.hintPair) {
      const col = idx % st.cols;
      const row = Math.floor(idx / st.cols);
      roundRect(ctx, layout.boardX + col * layout.cell + 2, layout.boardY + row * layout.cell + 2, layout.cell - 4, layout.cell - 4, radius);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore(); // 震屏平移出栈
}

/**
 * 消除粒子（V1.2 切片2 · D1 打回修复）：消费 feel 查表 particles，几何圆上屏。
 * 数据真源 = FEEL.particles（spec numeric.feel.particles 生成表，本文件零数值字面量）；
 * 色唯一来源 = UI.accentWarm（连击热感同 token，零裸 hex，ac-11 机判）；
 * 半径 = sizeRatio × cell（sizeRatio 由 feel 层按三档派生）；alpha 随寿命衰减（查表）。
 * 返回本帧实际绘制数（冒烟「上屏可观察断言」读取面；0 = 未消费）。
 */
export function drawParticles(ctx                          , layout        , st             )         {
  let drawn = 0;
  if (st.particles.length === 0) return drawn;
  ctx.save();
  ctx.translate(st.shake.x * layout.cell, st.shake.y * layout.cell); // 与棋盘同震屏平移
  for (const p of st.particles) {
    const r = p.sizeRatio * layout.cell;
    if (r <= 0) continue;
    const x = layout.boardX + p.x * layout.cell;
    const y = layout.boardY + p.y * layout.cell;
    if (x < -r || y < -r || x > layout.w + r || y > layout.h + r) continue; // 出屏裁剪（不占绘制数）
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.fillStyle = UI.accentWarm;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    drawn += 1;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return drawn;
}

/** 重开一键按钮（V1.2 · 三态查表 FEEL_UI.restart：idle/armed/transition；色一律 token） */
export function drawRestartButton(ctx                          , layout        , state                                 )       {
  const r = layout.restartRect;
  const tokenName = FEEL_UI.restart.tokenMap[state] ?? FEEL_UI.restart.tokenMap.idle;
  const hex = UI[String(tokenName).startsWith('UI.') ? String(tokenName).slice(3) : 'textPrimary'] ?? UI.textPrimary;
  ctx.save();
  ctx.globalAlpha = state === 'transition' ? 0.55 : state === 'armed' ? 0.95 : 0.8;
  ctx.fillStyle = hex;
  roundRect(ctx, r.x, r.y, r.size, r.size, r.size * SHAPE.cornerRadiusRatio * 1.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = MATERIAL.tint.ink;
  ctx.font = `${r.size * 0.3}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(HUD_TEXT.restartLabel, r.x + r.size / 2, r.y + r.size / 2);
  ctx.restore();
}

/** daily 入口与角标（V1.2 · FEEL_UI.daily 查表；色一律 token） */
export function drawDailyEntry(ctx                          , layout        , st             )       {
  if (!st.daily.visible) return;
  const tokenName = st.daily.done ? FEEL_UI.daily.tokenMap.done : FEEL_UI.daily.tokenMap.undone;
  const hex = UI[String(tokenName).startsWith('UI.') ? String(tokenName).slice(3) : 'accentWarm'] ?? UI.accentWarm;
  const size = Math.max(26, layout.h * 0.03);
  const x = layout.w - size - 12;
  const y = 10;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(hex, st.daily.done ? 0.28 : 0.85);
  ctx.fill();
  ctx.strokeStyle = withAlpha(hex, 0.9);
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.stroke();
  ctx.fillStyle = st.daily.done ? UI.textDim : hex;
  ctx.font = `${size * 0.42}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.daily.done ? '✓' : '日', x + size / 2, y + size / 2 + 1);
  if (st.daily.streak > 1) {
    ctx.fillStyle = UI.textDim;
    ctx.font = `${size * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`连 ${st.daily.streak}`, x - 4, y + size / 2);
  }
  ctx.restore();
}

export function drawHintBar(ctx                          , layout        , st             )       {
  if (st.cooled) return;
  if (!st.hintPair) return;
  ctx.fillStyle = UI.hintBarBg;
  const bw = layout.w * 0.86;
  const bh = layout.h * 0.055;
  roundRect(ctx, (layout.w - bw) / 2, layout.hintY - bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = UI.textPrimary;
  ctx.font = `${layout.h * 0.022}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('试试高亮的一对：相邻交换可成三连', layout.w / 2, layout.hintY);
}

export function drawCoolBanner(ctx                          , layout        , st             )       {
  if (!st.cooled) return;
  ctx.fillStyle = withAlpha(BACKDROP.coolScrim.hex, BACKDROP.coolScrim.alpha);
  ctx.fillRect(0, 0, layout.w, layout.h);
  const bw = layout.w * 0.8;
  const bh = layout.h * 0.24;
  const bx = (layout.w - bw) / 2;
  const by = layout.h * 0.36;
  roundRect(ctx, bx, by, bw, bh, bh * 0.12);
  ctx.fillStyle = UI.coolBannerBg;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = UI.coolBannerText;
  ctx.font = `${layout.h * TYPE_SCALE.bannerRatio}px system-ui, sans-serif`;
  ctx.fillText(HUD_TEXT.coolTitle, layout.w / 2, by + bh * 0.34);
  ctx.font = `${layout.h * 0.03}px system-ui, sans-serif`;
  ctx.fillText(`${HUD_TEXT.coolSubtitle} · ${HUD_TEXT.restartLabel}(R)`, layout.w / 2, by + bh * 0.72);
}


//# sourceURL=render/renderer.ts