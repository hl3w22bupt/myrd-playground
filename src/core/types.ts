/**
 * core/types —— 仿真核心对外契约（意图 / 事件 / 快照 / MatchHandle）。
 * 依据架构文档 02 §2，跨模块一律值类型。
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EntityKind = 'player' | 'ai';

/** 实体状态机：登机 → 自由落体 → 开伞滑翔 → 落地 → 死亡 */
export type PlayerState = 'plane' | 'freefall' | 'parachute' | 'ground' | 'dead';

export type BodyPart = 'head' | 'torso' | 'limb';

export type MatchStatus = 'lobby' | 'parachuting' | 'playing' | 'ended';

export type WeaponId = string;
export type ItemId = string;

/** 背包内的一格 */
export interface InvItem {
  item: ItemId;
  count: number;
}

export interface WeaponSlotState {
  weapon: WeaponId;
  magazine: number;
}

/** 输入侧唯一通道：玩家与 AI 共用（AI 不走特权通道） */
export type PlayerIntent =
  | { kind: 'move'; dirX: number; dirZ: number; sprint?: boolean }
  | { kind: 'aim'; yaw: number; pitch: number }
  | { kind: 'fire' }
  | { kind: 'stopFire' }
  | { kind: 'reload' }
  | { kind: 'switchWeapon'; slot: number }
  | { kind: 'interact' }
  | { kind: 'drop'; slot: number }
  | { kind: 'useItem'; slot: number }
  | { kind: 'jumpFromPlane' }
  | { kind: 'freefallControl'; dirX: number; dirZ: number; dive: number }
  | { kind: 'deployParachute' };

export type EliminationCause = 'shot' | 'zone';

export type GameEvent =
  | { type: 'lootSpawned'; id: string; pos: Vec3; item: ItemId }
  | { type: 'lootPickedUp'; entityId: string; item: ItemId; pos: Vec3 }
  | { type: 'weaponEquipped'; entityId: string; weapon: WeaponId }
  | { type: 'shotFired'; entityId: string; weapon: WeaponId; origin: Vec3; dir: Vec3; end: Vec3; hitEntity: boolean }
  | { type: 'damageDealt'; target: string; byId: string; amount: number; bodyPart: BodyPart; lethal: boolean }
  | { type: 'entityEliminated'; entityId: string; byId: string; cause: EliminationCause }
  | { type: 'zonePhaseChanged'; phase: number; center: Vec3; radius: number; nextCenter: Vec3; nextRadius: number; dps: number }
  | { type: 'playerStateChanged'; entityId: string; state: PlayerState }
  | { type: 'itemUsed'; entityId: string; item: ItemId }
  | { type: 'airdropIncoming'; id: string; pos: Vec3 }
  | { type: 'airdropLanded'; id: string; pos: Vec3 }
  | { type: 'matchEnded'; result: MatchResult };

export interface EntitySnapshot {
  id: string;
  kind: EntityKind;
  alive: boolean;
  pos: Vec3;
  yaw: number;
  pitch: number;
  state: PlayerState;
  weapon: WeaponId | null;
  hp: number;
  maxHp: number;
}

export interface PlayerViewSnapshot {
  id: string;
  hp: number;
  maxHp: number;
  state: PlayerState;
  weapon: WeaponId | null;
  magazine: number | null;
  reserve: number | null;
  reloading: boolean;
  weapons: Array<WeaponSlotState | null>;
  inventory: Array<InvItem | null>;
  usedGrids: number;
  armorReduction: number;
  helmetReduction: number;
  kills: number;
  aliveCount: number;
  medkitChannelMsLeft: number;
  /** 拾取提示（AC3）：范围内最近的可拾取物资；null 表示范围内无物资 */
  nearbyLoot: NearbyLoot | null;
  /** 毒圈警示（AC5）：true 表示玩家当前处于安全区外（正在按秒掉血） */
  outsideZone: boolean;
}

/** 玩家附近可拾取物资的提示信息 */
export interface NearbyLoot {
  id: string;
  item: ItemId;
  /** 与玩家的水平距离（m） */
  dist: number;
}

export interface LootSnapshot {
  id: string;
  item: ItemId;
  pos: Vec3;
}

/** 空投箱快照（渲染层只读数据源） */
export interface AirdropSnapshot {
  id: string;
  pos: Vec3;
  phase: 'falling' | 'landed';
}

export interface ZoneSnapshot {
  center: Vec3;
  radius: number;
  nextCenter: Vec3;
  nextRadius: number;
  phase: number;
  phaseCount: number;
  mode: 'wait' | 'shrink' | 'done';
  timeLeftMs: number;
  dps: number;
}

export interface PlaneSnapshot {
  active: boolean;
  pos: Vec3;
  dir: Vec3;
}

export interface WorldSnapshot {
  tick: number;
  elapsedMs: number;
  status: MatchStatus;
  entities: EntitySnapshot[];
  player: PlayerViewSnapshot | null;
  loots: LootSnapshot[];
  airdrops: AirdropSnapshot[];
  zone: ZoneSnapshot;
  plane: PlaneSnapshot | null;
}

export interface ResultRow {
  entityId: string;
  kind: EntityKind;
  rank: number;
  kills: number;
  eliminatedAtMs: number | null;
}

export interface MatchResult {
  winnerId: string | null;
  winnerKind: EntityKind | null;
  totalEntities: number;
  elapsedMs: number;
  rankings: ResultRow[];
  playerRank: number | null;
  playerKills: number;
}

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

/** 仿真对外的唯一入口契约（架构文档 02 §2） */
export interface MatchHandle {
  /** 推进一个 20ms 逻辑 tick（intents 为玩家本 tick 意图） */
  tick(intents?: PlayerIntent[]): void;
  /** 渲染层唯一只读数据源 */
  snapshot(): WorldSnapshot;
  /** 取走本 tick 事件（UI/特效消费） */
  drainEvents(): GameEvent[];
  status(): MatchStatus;
  /** ended 时非空：排名/淘汰数/用时 */
  result(): MatchResult | null;
  elapsed(): number;
}
