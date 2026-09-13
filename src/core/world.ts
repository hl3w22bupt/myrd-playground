/**
 * core/world —— World 状态容器（ECS-lite）与实体/物资/运输机/缩圈状态。
 */

import type { ContentPack, AiPersonaId } from '../content';
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
  /** 后坐力垂直偏移（rad，向上为正）：射击时累积，停火后按 RECOIL_TUNING 恢复 */
  recoilPitch: number;
  /** 后坐力水平偏移（rad）：射击时随机方向累积，停火后恢复 */
  recoilYaw: number;
  /** 行为人格（AI 行为多样化；玩家为 'assault' 占位不参与决策） */
  persona: AiPersonaId;
  /** 点射计数与冷却（AI burst fire 节流） */
  burstCount: number;
  burstReadyAtMs: number;
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
  /** AI */
  aiState: 'patrol' | 'loot' | 'seek' | 'fire' | 'fleeZone' | 'heal' | 'dead';
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
  /** 堆叠数量（弹药丢弃再拾取语义；undefined = 按物品配置默认数量） */
  count?: number;
}

/** 空投箱：falling 下落中 → landed 落地（落地时按内容物散布生成高价值物资） */
export interface AirDropCrate {
  id: string;
  /** 落点（水平位置固定，y 为当前箱体高度） */
  pos: Vec3;
  phase: 'falling' | 'landed';
  landedAtMs: number | null;
}

export interface PlaneState {
  active: boolean;
  pos: Vec3;
  dir: Vec3;
  start: Vec3;
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
  airdrops: AirDropCrate[];
  events: GameEvent[];
  result: MatchResult | null;
  /** 物资 id 序列（world 级而非模块级：同进程多局之间互不污染，确定性红线） */
  lootSeq: number;
  /** 空投 id 序列（world 级，同上） */
  airdropSeq: number;
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
    persona: 'assault',
    burstCount: 0,
    burstReadyAtMs: 0,
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

/** 取消进行中的医疗引导（受伤/开火打断，AC3 急救语义） */
export function cancelMedkitChannel(e: Entity): boolean {
  if (e.medkitUntilMs === null) return false;
  e.medkitUntilMs = null;
  e.medkitItemSlot = null;
  return true;
}
