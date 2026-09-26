import { RIPPLE_DURATION } from '../kernel/numeric.js';
import { PALETTE, blockColor, layerShade, shade } from './palette.js';
import { blockFace, setBlockTileset } from './textures.js';
import { drawBackdrop } from './backdrop.js';
import { emptyAssets } from './assets.js';
export class Renderer {
    ripples = [];
    /** assets/ 实体贴图（缺项 = 程序化绘制 fallback，引用失败不破坏运行） */
    sprites = emptyAssets();
    /** 注入贴图（loadGameAssets 完成后调用一次；tileset 同步进 textures 切片层） */
    applyAssets(assets) {
        this.sprites = assets;
        setBlockTileset(assets.blockTileset ?? null);
    }
    /** 重开时清空表现层残留特效（波纹等），不触碰内核状态 */
    clearFx() {
        this.ripples = [];
    }
    /** main 翻译 tower-ripple 事件后调用；越界 duration 按名义 300 兜底并告警 */
    enqueueRipple(e, nowMs) {
        const duration = e.duration_ms;
        if (duration < RIPPLE_DURATION.MIN_MS || duration > RIPPLE_DURATION.MAX_MS) {
            console.warn(`[render] tower-ripple duration_ms=${duration} 越界 [${RIPPLE_DURATION.MIN_MS},${RIPPLE_DURATION.MAX_MS}]，按名义 ${RIPPLE_DURATION.NOMINAL_MS} 兜底`);
        }
        this.ripples.push({ levelId: e.level_id, elementId: e.element_id, windowMs: e.window_ms, durationMs: duration, startedAt: nowMs });
    }
    /** 渲染一帧：快照只读，不回写内核 */
    draw(ctx, snap, nowMs, logical) {
        // L0/L1 背景（程序化：渐变 + 塔吊剪影 + 暮色线）
        drawBackdrop(ctx, logical.width, logical.height);
        // L2 塔身（自下而上，明度按层递减）
        for (const b of snap.tower)
            this.drawBlock(ctx, b, logical, false);
        // L3 摆动块（悬停带：塔顶上方两层高）
        if (snap.moving) {
            const hover = { x: snap.moving.x, width: snap.moving.width, yIndex: snap.layers + 2 };
            const y = logical.height - (hover.yIndex + 1) * BLOCK_H;
            const moveSprite = this.sprites.blockMove;
            if (moveSprite) {
                ctx.drawImage(moveSprite, hover.x - hover.width / 2, y, hover.width, BLOCK_H);
            }
            else {
                this.drawBlock(ctx, hover, logical, true);
                this.drawBounceLight(ctx, hover, logical);
            }
            this.drawGuide(ctx, hover, logical); // L4 引导层（首局 layers<2）
        }
        // L6 tower-ripple 波纹（300±50ms 内可见，随 duration 等比扩散；无整屏闪光）
        this.ripples = this.ripples.filter((r) => nowMs - r.startedAt < r.durationMs);
        for (const r of this.ripples) {
            const t = (nowMs - r.startedAt) / r.durationMs; // 0..1
            const topBlock = snap.tower[snap.tower.length - 1];
            const cx = topBlock ? topBlock.x : logical.width / 2;
            const cy = logical.height - ((topBlock ? topBlock.yIndex : snap.layers) + 1) * BLOCK_H + BLOCK_H / 2;
            const ring = this.sprites.rippleRing;
            if (ring) {
                const w = 80 + 200 * t;
                const h = (w * ring.naturalHeight) / Math.max(1, ring.naturalWidth);
                ctx.save();
                ctx.globalAlpha = (1 - t) * 0.9;
                ctx.drawImage(ring, cx - w / 2, cy - h / 2, w, h);
                ctx.restore();
            }
            else {
                ctx.save();
                ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`;
                ctx.lineWidth = 2 * (1 - t) + 0.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 40 + 120 * t, 12 + 36 * t, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            // 完美切面脉冲（风格卡 §1 特殊时刻光：白色切面描边脉冲；无贴图则不加光源）
            const pulse = this.sprites.perfectPulse;
            if (pulse && topBlock) {
                const px = topBlock.x - topBlock.width / 2;
                const py = logical.height - (topBlock.yIndex + 1) * BLOCK_H;
                ctx.save();
                ctx.globalAlpha = (1 - t) * 0.85;
                ctx.drawImage(pulse, px, py, topBlock.width, BLOCK_H);
                ctx.restore();
            }
        }
        // 掉落碎块（纯装饰；内核只给初始姿态）
        for (const d of snap.debris)
            this.drawDebris(ctx, d, logical);
        // L5 HUD 顶部安全区渐隐衬底（贴图缺项 = 无衬底，DOM 白字深描边已可读）
        const scrim = this.sprites.hudScrim;
        if (scrim)
            ctx.drawImage(scrim, 0, 0, logical.width, 56);
    }
    drawBlock(ctx, b, logical, moving) {
        const h = BLOCK_H;
        const y = logical.height - (b.yIndex + 1) * h;
        const hex = blockColor(b.yIndex);
        // e01 塔基块贴图（首块专用；缺项回 blockFace → tileset 切片 → 程序化画布）
        const base = this.sprites.blockBase;
        if (!moving && b.yIndex === 0 && base) {
            ctx.drawImage(base, b.x - b.width / 2, y, b.width, h);
        }
        else {
            const face = blockFace(hex, b.width, h);
            if (face) {
                ctx.drawImage(face.canvas, b.x - b.width / 2, y);
            }
            else {
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
    drawBounceLight(ctx, b, logical) {
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
    drawGuide(ctx, hover, logical) {
        if (hover.yIndex < 2)
            return;
        const topY = logical.height - hover.yIndex * BLOCK_H;
        const baseTopY = logical.height - BLOCK_H;
        if (baseTopY - topY < 4)
            return;
        const guide = this.sprites.guide;
        ctx.save();
        ctx.globalAlpha = 0.3;
        if (guide) {
            ctx.drawImage(guide, hover.x - guide.naturalWidth / 2, topY, guide.naturalWidth, baseTopY - topY);
        }
        else {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(hover.x, topY + 2);
            ctx.lineTo(hover.x, baseTopY - 2);
            ctx.stroke();
        }
        ctx.restore();
    }
    drawDebris(ctx, d, logical) {
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
