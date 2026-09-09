/**
 * content/lootTable —— AC3 物资按区域密度生成与权重池
 */

import type { ItemId } from './items';

export interface LootZoneDef {
  name: string;
  /** 生成密度：每万平米物品数 */
  densityPer10kM2: number;
  pool: Array<{ item: ItemId; weight: number }>;
}

export interface LootTableConfig {
  zones: LootZoneDef[];
}

/**
 * 城区（高密度、武器护甲为主）与野区（低密度、弹药医疗为主）。
 * AC3 断言依据：生成数量 = density × 区域面积 / 10_000（四舍五入）。
 */
export const LOOT_TABLE: LootTableConfig = {
  zones: [
    {
      name: 'urban',
      densityPer10kM2: 2.6,
      pool: [
        { item: 'weapon_ar_m4', weight: 14 },
        { item: 'weapon_smg_ump', weight: 18 },
        { item: 'ammo_556', weight: 18 },
        { item: 'ammo_45', weight: 16 },
        { item: 'armor_vest', weight: 12 },
        { item: 'helmet_mk2', weight: 10 },
        { item: 'medkit_large', weight: 6 },
        { item: 'first_aid', weight: 8 },
        { item: 'bandage', weight: 12 },
      ],
    },
    {
      name: 'wild',
      densityPer10kM2: 0.55,
      pool: [
        { item: 'weapon_ar_m4', weight: 8 },
        { item: 'weapon_smg_ump', weight: 12 },
        { item: 'ammo_556', weight: 20 },
        { item: 'ammo_45', weight: 18 },
        { item: 'armor_vest', weight: 8 },
        { item: 'helmet_mk2', weight: 7 },
        { item: 'medkit_large', weight: 8 },
        { item: 'first_aid', weight: 9 },
        { item: 'bandage', weight: 16 },
      ],
    },
  ],
};

export const LOOT_TOTAL_CAP = 240;
