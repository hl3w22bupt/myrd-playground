// enemy.js — 敌兵表现：圆角盒拼装人形池 + 快照驱动（位置/朝向/受击闪白/死亡倒地/腿部摆动）。
// 资产接线：人形经 assets/a02-geometry.mjs（引用失败降级同形兜底体）；姿态幅度取自 assets/palette.mjs。

import * as THREE from "three";
import { gameModel } from "../../assets/a02-geometry.mjs";
import { safe, styleCard } from "../../assets/index.mjs";

const P = styleCard();

export class EnemyPool {
  constructor(scene) {
    this.scene = scene;
    this.free = [];
    this.live = new Map(); // kernelId → rig
  }
  acquire(id) {
    let rig = this.free.pop();
    if (!rig) {
      // 资产引用：a02/soldier（兜底链 a02 fallback → 空组，绝不阻断出兵）
      rig = safe("a02:soldier", () => gameModel("a02/soldier"), () => ({ group: new THREE.Group(), parts: {} })) ?? { group: new THREE.Group(), parts: {} };
    }
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
      // 走路摆动（chase 时摆动，engage 站定微晃；幅度取风格卡比例段）
      const moving = e.state === "chase";
      const S = P.scale.soldier;
      const s = moving ? Math.sin(world.time * 9 + e.id) * S.walkSwing : Math.sin(world.time * 2 + e.id) * S.idleSway;
      if (rig.parts?.legL) rig.parts.legL.rotation.x = moving ? s : 0;
      if (rig.parts?.legR) rig.parts.legR.rotation.x = moving ? -s : 0;
      if (rig.parts?.armL) rig.parts.armL.rotation.x = moving ? -s * 0.5 : S.aimPose; // 举枪姿态
      if (rig.parts?.armR) rig.parts.armR.rotation.x = moving ? s * 0.5 : S.aimPose;
    }
    // 受击闪白（材质切换，走缓存克隆材质）
    flash(rig, e.hitFlashT > 0);
  }
  for (const id of [...pool.live.keys()]) if (!alive.has(id)) pool.release(id);
}

let flashMat = null;
function flash(rig, on) {
  if (!rig.parts?.torso || !rig.parts?.head) return; // 兜底体无独立部位时跳过闪白
  if (!flashMat) flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: P.fx.hitFlash, emissiveIntensity: 1.4 });
  // 先存原材质再切换（顺序不能反，否则原材质引用被闪白材质覆盖）
  if (!rig.baseMats) rig.baseMats = { torso: rig.parts.torso.material, head: rig.parts.head.material };
  rig.parts.torso.material = on ? flashMat : rig.baseMats.torso;
  rig.parts.head.material = on ? flashMat : rig.baseMats.head;
}
