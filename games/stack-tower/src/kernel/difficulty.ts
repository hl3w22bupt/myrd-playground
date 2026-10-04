/**
 * 难度调度（实体 e-difficulty-scheduler）— 关卡推进与 id 派生。
 * 红线：速度/窗口/层目标一律取自 numeric.ts 公式，禁止散落魔法数。
 */
import { NUMERIC, swingSpeed, perfectWindowMs, targetLayers } from './numeric.js';

export { swingSpeed, perfectWindowMs, targetLayers };

/** 关卡 id 派生：1 → 'lvl-01-stack-tower'（spec.levels[].id 命名约定） */
export function levelId(level: number): string {
  return `lvl-${String(level).padStart(2, '0')}-stack-tower`;
}

/** 关卡快查表：本关速度（px/s）/ 窗口（ms）/ 距离阈值（px）/ 层目标 */
export interface LevelTuning {
  level: number;
  id: string;
  speedPxs: number;
  windowMs: number;
  distancePx: number;
  target: number;
}

export function levelTuning(level: number): LevelTuning {
  const speedPxs = swingSpeed(level);
  const windowMs = perfectWindowMs(level);
  return {
    level,
    id: levelId(level),
    speedPxs,
    windowMs,
    distancePx: (speedPxs * windowMs) / 1000,
    target: targetLayers(level),
  };
}

/** 是否已达本关层目标（cumulative：塔身已落块数，不含塔基） */
export function isLevelClear(layers: number, level: number): boolean {
  return layers >= targetLayers(level);
}

/** 进入下一关（层数累计，塔身不清；速度/窗口只随关卡公式变化） */
export function nextLevel(level: number): number {
  return Math.min(level + 1, NUMERIC.difficulty.LEVEL_COUNT);
}

/** 塔基块宽度参照（=BLOCK_BASE_WIDTH） */
export function baseBlockWidth(): number {
  return NUMERIC.cut_width.BLOCK_BASE_WIDTH;
}
