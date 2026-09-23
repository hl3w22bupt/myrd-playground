// enemy.js — 敌兵表现：圆角盒拼装人形池 + 快照驱动（位置/朝向/受击闪白/死亡倒地/腿部摆动）。

import * as THREE from "three";
import { buildSoldier } from "./geometry.js";

export class EnemyPool {
  constructor(scene) {
    this.scene = scene;
    this.free = [];
    this.live = new Map(); // kernelId → rig
  }
  acquire(id) {
    let rig = this.free.pop();
    if (!rig) rig = buildSoldier();
    this.scene.add(rig.group);
    this.live.set(id, rig);
    return rig;
  }
  release(id) {
    const rig = this.live.get(id);
    if (!rig) return;
    this.scene.remove(rig.group);
    this.live.delete(id);
    this.free.push(rig);
  }
  get(id) { return this.live.get(id); }
  clear() { for (const id of [...this.live.keys()]) this.release(id); }
}

/** 快照 → 表现：每帧对每个活敌同步位姿；死亡敌兵先播倒地再由内核清理回收。*/
export function syncEnemies(pool, world, dt) {
  const alive = new Set();
  for (const e of world.enemies) {
    alive.add(e.id);
    let rig = pool.get(e.id);
    if (!rig) rig = pool.acquire(e.id);
    const g = rig.group;
    g.position.set(e.x, 0, e.z);
    g.rotation.y = e.yaw;
    const dead = e.state === "dead";
    if (dead) {
      // 倒地：绕 x 轴倒下 + 下沉（表现层自身时间驱动，确定性归内核，死亡外观归表现）
      const t = Math.min(1, e.deadT / 30);
      g.rotation.x = t * (Math.PI / 2) * 0.9;
      g.position.y = -t * 0.15;
    } else {
      g.rotation.x = 0;
      g.position.y = 0;
      // 走路摆动（chase 时摆动，engage 站定微晃）
      const moving = e.state === "chase";
      const s = moving ? Math.sin(world.time * 9 + e.id) * 0.5 : Math.sin(world.time * 2 + e.id) * 0.06;
      rig.parts.legL.rotation.x = moving ? s : 0;
      rig.parts.legR.rotation.x = moving ? -s : 0;
      rig.parts.armL.rotation.x = moving ? -s * 0.5 : -0.9; // 举枪姿态
      rig.parts.armR.rotation.x = moving ? s * 0.5 : -0.9;
    }
    // 受击闪白（材质切换，走缓存克隆材质）
    flash(rig, e.hitFlashT > 0);
  }
  for (const id of [...pool.live.keys()]) if (!alive.has(id)) pool.release(id);
}

let flashMat = null;
function flash(rig, on) {
  if (!flashMat) flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5a3c, emissiveIntensity: 1.4 });
  // 先存原材质再切换（顺序不能反，否则原材质引用被闪白材质覆盖）
  if (!rig.baseMats) rig.baseMats = { torso: rig.parts.torso.material, head: rig.parts.head.material };
  rig.parts.torso.material = on ? flashMat : rig.baseMats.torso;
  rig.parts.head.material = on ? flashMat : rig.baseMats.head;
}
