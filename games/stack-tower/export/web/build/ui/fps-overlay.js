/**
 * 帧率覆盖层（实体 e-pwa-shell 的 ?fps=1 面板，M2.1）。
 * 判据（acc-a5b 真机核查入口）：p95 帧耗时 ≤18.2ms（≈55fps@60Hz）且 >50ms jank 帧计数可读。
 * frameStats 为纯函数（Node 契约直接断言）；DOM 面板可注入、headless 安全。
 */
import { NUMERIC } from '../kernel/numeric.js';
const WINDOW = 120; // 滚动窗口帧数（约 2s@60Hz）
/** 纯函数：帧耗时序列（ms）→ 统计。p95 = 最近邻秩（ceil(0.95·n)），jank = >50ms 帧数 */
export function frameStats(durationsMs) {
    const n = durationsMs.length;
    if (n === 0)
        return { count: 0, p95Ms: 0, jankCount: 0, avgFps: 0 };
    const sorted = [...durationsMs].sort((a, b) => a - b);
    const p95 = sorted[Math.min(n - 1, Math.ceil(n * 0.95) - 1)];
    const jank = durationsMs.filter((d) => d > 50).length;
    const avg = durationsMs.reduce((s, d) => s + d, 0) / n;
    return { count: n, p95Ms: p95, jankCount: jank, avgFps: 1000 / avg };
}
/** 预算判定（acc-a5b 自动化口径）：p95 ≤ 18.2ms 且零新增 jank */
export function withinFrameBudget(stats) {
    return stats.p95Ms <= 18.2 && stats.jankCount === 0;
}
export function createFpsOverlay() {
    const window = [];
    let el = null;
    let latest = frameStats([]);
    return {
        sample(durationMs) {
            window.push(durationMs);
            if (window.length > WINDOW)
                window.shift();
            latest = frameStats(window);
            if (el) {
                el.textContent =
                    `fps ${latest.avgFps.toFixed(1)} · p95 ${latest.p95Ms.toFixed(1)}ms\n` +
                        `jank(>50ms) ${latest.jankCount} · budget ${withinFrameBudget(latest) ? 'OK' : 'OVER'} · step ${NUMERIC.FIXED_STEP_MS}ms`;
            }
            return latest;
        },
        stats: () => latest,
        mount(host) {
            if (!host)
                return;
            el = document.createElement('div');
            el.className = 'st-fps-overlay';
            host.appendChild(el);
        },
        dispose() {
            el?.remove();
            el = null;
        },
    };
}
