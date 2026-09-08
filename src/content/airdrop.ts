/**
 * content/airdrop —— 空投系统数值基准（对局中期高价值物资投放，玩法缺口补齐项）。
 * 空投专属物资（sr_awm / ammo_300 / 三级甲 / 三级盔）不出现在常规物资池。
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
  /** 落点在安全区内的归一化半径（× 当前圈半径，0..1，含少量圈外漂移余量另加） */
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
    { item: 'weapon_sr_awm', count: 1 },
    { item: 'ammo_300', count: 2 },
    { item: 'armor_vest_lv3', count: 1 },
    { item: 'helmet_mk3', count: 1 },
    { item: 'medkit_large', count: 1 },
  ],
};
