// e-render — Canvas 2D 渲染层：只读 theme.ts token（ac-art-3 单源）；
// 双层平涂 + 2px 描边 + 零渐变（风格卡 v1②③）· 20×12 逻辑面等比适配（view 缩放外置）
// spec: entities/e-render · scene: src/scene/battlefield.ts
// ctx 为最小绘图接口（真 Canvas 与 headless stub 同构 → 帧采样面 a4 可机判）。

                                                                
import { PALETTE, STROKE, PATH_ARROW, SCALE, turretColor, enemyHpColor, flashMix, FONT } from "./theme.mjs";
import { GUIDANCE } from "./guidance.mjs";
import { PATH_SEGMENTS, PATH_WAYPOINTS, CORE_TILES, pointAt } from "../world/grid.mjs";

                                                                                         

                          
                                                     
                                                      
                   
 

                            
                                                             
                                                               
                                                                                            
                                                                     
                                                  
                                                  
                                 
                                                                                                          
                                                                                                                                   
 

/** 主渲染入口：逻辑面 640×384 → view 缩放（外层已 translate/scale 则 view=identity） */
export function render(ctx           , view      , state                 , ui         , phase                                 , cfg            )       {
  ctx.save();
  ctx.translate(view.offX, view.offY);
  ctx.scale(view.scale, view.scale);
  drawField(ctx);
  drawPath(ctx);
  if (state) {
    drawTurrets(ctx, state, ui, cfg);
    drawEnemies(ctx, state, cfg);
    drawTraces(ctx, state);
    drawParticles(ctx, state);
    drawCore(ctx, state);
    drawRangeCircle(ctx, state, ui, cfg);
    drawGuidanceHint(ctx, state, phase);
    if (phase === "title") drawTitle(ctx);
    if (phase === "settled") drawSettlement(ctx, state);
    if (ui.showHud && phase !== "title") drawHud(ctx, state, cfg);
    drawMenus(ctx, state, ui, cfg);
  }
  ctx.restore();
}

function drawField(ctx           )       {
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(0, 0, SCALE.cols * SCALE.cellPx, SCALE.rows * SCALE.cellPx);
  ctx.fillStyle = PALETTE.field;
  ctx.fillRect(0, 0, SCALE.cols * SCALE.cellPx, SCALE.rows * SCALE.cellPx);
  ctx.strokeStyle = PALETTE.gridLine;
  ctx.lineWidth = 1;
  for (let c = 0; c <= SCALE.cols; c += 1) {
    ctx.beginPath(); ctx.moveTo(c * SCALE.cellPx, 0); ctx.lineTo(c * SCALE.cellPx, SCALE.rows * SCALE.cellPx); ctx.stroke();
  }
  for (let r = 0; r <= SCALE.rows; r += 1) {
    ctx.beginPath(); ctx.moveTo(0, r * SCALE.cellPx); ctx.lineTo(SCALE.cols * SCALE.cellPx, r * SCALE.cellPx); ctx.stroke();
  }
}

/** 敌军路径：暖沙宽带 + 常显虚线箭头（4px text-cream 60%） */
function drawPath(ctx           )       {
  ctx.strokeStyle = PALETTE.pathSand;
  ctx.lineWidth = 16;
  ctx.lineCap = "butt";
  for (const seg of PATH_SEGMENTS) {
    ctx.beginPath(); ctx.moveTo(seg.a.x, seg.a.y); ctx.lineTo(seg.b.x, seg.b.y); ctx.stroke();
  }
  ctx.strokeStyle = PALETTE.textCream;
  ctx.lineWidth = PATH_ARROW.widthPx;
  ctx.globalAlpha = PATH_ARROW.alpha;
  ctx.setLineDash(PATH_ARROW.dash ? [8, 6] : []);
  for (const seg of PATH_SEGMENTS) {
    ctx.beginPath(); ctx.moveTo(seg.a.x, seg.a.y); ctx.lineTo(seg.b.x, seg.b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawTurrets(ctx           , state          , ui         , cfg            )       {
  for (const t of state.turrets) {
    const size = SCALE.turretPx[t.level - 1] ?? 24;
    const bounce = state.fx.placeTicksLeft > 0 || (state.fx.upgradeTicksLeft > 0 && state.fx.upgradeTurretId === t.id);
    const s = bounce ? size * 1.15 : size;
    ctx.fillStyle = turretColor(t.level);
    ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
    ctx.strokeStyle = PALETTE.bgDeep;
    ctx.lineWidth = STROKE.widthPx;
    ctx.strokeRect(t.x - s / 2, t.y - s / 2, s, s);
    // 等级星标（path-upgrade-turret-01 视觉锚：星标+1）
    ctx.fillStyle = PALETTE.textCream;
    ctx.font = `${FONT.panel}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("★".repeat(t.level), t.x, t.y - s / 2 - 4);
  }
}

function drawEnemies(ctx           , state          , cfg            )       {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const p = pointAt(e.pathDistPx);
    let fill = enemyHpColor(e.hp / e.maxHp);
    const fl = state.fx.hitFlashes.find((f) => f.enemyId === e.id);
    if (fl) {
      const total = Math.max(1, Math.round(cfg.feedback.hitFlashMs / cfg.fixedStepMs));
      fill = flashMix(fill, fl.ticksLeft / total);
    }
    ctx.fillStyle = fill;
    ctx.fillRect(p.x - e.sizePx / 2, p.y - e.sizePx / 2, e.sizePx, e.sizePx);
    ctx.strokeStyle = PALETTE.bgDeep;
    ctx.lineWidth = STROKE.widthPx;
    ctx.strokeRect(p.x - e.sizePx / 2, p.y - e.sizePx / 2, e.sizePx, e.sizePx);
    // 血量带（满/残两态色：enemyHpMix 派生面）
    if (e.hp < e.maxHp) {
      ctx.fillStyle = PALETTE.bgDeep;
      ctx.fillRect(p.x - e.sizePx / 2, p.y - e.sizePx / 2 - 6, e.sizePx, 3);
      ctx.fillStyle = enemyHpColor(e.hp / e.maxHp);
      ctx.fillRect(p.x - e.sizePx / 2, p.y - e.sizePx / 2 - 6, (e.sizePx * e.hp) / e.maxHp, 3);
    }
  }
}

function drawTraces(ctx           , state          )       {
  ctx.strokeStyle = PALETTE.textCream;
  ctx.lineWidth = 2;
  for (const t of state.fx.traces) {
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
}

function drawParticles(ctx           , state          )       {
  ctx.fillStyle = PALETTE.textCream;
  for (const p of state.fx.particles) ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
}

function drawCore(ctx           , state          )       {
  const [cc, cr] = CORE_TILES[0];
  const x = cc * SCALE.cellPx, y = cr * SCALE.cellPx, s = SCALE.coreCells * SCALE.cellPx;
  const flash = state.fx.coreFlashTicks > 0;
  ctx.fillStyle = PALETTE.coreCoral;
  ctx.globalAlpha = flash ? 1 : 0.85;
  ctx.fillRect(x, y, s, s);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.bgDeep;
  ctx.lineWidth = STROKE.widthPx;
  ctx.strokeRect(x, y, s, s);
  ctx.fillStyle = PALETTE.textCream;
  ctx.font = `${FONT.hud}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(state.coreLives), x + s / 2, y + s / 2 + 6);
}

/** 射程圈：待放置格/选中炮塔显现（虚线圆——a1/path-place 视觉锚） */
function drawRangeCircle(ctx           , state          , ui         , cfg            )       {
  let cx                = null, cy                = null, rTiles = 0;
  if (ui.pendingTile) {
    const [c, r] = ui.pendingTile.split(",").map(Number);
    const p = { x: (c + 0.5) * SCALE.cellPx, y: (r + 0.5) * SCALE.cellPx };
    cx = p.x; cy = p.y; rTiles = cfg.turret.rangeTilesBase;
  } else if (ui.selectedTurretId !== null) {
    const t = state.turrets.find((x) => x.id === ui.selectedTurretId);
    if (t) { cx = t.x; cy = t.y; rTiles = cfg.turret.rangeTilesBase + cfg.turret.rangeGrowthPerLevel * (t.level - 1); }
  }
  if (cx === null) return;
  ctx.strokeStyle = PALETTE.textCream;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, rTiles * SCALE.cellPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** 引导浮层：未消散时 bg-deep 70% 覆层 + copy-hint-place 逐字（hint_shown.text 同源） */
function drawGuidanceHint(ctx           , state          , phase        )       {
  if (state.fx.guidanceHidden && state.fx.guidanceFadeTicks <= 0) return;
  ctx.globalAlpha = state.fx.guidanceHidden ? (state.fx.guidanceFadeTicks / 12) * 0.7 : 0.7;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(0, 0, SCALE.cols * SCALE.cellPx, SCALE.rows * SCALE.cellPx);
  ctx.globalAlpha = 1;
  if (phase !== "title") {
    ctx.fillStyle = PALETTE.textCream;
    ctx.font = `${FONT.hud}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(GUIDANCE["copy-hint-place"], SCALE.cols * SCALE.cellPx / 2, SCALE.rows * SCALE.cellPx / 2);
  }
}

function drawTitle(ctx           )       {
  const w = SCALE.cols * SCALE.cellPx, h = SCALE.rows * SCALE.cellPx;
  ctx.fillStyle = PALETTE.textCream;
  ctx.font = `32px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(GUIDANCE["copy-title"], w / 2, h / 2 - 48);
  ctx.font = `${FONT.hud}px sans-serif`;
  ctx.fillText(GUIDANCE["copy-subtitle"], w / 2, h / 2 - 16);
  ctx.fillText(GUIDANCE["copy-hint-place"], w / 2, h / 2 + 16);
  ctx.fillStyle = PALETTE.turretGreen;
  ctx.fillRect(w / 2 - 72, h / 2 + 40, 144, 40);
  ctx.strokeStyle = PALETTE.bgDeep;
  ctx.lineWidth = STROKE.widthPx;
  ctx.strokeRect(w / 2 - 72, h / 2 + 40, 144, 40);
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.font = `${FONT.hud}px sans-serif`;
  ctx.fillText(GUIDANCE["copy-start"], w / 2, h / 2 + 65);
}

/** 结算面板：中央 320×200（风格卡④）；三信息 = 结果标题 + 核心生命 + 军费 */
function drawSettlement(ctx           , state          )       {
  const w = SCALE.cols * SCALE.cellPx, h = SCALE.rows * SCALE.cellPx;
  const fade = state.fx.settlementFadeTicks > 0 ? state.fx.settlementFadeTicks / 12 : 0;
  if (fade > 0) ctx.globalAlpha = 1 - fade * 0.5;
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillRect(w / 2 - 160, h / 2 - 100, 320, 200);
  ctx.strokeStyle = PALETTE.textCream;
  ctx.lineWidth = STROKE.widthPx;
  ctx.strokeRect(w / 2 - 160, h / 2 - 100, 320, 200);
  ctx.fillStyle = PALETTE.textCream;
  ctx.font = `24px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(state.status === "victory" ? GUIDANCE["copy-result-win"] : GUIDANCE["copy-result-lose"], w / 2, h / 2 - 48);
  ctx.font = `${FONT.hud}px sans-serif`;
  ctx.fillText(`${GUIDANCE["copy-core-label"]} ${state.coreLives} · ${GUIDANCE["copy-gold-label"]} ${state.gold}`, w / 2, h / 2 - 8);
  ctx.fillStyle = PALETTE.turretGreen;
  ctx.fillRect(w / 2 - 72, h / 2 + 24, 144, 40);
  ctx.strokeRect(w / 2 - 72, h / 2 + 24, 144, 40);
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.fillText(GUIDANCE["copy-restart"], w / 2, h / 2 + 49);
  ctx.globalAlpha = 1;
}

function drawHud(ctx           , state          , cfg            )       {
  const w = SCALE.cols * SCALE.cellPx;
  ctx.fillStyle = PALETTE.textCream;
  ctx.font = `${FONT.hud}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`${GUIDANCE["copy-core-label"]} ${state.coreLives}`, SCALE.uiPadPx, 24);
  ctx.fillText(`${GUIDANCE["copy-gold-label"]} ${state.gold}`, SCALE.uiPadPx + 96, 24);
  ctx.fillText(`${GUIDANCE["copy-wave-label"]} ${state.waveIndex}/${cfg.victoryWaves}`, SCALE.uiPadPx + 208, 24);
  // 加速按钮（path-speed-toggle-01 视觉锚：态色块 grid-line↔turret-green）
  ctx.fillStyle = state.speed === 2 ? PALETTE.turretGreen : PALETTE.gridLine;
  ctx.fillRect(w - 88, 8, 72, 28);
  ctx.strokeStyle = PALETTE.bgDeep;
  ctx.lineWidth = STROKE.widthPx;
  ctx.strokeRect(w - 88, 8, 72, 28);
  ctx.fillStyle = PALETTE.bgDeep;
  ctx.font = `${FONT.panel}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${GUIDANCE["copy-speed-label"]} ×${state.speed}`, w - 52, 27);
  // HUD 击杀跳动（a4 通道 hud-jump：killPulse 期放大重绘一次）
  if (state.fx.killPulseTicks > 0) {
    ctx.fillStyle = PALETTE.textCream;
    ctx.font = `${FONT.hud + 4}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${GUIDANCE["copy-gold-label"]} ${state.gold}`, SCALE.uiPadPx + 96, 24);
  }
}

/** 放置/升级菜单（path-place/upgrade 二步确认面） */
function drawMenus(ctx           , state          , ui         , cfg            )       {
  const w = SCALE.cols * SCALE.cellPx, h = SCALE.rows * SCALE.cellPx;
  ctx.font = `${FONT.panel}px sans-serif`;
  ctx.textAlign = "center";
  if (ui.pendingTile) {
    ctx.fillStyle = PALETTE.bgDeep;
    ctx.fillRect(w / 2 - 90, h - 56, 180, 40);
    ctx.strokeStyle = PALETTE.textCream;
    ctx.lineWidth = STROKE.widthPx;
    ctx.strokeRect(w / 2 - 90, h - 56, 180, 40);
    ctx.fillStyle = PALETTE.textCream;
    ctx.fillText(`${GUIDANCE["copy-start"]}（${GUIDANCE["copy-gold-label"]} ${cfg.turret.costPlace}）`, w / 2, h - 32);
  } else if (ui.selectedTurretId !== null) {
    const t = state.turrets.find((x) => x.id === ui.selectedTurretId);
    if (t && t.level < cfg.turret.levels) {
      const cost = Math.round(cfg.turret.costUpgradeBase * Math.pow(cfg.turret.costUpgradeGrowth, t.level - 1));
      ctx.fillStyle = PALETTE.bgDeep;
      ctx.fillRect(w / 2 - 90, h - 56, 180, 40);
      ctx.strokeStyle = PALETTE.textCream;
      ctx.lineWidth = STROKE.widthPx;
      ctx.strokeRect(w / 2 - 90, h - 56, 180, 40);
      ctx.fillStyle = PALETTE.textCream;
      ctx.fillText(`${GUIDANCE["copy-hint-upgrade"]}（${GUIDANCE["copy-gold-label"]} ${cost}）`, w / 2, h - 32);
    }
  }
}

/** 路径折点导出（供 view/输入换算复用；本文件不计算布局） */
export const PATH_POINTS = PATH_WAYPOINTS;
