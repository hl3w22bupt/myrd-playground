/**
 * render/effects —— 弹道拖尾 / 枪口火焰 / 命中火花 / 淘汰爆裂 / 缩圈脉冲 / 毒圈粒子带。
 * 全部对象池 + 固定缓冲 Points（零逐帧分配，AC1 内存红线）。
 * 特效全部由 core 事件驱动（shotFired / entityEliminated / zonePhaseChanged），与游戏事件同步触发（AC2③）。
 */

import * as THREE from 'three';
import type { GameEvent, ProjectileSnapshot, Vec3 } from '../core/types';
import {
  FLASH_POOL_SIZE,
  HIT_PARTICLE_COUNT,
  PULSE_POOL_SIZE,
  TRACER_POOL_SIZE,
  ZONE_PARTICLE_COUNT,
} from '../content/render';
import { makeGlowTexture } from './textures';

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Flash {
  sprite: THREE.Sprite;
  life: number;
  baseScale: number;
}

/** 缩圈脉冲冲击波（环形放大淡出） */
interface Pulse {
  mesh: THREE.Mesh;
  life: number;
}

/** 池容量来自 content/render 配置表（数值与历史实现一致，仅收敛到配置） */
const TRACER_POOL = TRACER_POOL_SIZE;
const FLASH_POOL = FLASH_POOL_SIZE;
const PULSE_POOL = PULSE_POOL_SIZE;
const HIT_PARTICLES = HIT_PARTICLE_COUNT;
const ZONE_PARTICLES = ZONE_PARTICLE_COUNT;
const PARTICLE_LIFE = 0.45;
const FLASH_LIFE = 0.09;
const PULSE_LIFE = 1.1;

/** 实体位置解析器：view 层提供（事件不含位置，渲染层从插值视图取） */
export type EntityPosResolver = (id: string) => Vec3 | null;

export class EffectLayer {
  private tracers: Tracer[] = [];
  private flashes: Flash[] = [];
  private pulses: Pulse[] = [];
  private tracerCursor = 0;
  private flashCursor = 0;
  private pulseCursor = 0;

  // 火花/爆裂粒子（固定缓冲 Points）
  private points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifes: Float32Array;
  private maxLifes: Float32Array;
  private particleCursor = 0;

  // 毒圈边缘粒子带（固定缓冲 Points，循环上升）
  private zonePoints: THREE.Points;
  private zonePos: Float32Array;
  private zoneSeed: Float32Array;
  private zoneRadius = 0;
  private zoneCx = 0;
  private zoneCz = 0;

  constructor(scene: THREE.Scene) {
    const glow = makeGlowTexture();

    // —— 弹道拖尾池 ——
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xffe9a0,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    for (let i = 0; i < TRACER_POOL; i++) {
      const g = geo.clone();
      const line = new THREE.Line(g, tracerMat.clone());
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    // —— 枪口火焰池 ——
    const flashMat = new THREE.SpriteMaterial({
      map: glow,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < FLASH_POOL; i++) {
      const sprite = new THREE.Sprite(flashMat.clone());
      sprite.scale.set(1.6, 1.6, 1);
      sprite.visible = false;
      scene.add(sprite);
      this.flashes.push({ sprite, life: 0, baseScale: 1.6 });
    }

    // —— 缩圈脉冲池 ——
    const pulseGeo = new THREE.RingGeometry(0.92, 1, 64);
    pulseGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < PULSE_POOL; i++) {
      const mesh = new THREE.Mesh(
        pulseGeo,
        new THREE.MeshBasicMaterial({
          color: 0x8fd8ff,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.pulses.push({ mesh, life: 0 });
    }

    // —— 火花/爆裂粒子 ——
    this.positions = new Float32Array(HIT_PARTICLES * 3);
    this.velocities = new Float32Array(HIT_PARTICLES * 3);
    this.lifes = new Float32Array(HIT_PARTICLES);
    this.maxLifes = new Float32Array(HIT_PARTICLES);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.55,
      map: glow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffb066,
    });
    this.points = new THREE.Points(pGeo, pMat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);

    // —— 毒圈边缘粒子带（紫色上飘，随缩圈半径收拢）——
    this.zonePos = new Float32Array(ZONE_PARTICLES * 3);
    this.zoneSeed = new Float32Array(ZONE_PARTICLES);
    for (let i = 0; i < ZONE_PARTICLES; i++) {
      this.zoneSeed[i] = Math.random();
      this.zonePos[i * 3] = -9999;
      this.zonePos[i * 3 + 1] = -9999;
    }
    const zGeo = new THREE.BufferGeometry();
    zGeo.setAttribute('position', new THREE.BufferAttribute(this.zonePos, 3));
    const zMat = new THREE.PointsMaterial({
      size: 1.6,
      map: glow,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xb45cf0,
    });
    this.zonePoints = new THREE.Points(zGeo, zMat);
    this.zonePoints.frustumCulled = false;
    this.zonePoints.visible = false;
    scene.add(this.zonePoints);
  }

  /** 由 core 事件驱动；resolve 提供实体位置（事件本身不含坐标） */
  consumeEvents(events: GameEvent[], resolve: EntityPosResolver): void {
    for (const ev of events) {
      if (ev.type === 'shotFired') {
        // 枪口火焰即时表现；弹道拖尾由 updateProjectiles 跟随投射物（弹道下坠线）
        this.spawnFlash(ev.origin, ev.dir);
      } else if (ev.type === 'projectileImpact') {
        // 弹着点火花（命中实体时 damageDealt 事件并行驱动命中标记）
        this.burstAt(ev.pos, { x: 0, y: 0.6, z: 0 }, ev.hitEntity ? 12 : 6, ev.hitEntity ? 0xff8a5a : 0xd8c9a0);
      } else if (ev.type === 'airdropLanded') {
        // 空投落地红色信号烟尘
        this.burstAt(ev.pos, { x: 0, y: 1, z: 0 }, 26, 0xff5a4a, true);
      } else if (ev.type === 'entityEliminated') {
        const p = resolve(ev.entityId);
        if (p) this.burstAt(p, { x: 0, y: 0.4, z: 0 }, 34, 0xffd0a0, true);
      } else if (ev.type === 'zonePhaseChanged') {
        this.spawnPulse(ev.center, ev.radius);
      }
    }
  }

  /** 投射物拖尾：每帧为每个在飞弹丸生成 prev→pos 短拖尾（跟随重力弧线） */
  updateProjectiles(projectiles: readonly ProjectileSnapshot[]): void {
    for (const p of projectiles) {
      // 首 tick（prev===pos）不画，避免原点闪线
      const dx = p.pos.x - p.prev.x;
      const dy = p.pos.y - p.prev.y;
      const dz = p.pos.z - p.prev.z;
      if (dx * dx + dy * dy + dz * dz < 1e-6) continue;
      this.spawnTracer(p.prev, p.pos);
    }
  }

  /** 命中/爆裂粒子：dir 为弹道方向；heavy 时喷发更强、带向上冲击 */
  burstAt(p: Vec3, dir: Vec3, count = 10, colorTint?: number, heavy = false): void {
    for (let i = 0; i < count; i++) {
      const idx = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % HIT_PARTICLES;
      this.positions[idx * 3] = p.x;
      this.positions[idx * 3 + 1] = p.y;
      this.positions[idx * 3 + 2] = p.z;
      const spread = heavy ? 9 : 5;
      this.velocities[idx * 3] = dir.x * 2 + (Math.random() - 0.5) * spread;
      this.velocities[idx * 3 + 1] = Math.abs(dir.y) * 2 + Math.random() * (heavy ? 8 : 4);
      this.velocities[idx * 3 + 2] = dir.z * 2 + (Math.random() - 0.5) * spread;
      const life = heavy ? 0.8 : PARTICLE_LIFE;
      this.lifes[idx] = life;
      this.maxLifes[idx] = life;
    }
    if (colorTint !== undefined) {
      (this.points.material as THREE.PointsMaterial).color.setHex(colorTint);
    }
    this.points.visible = true;
  }

  /** 缩圈脉冲：在新圈边界处放大冲击波 */
  private spawnPulse(center: Vec3, radius: number): void {
    const pulse = this.pulses[this.pulseCursor];
    this.pulseCursor = (this.pulseCursor + 1) % PULSE_POOL;
    pulse.mesh.position.set(center.x, 0.8, center.z);
    pulse.mesh.scale.set(radius, 1, radius);
    (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
    pulse.mesh.visible = true;
    pulse.life = PULSE_LIFE;
  }

  private spawnTracer(from: Vec3, to: Vec3): void {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % TRACER_POOL;
    const pos = t.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    (t.line.material as THREE.LineBasicMaterial).opacity = 0.85;
    t.line.visible = true;
    t.life = 0.09;
  }

  private spawnFlash(origin: Vec3, dir: Vec3): void {
    const f = this.flashes[this.flashCursor];
    this.flashCursor = (this.flashCursor + 1) % FLASH_POOL;
    f.sprite.position.set(origin.x + dir.x * 0.6, origin.y + dir.y * 0.6, origin.z + dir.z * 0.6);
    f.baseScale = 1.6 + Math.random() * 0.6;
    f.sprite.scale.set(f.baseScale, f.baseScale, 1);
    (f.sprite.material as THREE.SpriteMaterial).opacity = 1;
    f.sprite.visible = true;
    f.life = FLASH_LIFE;
  }

  /** 毒圈粒子带：随当前圈参数收拢/上升（每帧由 view 喂入圈状态） */
  updateZoneDrift(center: Vec3, radius: number, dtSec: number): void {
    if (radius <= 0) {
      this.zonePoints.visible = false;
      return;
    }
    this.zoneCx = center.x;
    this.zoneCz = center.z;
    this.zoneRadius = radius;
    const rise = 3.2 * dtSec;
    for (let i = 0; i < ZONE_PARTICLES; i++) {
      const seed = this.zoneSeed[i];
      const angle = seed * Math.PI * 2 + this.zoneRadius * 0.02;
      const jitter = (hashF(seed * 91.7) - 0.5) * radius * 0.04;
      const r = radius + jitter;
      this.zonePos[i * 3] = this.zoneCx + Math.cos(angle) * r;
      this.zonePos[i * 3 + 1] += rise;
      if (this.zonePos[i * 3 + 1] > 26) this.zonePos[i * 3 + 1] = 0.4;
      this.zonePos[i * 3 + 2] = this.zoneCz + Math.sin(angle) * r;
    }
    this.zonePoints.visible = true;
    (this.zonePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** 每帧推进（dt 秒） */
  update(dtSec: number): void {
    for (const t of this.tracers) {
      if (!t.line.visible) continue;
      t.life -= dtSec;
      const mat = t.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, t.life / 0.09) * 0.85;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const f of this.flashes) {
      if (!f.sprite.visible) continue;
      f.life -= dtSec;
      const k = Math.max(0, f.life / FLASH_LIFE);
      (f.sprite.material as THREE.SpriteMaterial).opacity = k;
      const s = f.baseScale * (1 + (1 - k) * 0.9);
      f.sprite.scale.set(s, s, 1);
      if (f.life <= 0) f.sprite.visible = false;
    }
    for (const pulse of this.pulses) {
      if (!pulse.mesh.visible) continue;
      pulse.life -= dtSec;
      const k = Math.max(0, pulse.life / PULSE_LIFE);
      (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
      const s = 1 + (1 - k) * 0.12;
      pulse.mesh.scale.x *= s;
      pulse.mesh.scale.z *= s;
      if (pulse.life <= 0) pulse.mesh.visible = false;
    }

    let anyAlive = false;
    for (let i = 0; i < HIT_PARTICLES; i++) {
      if (this.lifes[i] <= 0) continue;
      anyAlive = true;
      this.lifes[i] -= dtSec;
      this.velocities[i * 3 + 1] -= 9.8 * dtSec;
      this.positions[i * 3] += this.velocities[i * 3] * dtSec;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dtSec;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dtSec;
      if (this.lifes[i] <= 0) {
        this.positions[i * 3 + 1] = -9999;
      }
    }
    if (anyAlive) {
      (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    } else {
      this.points.visible = false;
    }
  }

  dispose(): void {
    for (const t of this.tracers) {
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    for (const f of this.flashes) {
      (f.sprite.material as THREE.Material).dispose();
    }
    for (const p of this.pulses) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.zonePoints.geometry.dispose();
    (this.zonePoints.material as THREE.Material).dispose();
  }
}

function hashF(n: number): number {
  return n - Math.floor(n);
}
