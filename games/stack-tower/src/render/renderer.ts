/**
 * Canvas2D 表现层 — 只做「内核快照 → 画布」映射，零玩法逻辑。
 * tower-ripple 波纹是 perfect 反馈的唯一表现形态（T1 必改②：禁止整屏 aha/闪屏）。
 * 色值一律取自 render/palette（情绪板 8 色同源）；块面贴图来自 render/textures；
 * 背景来自 render/backdrop。
 */
import type { Snapshot, PlacedBlock, DebrisSpec } from '../kernel/types.js';
import { PALETTE, blockColor, layerShade, shade } from './palette.js';
import { NEON } from './theme.js';
import { createRippleRenderer } from './ripple-renderer.js';
import { blockFace, setBlockTileset } from './textures.js';
import { drawBackdrop } from './backdrop.js';
import { emptyAssets, type GameAssets, type GameImage } from './assets.js';

export class Renderer {
  /** tower-ripple 表现层订阅者（e-ripple-renderer：池 ≤200 + additive + 异常隔离） */
  private ripples = createRippleRenderer();
  /** 池观测出口（acc-j2 / 测试用） */
  get ripplePool() {
    return { alive: this.ripples.aliveCount, capacity: this.ripples.capacity };
  }
  /** assets/ 实体贴图（缺项 = 程序化绘制 fallback，引用失败不破坏运行） */
  private sprites: GameAssets = emptyAssets();

  /** 注入贴图（loadGameAssets 完成后调用一次；tileset 同步进 textures 切片层） */
  applyAssets(assets: GameAssets): void {
    this.sprites = assets;
    setBlockTileset(assets.blockTileset ?? null);
  }

  /** 重开时清空表现层残留特效（波纹等），不触碰内核状态 */
  clearFx(): void {
    this.ripples.clear();
  }

  /** main 翻译 tower-ripple 事件后调用；越界 duration 按名义 300 兜底并告警 */
  enqueueRipple(e: { level_id: string; element_id: string; window_ms: number; duration_ms: number }, nowMs: number): void {
    this.ripples.enqueue(e.duration_ms, nowMs);
  }

  /** 渲染一帧：快照只读，不回写内核 */
  draw(ctx: CanvasRenderingContext2D, snap: Snapshot, nowMs: number, logical: { width: number; height: number }): void {
    // L0/L1 背景（程序化：渐变 + 塔吊剪影 + 暮色线）
    drawBackdrop(ctx, logical.width, logical.height);
    // L2 塔身（自下而上，明度按层递减）
    for (const b of snap.tower) this.drawBlock(ctx, b, logical, false);
    // L3 摆动块（悬停带：塔顶上方两层高）
    if (snap.moving) {
      // e09 开局摆位后物理塔顶 ≠ snap.layers（玩家层数，不含预置块）：悬停带必须锚物理塔顶，
      // 否则摆动块/引导线穿进开场预置块（v1.2 部署版回归：悬停带落在塔身内部）
      const topBlock = snap.tower[snap.tower.length - 1];
      const hover: PlacedBlock = { x: snap.moving.x, width: snap.moving.width, yIndex: (topBlock ? topBlock.yIndex : snap.layers) + 2 };
      const y = logical.height - (hover.yIndex + 1) * BLOCK_H;
      const moveSprite = this.sprites.blockMove;
      if (moveSprite) {
        ctx.drawImage(moveSprite, hover.x - hover.width / 2, y, hover.width, BLOCK_H);
      } else {
        this.drawBlock(ctx, hover, logical, true);
        this.drawBounceLight(ctx, hover, logical);
      }
      this.drawGuide(ctx, hover, logical, topBlock ? topBlock.yIndex : snap.layers); // L4 引导层（首局 layers<2）
    }
    // L6 tower-ripple 波纹（e-ripple-renderer：池 ≤200 颗 + additive 合成 + 异常隔离；
    // duration 300±50ms 内可见，随 duration 等比扩散；无整屏闪光）
    {
      const topBlock = snap.tower[snap.tower.length - 1];
      const cx = topBlock ? topBlock.x : logical.width / 2;
      const cy = logical.height - ((topBlock ? topBlock.yIndex : snap.layers) + 1) * BLOCK_H + BLOCK_H / 2;
      const drawn = this.ripples.draw(ctx, nowMs, cx, cy, 1);
      if (drawn < 0) console.info('[render] ripple draw 异常已隔离');
    }
    // 掉落碎块（纯装饰；内核只给初始姿态）
    for (const d of snap.debris) this.drawDebris(ctx, d, logical);
    // L5 HUD 顶部安全区渐隐衬底（贴图缺项 = 无衬底，DOM 白字深描边已可读）
    const scrim = this.sprites.hudScrim;
    if (scrim) ctx.drawImage(scrim, 0, 0, logical.width, 56);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, b: PlacedBlock, logical: { width: number; height: number }, moving: boolean): void {
    const h = BLOCK_H;
    const y = logical.height - (b.yIndex + 1) * h;
    const hex = blockColor(b.yIndex);
    // e01 塔基块贴图（首块专用；缺项回 blockFace → tileset 切片 → 程序化画布）
    const base = this.sprites.blockBase;
    if (!moving && b.yIndex === 0 && base) {
      ctx.drawImage(base, b.x - b.width / 2, y, b.width, h);
    } else {
      const face = blockFace(hex, b.width, h);
      if (face) {
        ctx.drawImage(face.canvas, b.x - b.width / 2, y);
      } else {
        const f = moving ? 1 : layerShade(b.yIndex);
        ctx.fillStyle = shade(hex, f);
        ctx.fillRect(b.x - b.width / 2, y, b.width, h - 1);
      }
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

  /** L4 引导层（风格卡 §3）：首局 layers<2 时摆块正下方落点虚线；2 次落块后随 layers≥2 自动消失 */
  private drawGuide(ctx: CanvasRenderingContext2D, hover: PlacedBlock, logical: { width: number; height: number }, topYIndex: number): void {
    if (hover.yIndex < 2) return;
    const topY = logical.height - hover.yIndex * BLOCK_H;
    const baseTopY = logical.height - (topYIndex + 1) * BLOCK_H; // 落点面 = 物理塔顶上表面（e09 后 ≠ 塔基顶）
    if (baseTopY - topY < 4) return;
    const guide = this.sprites.guide;
    ctx.save();
    ctx.globalAlpha = 0.3;
    if (guide) {
      ctx.drawImage(guide, hover.x - guide.naturalWidth / 2, topY, guide.naturalWidth, baseTopY - topY);
    } else {
      ctx.strokeStyle = NEON.CUT_FACE;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(hover.x, topY + 2);
      ctx.lineTo(hover.x, baseTopY - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDebris(ctx: CanvasRenderingContext2D, d: DebrisSpec, logical: { height: number }): void {
    const y = logical.height - (d.yIndex + 1) * BLOCK_H;
    const debris = this.sprites.debris;
    if (debris) {
      ctx.drawImage(debris, d.x - d.width / 2, y, d.width, BLOCK_H);
      return;
    }
    ctx.fillStyle = PALETTE.DEBRIS;
    ctx.fillRect(d.x - d.width / 2, y, d.width, BLOCK_H - 1);
  }
}

export const BLOCK_H = 28; // 表现层块高（逻辑像素）；不影响内核判定
