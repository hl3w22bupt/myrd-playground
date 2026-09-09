/**
 * content/items —— AC3 物资与生效数值基准（护甲减伤/医疗回血/弹药计数）
 * 血包急救线：绷带 / 急救包 / 医疗箱 三档医疗物资；空投专属 L3 护甲/头盔。
 */

import type { WeaponId } from './weapons';

export type ItemId =
  | 'weapon_ar_m4'
  | 'weapon_smg_ump'
  | 'weapon_ar_groza'
  | 'ammo_556'
  | 'ammo_45'
  | 'armor_vest'
  | 'armor_vest_l3'
  | 'helmet_mk2'
  | 'helmet_l3'
  | 'bandage'
  | 'first_aid'
  | 'medkit_large';

export type ItemKind = 'weapon' | 'ammo' | 'armor' | 'helmet' | 'medkit';

export interface ItemDefBase {
  id: ItemId;
  name: string;
  kind: ItemKind;
  /** 背包格子占用（每个堆叠格） */
  gridCost: number;
  /** 单格最大堆叠数（1 = 不可堆叠） */
  stackMax: number;
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
    loadedAmmo: 30, gridCost: 0, stackMax: 1,
  },
  weapon_smg_ump: {
    id: 'weapon_smg_ump', name: '冲锋枪 UMP', kind: 'weapon', weaponId: 'smg_ump',
    loadedAmmo: 25, gridCost: 0, stackMax: 1,
  },
  weapon_ar_groza: {
    id: 'weapon_ar_groza', name: '步枪 Groza', kind: 'weapon', weaponId: 'ar_groza',
    loadedAmmo: 30, gridCost: 0, stackMax: 1,
  },
  ammo_556: { id: 'ammo_556', name: '5.56mm 弹药', kind: 'ammo', ammoType: 'ammo_556', count: 60, gridCost: 2, stackMax: 3 },
  ammo_45: { id: 'ammo_45', name: '.45 弹药', kind: 'ammo', ammoType: 'ammo_45', count: 50, gridCost: 2, stackMax: 3 },
  armor_vest: { id: 'armor_vest', name: '防弹衣', kind: 'armor', damageReduction: 0.35, gridCost: 0, stackMax: 1 },
  armor_vest_l3: { id: 'armor_vest_l3', name: '三级防弹衣', kind: 'armor', damageReduction: 0.5, gridCost: 0, stackMax: 1 },
  helmet_mk2: { id: 'helmet_mk2', name: '头盔', kind: 'helmet', headshotReduction: 0.5, gridCost: 0, stackMax: 1 },
  helmet_l3: { id: 'helmet_l3', name: '三级头盔', kind: 'helmet', headshotReduction: 0.65, gridCost: 0, stackMax: 1 },
  bandage: { id: 'bandage', name: '绷带', kind: 'medkit', healAmount: 12, useMs: 2000, gridCost: 1, stackMax: 10 },
  first_aid: { id: 'first_aid', name: '急救包', kind: 'medkit', healAmount: 75, useMs: 4500, gridCost: 2, stackMax: 3 },
  medkit_large: { id: 'medkit_large', name: '医疗箱', kind: 'medkit', healAmount: 60, useMs: 3000, gridCost: 2, stackMax: 2 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** 医疗物资自动选用优先级（血包急救线：useItem slot=-1 时按序选第一档可用且不溢出过多的） */
export const MEDKIT_PRIORITY: ItemId[] = ['first_aid', 'medkit_large', 'bandage'];
