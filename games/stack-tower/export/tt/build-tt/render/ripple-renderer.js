"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRippleRenderer = createRippleRenderer;
/**
 * tower-ripple 表现层订阅者（实体 e-ripple-renderer，spec v1.2）。
 *
 * 契约（world 规则 v1.2 追加条 + entity expect）：
 *  - 订阅内核 tower-ripple 事件；内核事件契约（e-ripple-emitter）原文不变，零内核改动；
 *  - 涟漪粒子对象池 ≤ theme.RIPPLE_POOL_MAX（200）颗：超龄/超额一律复用或丢弃，禁新建；
 *  - Canvas2D additive 合成（globalCompositeOperation = theme.RIPPLE_RENDER.COMPOSITE='lighter'）；
 *  - 订阅侧异常必须隔离：enqueue/draw 全程 catch，禁止反传内核或中断确定性 tick；
 *  - 表现层常量唯一来源 = theme.ts（acc-t1）。
 */
const theme_js_1 = require("./theme.js");
const numeric_js_1 = require("../kernel/numeric.js");
/** 创建池化涟漪订阅器（owner：渲染器每帧调用 draw，事件入口调用 enqueue） */
function createRippleRenderer() {
    /** 固定容量池：初始化即建满 RIPPLE_POOL_MAX 颗，alive 标记复用（零运行期分配） */
    const pool = Array.from({ length: theme_js_1.RIPPLE_POOL_MAX }, () => ({ startedAt: 0, durationMs: 0 }));
    let aliveCount = 0;
    return {
        /** 池内存活粒子数（测试/观测用，O(1)） */
        get aliveCount() {
            return aliveCount;
        },
        /** 池容量（恒为 theme.RIPPLE_POOL_MAX） */
        get capacity() {
            return theme_js_1.RIPPLE_POOL_MAX;
        },
        /** 入队一颗涟漪；池满时复用最老槽位（FIFO），绝不超容量 */
        enqueue(durationMs, nowMs) {
            try {
                const duration = durationMs < numeric_js_1.RIPPLE_DURATION.MIN_MS || durationMs > numeric_js_1.RIPPLE_DURATION.MAX_MS
                    ? numeric_js_1.RIPPLE_DURATION.NOMINAL_MS
                    : durationMs;
                // 找死槽；无死槽则抢占最早开始的槽位（最老复用）
                let slot = -1;
                let oldest = 0;
                for (let i = 0; i < theme_js_1.RIPPLE_POOL_MAX; i++) {
                    const p = pool[i];
                    const dead = p.durationMs === 0 || nowMs - p.startedAt >= p.durationMs;
                    if (dead) {
                        if (slot < 0) {
                            slot = i;
                            if (p.durationMs !== 0)
                                aliveCount = Math.max(0, aliveCount - 1);
                            break;
                        }
                    }
                    if (slot < 0 && (oldest === 0 || p.startedAt < pool[oldest].startedAt))
                        oldest = i;
                }
                if (slot < 0) {
                    slot = oldest;
                    aliveCount = Math.max(0, aliveCount - 1);
                }
                const p = pool[slot];
                p.startedAt = nowMs;
                p.durationMs = duration;
                aliveCount += 1;
            }
            catch {
                // 订阅异常隔离：表现层吞掉，不反传内核、不中断 tick
            }
        },
        /** 清空表现层残留（restart 时调用；不触碰内核状态） */
        clear() {
            try {
                for (const p of pool) {
                    p.startedAt = 0;
                    p.durationMs = 0;
                }
                aliveCount = 0;
            }
            catch {
                /* 隔离 */
            }
        },
        /**
         * 渲染本帧全部存活涟漪（additive 合成）。topX/topY 为塔顶锚点（由渲染器传入，
         * 涟漪以塔顶为圆心扩散——与内核快照对齐，本模块不读内核）。
         * 返回值：本帧实际绘制的粒子数（-1 表示异常被隔离，调用方可留痕）。
         */
        draw(ctx, nowMs, topX, topY, scale) {
            try {
                let drawn = 0;
                ctx.save();
                ctx.globalCompositeOperation = theme_js_1.RIPPLE_RENDER.COMPOSITE;
                for (let i = 0; i < theme_js_1.RIPPLE_POOL_MAX; i++) {
                    const p = pool[i];
                    if (p.durationMs === 0)
                        continue;
                    const age = nowMs - p.startedAt;
                    if (age >= p.durationMs) {
                        p.durationMs = 0;
                        aliveCount = Math.max(0, aliveCount - 1);
                        continue;
                    }
                    const t = age / p.durationMs; // 0..1
                    const radius = 40 + (theme_js_1.RIPPLE_RENDER.MAX_RADIUS_SCALE * 120) * t * scale;
                    const alpha = theme_js_1.RIPPLE_RENDER.START_ALPHA * (1 - t);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = theme_js_1.NEON.RIPPLE_RING;
                    ctx.beginPath();
                    ctx.ellipse(topX, topY, radius, radius * 0.3, 0, 0, Math.PI * 2);
                    ctx.lineWidth = theme_js_1.RIPPLE_RENDER.RING_WIDTH * (1 - t) + 1;
                    ctx.strokeStyle = theme_js_1.NEON.RIPPLE_RING;
                    ctx.fill();
                    ctx.stroke();
                    drawn++;
                }
                ctx.restore();
                return drawn;
            }
            catch {
                return -1; // 隔离：绘制异常不上抛（调用方仅留痕）
            }
        },
    };
}
