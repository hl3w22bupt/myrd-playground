/**
 * core/snapshot —— 可复用快照写入器（渲染/UI 每帧快照通道，零逐帧分配）。
 *
 * 背景：buildSnapshot() 每次调用都重建整个对象图（实体×多对象 + 全部物资 + 玩家背包数组）。
 * 渲染层 60FPS 下每帧调用一次时，每秒产生数千个短命对象 → GC 抖动 → 帧率毛刺与堆持续增长。
 * 本写入器一次性预分配对象图，write() 只覆写字段值并返回恒定引用（逐帧分配数为 0）。
 *
 * 有效性约束：返回的 WorldSnapshot 是复用对象，仅在下一次 write() 前有效；
 * 需要跨帧保留快照请改用 buildSnapshot()（分配版）。
 *
 * 确定性红线：只读 World、不写任何仿真状态、不使用 Math.random/Date.now。
 */

import { ENTITY_CAP, INVENTORY_GRIDS } from '../content/constants';
import type {
  AirDropSnapshot,
  EntityKind,
  EntitySnapshot,
  InvItem,
  LootSnapshot,
  PlayerState,
  PlayerViewSnapshot,
  PlaneSnapshot,
  WeaponSlotState,
  WorldSnapshot,
  ZoneSnapshot,
} from './types';
import type { World } from './world';

function makeEntitySnapshot(): EntitySnapshot {
  return {
    id: '',
    kind: 'ai' as EntityKind,
    alive: false,
    pos: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    state: 'dead' as PlayerState,
    weapon: null,
    hp: 0,
    maxHp: 0,
  };
}

/**
 * 零分配快照写入器。
 * @param capacity 预分配实体槽数（默认 ENTITY_CAP；不足时自动扩容一次并保留）
 */
export class SnapshotWriter {
  /** 恒定引用：每次 write() 都返回同一对象 */
  readonly snapshot: WorldSnapshot;

  private readonly entitySnaps: EntitySnapshot[];
  private readonly lootSnaps: LootSnapshot[];
  private readonly zoneSnap: ZoneSnapshot;
  private readonly planeSnap: PlaneSnapshot;
  private readonly airdropSnaps: AirDropSnapshot[] = [];
  private readonly playerSnap: PlayerViewSnapshot;
  private readonly playerWeaponSlots: Array<WeaponSlotState | null>;
  private readonly playerSlotObjs: WeaponSlotState[];
  private readonly playerInvSlots: Array<InvItem | null>;
  private readonly playerInvObjs: InvItem[];

  constructor(capacity: number = ENTITY_CAP) {
    this.entitySnaps = [];
    for (let i = 0; i < Math.max(1, capacity); i++) this.entitySnaps.push(makeEntitySnapshot());
    this.lootSnaps = [];

    this.zoneSnap = {
      center: { x: 0, y: 0, z: 0 },
      radius: 0,
      nextCenter: { x: 0, y: 0, z: 0 },
      nextRadius: 0,
      phase: 0,
      phaseCount: 0,
      mode: 'wait',
      timeLeftMs: 0,
      dps: 0,
    };
    this.planeSnap = { active: false, pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 0 } };

    this.playerWeaponSlots = [null, null];
    this.playerSlotObjs = [
      { weapon: '', magazine: 0 },
      { weapon: '', magazine: 0 },
    ];
    this.playerInvSlots = new Array(INVENTORY_GRIDS).fill(null);
    this.playerInvObjs = [];
    for (let i = 0; i < INVENTORY_GRIDS; i++) this.playerInvObjs.push({ item: '', count: 0 });

    this.playerSnap = {
      id: '',
      hp: 0,
      maxHp: 0,
      state: 'dead',
      weapon: null,
      magazine: null,
      reserve: null,
      reloading: false,
      weapons: this.playerWeaponSlots,
      inventory: this.playerInvSlots,
      usedGrids: 0,
      armorReduction: 0,
      helmetReduction: 0,
      kills: 0,
      aliveCount: 0,
      medkitChannelMsLeft: 0,
      medkitItem: null,
    };

    this.snapshot = {
      tick: 0,
      elapsedMs: 0,
      status: 'lobby',
      entities: this.entitySnaps,
      player: this.playerSnap,
      loots: this.lootSnaps,
      zone: this.zoneSnap,
      plane: null,
      airdrops: this.airdropSnaps,
      playerEntity: null,
    };
  }

  /** 覆写快照（零分配）并返回恒定引用 */
  write(w: World): WorldSnapshot {
    this.writeEntities(w);
    this.writeLoots(w);
    this.writePlayer(w);
    this.writeZone(w);
    this.writePlane(w);
    this.writeAirdrops(w);

    const s = this.snapshot;
    s.tick = w.tick;
    s.elapsedMs = w.elapsedMs;
    s.status = w.status;
    return s;
  }

  private writeEntities(w: World): void {
    const src = w.entities;
    const dst = this.entitySnaps;
    // 容量不足时扩容（常态 ≤ ENTITY_CAP，不触发；触发后容量保留，不再分配）
    while (dst.length < src.length) dst.push(makeEntitySnapshot());
    dst.length = src.length;

    let playerEntity: EntitySnapshot | null = null;
    for (let i = 0; i < src.length; i++) {
      const e = src[i];
      const d = dst[i];
      d.id = e.id;
      d.kind = e.kind;
      d.alive = e.alive;
      d.pos.x = e.pos.x;
      d.pos.y = e.pos.y;
      d.pos.z = e.pos.z;
      d.yaw = e.yaw + e.recoilYaw;
      d.pitch = e.pitch + e.recoilPitch;
      d.state = e.state;
      d.weapon = e.weapons[e.activeWeapon]?.weapon ?? null;
      d.hp = e.hp;
      d.maxHp = e.maxHp;
      if (e.kind === 'player') playerEntity = d;
    }
    this.snapshot.playerEntity = playerEntity;
  }

  private writeLoots(w: World): void {
    const src = w.loots;
    const dst = this.lootSnaps;
    let n = 0;
    for (let i = 0; i < src.length; i++) {
      const l = src[i];
      if (l.taken) continue;
      let d = dst[n];
      if (d === undefined) {
        d = { id: '', item: '', pos: { x: 0, y: 0, z: 0 } };
        dst.push(d);
      }
      d.id = l.id;
      d.item = l.item;
      d.pos.x = l.pos.x;
      d.pos.y = l.pos.y;
      d.pos.z = l.pos.z;
      n += 1;
    }
    dst.length = n;
  }

  private writePlayer(w: World): void {
    const p = w.player;
    const d = this.playerSnap;
    const slot = p.weapons[p.activeWeapon];
    const slotDef = slot ? w.pack.weapons[slot.weapon as keyof typeof w.pack.weapons] : null;

    d.id = p.id;
    d.hp = p.hp;
    d.maxHp = p.maxHp;
    d.state = p.state;
    d.weapon = slot?.weapon ?? null;
    d.magazine = slot?.magazine ?? null;
    d.reserve = slotDef ? (p.ammoReserve[slotDef.ammoType] ?? 0) : null;
    d.reloading = p.reloadUntilMs !== null;
    d.usedGrids = p.usedGrids;
    d.armorReduction = p.armorReduction;
    d.helmetReduction = p.helmetReduction;
    d.kills = p.kills;
    d.medkitChannelMsLeft = p.medkitUntilMs !== null ? Math.max(0, p.medkitUntilMs - w.elapsedMs) : 0;
    d.medkitItem =
      p.medkitUntilMs !== null && p.medkitItemSlot !== null
        ? (p.inventory[p.medkitItemSlot]?.item ?? null)
        : null;

    // 武器槽（复用槽对象，零分配）：槽位数跟随 p.weapons.length 原地扩缩，
    // 与分配版 buildSnapshot 的 weapons.map(...) 通道在任何槽数下保持一致（默认 2 槽不变）
    const weapons = this.playerWeaponSlots;
    const slotCount = p.weapons.length;
    while (weapons.length < slotCount) {
      // 扩容仅在槽位配置变化时发生一次；稳态循环内零分配。引用数组原地 push，恒定引用不变
      if (this.playerSlotObjs.length < slotCount) this.playerSlotObjs.push({ weapon: '', magazine: 0 });
      weapons.push(null);
    }
    for (let i = 0; i < slotCount; i++) {
      const s = p.weapons[i];
      if (s) {
        const o = this.playerSlotObjs[i];
        o.weapon = s.weapon;
        o.magazine = s.magazine;
        weapons[i] = o;
      } else {
        weapons[i] = null;
      }
    }
    // 收缩：仅截断引用数组（槽对象保留在 playerSlotObjs，回升时直接复用，不重新分配）
    if (weapons.length > slotCount) weapons.length = slotCount;

    // 背包格子（复用格子对象，零分配）
    const inv = this.playerInvSlots;
    while (this.playerInvObjs.length < p.inventory.length) {
      this.playerInvObjs.push({ item: '', count: 0 });
      inv.push(null);
    }
    inv.length = p.inventory.length;
    for (let i = 0; i < p.inventory.length; i++) {
      const s = p.inventory[i];
      if (s) {
        const o = this.playerInvObjs[i];
        o.item = s.item;
        o.count = s.count;
        inv[i] = o;
      } else {
        inv[i] = null;
      }
    }

    // 存活数（普通循环，避免 reduce 闭包分配）
    let alive = 0;
    const ents = w.entities;
    for (let i = 0; i < ents.length; i++) if (ents[i].alive) alive += 1;
    d.aliveCount = alive;
  }

  private writeZone(w: World): void {
    const z = w.zone;
    const d = this.zoneSnap;
    d.center.x = z.center.x;
    d.center.y = z.center.y;
    d.center.z = z.center.z;
    d.radius = z.radius;
    d.nextCenter.x = z.nextCenter.x;
    d.nextCenter.y = z.nextCenter.y;
    d.nextCenter.z = z.nextCenter.z;
    d.nextRadius = z.nextRadius;
    d.phase = z.phase;
    d.phaseCount = w.pack.zone.phases.length;
    d.mode = z.mode;
    d.timeLeftMs = Math.max(0, z.timerMs);
    d.dps = z.dps;
  }

  private writePlane(w: World): void {
    const p = w.plane;
    if (!p.active) {
      this.snapshot.plane = null;
      return;
    }
    const d = this.planeSnap;
    d.active = true;
    d.pos.x = p.pos.x;
    d.pos.y = p.pos.y;
    d.pos.z = p.pos.z;
    d.dir.x = p.dir.x;
    d.dir.y = p.dir.y;
    d.dir.z = p.dir.z;
    this.snapshot.plane = d;
  }

  private writeAirdrops(w: World): void {
    const src = w.airdrops;
    const dst = this.airdropSnaps;
    while (dst.length < src.length) {
      dst.push({ id: '', pos: { x: 0, y: 0, z: 0 }, y: 0, phase: 'falling' });
    }
    dst.length = src.length;
    for (let i = 0; i < src.length; i++) {
      const a = src[i];
      const d = dst[i];
      d.id = a.id;
      d.pos.x = a.pos.x;
      d.pos.y = a.pos.y;
      d.pos.z = a.pos.z;
      d.y = a.pos.y;
      d.phase = a.phase;
    }
  }
}
