/**
 * content/airdrop —— 空投系统数值基准（对局中期高价值物资集中投放，玩法缺口补齐项）。
 * 定时与投放规则参照既有权威实现（PR #14）取值；内容物使用本功能线 content/items
 * 已定义的高价值物资（含武器/弹药/护甲/头盔/医疗包），保证落地物走标准 loot 通道。
 */

import type { ItemId } from './items';

export interface AirdropConfig {
  /** 首次空投时间（对局开始后秒数） */
  firstDropAtSec: number;
  /** 后续空投间隔（秒） */
  respawnIntervalSec: number;
  /** 单局空投次数上限 */
  maxDrops: number;
  /** 空投箱下落速度（m/s，带伞减速） */
  fallSpeedMps: number;
  /** 空投箱出现高度（m） */
  spawnAltitude: number;
  /** 落点在安全区内的归一化半径（× 当前圈半径，0..1） */
  landRadiusFactor: number;
  /** 落点距圈心最小距离（× 当前圈半径，避免总是砸圈心） */
  landMinRadiusFactor: number;
  /** 落地后箱旁物资散布半径（m） */
  scatterRadiusM: number;
  /** 每个空投箱的内容物（item + 份数） */
  contents: Array<{ item: ItemId; count: number }>;
}

export const AIRDROP: AirdropConfig = {
  firstDropAtSec: 55,
  respawnIntervalSec: 110,
  maxDrops: 3,
  fallSpeedMps: 18,
  spawnAltitude: 260,
  landRadiusFactor: 0.55,
  landMinRadiusFactor: 0.1,
  scatterRadiusM: 4,
  contents: [
    { item: 'weapon_ar_m4', count: 1 },
    { item: 'ammo_556', count: 2 },
    { item: 'armor_vest', count: 1 },
    { item: 'helmet_mk2', count: 1 },
    { item: 'medkit_large', count: 1 },
  ],
};
