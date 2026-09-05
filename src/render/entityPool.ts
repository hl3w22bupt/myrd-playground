/**
 * render/entityPool —— 实体视图池（本步升级：对象池 × 实例合批 × LOD 三合一）。
 *
 * 演进：
 * v1（性能小步）：预建 capacity 套 Group/Geometry/Material，acquire 出栈复用——运行期零创建/零销毁，
 *               但每实体 3 个独立 Mesh，20 实体 = 最多 60 draw call。
 * v2（画面升级步）：部件改为 3 个 InstancedMesh（躯干/头/枪），实体 = 槽位 = 实例下标。
 *               同屏全部实体固定 3 draw call（ENTITY_BATCH_MESH_COUNT），与实体数无关；
 *               池升级为「槽位池」：acquire/release O(1)、零分配；隐藏/LOD 降级实例写零缩放矩阵。
 *
 * LOD 协作：视图带 detail（render/lod 判定），sync() 只写可见部件矩阵——LOD 切换
 * 不增删对象、不改变 draw call 数，仅省远处顶点/片元。
 *
 * 颜色通道：躯干 instanceColor 承载队伍染色 + 受击闪白（命中事件 → hurtT 衰减），
 * 脏检查写色（颜色不变不上传），保持上一小步「消除逐帧 instanceColor 上传」的优化。
 */

import * as THREE from 'three';
import { ENTITY_BATCH_MESH_COUNT, ENTITY_VIEW_POOL_SIZE } from '../content/render';
import { ENTITY_DETAIL_FULL, type EntityDetail, partVisibleAtDetail } from './lod';

/** 部件下标（与 partVisibleAtDetail 约定一致） */
const PART_BODY = 0;
const PART_GUN = 2;

/** 零缩放矩阵：隐藏实例（共享常量，写入零分配；退化三角形不产生片元） */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/** 实体视图：槽位句柄 + 渲染插值状态（无 Group，实体对象本身零驻留场景图） */
export interface EntityView {
  readonly slot: number;
  /** 是否参与本帧绘制（false → 槽位实例矩阵置零） */
  visible: boolean;
  /** 渲染位置（插值后，只读快照语义，不回写仿真） */
  x: number;
  y: number;
  z: number;
  /** 朝向（rad） */
  yaw: number;
  /** LOD 细节级别（render/lod 判定结果） */
  detail: EntityDetail;
  /** 队伍染色（tint 写入，sync 脏检查上传） */
  tintR: number;
  tintG: number;
  tintB: number;
  /** 受击闪白剩余时间（秒） */
  hurtT: number;
  /** 上一逻辑 tick 位置（值拷贝，用于渲染插值） */
  hasPrev: boolean;
  prevX: number;
  prevY: number;
  prevZ: number;
}

export class EntityViewPool {
  private readonly parts: Array<THREE.InstancedMesh> = [];
  private readonly views: EntityView[] = [];
  private readonly freeSlots: number[] = [];
  private readonly usedSlots = new Set<number>();

  private readonly bodyGeo: THREE.CapsuleGeometry;
  private readonly headGeo: THREE.SphereGeometry;
  private readonly gunGeo: THREE.BoxGeometry;
  private readonly headMat: THREE.MeshLambertMaterial;
  private readonly gunMat: THREE.MeshLambertMaterial;

  // 复用临时对象（sync 逐槽位零分配）
  private readonly tmpMat = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpOff = new THREE.Vector3();
  private readonly tmpColor = new THREE.Color();
  /** 上次上传的实例色（脏检查：颜色不变不写 instanceColor） */
  private readonly lastColor: Float32Array;

  constructor(
    private readonly scene: THREE.Scene,
    /** 池容量（默认 ENTITY_VIEW_POOL_SIZE = ENTITY_CAP），封顶后运行期不再创建 */
    capacity: number = ENTITY_VIEW_POOL_SIZE,
  ) {
    const cap = Math.max(0, capacity);
    // 共享几何（全部实体实例复用同一几何）
    this.bodyGeo = new THREE.CapsuleGeometry(0.36, 0.9, 3, 8);
    this.headGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this.gunGeo = new THREE.BoxGeometry(0.08, 0.08, 0.9);
    this.headMat = new THREE.MeshLambertMaterial({ color: 0xd9b38c });
    this.gunMat = new THREE.MeshLambertMaterial({ color: 0x33383d });
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // 部件偏移/朝向约定：躯干无附加偏移，头/枪沿站姿纵向偏移（与 v1 视觉一致）
    const geos = [this.bodyGeo, this.headGeo, this.gunGeo];
    const mats = [bodyMat, this.headMat, this.gunMat];
    const offsets = [
      new THREE.Vector3(0, 0.95, 0),
      new THREE.Vector3(0, 1.62, 0),
      new THREE.Vector3(0.22, 1.25, 0.5),
    ];
    this.partOffsets = offsets;
    this.lastColor = new Float32Array(cap * 3).fill(-1);

    for (let part = 0; part < ENTITY_BATCH_MESH_COUNT; part++) {
      const inst = new THREE.InstancedMesh(geos[part]!, mats[part]!, cap);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.frustumCulled = false; // 实例分布全图，包围球剔除无效
      inst.count = cap;
      inst.castShadow = part !== PART_GUN; // 枪为细长小盒，跳过阴影投射（省 shadow pass 顶点）
      if (part === PART_BODY) {
        for (let i = 0; i < cap; i++) inst.setColorAt(i, this.tmpColor.setRGB(1, 1, 1));
        if (inst.instanceColor) inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      this.parts.push(inst);
      this.scene.add(inst);
    }

    for (let slot = 0; slot < cap; slot++) {
      this.freeSlots.push(slot);
      this.views.push({
        slot,
        visible: false,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        detail: ENTITY_DETAIL_FULL,
        tintR: 1,
        tintG: 1,
        tintB: 1,
        hurtT: 0,
        hasPrev: false,
        prevX: 0,
        prevY: 0,
        prevZ: 0,
      });
    }
  }

  /** 部件局部偏移（躯干/头/枪；构建时确定） */
  private readonly partOffsets: THREE.Vector3[];

  /** 躯干实例色是否本帧有变化（脏标记：避免逐帧 instanceColor 上传） */
  private bodyColorDirty = false;

  get capacity(): number {
    return this.views.length;
  }

  get acquiredCount(): number {
    return this.usedSlots.size;
  }

  /** 合批不变量：同屏实体 draw call 数恒为部件 mesh 数（与实体数无关） */
  get drawCalls(): number {
    return this.parts.length;
  }

  /** 部件实例网格（调试/测试用：断言合批不变量与实例矩阵，勿在渲染循环内使用） */
  get partMeshes(): readonly THREE.InstancedMesh[] {
    return this.parts;
  }

  /** 取一个空闲槽位视图；池耗尽返回 null（调用方应隐藏该实体，不得现场创建） */
  acquire(): EntityView | null {
    const slot = this.freeSlots.pop();
    if (slot === undefined) return null;
    this.usedSlots.add(slot);
    const v = this.views[slot]!;
    v.visible = false;
    v.x = 0;
    v.y = 0;
    v.z = 0;
    v.yaw = 0;
    v.detail = ENTITY_DETAIL_FULL;
    v.hurtT = 0;
    v.hasPrev = false;
    v.prevX = 0;
    v.prevY = 0;
    v.prevZ = 0;
    return v;
  }

  /** 归还单个视图（对局内实体淘汰即归还；对象复用不销毁，矩阵立即置零防残影） */
  release(view: EntityView): void {
    if (!this.usedSlots.delete(view.slot)) return;
    view.visible = false;
    this.hideSlot(view.slot);
    this.markMatricesDirty();
    this.freeSlots.push(view.slot);
  }

  /** 归还全部视图（对局重开时复用，不销毁对象；矩阵立即置零防残影） */
  releaseAll(): void {
    if (this.parts.length > 0) {
      for (const slot of this.usedSlots) this.hideSlot(slot);
      if (this.usedSlots.size > 0) this.markMatricesDirty();
    }
    for (const slot of this.usedSlots) this.freeSlots.push(slot);
    this.usedSlots.clear();
    for (const v of this.views) v.visible = false;
  }

  /** 队伍染色（复用视图时调用；不改材质数量） */
  tint(view: EntityView, color: number): void {
    this.tmpColor.setHex(color);
    view.tintR = this.tmpColor.r;
    view.tintG = this.tmpColor.g;
    view.tintB = this.tmpColor.b;
  }

  /**
   * 每帧一次：把全部槽位状态刷入实例矩阵/颜色（调用方在写完视图后调用一次）。
   * 零分配：矩阵/四元数/颜色全部复用；隐藏部件写共享零缩放矩阵。
   */
  sync(): void {
    const body = this.parts[PART_BODY]!;

    for (const slot of this.usedSlots) {
      const v = this.views[slot]!;
      if (!v.visible) {
        this.hideSlot(slot);
        continue;
      }
      this.tmpEuler.set(0, v.yaw, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);

      for (let part = 0; part < this.parts.length; part++) {
        if (!partVisibleAtDetail(part, v.detail)) {
          this.parts[part]!.setMatrixAt(slot, ZERO_MATRIX);
          continue;
        }
        this.tmpOff.copy(this.partOffsets[part]!).applyQuaternion(this.tmpQuat);
        this.tmpPos.set(v.x + this.tmpOff.x, v.y + this.tmpOff.y, v.z + this.tmpOff.z);
        this.parts[part]!.setMatrixAt(slot, this.tmpMat.compose(this.tmpPos, this.tmpQuat, ONE_SCALE));
      }

      // 躯干实例色 = 队伍色 → 受击闪白（hurtT 0..1 线性提亮），脏检查避免逐帧上传
      const flash = Math.max(0, Math.min(1, v.hurtT)) * 0.85;
      const r = v.tintR + (1 - v.tintR) * flash;
      const g = v.tintG + (1 - v.tintG) * flash;
      const b = v.tintB + (1 - v.tintB) * flash;
      const ci = slot * 3;
      const last = this.lastColor;
      if (last[ci] !== r || last[ci + 1] !== g || last[ci + 2] !== b) {
        body.setColorAt(slot, this.tmpColor.setRGB(r, g, b));
        last[ci] = r;
        last[ci + 1] = g;
        last[ci + 2] = b;
        this.bodyColorDirty = true;
      }
    }

    for (const part of this.parts) part.instanceMatrix.needsUpdate = true;
    if (this.bodyColorDirty && body.instanceColor) {
      body.instanceColor.needsUpdate = true;
      this.bodyColorDirty = false;
    }
  }

  /** 置零后标记矩阵脏（供本帧上传） */
  private markMatricesDirty(): void {
    for (const part of this.parts) part.instanceMatrix.needsUpdate = true;
  }

  /** 槽位隐藏：三部件全部置零矩阵 */
  private hideSlot(slot: number): void {
    for (const part of this.parts) part.setMatrixAt(slot, ZERO_MATRIX);
  }

  dispose(): void {
    this.releaseAll();
    for (const part of this.parts) {
      part.geometry.dispose();
      (part.material as THREE.Material).dispose();
      this.scene.remove(part);
    }
    this.parts.length = 0;
    this.views.length = 0;
    this.freeSlots.length = 0;
    this.usedSlots.clear();
  }
}

const ONE_SCALE = new THREE.Vector3(1, 1, 1);
