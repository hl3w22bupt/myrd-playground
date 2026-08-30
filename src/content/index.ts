/**
 * content —— 内容配置包（数值唯一来源）。core 可依赖 content，content 不依赖任何模块。
 */

import { MOVEMENT, PARACHUTE } from './physics';
import { ITEMS } from './items';
import { WEAPONS } from './weapons';
import { LOOT_TABLE } from './lootTable';
import { ZONE } from './zone';
import { MAP } from './map';
import { AI } from './ai';
import * as CONSTANTS from './constants';

export interface ContentPack {
  version: string;
  constants: typeof CONSTANTS;
  weapons: typeof WEAPONS;
  items: typeof ITEMS;
  lootTable: typeof LOOT_TABLE;
  zone: typeof ZONE;
  map: typeof MAP;
  ai: typeof AI;
  physics: { parachute: typeof PARACHUTE; movement: typeof MOVEMENT };
}

export const DEFAULT_CONTENT_PACK: ContentPack = {
  version: 'pubg-web-core@1',
  constants: CONSTANTS,
  weapons: WEAPONS,
  items: ITEMS,
  lootTable: LOOT_TABLE,
  zone: ZONE,
  map: MAP,
  ai: AI,
  physics: { parachute: PARACHUTE, movement: MOVEMENT },
};

/** 测试/调参用：派生内容包（浅覆盖） */
export function derivePack(base: ContentPack, patch: Partial<ContentPack>): ContentPack {
  return { ...base, ...patch };
}

export * from './constants';
export * from './weapons';
export * from './items';
export * from './lootTable';
export * from './zone';
export * from './map';
export * from './physics';
export * from './ai';
