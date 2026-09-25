/**
 * Canvas2D 表现层 — 只做「内核快照 → 画布」映射，零玩法逻辑。
 * tower-ripple 波纹是 perfect 反馈的唯一表现形态（T1 必改②：禁止整屏 aha/闪屏）。
 */
import type { Snapshot } from '../kernel/types.js';
import { RIPPLE_DURATION } from '../kernel/numeric.js';

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

  /** main 翻译 tower-ripple 事件后调用；越界 duration 按名义 300 兜底并告警 */
  enqueueRipple(e: { level_id: string; element_id: string; window_ms: number; duration_ms: number }, nowMs: number): void {
    const duration = e.duration_ms;
    if (duration < RIPPLE_DURATION.MIN_MS || duration > RIPPLE_DURATION.MAX_MS) {
      console.warn(`[render] tower-ripple duration_ms=${duration} 越界 [${RIPPLE_DURATION.MIN_MS},${RIPPLE_DURATION.MAX_MS}]，按名义 ${RIPPLE_DURATION.NOMINAL_MS} 兜底`);
    }
    this.ripples.push({ levelId: e.level_id, elementId: e.element_id, windowMs: e.window_ms, durationMs: duration, startedAt: nowMs });
  }

  /** 渲染一帧：快照只读，不回写内核 */
  draw(ctx: CanvasRenderingContext2D, snap: Snapshot, nowMs: number, logical: { width: number; height: number }): void {
    // 1) 天空（程序化渐变，风格卡 v0：冷灰蓝黄昏）
    this.drawSky(ctx, logical);
    // 2) 塔身（自下而上，亮度按层递减）
    for (const b of snap.tower) this.drawBlock(ctx, b.x, b.width, b.yIndex, logical);
    // 3) 摆动块
    if (snap.moving) this.drawBlock(ctx, snap.moving.x, snap.moving.width, snap.layers, logical, true);
    // 4) tower-ripple 波纹（300±50ms 内可见，随 duration 等比扩散）
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
    // 5) 掉落碎块（重力表现，纯装饰）
    for (const d of snap.debris) this.drawDebris(ctx, d, logical);
  }

  private drawSky(ctx: CanvasRenderingContext2D, logical: { width: number; height: number }): void {
    const g = ctx.createLinearGradient(0, 0, 0, logical.height);
    g.addColorStop(0, '#2b3a4d');
    g.addColorStop(1, '#8a97a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, logical.width, logical.height);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, width: number, yIndex: number, logical: { width: number; height: number }, moving = false): void {
    const h = BLOCK_H;
    const y = logical.height - (yIndex + 1) * h;
    const palette = ['#c96f3b', '#a84a32', '#d9a441'];
    const shade = moving ? 1 : Math.max(0.55, 1 - yIndex * 0.02); // 风格卡：越低越暗（8%/层的近似）
    ctx.fillStyle = shadeColor(palette[yIndex % palette.length]!, shade);
    ctx.fillRect(x - width / 2, y, width, h - 1);
    // 切面高亮描边（1px 白，风格卡 v0 对比度策略）
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2 + 0.5, y + 0.5, width - 1, h - 2);
  }

  private drawDebris(ctx: CanvasRenderingContext2D, d: { x: number; width: number; yIndex: number; dir: 1 | -1 }, logical: { height: number }): void {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(d.x - d.width / 2, logical.height - (d.yIndex + 1) * BLOCK_H, d.width, BLOCK_H - 1);
  }
}

export const BLOCK_H = 28; // 表现层块高（逻辑像素）；不影响内核判定

function shadeColor(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}
