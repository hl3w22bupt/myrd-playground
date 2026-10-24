"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOCK_H = exports.Renderer = void 0;
const palette_js_1 = require("./palette.js");
const theme_js_1 = require("./theme.js");
const ripple_renderer_js_1 = require("./ripple-renderer.js");
const textures_js_1 = require("./textures.js");
const backdrop_js_1 = require("./backdrop.js");
const assets_js_1 = require("./assets.js");
class Renderer {
    /** tower-ripple 表现层订阅者（e-ripple-renderer：池 ≤200 + additive + 异常隔离） */
    ripples = (0, ripple_renderer_js_1.createRippleRenderer)();
    /** 池观测出口（acc-j2 / 测试用） */
    get ripplePool() {
        return { alive: this.ripples.aliveCount, capacity: this.ripples.capacity };
    }
    /** assets/ 实体贴图（缺项 = 程序化绘制 fallback，引用失败不破坏运行） */
    sprites = (0, assets_js_1.emptyAssets)();
    /** 注入贴图（loadGameAssets 完成后调用一次；tileset 同步进 textures 切片层） */
    applyAssets(assets) {
        this.sprites = assets;
        (0, textures_js_1.setBlockTileset)(assets.blockTileset ?? null);
    }
    /** 重开时清空表现层残留特效（波纹等），不触碰内核状态 */
    clearFx() {
        this.ripples.clear();
    }
    /** main 翻译 tower-ripple 事件后调用；越界 duration 按名义 300 兜底并告警 */
    enqueueRipple(e, nowMs) {
        this.ripples.enqueue(e.duration_ms, nowMs);
    }
    /** 渲染一帧：快照只读，不回写内核 */
    draw(ctx, snap, nowMs, logical) {
        // L0/L1 背景（程序化：渐变 + 塔吊剪影 + 暮色线）
        (0, backdrop_js_1.drawBackdrop)(ctx, logical.width, logical.height);
        // L2 塔身（自下而上，明度按层递减）
        for (const b of snap.tower)
            this.drawBlock(ctx, b, logical, false);
        // L3 摆动块（悬停带：塔顶上方两层高）
        if (snap.moving) {
            const hover = { x: snap.moving.x, width: snap.moving.width, yIndex: snap.layers + 2 };
            const y = logical.height - (hover.yIndex + 1) * exports.BLOCK_H;
            const moveSprite = this.sprites.blockMove;
            if (moveSprite) {
                ctx.drawImage(moveSprite, hover.x - hover.width / 2, y, hover.width, exports.BLOCK_H);
            }
            else {
                this.drawBlock(ctx, hover, logical, true);
                this.drawBounceLight(ctx, hover, logical);
            }
            this.drawGuide(ctx, hover, logical); // L4 引导层（首局 layers<2）
        }
        // L6 tower-ripple 波纹（e-ripple-renderer：池 ≤200 颗 + additive 合成 + 异常隔离；
        // duration 300±50ms 内可见，随 duration 等比扩散；无整屏闪光）
        {
            const topBlock = snap.tower[snap.tower.length - 1];
            const cx = topBlock ? topBlock.x : logical.width / 2;
            const cy = logical.height - ((topBlock ? topBlock.yIndex : snap.layers) + 1) * exports.BLOCK_H + exports.BLOCK_H / 2;
            const drawn = this.ripples.draw(ctx, nowMs, cx, cy, 1);
            if (drawn < 0)
                console.info('[render] ripple draw 异常已隔离');
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
        const h = exports.BLOCK_H;
        const y = logical.height - (b.yIndex + 1) * h;
        const hex = (0, palette_js_1.blockColor)(b.yIndex);
        // e01 塔基块贴图（首块专用；缺项回 blockFace → tileset 切片 → 程序化画布）
        const base = this.sprites.blockBase;
        if (!moving && b.yIndex === 0 && base) {
            ctx.drawImage(base, b.x - b.width / 2, y, b.width, h);
        }
        else {
            const face = (0, textures_js_1.blockFace)(hex, b.width, h);
            if (face) {
                ctx.drawImage(face.canvas, b.x - b.width / 2, y);
            }
            else {
                const f = moving ? 1 : (0, palette_js_1.layerShade)(b.yIndex);
                ctx.fillStyle = (0, palette_js_1.shade)(hex, f);
                ctx.fillRect(b.x - b.width / 2, y, b.width, h - 1);
            }
        }
        // 切面高亮描边（1px 白，判定物）
        ctx.strokeStyle = palette_js_1.PALETTE.FACE_HIGHLIGHT;
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x - b.width / 2 + 0.5, y + 0.5, b.width - 1, h - 2);
    }
    /** 摆动块下缘冷灰蓝反弹光（风格卡 §1：把待落块从背景托出） */
    drawBounceLight(ctx, b, logical) {
        const y = logical.height - (b.yIndex + 1) * exports.BLOCK_H + exports.BLOCK_H - 1;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = palette_js_1.PALETTE.SKY_BOTTOM;
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
        const topY = logical.height - hover.yIndex * exports.BLOCK_H;
        const baseTopY = logical.height - exports.BLOCK_H;
        if (baseTopY - topY < 4)
            return;
        const guide = this.sprites.guide;
        ctx.save();
        ctx.globalAlpha = 0.3;
        if (guide) {
            ctx.drawImage(guide, hover.x - guide.naturalWidth / 2, topY, guide.naturalWidth, baseTopY - topY);
        }
        else {
            ctx.strokeStyle = theme_js_1.NEON.CUT_FACE;
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
        const y = logical.height - (d.yIndex + 1) * exports.BLOCK_H;
        const debris = this.sprites.debris;
        if (debris) {
            ctx.drawImage(debris, d.x - d.width / 2, y, d.width, exports.BLOCK_H);
            return;
        }
        ctx.fillStyle = palette_js_1.PALETTE.DEBRIS;
        ctx.fillRect(d.x - d.width / 2, y, d.width, exports.BLOCK_H - 1);
    }
}
exports.Renderer = Renderer;
exports.BLOCK_H = 28; // 表现层块高（逻辑像素）；不影响内核判定
