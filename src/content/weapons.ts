/**
 * content/weapons —— AC4 数值基准（权威基准知识文档 6439fc3e 附录值，禁止擅改）
 * 术语与数值以《Web大逃杀技术方案与性能红线》为准。
 */

export type WeaponId = 'ar_m4' | 'smg_ump' | 'ar_groza';
export type WeaponCategory = 'ar' | 'smg';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  /** 基础伤害 */
  damage: number;
  /** 射速（发/分） */
  rpm: number;
  /** 弹匣容量 */
  magazine: number;
  /** 换弹时间（ms） */
  reloadMs: number;
  /** 后坐力系数 0..1（影响瞄准上抬与散布扩张） */
  recoil: number;
  /** 有效射程（m），超出后伤害线性衰减至 50% */
  effectiveRange: number;
  /** 最大射程（m），超过后不再判定命中 */
  maxRange: number;
  /** 散布标准差（rad） */
  spread: number;
  /** 弹速（m/s） */
  projectileSpeed: number;
  /** 弹药类型 */
  ammoType: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar_m4: {
    id: 'ar_m4',
    name: '步枪 M4',
    category: 'ar',
    damage: 26,
    rpm: 620,
    magazine: 30,
    reloadMs: 2200,
    recoil: 0.45,
    effectiveRange: 350,
    maxRange: 500,
    spread: 0.002,
    projectileSpeed: 890,
    ammoType: 'ammo_556',
  },
  smg_ump: {
    id: 'smg_ump',
    name: '冲锋枪 UMP',
    category: 'smg',
    damage: 18,
    rpm: 850,
    magazine: 25,
    reloadMs: 1800,
    recoil: 0.3,
    effectiveRange: 120,
    maxRange: 220,
    spread: 0.0022,
    projectileSpeed: 620,
    ammoType: 'ammo_45',
  },
  /** 空投专属步枪：高伤害高射速，仅空投产出（数值为本功能线新增，落配置表） */
  ar_groza: {
    id: 'ar_groza',
    name: '步枪 Groza',
    category: 'ar',
    damage: 30,
    rpm: 700,
    magazine: 30,
    reloadMs: 2400,
    recoil: 0.5,
    effectiveRange: 380,
    maxRange: 520,
    spread: 0.0021,
    projectileSpeed: 880,
    ammoType: 'ammo_556',
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
