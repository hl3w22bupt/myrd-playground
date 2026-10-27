// waveDirector.ts — e-wave-director：编成表驱动出怪节奏 + 波间结算
// spec: entities/e-wave-director · numeric.waveTable（waves=8 · enemiesPerWaveBase=6 ·
//       enemiesGrowthPerWave=1.35）· level-1/el-warmup（前 10 秒敌量×0.5 宽松窗）
// 与线 2 waveIndex 形态相近但机制主体不同（防守目标 vs 走位刷怪）——差异点三列已声明。

import type { GameConfig } from "../kernel/config.ts";
import { pickKind } from "../entities/enemy.ts";

export const FIRST_WAVE_LENIENT_RATIO = 0.5; // 前 10 秒出怪节奏 ×0.5（间隔 ×2）

/** 波次敌量（编成表）：round(enemiesPerWaveBase × enemiesGrowthPerWave^(w-1)) */
export function waveEnemyCount(cfg: GameConfig, wave: number): number {
  return Math.round(cfg.waveTable.enemiesPerWaveBase * Math.pow(cfg.waveTable.enemiesGrowthPerWave, wave - 1));
}

/** 波次编成序列（同 seed 确定：kind 序列由 seededRng 驱动；首波全 grunt=教学波） */
export function waveComposition(cfg: GameConfig, wave: number, rng: () => number): string[] {
  const n = waveEnemyCount(cfg, wave);
  const seq: string[] = [];
  for (let i = 0; i < n; i += 1) seq.push(wave === 1 ? "grunt" : pickKind(rng()));
  return seq;
}

/** 出怪间隔 tick：spawnIntervalBaseMs；首波前 10s 宽松窗内 ×2（敌量节奏减半） */
export function spawnIntervalTicks(cfg: GameConfig, wave: number, waveElapsedMs: number): number {
  const base = cfg.enemy.spawnIntervalBaseMs / cfg.fixedStepMs;
  if (wave === 1 && waveElapsedMs < cfg.pacing.firstWaveLeniencyMs) return Math.round(base * 2);
  return Math.round(base);
}

/** 波间状态机相位：prep（波前）→ spawning（出怪中）→ clearing（清场尾）→ intermission（波间歇） */
export type WavePhase = "prep" | "spawning" | "clearing" | "intermission";
