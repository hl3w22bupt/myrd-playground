/**
 * 程序化背景（资产 a03-bg-sky，generator: procedural:canvas2d）。
 * 构图脚本 L0/L1（风格卡 §3）：冷灰蓝黄昏渐变 + 2~3 道工地塔吊剪影（α0.18）+ 地平线暮色线。
 * 零外部图片；浏览器外由 renderer 降级为渐变矩形。
 */
import { PALETTE } from './palette.js';

export const HORIZON_Y = 640; // 构图脚本 L1：地平线（逻辑像素）

/** 绘制背景层（每帧调用；绘制指令极轻，无需离屏缓存） */
export function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // L0 天空渐变：暮蓝深 → 暮蓝浅
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, PALETTE.SKY_TOP);
  g.addColorStop(1, PALETTE.SKY_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // L0 远景塔吊剪影 ×3（程序化折线，α0.18，确定性几何无随机）
  ctx.save();
  ctx.strokeStyle = 'rgba(20,28,38,0.18)';
  ctx.lineWidth = 3;
  const cranes = [
    { x: width * 0.18, h: 250, arm: 90 },
    { x: width * 0.52, h: 300, arm: 120 },
    { x: width * 0.84, h: 210, arm: 70 },
  ];
  for (const c of cranes) {
    const baseY = HORIZON_Y + 20;
    ctx.beginPath();
    ctx.moveTo(c.x, baseY);
    ctx.lineTo(c.x, baseY - c.h);
    ctx.lineTo(c.x - c.arm * 0.35, baseY - c.h);
    ctx.lineTo(c.x + c.arm, baseY - c.h + 12);
    ctx.moveTo(c.x, baseY - c.h);
    ctx.lineTo(c.x + c.arm * 0.2, baseY - c.h - 26);
    ctx.stroke();
  }
  ctx.restore();

  // L1 地平线暮色线：1px，α0.4
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = PALETTE.HORIZON;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HORIZON_Y + 0.5);
  ctx.lineTo(width, HORIZON_Y + 0.5);
  ctx.stroke();
  ctx.restore();
}
