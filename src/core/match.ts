/**
 * core/match —— createMatch：仿真对外的唯一入口（MatchHandle）。
 * tick 内禁止 Math.random / Date.now / DOM 访问（确定性红线，CI lint 强制）。
 */

import { DEFAULT_CONTENT_PACK, ENTITY_CAP, TICK_MS } from '../content';
import type { ContentPack } from '../content';
import { Rng } from './rng';
import {
  createEntity,
  pushEvent,
  type Entity,
  type LootItem,
  type PlaneState,
  type World,
  type ZoneState,
} from './world';
import { generateMap } from './mapgen';
import { updatePlane, simulateFalling } from './systems/parachute';
import { updateMovement } from './systems/movement';
import { updateCombat } from './systems/combat';
import { generateLoot, updateLoot } from './systems/loot';
import { initZone, updateZone } from './systems/zone';
import { initAi, updateAi } from './systems/ai';
import { updateLifecycle, checkMatchEnd } from './systems/lifecycle';
import { SnapshotWriter } from './snapshot';
import type {
  EntitySnapshot,
  GameEvent,
  LootSnapshot,
  MatchHandle,
  MatchResult,
  MatchStatus,
  PlayerIntent,
  PlayerViewSnapshot,
  Vec3,
  WorldSnapshot,
} from './types';

export interface MatchConfig {
  /** 全局种子：物资/AI/航线/缩圈子流均由它派生 */
  seed: number;
  contentPack?: ContentPack;
  playerCount?: 1;
  /** AI 数量（10..19，含玩家实体上限 20） */
  aiCount?: number;
}

/** 默认对局参数（落地为配置而非硬编码散落各处） */
export const MATCH_DEFAULTS = {
  aiCount: 12,
} as const;

export function createWorldForTest(config: MatchConfig): World {
  const pack = config.contentPack ?? DEFAULT_CONTENT_PACK;
  const seed = config.seed >>> 0;
  const aiCount = Math.max(1, Math.min(pack.constants.ENTITY_CAP - 1, config.aiCount ?? MATCH_DEFAULTS.aiCount));
  const root = new Rng(seed, 'match');

  const rng = {
    map: root.fork('map'),
    plane: root.fork('plane'),
    loot: root.fork('loot'),
    ai: root.fork('ai'),
    combat: root.fork('combat'),
    zone: root.fork('zone'),
  };

  const generated = generateMap(pack, rng.map);

  // 航线：由种子决定的一条穿越地图的固定直线
  const angle = rng.plane.range(0, Math.PI * 2);
  const dir = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
  const center = { x: pack.constants.MAP_HALF, y: pack.physics.parachute.planeAltitude, z: pack.constants.MAP_HALF };
  const span = pack.constants.MAP_SIZE * 0.75 + pack.physics.parachute.planePathMargin;
  const plane: PlaneState = {
    active: true,
    dir,
    start: { x: center.x - dir.x * span, y: center.y, z: center.z - dir.z * span },
    pos: { x: center.x - dir.x * span, y: center.y, z: center.z - dir.z * span },
  };

  const zone: ZoneState = {
    phase: 0,
    mode: 'wait',
    timerMs: 0,
    center: { x: center.x, y: 0, z: center.z },
    radius: pack.zone.initialRadius,
    nextCenter: { x: center.x, y: 0, z: center.z },
    nextRadius: pack.zone.initialRadius,
    dps: 0,
    doneElapsedMs: 0,
    accumulatorSec: 0,
    shrinkFrom: { center: { x: center.x, y: 0, z: center.z }, radius: pack.zone.initialRadius },
  };

  const spawn: Vec3 = { ...plane.pos };
  const entities: Entity[] = [];
  const player = createEntity('player', 'player', 0, spawn);
  entities.push(player);
  for (let i = 0; i < aiCount; i++) {
    entities.push(createEntity(`ai_${i}`, 'ai', i + 1, { ...spawn }));
  }

  const w: World = {
    seed,
    pack,
    tick: 0,
    elapsedMs: 0,
    status: 'lobby',
    entities,
    player,
    loots: [],
    plane,
    zone,
    buildings: generated.buildings,
    dropHints: generated.dropHints,
    events: [],
    result: null,
    rng,
  };

  generateLoot(w);
  initZone(w);
  initAi(w);
  return w;
}

/** 推进一个逻辑 tick：intents 为玩家本 tick 的意图序列 */
export function tickWorld(w: World, intents: PlayerIntent[]): void {
  w.tick += 1;
  w.elapsedMs += w.pack.constants.TICK_MS;

  if (w.status === 'ended') return;

  // 1) 应用意图（玩家意图直通，AI 意图与玩家同通道消费）
  for (const intent of intents) applyIntent(w.player, intent);
  for (const e of w.entities) {
    if (e.kind !== 'ai') continue;
    for (const intent of e.pendingIntents) applyIntent(e, intent);
  }

  // 2) lifecycle（状态机推进）
  updateLifecycle(w);

  // 3) parachute（运输机航线 + 四阶段物理）
  updatePlane(w);
  const dtSec = w.pack.constants.TICK_MS / 1000;
  for (const e of w.entities) simulateFalling(w, e, dtSec);

  // 4) movement（地面移动 + 碰撞）
  updateMovement(w);

  // 5) combat（射击/换弹/切枪/命中）
  updateCombat(w);

  // 6) loot（拾取/丢弃/使用）
  updateLoot(w);

  // 7) zone（缩圈 + 毒圈伤害）
  updateZone(w);

  // 8) ai（分帧决策，产出下一拍意图）
  updateAi(w);

  // 9) 胜负判定
  checkMatchEnd(w);
}

export function applyIntent(e: Entity, intent: PlayerIntent): void {
  switch (intent.kind) {
    case 'move':
      e.moveDirX = intent.dirX;
      e.moveDirZ = intent.dirZ;
      e.moveSprint = intent.sprint ?? false;
      break;
    case 'aim':
      e.yaw = intent.yaw;
      e.pitch = intent.pitch;
      break;
    case 'fire':
      e.firing = true;
      break;
    case 'stopFire':
      e.firing = false;
      break;
    case 'reload':
      e.wantReload = true;
      break;
    case 'switchWeapon':
      e.wantSwitch = intent.slot === 1 ? 1 : 0;
      break;
    case 'interact':
      e.wantInteract = true;
      break;
    case 'drop':
      e.wantDrop = intent.slot;
      break;
    case 'useItem':
      e.wantUse = intent.slot;
      break;
    case 'jumpFromPlane':
      e.wantJump = true;
      break;
    case 'freefallControl':
      e.ctrlX = intent.dirX;
      e.ctrlZ = intent.dirZ;
      e.ctrlDive = intent.dive;
      break;
    case 'deployParachute':
      e.wantDeploy = true;
      break;
  }
}

export function buildSnapshot(w: World): WorldSnapshot {
  const entities: EntitySnapshot[] = w.entities.map((e) => ({
    id: e.id,
    kind: e.kind,
    alive: e.alive,
    pos: { ...e.pos },
    yaw: e.yaw,
    pitch: e.pitch,
    state: e.state,
    weapon: e.weapons[e.activeWeapon]?.weapon ?? null,
    hp: e.hp,
    maxHp: e.maxHp,
  }));

  const loots: LootSnapshot[] = [];
  for (const l of w.loots) {
    if (l.taken) continue;
    loots.push({ id: l.id, item: l.item, pos: l.pos });
  }

  let player: PlayerViewSnapshot | null = null;
  const p = w.player;
  const slot = p.weapons[p.activeWeapon];
  const slotDef = slot ? w.pack.weapons[slot.weapon as keyof typeof w.pack.weapons] : null;
  player = {
    id: p.id,
    hp: p.hp,
    maxHp: p.maxHp,
    state: p.state,
    weapon: slot?.weapon ?? null,
    magazine: slot?.magazine ?? null,
    reserve: slotDef ? (p.ammoReserve[slotDef.ammoType] ?? 0) : null,
    reloading: p.reloadUntilMs !== null,
    weapons: p.weapons.map((s) => (s ? { ...s } : null)),
    inventory: p.inventory.map((s) => (s ? { ...s } : null)),
    usedGrids: p.usedGrids,
    armorReduction: p.armorReduction,
    helmetReduction: p.helmetReduction,
    kills: p.kills,
    aliveCount: w.entities.reduce((n, e) => n + (e.alive ? 1 : 0), 0),
    medkitChannelMsLeft: p.medkitUntilMs !== null ? Math.max(0, p.medkitUntilMs - w.elapsedMs) : 0,
  };

  return {
    tick: w.tick,
    elapsedMs: w.elapsedMs,
    status: w.status,
    entities,
    player,
    loots,
    playerEntity: entities.length > 0 && entities[0].id === w.player.id ? entities[0] : null,
    zone: {
      center: { ...w.zone.center },
      radius: w.zone.radius,
      nextCenter: { ...w.zone.nextCenter },
      nextRadius: w.zone.nextRadius,
      phase: w.zone.phase,
      phaseCount: w.pack.zone.phases.length,
      mode: w.zone.mode,
      timeLeftMs: Math.max(0, w.zone.timerMs),
      dps: w.zone.dps,
    },
    plane: w.plane.active
      ? { active: true, pos: { ...w.plane.pos }, dir: { ...w.plane.dir } }
      : null,
  };
}

export function createMatch(config: MatchConfig): MatchHandle & { world: World } {
  const w = createWorldForTest(config);
  // 零分配快照通道：预分配对象图，每帧只覆写（渲染/UI 每帧消费，避免 GC 抖动）
  const snapshotWriter = new SnapshotWriter(Math.max(ENTITY_CAP, w.entities.length));
  // 事件缓冲复用：上一帧事件已在本帧内被 UI/特效消费完，下一帧 drain 时回收该数组
  let reclaimedEvents: GameEvent[] = [];
  return {
    world: w,
    tick(intents: PlayerIntent[] = []): void {
      tickWorld(w, intents);
    },
    snapshot(): WorldSnapshot {
      return buildSnapshot(w);
    },
    snapshotReusable(): WorldSnapshot {
      return snapshotWriter.write(w);
    },
    drainEvents(): GameEvent[] {
      const spare = reclaimedEvents;
      spare.length = 0;
      const out = w.events;
      w.events = spare;
      reclaimedEvents = out;
      return out;
    },
    status(): MatchStatus {
      return w.status;
    },
    result(): MatchResult | null {
      return w.result;
    },
    elapsed(): number {
      return w.elapsedMs;
    },
  };
}

export type { LootItem };
export { pushEvent, TICK_MS };
