// turret.ts — e-turret：炮塔格位+等级 1..3 数值表（同位升级强化；索敌=路径推进序首个进射程）
// spec: entities/e-turret · numeric.turret（dmg/fireInterval/range 全按等级幂式推导）

import type { GameConfig } from "../kernel/config.ts";

export const TURRET_LEVELS = 3;

export interface Turret {
  id: number;
  col: number;
  row: number;
  level: number;        // 1..3
  x: number;            // 格中心像素
  y: number;
  cooldownTicks: number; // 开火冷却（tick 计）
  investedGold: number;  // 累计投入（结算面/升级价基准）
  kills: number;
  totalDamage: number;
}

/** 每发伤害：dmgPerShotBase × dmgGrowthPerLevel^(level-1) */
export function dmgPerShot(cfg: GameConfig, level: number): number {
  return cfg.turret.dmgPerShotBase * Math.pow(cfg.turret.dmgGrowthPerLevel, level - 1);
}

/** 开火间隔 tick：fireIntervalMsBase × fireIntervalDecayPerLevel^(level-1) → /stepMs */
export function fireIntervalTicks(cfg: GameConfig, level: number): number {
  const ms = cfg.turret.fireIntervalMsBase * Math.pow(cfg.turret.fireIntervalDecayPerLevel, level - 1);
  return Math.max(1, Math.round(ms / cfg.fixedStepMs));
}

/** 射程（格）：rangeTilesBase + rangeGrowthPerLevel×(level-1) */
export function rangeTiles(cfg: GameConfig, level: number): number {
  return cfg.turret.rangeTilesBase + cfg.turret.rangeGrowthPerLevel * (level - 1);
}

/** 升级到 level+1 的价格：costUpgradeBase × costUpgradeGrowth^(targetLevel-2)（2→3 阶=128） */
export function upgradeCost(cfg: GameConfig, currentLevel: number): number {
  return Math.round(cfg.turret.costUpgradeBase * Math.pow(cfg.turret.costUpgradeGrowth, currentLevel - 1));
}

/** 塔身绘制尺寸（px，theme.SCALE.turretPx 同序 Lv1..3） */
export function turretSizePx(cfg: GameConfig, level: number): number {
  const arr = [24, 26, 28];
  const i = Math.min(arr.length, Math.max(1, level)) - 1;
  return arr[i];
}
