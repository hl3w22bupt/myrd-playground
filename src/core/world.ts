/**
 * core/world —— World 状态容器（ECS-lite）与实体/物资/运输机/缩圈状态。
 */

import type { ContentPack } from '../content';
import type { AiPersonaId } from '../content/ai';
import { INVENTORY_GRIDS, MAX_HP } from '../content/constants';
import type {
  EntityKind,
  GameEvent,
  ItemId,
  MatchResult,
  MatchStatus,
  PlayerIntent,
  PlayerState,
  Vec3,
  WeaponId,
  AABB,
} from './types';
import type { Rng } from './rng';

export interface WeaponSlot {
  weapon: WeaponId;
  magazine: number;
}

export interface Entity {
  id: string;
  kind: EntityKind;
  index: number;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: PlayerState;
  kills: number;
  /** 淘汰时的名次（存活数） */
  rank: number | null;
  eliminatedAtMs: number | null;
  eliminatedBy: string | null;
  /** 装备（护甲/头盔立即生效） */
  armorReduction: number;
  helmetReduction: number;
  /** 武器槽（0 主武器 / 1 副武器） */
  weapons: Array<WeaponSlot | null>;
  activeWeapon: 0 | 1;
  /** 弹药储备（按弹药类型） */
  ammoReserve: Record<string, number>;
  /** 背包格子 */
  inventory: Array<{ item: ItemId; count: number } | null>;
  usedGrids: number;
  /** 逻辑时间戳（world.elapsedMs） */
  fireReadyAtMs: number;
  reloadUntilMs: number | null;
  switchReadyAtMs: number;
  medkitUntilMs: number | null;
  medkitItemSlot: number | null;
  /** 是否按住开火 */
  firing: boolean;
  /** 连射散布扩张（后坐力 bloom） */
  bloom: number;
  /** 后坐力垂直偏移（rad，踢枪累积，独立于瞄准，弹道方向 = pitch + recoilPitch） */
  recoilPitch: number;
  /** 后坐力水平偏移（rad，随机方向踢枪） */
  recoilYaw: number;
  /** AI 行为人格（多样化，见 content/ai.AI_PERSONALITIES） */
  aiPersona: AiPersonaId;
  /** 本 tick 解析后的意图状态（由 applyIntent 写入，各系统消费） */
  moveDirX: number;
  moveDirZ: number;
  moveSprint: boolean;
  aimPitchCmd: number;
  ctrlX: number;
  ctrlZ: number;
  ctrlDive: number;
  wantJump: boolean;
  wantDeploy: boolean;
  wantReload: boolean;
  wantInteract: boolean;
  wantSwitch: number | null;
  wantDrop: number | null;
  wantUse: number | null;
  /** 是否请求使用最强血包（Q 自动选择；updateLoot 解析为具体槽位） */
  wantUseBest: boolean;
  /** 最近一次受击的逻辑时间（ms；急救「受击打断」与 AI 撤退判定共用） */
  lastDamagedAtMs: number;
  /** AI */
  aiState: 'patrol' | 'loot' | 'seek' | 'fire' | 'fleeZone' | 'retreat' | 'dead';
  aiWaypoint: Vec3 | null;
  aiTargetId: string | null;
  aiLastSeenMs: number;
  aiFirstSeenMs: number;
  aiJumpAtMs: number | null;
  aiLootId: string | null;
  aiDecisionOffset: number;
  /** 意图缓存：AI 每次决策重写整表，各 tick 全量应用（与玩家意图同通道） */
  pendingIntents: PlayerIntent[];
}

export interface LootItem {
  id: string;
  item: ItemId;
  pos: Vec3;
  taken: boolean;
}

export interface PlaneState {
  active: boolean;
  pos: Vec3;
  dir: Vec3;
  start: Vec3;
}

export interface AirdropCrate {
  id: string;
  pos: Vec3;
  phase: 'falling' | 'landed';
  landedAtMs: number | null;
}

export interface ZoneState {
  phase: number;
  mode: 'wait' | 'shrink' | 'done';
  timerMs: number;
  center: Vec3;
  radius: number;
  nextCenter: Vec3;
  nextRadius: number;
  dps: number;
  doneElapsedMs: number;
  accumulatorSec: number;
  shrinkFrom: { center: Vec3; radius: number };
}

export interface World {
  seed: number;
  pack: ContentPack;
  tick: number;
  elapsedMs: number;
  status: MatchStatus;
  entities: Entity[];
  player: Entity;
  loots: LootItem[];
  plane: PlaneState;
  zone: ZoneState;
  buildings: AABB[];
  dropHints: Vec3[];
  /** 空投箱（含下落中与已落地） */
  airdrops: AirdropCrate[];
  airdropSeq: number;
  events: GameEvent[];
  result: MatchResult | null;
  rng: {
    map: Rng;
    loot: Rng;
    ai: Rng;
    combat: Rng;
    plane: Rng;
    zone: Rng;
    airdrop: Rng;
  };
}

export function createEntity(
  id: string,
  kind: EntityKind,
  index: number,
  spawn: Vec3,
): Entity {
  return {
    id,
    kind,
    index,
    pos: { ...spawn },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    alive: true,
    state: 'plane',
    kills: 0,
    rank: null,
    eliminatedAtMs: null,
    eliminatedBy: null,
    armorReduction: 0,
    helmetReduction: 0,
    weapons: [null, null],
    activeWeapon: 0,
    ammoReserve: {},
    inventory: new Array(INVENTORY_GRIDS).fill(null),
    usedGrids: 0,
    fireReadyAtMs: 0,
    reloadUntilMs: null,
    switchReadyAtMs: 0,
    medkitUntilMs: null,
    medkitItemSlot: null,
    firing: false,
    bloom: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    aiPersona: 'assault',
    moveDirX: 0,
    moveDirZ: 0,
    moveSprint: false,
    aimPitchCmd: 0,
    ctrlX: 0,
    ctrlZ: 0,
    ctrlDive: 0,
    wantJump: false,
    wantDeploy: false,
    wantReload: false,
    wantInteract: false,
    wantSwitch: null,
    wantDrop: null,
    wantUse: null,
    wantUseBest: false,
    lastDamagedAtMs: -1e9,
    aiState: 'patrol',
    aiWaypoint: null,
    aiTargetId: null,
    aiLastSeenMs: -1e9,
    aiFirstSeenMs: -1e9,
    aiJumpAtMs: null,
    aiLootId: null,
    aiDecisionOffset: index % 4,
    pendingIntents: [],
  };
}

export function pushEvent(w: World, ev: GameEvent): void {
  w.events.push(ev);
}

/** 背包剩余格子 */
export function freeGrids(e: Entity): number {
  return e.inventory.length - e.usedGrids;
}

/** 取消医疗引导（开火/被打断时调用，急救语义：持枪射击即中断包扎） */
export function cancelMedkitChannel(e: Entity): void {
  e.medkitUntilMs = null;
  e.medkitItemSlot = null;
}
