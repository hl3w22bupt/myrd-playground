// renderer.ts — 表现层渲染器（e-renderer · 极简几何色块，零贴图）
//
// 色值唯一来源 = theme.ts 单源（spec palette + 美术 token）；本文件零 hex 字面量（ac-11/13 机判）。
import { PALETTE, UI, SHAPE, MATERIAL, TYPE_SCALE, HUD_TEXT, BACKDROP, withAlpha } from './theme.mjs';

                              
                  
               
               
                
                
                           
                   
                          
                                    
                                      
                  
               
 

                         
            
            
               
                 
                 
                    
               
                
 

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
  cellsTop.forEach(([label, value], i) => {
    const cx = colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.textDim;
    ctx.fillText(label, cx - fs * 2.2, layout.hudY);
    ctx.fillStyle = UI.textPrimary;
    ctx.font = `${layout.h * TYPE_SCALE.scoreRatio}px system-ui, sans-serif`;
    ctx.fillText(value, cx + fs * 0.6, layout.hudY);
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
    ctx.save();
    if (popping) ctx.globalAlpha = 0.35;
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