/**
 * content/airdrop —— 空投配置（空投线：触发节奏 / 下落物理 / 物资包内容）。
 * 触发锚定缩圈阶段：进入列表内阶段（0-based phase 的 wait 开始）时，在下一圈范围内投放一个空投。
 */

import type { ItemId } from './items';

export interface AirdropConfig {
  /** 触发空投的缩圈阶段（0-based；进入该阶段 wait 时投放） */
  triggerPhases: number[];
  /** 投放高度（m，相对地面） */
  spawnAltitude: number;
  /** 空投箱下落速度（m/s，降落伞减速后匀速） */
  fallSpeed: number;
  /** 落点在下一圈内的最大半径比例（0..1，相对 nextRadius） */
  landingRadiusRatio: number;
  /** 空投物资包（落地后在箱周生成） */
  bundle: ItemId[];
  /** 落地后物资散布半径（m） */
  bundleSpreadM: number;
}

export const AIRDROP: AirdropConfig = {
  triggerPhases: [1, 3],
  spawnAltitude: 160,
  fallSpeed: 9,
  landingRadiusRatio: 0.7,
  bundle: ['weapon_ar_groza', 'armor_vest_l3', 'helmet_l3', 'first_aid', 'ammo_556'],
  bundleSpreadM: 2.5,
};
