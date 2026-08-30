/**
 * core —— 确定性仿真核心（纯 TS，零 DOM / zero three）。
 * Node 可直接运行（测试策略成立的前提）。
 */

export { Rng, createRng } from './rng';
export * from './types';
export { createMatch, createWorldForTest, tickWorld, buildSnapshot, applyIntent, MATCH_DEFAULTS } from './match';
export type { MatchConfig } from './match';
export { FixedLoop } from './loop';
export * from './geom';
export {
  terrainHeightAt,
  isUrbanArea,
  nearestUrbanCenter,
  generateMap,
  resolveBuildingCollision,
} from './mapgen';
export type { GeneratedMap } from './mapgen';
export type { World, Entity, LootItem, PlaneState, ZoneState, WeaponSlot } from './world';
export { pushEvent, createEntity, freeGrids } from './world';
export * from './systems/combat';
export { updateZone, initZone } from './systems/zone';
export { updateAi, initAi } from './systems/ai';
export { updateLifecycle, checkMatchEnd } from './systems/lifecycle';
export { generateLoot, tryPickup, addItem, dropItem, useMedkit, updateLoot } from './systems/loot';
export { updatePlane, simulateFalling, jumpFromPlane } from './systems/parachute';
export { updateMovement } from './systems/movement';
