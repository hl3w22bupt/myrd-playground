/**
 * 完美判定（实体 e-perfect-judge）。
 * 判据：|offset| ≤ swingSpeed(level) × perfectWindowMs(level) / 1000（L1 = 22.4px）。
 * perfect → 宽度不减、combo+1、发射 tower-ripple。
 */
import { perfectDistance } from './numeric.js';
export function judgeDrop(offsetPx, level) {
    const thresholdPx = perfectDistance(level);
    return { perfect: Math.abs(offsetPx) <= thresholdPx, thresholdPx, offsetPx };
}
