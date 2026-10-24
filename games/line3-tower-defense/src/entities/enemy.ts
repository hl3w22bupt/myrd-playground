// enemy.ts — e-enemy：敌军三型数值公式（血量带+波次编成表驱动；到路径终点=漏怪核心-1）
// spec: entities/e-enemy · numeric.enemy（hpBase/hpGrowthPerWave/types）

import type { EnemyKind, GameConfig } from "../kernel/config.ts";

export type { EnemyKind };

export const ENEMY_KINDS: readonly EnemyKind[] = ["grunt", "runner", "brute"];

/** 编成配比（编成表驱动：grunt 60% / runner 25% / brute 15%；首波全 grunt=教学波） */
export const KIND_MIX: Array<{ kind: EnemyKind; upto: number }> = [
  { kind: "grunt", upto: 0.6 },
  { kind: "runner", upto: 0.85 },
  { kind: "brute", upto: 1.0 },
];

export interface Enemy {
  id: number;
  kind: EnemyKind;
  wave: number;        // 所属波次（编成表键）
  hp: number;          // 当前血量
  maxHp: number;
  pathDistPx: number;  // 沿路径已推进像素
  speedPxPerTick: number;
  sizePx: number;
  spawnTick: number;
  alive: boolean;
  endTick: number;     // 死亡/漏怪 tick（0=未结束；敌路径推进序列表锚）
  endReason: "" | "killed" | "leaked";
}

/** 波次血量：hpBase × hpGrowthPerWave^(w-1) × type.hpMul */
export function enemyMaxHp(cfg: GameConfig, kind: EnemyKind, wave: number): number {
  const t = cfg.enemy.types[kind];
  return cfg.enemy.hpBase * Math.pow(cfg.enemy.hpGrowthPerWave, wave - 1) * t.hpMul;
}

/** 波次速度：speedTilesPerSec × type.speedMul × 32px/tile → px/tick */
export function enemySpeedPxPerTick(cfg: GameConfig, kind: EnemyKind): number {
  const t = cfg.enemy.types[kind];
  const pxPerSec = cfg.enemy.speedTilesPerSec * t.speedMul * 32;
  return (pxPerSec * cfg.fixedStepMs) / 1000;
}

/** 编成表：kind 抽取（r∈[0,1) 由 seededRng 驱动 → 同 seed 同序列） */
export function pickKind(r: number): EnemyKind {
  for (const row of KIND_MIX) if (r < row.upto) return row.kind;
  return "brute";
}
