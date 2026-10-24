/**
 * 完美判定（实体 e-perfect-judge）。
 * 判据：|offset| ≤ swingSpeed(level) × perfectWindowMs(level) / 1000（L1 = 22.4px）。
 * perfect → 宽度不减、combo+1、发射 tower-ripple。
 */
import { perfectDistance } from './numeric.js';

export interface JudgeResult {
  perfect: boolean;
  /** 本 tick 判定使用的距离阈值（px） */
  thresholdPx: number;
  /** 落块瞬间的水平偏差（px，带符号） */
  offsetPx: number;
}

export function judgeDrop(offsetPx: number, level: number): JudgeResult {
  const thresholdPx = perfectDistance(level);
  return { perfect: Math.abs(offsetPx) <= thresholdPx, thresholdPx, offsetPx };
}
