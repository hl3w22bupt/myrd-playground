/**
 * Canvas2D 表现层 — 只做「内核快照 → 画布」映射，零玩法逻辑。
 * tower-ripple 波纹是 perfect 反馈的唯一表现形态（T1 必改②：禁止整屏 aha/闪屏）。
 * 色值一律取自 render/palette（情绪板 8 色同源）；块面贴图来自 render/textures；
 * 背景来自 render/backdrop。
 */
import type { Snapshot, PlacedBlock, DebrisSpec } from '../kernel/types.js';
import { RIPPLE_DURATION } from '../kernel/numeric.js';
import { PALETTE, blockColor, layerShade, shade } from './palette.js';
import { blockFace } from './textures.js';
import { drawBackdrop } from './backdrop.js';

interface RippleFx {
  levelId: string;
  elementId: string;
  windowMs: number;
  durationMs: number;
  /** 表现层本地接收时刻（表现时钟，非内核仿真时间） */
  startedAt: number;
}

export class Renderer {
  private ripples: RippleFx[] = [];

  /** 重开时清空表现层残留特效（波纹等），不触碰内核状态 */
  clearFx(): void {
    this.ripples = [];
  }

  /** main 翻译 tower-ripple 事件后调用；越界 duration 按名义 300 兜底并告警 */
  enqueueRipple(e: { level_id: string; element_id: string; window_ms: number; duration_ms: number }, nowMs: number): void {
    const duration = e.duration_ms;
    if (duration < RIPPLE_DURATION.MIN_MS || duration > RIPPLE_DURATION.MAX_MS) {
      console.warn(
        `[render] tower-ripple duration_ms=${duration} 越界 [${RIPPLE_DURATION.MIN_MS},${RIPPLE_DURATION.MAX_MS}]，按名义 ${RIPPLE_DURATION.NOMINAL_MS} 兜底`,
      );
    }
    this.ripples.push({ levelId: e.level_id, elementId: e.element_id, windowMs: e.window_ms, durationMs: duration, startedAt: nowMs });
  }

  /** 渲染一帧：快照只读，不回写内核 */
  draw(ctx: CanvasRenderingContext2D, snap: Snapshot, nowMs: number, logical: { width: number; height: number }): void {
    // L0/L1 背景（程序化：渐变 + 塔吊剪影 + 暮色线）
    drawBackdrop(ctx, logical.width, logical.height);
    // L2 塔身（自下而上，明度按层递减）
    for (const b of snap.tower) this.drawBlock(ctx, b, logical, false);
    // L3 摆动块（悬停带：塔顶上方两层高）
    if (snap.moving) {
      const hover: PlacedBlock = { x: snap.moving.x, width: snap.moving.width, yIndex: snap.layers + 2 };
      this.drawBlock(ctx, hover, logical, true);
      this.drawBounceLight(ctx, hover, logical);
    }
    // L6 tower-ripple 波纹（300±50ms 内可见，随 duration 等比扩散；无整屏闪光）
    this.ripples = this.ripples.filter((r) => nowMs - r.startedAt < r.durationMs);
    for (const r of this.ripples) {
      const t = (nowMs - r.startedAt) / r.durationMs; // 0..1
      const topBlock = snap.tower[snap.tower.length - 1];
      const cx = topBlock ? topBlock.x : logical.width / 2;
      const cy = logical.height - ((topBlock ? topBlock.yIndex : snap.layers) + 1) * BLOCK_H + BLOCK_H / 2;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`;
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40 + 120 * t, 12 + 36 * t, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 掉落碎块（纯装饰；内核只给初始姿态）
    for (const d of snap.debris) this.drawDebris(ctx, d, logical);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, b: PlacedBlock, logical: { width: number; height: number }, moving: boolean): void {
    const h = BLOCK_H;
    const y = logical.height - (b.yIndex + 1) * h;
    const hex = blockColor(b.yIndex);
    const face = blockFace(hex, b.width, h);
    if (face) {
      ctx.drawImage(face.canvas, b.x - b.width / 2, y);
    } else {
      const f = moving ? 1 : layerShade(b.yIndex);
      ctx.fillStyle = shade(hex, f);
      ctx.fillRect(b.x - b.width / 2, y, b.width, h - 1);
    }
    // 切面高亮描边（1px 白，判定物）
    ctx.strokeStyle = PALETTE.FACE_HIGHLIGHT;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x - b.width / 2 + 0.5, y + 0.5, b.width - 1, h - 2);
  }

  /** 摆动块下缘冷灰蓝反弹光（风格卡 §1：把待落块从背景托出） */
  private drawBounceLight(ctx: CanvasRenderingContext2D, b: PlacedBlock, logical: { width: number; height: number }): void {
    const y = logical.height - (b.yIndex + 1) * BLOCK_H + BLOCK_H - 1;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = PALETTE.SKY_BOTTOM;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.width / 2 + 2, y);
    ctx.lineTo(b.x + b.width / 2 - 2, y);
    ctx.stroke();
    ctx.restore();
  }

  private drawDebris(ctx: CanvasRenderingContext2D, d: DebrisSpec, logical: { height: number }): void {
    ctx.fillStyle = PALETTE.DEBRIS;
    ctx.fillRect(d.x - d.width / 2, logical.height - (d.yIndex + 1) * BLOCK_H, d.width, BLOCK_H - 1);
  }
}

export const BLOCK_H = 28; // 表现层块高（逻辑像素）；不影响内核判定
