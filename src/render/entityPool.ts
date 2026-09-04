/**
 * render/entityPool —— 实体视图对象池（性能小步：实体走对象池，运行期零创建/零销毁）。
 *
 * 改造前：实体首次出现时 new Group/Geometry/Material（13 次几何创建 + GPU 上传分布在局内，
 * 造成落地/生成时刻的帧率毛刺），实体消失即 dispose（反复分配回收 → 堆抖动）。
 * 改造后：构造时一次性预建 capacity 套视图（几何/部分材质共享），acquire 只是出栈复用；
 * 容量封顶 = ENTITY_CAP，运行期不再产生任何实体视图分配。
 */

import * as THREE from 'three';
import { ENTITY_VIEW_POOL_SIZE } from '../content/render';

export interface EntityView {
  group: THREE.Group;
  body: THREE.Mesh;
  /** 上一逻辑 tick 位置（值拷贝，用于渲染插值；避免每实体持有可变 Vec3 对象） */
  hasPrev: boolean;
  prevX: number;
  prevY: number;
  prevZ: number;
  /** 受击闪白剩余时间（秒） */
  hurtT: number;
}

export class EntityViewPool {
  private readonly free: EntityView[] = [];
  private readonly acquired: EntityView[] = [];

  private readonly bodyGeo: THREE.CapsuleGeometry;
  private readonly headGeo: THREE.SphereGeometry;
  private readonly gunGeo: THREE.BoxGeometry;
  private readonly headMat: THREE.MeshLambertMaterial;
  private readonly gunMat: THREE.MeshLambertMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    /** 池容量（默认 ENTITY_VIEW_POOL_SIZE = ENTITY_CAP），封顶后运行期不再创建 */
    capacity: number = ENTITY_VIEW_POOL_SIZE,
  ) {
    // 共享几何：所有实体视图复用同一几何实例（仅材质因受击闪白需逐实体独立）
    this.bodyGeo = new THREE.CapsuleGeometry(0.36, 0.9, 3, 8);
    this.headGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this.gunGeo = new THREE.BoxGeometry(0.08, 0.08, 0.9);
    this.headMat = new THREE.MeshLambertMaterial({ color: 0xd9b38c });
    this.gunMat = new THREE.MeshLambertMaterial({ color: 0x33383d });

    for (let i = 0; i < Math.max(0, capacity); i++) {
      this.free.push(this.build(0x4da3ff));
    }
  }

  get capacity(): number {
    return this.free.length + this.acquired.length;
  }

  get acquiredCount(): number {
    return this.acquired.length;
  }

  /** 取一个空闲视图；池耗尽返回 null（调用方应隐藏该实体，不得现场创建） */
  acquire(): EntityView | null {
    const v = this.free.pop();
    if (!v) return null;
    v.group.visible = false;
    v.hasPrev = false;
    v.prevX = 0;
    v.prevY = 0;
    v.prevZ = 0;
    v.hurtT = 0;
    this.acquired.push(v);
    return v;
  }

  /** 归还全部视图（对局重开时复用，不销毁对象） */
  releaseAll(): void {
    for (const v of this.acquired) {
      v.group.visible = false;
      (v.body.material as THREE.MeshLambertMaterial).emissive.setScalar(0);
      this.free.push(v);
    }
    this.acquired.length = 0;
  }

  /** 由玩家/AI 染色（复用视图时调用；不改材质数量） */
  tint(view: EntityView, color: number): void {
    (view.body.material as THREE.MeshLambertMaterial).color.setHex(color);
  }

  dispose(): void {
    this.releaseAll();
    this.bodyGeo.dispose();
    this.headGeo.dispose();
    this.gunGeo.dispose();
    this.headMat.dispose();
    this.gunMat.dispose();
    for (const v of this.free) {
      (v.body.material as THREE.Material).dispose();
      this.scene.remove(v.group);
    }
    this.free.length = 0;
  }

  private build(bodyColor: number): EntityView {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(this.headGeo, this.headMat);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    const gun = new THREE.Mesh(this.gunGeo, this.gunMat);
    gun.position.set(0.22, 1.25, 0.5);
    group.add(gun);
    group.visible = false;
    this.scene.add(group);
    return { group, body, hasPrev: false, prevX: 0, prevY: 0, prevZ: 0, hurtT: 0 };
  }
}
