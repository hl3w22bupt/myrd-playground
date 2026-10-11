// render/renderer.ts — 几何渲染（wheat-squad · spec e-renderer 落点）
//
// 纪律：零外部贴图（tex-1，沿 g2-blocks ac-13）；一切形状 = 纯几何 + theme token；
// 麦浪底纹 = 程序化正弦条带（零贴图的「麦浪感」替代面）。
                                                 
import { THEME } from './theme.mjs';

                                                

export function computeLayout(w        , h        )         {
  return { w, h };
}

/** 麦浪田底：奶油天 + 正弦麦浪条带（两层视差，纯几何） */
export function drawField(ctx                          , L        , tick        )       {
  ctx.fillStyle = THEME.skyCream;
  ctx.fillRect(0, 0, L.w, L.h);
  for (let band = 0; band < 2; band += 1) {
    ctx.fillStyle = band === 0 ? THEME.fieldGreen : THEME.fieldDeep;
    ctx.globalAlpha = band === 0 ? 0.35 : 0.5;
    const baseY = L.h * (0.55 + band * 0.22);
    const amp = 10 + band * 6;
    const shift = ((tick * (0.4 + band * 0.2)) % 64);
    ctx.beginPath();
    ctx.moveTo(0, L.h);
    for (let x = 0; x <= L.w; x += 16) {
      ctx.lineTo(x, baseY + Math.sin((x + shift) / 48) * amp);
    }
    ctx.lineTo(L.w, L.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 害虫（几何甲虫：椭圆身 + 头点；hit flash = accentRed 描边高亮） */
export function drawPests(ctx                          , st          )       {
  for (const p of st.pests) {
    const flashing = st.tick <= p.flashUntilTick;
    ctx.fillStyle = flashing ? THEME.accentRed : THEME.pestBrown;
    ctx.beginPath();
    ctx.ellipse(p.pos.x, p.pos.y, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.inkBrown;
    ctx.beginPath();
    ctx.arc(p.pos.x + 6, p.pos.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 队长（wheatGold 高亮圈常显 = level-1/el-warmup 操作锚可见性）+ 队员（小圆） */
export function drawSquad(ctx                          , st          )       {
  ctx.strokeStyle = THEME.wheatDeep;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(st.captain.pos.x, st.captain.pos.y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = THEME.wheatGold;
  ctx.beginPath();
  ctx.arc(st.captain.pos.x, st.captain.pos.y, 10, 0, Math.PI * 2);
  ctx.fill();
  for (const m of st.mates) {
    ctx.fillStyle = THEME.wheatDeep;
    ctx.beginPath();
    ctx.arc(m.pos.x, m.pos.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 麦粒弹 + 麦穗 pickup + 击杀 flash/粒子（反馈面） */
export function drawEffects(ctx                          , st          )       {
  ctx.fillStyle = THEME.wheatDeep;
  for (const b of st.bullets) {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pk of st.pickups) {
    ctx.fillStyle = THEME.wheatGold;
    ctx.fillRect(pk.pos.x - 3, pk.pos.y - 4, 6, 8);
  }
  for (const f of st.flashes) {
    const life = (f.endTick - st.tick) / Math.max(1, f.endTick - f.bornTick);
    ctx.globalAlpha = Math.max(0, Math.min(1, life));
    ctx.strokeStyle = THEME.accentRed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 12 + (1 - life) * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = THEME.wheatGold;
  for (const p of st.particles) {
    ctx.fillRect(p.pos.x - 2, p.pos.y - 2, 4, 4);
  }
}

/** HUD：HP 心形点 + 波次/击杀/时长（inkBrown 文字，system-ui 零字体资产） */
export function drawHud(ctx                          , L        , st          )       {
  ctx.fillStyle = THEME.inkBrown;
  ctx.font = '600 14px system-ui, sans-serif';
  const sec = Math.floor((st.tick * st.cfg.stepMs) / 1000);
  ctx.fillText(`第${st.waveIndex}浪 · 击杀 ${st.kills} · ${sec}s`, 12, 22);
  for (let i = 0; i < st.captain.hp; i += 1) {
    ctx.fillStyle = THEME.accentRed;
    ctx.beginPath();
    ctx.arc(L.w - 16 - i * 16, 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (st.inRest) {
    ctx.fillStyle = THEME.fieldDeep;
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(`喘息 ${Math.ceil(st.waveTimerMs / 1000)}s · 下一浪更密`, L.w / 2 - 60, L.h - 14);
  }
}
