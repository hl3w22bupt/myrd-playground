/**
 * content/items —— AC3 物资与生效数值基准（护甲减伤/医疗回血/弹药计数）
 */

import type { WeaponId } from './weapons';

export type ItemId =
  | 'weapon_ar_m4'
  | 'weapon_smg_ump'
  | 'weapon_sr_awm'
  | 'ammo_556'
  | 'ammo_45'
  | 'ammo_300'
  | 'armor_vest'
  | 'armor_vest_lv3'
  | 'helmet_mk2'
  | 'helmet_mk3'
  | 'medkit_large'
  | 'firstaid_kit'
  | 'bandage';

export type ItemKind = 'weapon' | 'ammo' | 'armor' | 'helmet' | 'medkit';

export interface ItemDefBase {
  id: ItemId;
  name: string;
  kind: ItemKind;
  /** 背包格子占用 */
  gridCost: number;
}

export interface WeaponItemDef extends ItemDefBase {
  kind: 'weapon';
  weaponId: WeaponId;
  /** 拾取时附带的上膛弹药数 */
  loadedAmmo: number;
}

export interface AmmoItemDef extends ItemDefBase {
  kind: 'ammo';
  ammoType: string;
  count: number;
}

export interface ArmorItemDef extends ItemDefBase {
  kind: 'armor';
  /** 躯干减伤 0..1 */
  damageReduction: number;
}

export interface HelmetItemDef extends ItemDefBase {
  kind: 'helmet';
  /** 爆头减伤 0..1 */
  headshotReduction: number;
}

export interface MedkitItemDef extends ItemDefBase {
  kind: 'medkit';
  /** 恢复生命值 */
  healAmount: number;
  /** 使用耗时（ms） */
  useMs: number;
}

export type ItemDef =
  | WeaponItemDef
  | AmmoItemDef
  | ArmorItemDef
  | HelmetItemDef
  | MedkitItemDef;

export const ITEMS: Record<ItemId, ItemDef> = {
  weapon_ar_m4: {
    id: 'weapon_ar_m4', name: '步枪 M4', kind: 'weapon', weaponId: 'ar_m4',
    loadedAmmo: 30, gridCost: 0,
  },
  weapon_smg_ump: {
    id: 'weapon_smg_ump', name: '冲锋枪 UMP', kind: 'weapon', weaponId: 'smg_ump',
    loadedAmmo: 25, gridCost: 0,
  },
  weapon_sr_awm: {
    id: 'weapon_sr_awm', name: '栓动狙击 AWM', kind: 'weapon', weaponId: 'sr_awm',
    loadedAmmo: 5, gridCost: 0,
  },
  ammo_556: { id: 'ammo_556', name: '5.56mm 弹药', kind: 'ammo', ammoType: 'ammo_556', count: 60, gridCost: 2 },
  ammo_45: { id: 'ammo_45', name: '.45 弹药', kind: 'ammo', ammoType: 'ammo_45', count: 50, gridCost: 2 },
  ammo_300: { id: 'ammo_300', name: '.300 马格南', kind: 'ammo', ammoType: 'ammo_300', count: 20, gridCost: 2 },
  armor_vest: { id: 'armor_vest', name: '防弹衣', kind: 'armor', damageReduction: 0.35, gridCost: 0 },
  armor_vest_lv3: { id: 'armor_vest_lv3', name: '三级防弹衣', kind: 'armor', damageReduction: 0.5, gridCost: 0 },
  helmet_mk2: { id: 'helmet_mk2', name: '头盔', kind: 'helmet', headshotReduction: 0.5, gridCost: 0 },
  helmet_mk3: { id: 'helmet_mk3', name: '三级头盔', kind: 'helmet', headshotReduction: 0.65, gridCost: 0 },
  medkit_large: { id: 'medkit_large', name: '医疗包', kind: 'medkit', healAmount: 60, useMs: 3000, gridCost: 2 },
  firstaid_kit: { id: 'firstaid_kit', name: '急救包', kind: 'medkit', healAmount: 45, useMs: 2000, gridCost: 2 },
  bandage: { id: 'bandage', name: '绷带', kind: 'medkit', healAmount: 15, useMs: 1200, gridCost: 1 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
