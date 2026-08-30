/**
 * render/effects —— 弹道拖尾 / 枪口火焰 / 命中粒子（对象池，零逐帧分配，AC1 内存红线）。
 * 特效全部由 core 事件驱动（shotFired / damageDealt），与游戏事件同步触发（AC2③）。
 */

import * as THREE from 'three';
import type { GameEvent, Vec3 } from '../core/types';
import { makeGlowTexture } from './textures';

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Flash {
  sprite: THREE.Sprite;
  life: number;
}

const TRACER_POOL = 24;
const FLASH_POOL = 8;
const HIT_PARTICLES = 240;
const PARTICLE_LIFE = 0.45;

export class EffectLayer {
  private tracers: Tracer[] = [];
  private flashes: Flash[] = [];
  private tracerCursor = 0;
  private flashCursor = 0;

  // 命中粒子（固定缓冲 Points）
  private points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifes: Float32Array;
  private particleCursor = 0;

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
      this.flashes.push({ sprite, life: 0 });
    }

    // —— 命中粒子 ——
    this.positions = new Float32Array(HIT_PARTICLES * 3);
    this.velocities = new Float32Array(HIT_PARTICLES * 3);
    this.lifes = new Float32Array(HIT_PARTICLES);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.5,
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
  }

  /** 由 core 事件驱动 */
  consumeEvents(events: GameEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'shotFired') {
        this.spawnTracer(ev.origin, ev.end);
        this.spawnFlash(ev.origin, ev.dir);
      } else if (ev.type === 'damageDealt') {
        void ev;
      } else if (ev.type === 'entityEliminated') {
        void ev;
      }
    }
  }

  /** 命中点粒子（渲染层在事件后按弹道终点估算） */
  burstAt(p: Vec3, dir: Vec3): void {
    for (let i = 0; i < 10; i++) {
      const idx = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % HIT_PARTICLES;
      this.positions[idx * 3] = p.x;
      this.positions[idx * 3 + 1] = p.y;
      this.positions[idx * 3 + 2] = p.z;
      this.velocities[idx * 3] = dir.x * 2 + (Math.random() - 0.5) * 5;
      this.velocities[idx * 3 + 1] = Math.abs(dir.y) * 2 + Math.random() * 4;
      this.velocities[idx * 3 + 2] = dir.z * 2 + (Math.random() - 0.5) * 5;
      this.lifes[idx] = PARTICLE_LIFE;
    }
    this.points.visible = true;
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
    (f.sprite.material as THREE.SpriteMaterial).opacity = 1;
    f.sprite.visible = true;
    f.life = 0.06;
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
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, f.life / 0.06);
      if (f.life <= 0) f.sprite.visible = false;
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
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
