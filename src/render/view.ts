/**
 * render/view —— Three.js 表现层：快照 → 场景对象映射（渲染唯一数据源 = core snapshot）。
 * 引擎边界：本目录之外禁止 import three（CI lint 强制）。
 */

import * as THREE from 'three';
import type { GameEvent, MatchHandle, Vec3, WorldSnapshot } from '../core/types';
import type { World } from '../core/world';
import { terrainHeightAt } from '../core/mapgen';
import { ENTITY_CAP, MAP_SIZE } from '../content/constants';
import { MAX_VISIBLE_ENTITIES } from '../content/render';
import type { ContentPack } from '../content';
import { EffectLayer } from './effects';
import { SkyDome } from './sky';
import { PropsLayer } from './props';
import type { EntityView } from './entityPool';
import { EntityViewPool } from './entityPool';
import { makeBuildingTexture, makeCanopyTexture, makeGroundTexture } from './textures';
import { AutoQuality, QUALITY_PRESETS, type QualityLevel, type QualityPreset } from './quality';
import { PostFxPass } from './postfx';
import { LOOT_ANIM_HZ, SHADOW_UPDATE_HZ } from '../content/render';

/** 雾/天空地平线色（与 makeSkyTexture 渐变底色一致，形成连贯远景层次） */
const HORIZON_COLOR = 0xc3d6e6;

type MatchLike = MatchHandle & { world: World };

const ENTITY_COLORS = { player: 0x4da3ff, ai: 0xd8564a } as const;
const LOOT_COLORS: Record<string, number> = {
  weapon_ar_m4: 0xffd54a,
  weapon_smg_ump: 0xffb03a,
  ammo_556: 0x9ad06a,
  ammo_45: 0x6fae4f,
  armor_vest: 0x5aa7d6,
  helmet_mk2: 0x7fbfe0,
  medkit_large: 0xe8ecf2,
};

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private pack: ContentPack;
  private match: MatchHandle;
  private effects: EffectLayer;
  private sky: SkyDome | null = null;
  private props: PropsLayer | null = null;
  private autoQuality: AutoQuality;
  private preset: QualityPreset;

  // 静态场景
  private terrainMesh: THREE.Mesh;
  private buildingMesh: THREE.InstancedMesh;
  private dirLight: THREE.DirectionalLight;

  // 动态对象池（实体视图走池：运行期零创建/零销毁）
  private entityPool: EntityViewPool;
  /** 实体下标 → 视图（实体在 core 内下标稳定，免 Map/Set 与字符串哈希） */
  private entityViews: Array<EntityView | null> = [];
  private lootInst: THREE.InstancedMesh;
  private lootShown = 0;
  /** 物资实例颜色脏检查：槽位 → 上次写入的物品种类（'' = 未写入） */
  private lootColorItems: Array<string> = [];
  private lootColorDirty = true;
  private zoneWall: THREE.Mesh;
  private zoneRing: THREE.LineLoop;
  private planeMesh: THREE.Group;
  private canopy: THREE.Mesh;
  private canopyFor: string | null = null;
  private postfx: PostFxPass;
  /** 阴影/物资动画的帧计数降频器（60/N Hz，帧驱动下无时钟依赖） */
  private shadowFrame = 0;
  private lootFrame = 0;
  private readonly shadowEveryFrames: number;
  private readonly lootEveryFrames: number;

  private tmpMat4 = new THREE.Matrix4();
  private tmpQuat = new THREE.Quaternion();
  private tmpVec = new THREE.Vector3();
  private tmpEuler = new THREE.Euler();
  private tmpColor = new THREE.Color();
  private oneScale = new THREE.Vector3(1, 1, 1);
  private disposed = false;

  // 同屏实体裁剪用的可复用缓冲（零分配：容量只按实体数峰值增长一次）
  private orderIdx = new Int32Array(ENTITY_CAP);
  private orderDist = new Float64Array(ENTITY_CAP);
  private visibleFlag = new Uint8Array(ENTITY_CAP);
  private readonly maxVisibleEntities = MAX_VISIBLE_ENTITIES;

  constructor(
    private container: HTMLElement,
    match: MatchLike,
    pack: ContentPack,
    quality: QualityLevel,
  ) {
    this.match = match;
    this.pack = pack;
    this.autoQuality = new AutoQuality(quality);
    this.preset = QUALITY_PRESETS[this.autoQuality.current];
    this.shadowEveryFrames = Math.max(1, Math.round(60 / SHADOW_UPDATE_HZ));
    this.lootEveryFrames = Math.max(1, Math.round(60 / LOOT_ANIM_HZ));

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.pixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // ACES 电影级色调映射 + 曝光补偿：纯 GPU 侧改动，不增加 draw call（AC2 画面质感）
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.scene = new THREE.Scene();
    const sky = new THREE.Color(HORIZON_COLOR);
    this.scene.background = sky;

    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.3,
      3000,
    );

    // —— 光照（AC2②：方向光 + 雾效明暗层次；强度按 ACES 曝光补偿调校）——
    const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x54503c, 1.05);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.dirLight.position.set(160, 260, 110);
    this.dirLight.castShadow = this.preset.shadows;
    this.dirLight.shadow.mapSize.set(this.preset.shadowMapSize, this.preset.shadowMapSize);
    this.dirLight.shadow.camera.near = 40;
    this.dirLight.shadow.camera.far = 900;
    const shadowSpan = 170;
    this.dirLight.shadow.camera.left = -shadowSpan;
    this.dirLight.shadow.camera.right = shadowSpan;
    this.dirLight.shadow.camera.top = shadowSpan;
    this.dirLight.shadow.camera.bottom = -shadowSpan;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    // 阴影贴图降频重绘（静态场景 + 少量动态实体，20Hz 不可感知）：省 2/3 阴影 pass
    this.dirLight.shadow.autoUpdate = false;
    this.dirLight.shadow.needsUpdate = true;
    this.applyFog();

    // —— 地形 ——
    this.terrainMesh = this.buildTerrain();
    this.scene.add(this.terrainMesh);

    // —— 建筑（Instanced，材质纹理）——
    const bTex = makeBuildingTexture();
    const bMat = new THREE.MeshLambertMaterial({ map: bTex });
    this.buildingMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      bMat,
      Math.max(1, match.world.buildings.length),
    );
    this.buildingMesh.castShadow = true;
    this.buildingMesh.receiveShadow = true;
    this.syncBuildings();
    this.scene.add(this.buildingMesh);

    // —— 物资（Instanced 小方箱）——
    const lootGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const lootMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.lootInst = new THREE.InstancedMesh(lootGeo, lootMat, 256);
    this.lootInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lootInst.count = 0;
    this.lootInst.frustumCulled = false;
    this.scene.add(this.lootInst);

    // —— 安全区（当前圈墙体 + 下一圈轮廓线）——
    const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zoneWall = new THREE.Mesh(wallGeo, wallMat);
    this.zoneWall.frustumCulled = false;
    this.scene.add(this.zoneWall);

    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    this.zoneRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
    );
    this.zoneRing.frustumCulled = false;
    this.scene.add(this.zoneRing);

    // —— 运输机 ——
    this.planeMesh = this.buildPlane();
    this.scene.add(this.planeMesh);

    // —— 降落伞 ——
    this.canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: makeCanopyTexture(), side: THREE.DoubleSide }),
    );
    this.canopy.visible = false;
    this.scene.add(this.canopy);

    // —— 实体视图对象池（预建，容量 = ENTITY_CAP；运行期零创建/零销毁）——
    this.entityPool = new EntityViewPool(this.scene);

    this.effects = new EffectLayer(this.scene);

    // —— 天空穹顶 + 植被点缀（AC2①②：远景层次与场景细节；分块 LOD 见 props/vegLod）——
    this.sky = new SkyDome(this.scene);
    this.props = new PropsLayer(this.scene, pack, match.world.buildings, this.autoQuality.current);

    // —— 后处理（单 pass：轻量 AA + 暗角 + 色彩分级；low 档直通，RT 复用零重建）——
    this.postfx = this.buildPostFx();
  }

  /** 按当前 preset 构建后处理（档位切换时重建，频率 ≤ 每分钟一次，非逐帧路径） */
  private buildPostFx(): PostFxPass {
    const p = this.preset;
    return new PostFxPass(
      p.postFx,
      p.postFxMsaa,
      p.postFxScale,
      this.container.clientWidth,
      Math.max(1, this.container.clientHeight),
      Math.min(window.devicePixelRatio, p.pixelRatio),
    );
  }

  get qualityLevel(): QualityLevel {
    return this.autoQuality.current;
  }

  /** 帧率驱动的画质自适应（架构 01 §3.2） */
  autoTune(fps: number, nowMs: number): QualityLevel | null {
    const before = this.autoQuality.current;
    const after = this.autoQuality.update({ fps, low1Fps: 0, p95FrameMs: 0, avgFrameMs: 0, heapMb: null }, nowMs);
    if (after !== before) {
      this.preset = QUALITY_PRESETS[after];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.pixelRatio));
      this.renderer.shadowMap.enabled = this.preset.shadows;
      this.dirLight.castShadow = this.preset.shadows;
      this.applyFog();
      // 后处理随档位重建（low 关闭直通 / medium 降采样 / high 全分辨率+MSAA），并同步 RT 尺寸
      this.postfx.dispose();
      this.postfx = this.buildPostFx();
      this.postfx.setSize(this.container.clientWidth, Math.max(1, this.container.clientHeight), this.renderer.getPixelRatio());
      return after;
    }
    return null;
  }

  /** 分层雾：近景全清晰 → 中景渐雾 → 远景完全融入地平线色（AC2②距离层次） */
  private applyFog(): void {
    const d = this.preset.viewDistance;
    this.scene.fog = new THREE.Fog(HORIZON_COLOR, d * 0.28, d * 0.96);
  }

  // ———————————————————— 场景构建 ————————————————————

  private buildTerrain(): THREE.Mesh {
    const seg = 140;
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x6f8f4a);
    const rock = new THREE.Color(0x8a8064);
    const urban = new THREE.Color(0x8f8b7a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + MAP_SIZE / 2;
      const z = pos.getZ(i) + MAP_SIZE / 2;
      const h = terrainHeightAt(this.pack, x, z);
      pos.setY(i, h);
      const urbanHere = this.pack.map.urbanAreas.some(
        (u) => (x - u.x) ** 2 + (z - u.z) ** 2 <= u.radius * u.radius,
      );
      c.copy(grass).lerp(rock, Math.min(1, Math.max(0, (h - 12) / 14)));
      if (urbanHere) c.lerp(urban, 0.55);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeGroundTexture() });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    mesh.receiveShadow = true;
    return mesh;
  }

  private syncBuildings(): void {
    const buildings = (this.match as MatchLike).world.buildings;
    const color = new THREE.Color();
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const d = b.maxZ - b.minZ;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const cy = (b.minY + b.maxY) / 2;
      this.tmpMat4.makeScale(w, h, d);
      this.tmpMat4.setPosition(cx, cy, cz);
      this.buildingMesh.setMatrixAt(i, this.tmpMat4);
      color.setHSL(0.08 + ((i * 37) % 20) / 400, 0.18, 0.52 + ((i * 53) % 18) / 130);
      this.buildingMesh.setColorAt(i, color);
    }
    this.buildingMesh.count = buildings.length;
    this.buildingMesh.instanceMatrix.needsUpdate = true;
    if (this.buildingMesh.instanceColor) this.buildingMesh.instanceColor.needsUpdate = true;
  }

  private buildPlane(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(1.6, 9, 4, 10),
      new THREE.MeshLambertMaterial({ color: 0x5d6b60 }),
    );
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.4, 14),
      new THREE.MeshLambertMaterial({ color: 0x4e5a52 }),
    );
    g.add(wing);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x4e5a52 }),
    );
    tail.position.set(-5, 1.6, 0);
    g.add(tail);
    g.scale.setScalar(2.4);
    return g;
  }

  // ———————————————————— 每帧更新 ————————————————————

  /** 渲染一帧：snapshot 只读 + 事件消费 */
  render(snap: WorldSnapshot, events: GameEvent[], alpha: number, dtSec: number): void {
    if (this.disposed) return;
    this.effects.consumeEvents(events, (id) => this.entityWorldPos(snap, id));
    this.syncEntities(snap, alpha, dtSec);
    this.syncLoot(snap);
    this.syncZone(snap);
    this.syncPlane(snap);
    this.effects.updateZoneDrift(snap.zone.center, snap.zone.radius, dtSec);
    this.effects.update(dtSec);
    this.updateCamera(snap, alpha);
    this.updateSun(snap);
    if (this.sky) this.sky.update(this.camera.position, dtSec);

    // 植被分块 LOD（内部按 VEG_LOD_UPDATE_HZ 降频决策）
    this.props?.update(this.camera.position.x, this.camera.position.z);

    // 阴影贴图按 SHADOW_UPDATE_HZ 降频重绘（light 每帧跟玩家移动，贴图内容定时刷新）
    this.shadowFrame += 1;
    if (this.preset.shadows && this.shadowFrame % this.shadowEveryFrames === 1) {
      this.dirLight.shadow.needsUpdate = true;
    }

    // 后处理主路径：场景→复用 RT→单 pass 合成（关闭时内部直通 renderer.render）
    this.postfx.render(this.renderer, this.scene, this.camera);
  }

  /** 实体当前渲染位置（特效事件定位用；按 id 查快照下标 → 对象池视图，只读不回写仿真） */
  private entityWorldPos(snap: WorldSnapshot, id: string): Vec3 | null {
    const ents = snap.entities;
    for (let i = 0; i < ents.length; i++) {
      if (ents[i].id !== id) continue;
      const view = this.entityViews[i];
      if (!view || !view.group.visible) return null;
      return { x: view.group.position.x, y: view.group.position.y + 1, z: view.group.position.z };
    }
    return null;
  }

  private syncEntities(snap: WorldSnapshot, alpha: number, dtSec: number): void {
    const ents = snap.entities;
    const count = ents.length;
    const player = snap.playerEntity;

    // 复用缓冲按需扩容（仅当实体数超历史峰值时分配一次，常态零分配）
    if (this.orderIdx.length < count) {
      this.orderIdx = new Int32Array(count);
      this.orderDist = new Float64Array(count);
      this.visibleFlag = new Uint8Array(count);
    }
    const orderIdx = this.orderIdx;
    const orderDist = this.orderDist;
    const visibleFlag = this.visibleFlag;

    // 1) 收集候选（存活且已离机）并按与玩家距离升序插入排序（零分配，≤20 个元素）
    const px = player ? player.pos.x : MAP_SIZE / 2;
    const pz = player ? player.pos.z : MAP_SIZE / 2;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const e = ents[i];
      if (!e.alive || e.state === 'plane') continue;
      const dx = e.pos.x - px;
      const dz = e.pos.z - pz;
      const d2 = dx * dx + dz * dz;
      let j = n;
      while (j > 0 && orderDist[j - 1] > d2) {
        orderDist[j] = orderDist[j - 1];
        orderIdx[j] = orderIdx[j - 1];
        j -= 1;
      }
      orderDist[j] = d2;
      orderIdx[j] = i;
      n += 1;
    }

    // 2) 同屏实体上限：只渲染距玩家最近的 maxVisibleEntities 个（玩家自身强制可见）
    visibleFlag.fill(0, 0, count);
    const limit = Math.min(n, this.maxVisibleEntities);
    for (let k = 0; k < limit; k++) visibleFlag[orderIdx[k]] = 1;
    if (player) {
      for (let i = 0; i < count; i++) if (ents[i] === player) visibleFlag[i] = 1;
    }

    // 3) 同步视图（实体下标稳定 → 视图按池复用，死亡/登机/超上限仅隐藏不销毁）
    for (let i = 0; i < count; i++) {
      const e = ents[i];
      const active = e.alive && e.state !== 'plane' && visibleFlag[i] === 1;
      let view = this.entityViews[i];
      if (active && !view) {
        view = this.entityPool.acquire();
        if (view) {
          this.entityPool.tint(view, ENTITY_COLORS[e.kind]);
          this.entityViews[i] = view;
        }
      }
      if (!view) continue;
      view.group.visible = active;
      if (!active) {
        view.hasPrev = false;
        continue;
      }

      // 位置插值（只做渲染插值，不回写逻辑状态）
      const ix = view.hasPrev ? view.prevX + (e.pos.x - view.prevX) * alpha : e.pos.x;
      const iy = view.hasPrev ? view.prevY + (e.pos.y - view.prevY) * alpha : e.pos.y;
      const iz = view.hasPrev ? view.prevZ + (e.pos.z - view.prevZ) * alpha : e.pos.z;
      view.group.position.set(ix, iy, iz);
      view.group.rotation.y = -e.yaw;
      view.prevX = e.pos.x;
      view.prevY = e.pos.y;
      view.prevZ = e.pos.z;
      view.hasPrev = true;

      // 受击闪白（按真实帧时长扣减，帧率无关）
      if (view.hurtT > 0) {
        view.hurtT -= dtSec;
        (view.body.material as THREE.MeshLambertMaterial).emissive.setScalar(Math.max(0, view.hurtT) * 2);
      }

      // 降落伞挂载
      if (e.state === 'parachute') {
        this.canopy.visible = true;
        this.canopy.position.set(ix, iy + 3.4, iz);
        this.canopyFor = e.id;
      } else if (this.canopyFor === e.id) {
        this.canopy.visible = false;
        this.canopyFor = null;
      }
    }

    // 4) 实体数量收缩时归还多余视图（正常对局内实体数恒定，防御性处理）
    if (this.entityViews.length > count) {
      for (let i = count; i < this.entityViews.length; i++) {
        this.entityViews[i] = null;
      }
      this.entityViews.length = count;
    }
  }

  /** 当前可见实体数（调试 HUD / 基准断言用） */
  get visibleEntityCount(): number {
    let n = 0;
    for (let i = 0; i < this.entityViews.length; i++) {
      const v = this.entityViews[i];
      if (v && v.group.visible) n += 1;
    }
    return n;
  }

  private syncLoot(snap: WorldSnapshot): void {
    // 拾取立即生效（新槽位内容必须当帧写入），但浮动/旋转动画矩阵按 LOOT_ANIM_HZ 降频上传：
    // 60→20Hz 消除每帧 256 实例矩阵全量 GPU 上传，20Hz 下动画依旧顺滑。
    const animate = this.lootFrame % this.lootEveryFrames === 0;
    this.lootFrame += 1;
    const count = Math.min(snap.loots.length, Math.floor(this.lootInst.instanceMatrix.count * this.preset.lootDensity));
    const t = performance.now() / 1000;
    let colorDirty = false;
    for (let i = 0; i < count; i++) {
      const l = snap.loots[i];

      // 物品颜色只随槽位内容变化写入（消除逐帧 instanceColor GPU 上传）
      if (this.lootColorDirty || this.lootColorItems[i] !== l.item) {
        const color = LOOT_COLORS[l.item] ?? 0xcccccc;
        this.lootInst.setColorAt(i, this.tmpColor.setHex(color));
        this.lootColorItems[i] = l.item;
        colorDirty = true;
      }

      if (!animate) continue;
      const bob = Math.sin(t * 2 + i) * 0.08;
      this.tmpEuler.set(0, t * 0.8 + i, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpMat4.compose(
        this.tmpVec.set(l.pos.x, l.pos.y + 0.45 + bob, l.pos.z),
        this.tmpQuat,
        this.oneScale,
      );
      this.lootInst.setMatrixAt(i, this.tmpMat4);
    }
    this.lootShown = count;
    this.lootInst.count = count;
    if (animate || colorDirty || this.lootColorDirty) this.lootInst.instanceMatrix.needsUpdate = true;
    if (colorDirty && this.lootInst.instanceColor) this.lootInst.instanceColor.needsUpdate = true;
    this.lootColorDirty = false;
    void this.lootShown;
  }

  private syncZone(snap: WorldSnapshot): void {
    const z = snap.zone;
    this.zoneWall.position.set(z.center.x, 100, z.center.z);
    this.zoneWall.scale.set(z.radius, 200, z.radius);
    this.zoneRing.position.set(z.nextCenter.x, terrainHeightAt(this.pack, z.nextCenter.x, z.nextCenter.z) + 0.6, z.nextCenter.z);
    this.zoneRing.scale.set(z.nextRadius, z.nextRadius, z.nextRadius);
  }

  private syncPlane(snap: WorldSnapshot): void {
    const p = snap.plane;
    this.planeMesh.visible = !!p;
    if (p) {
      this.planeMesh.position.set(p.pos.x, p.pos.y, p.pos.z);
      this.planeMesh.rotation.y = Math.atan2(p.dir.x, p.dir.z) + Math.PI / 2;
    }
  }

  private updateCamera(snap: WorldSnapshot, _alpha: number): void {
    // 玩家实体直引（快照已带 playerEntity，避免每帧 entities.find 分配闭包与线性扫描）
    const p = snap.playerEntity ?? null;
    if (!p) return;
    const aimHeight = p.state === 'plane' ? 4 : 1.62;
    // 第三人称：沿视线反方向偏移
    const yaw = p.yaw;
    const pitch = Math.max(-0.5, Math.min(0.9, p.pitch));
    const dist = p.state === 'plane' ? 26 : p.state === 'ground' ? 5.2 : 7.5;
    const cx = p.pos.x - Math.cos(yaw) * Math.cos(pitch) * dist;
    const cz = p.pos.z - Math.sin(yaw) * Math.cos(pitch) * dist;
    const cy = p.pos.y + aimHeight + 1.6 - Math.sin(pitch) * dist;
    const groundMin = terrainHeightAt(this.pack, cx, cz) + 0.6;
    this.camera.position.lerp(this.tmpVec.set(cx, Math.max(cy, groundMin), cz), 0.35);
    this.camera.lookAt(p.pos.x + Math.cos(yaw) * 8, p.pos.y + aimHeight + Math.sin(pitch) * 6, p.pos.z + Math.sin(yaw) * 8);
    void _alpha;
  }

  private updateSun(snap: WorldSnapshot): void {
    const p = snap.playerEntity ?? null;
    if (!p) return;
    this.dirLight.target.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.dirLight.position.set(p.pos.x + 160, p.pos.y + 260, p.pos.z + 110);
  }

  // ———————————————————— 生命周期 ————————————————————

  resize(): void {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    // 后处理 RT 复用同一对象仅 setSize（渲染目标对象池：运行期零重建）
    this.postfx.setSize(w, h, this.renderer.getPixelRatio());
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.disposed = true;
    this.effects.dispose();
    this.sky?.dispose();
    this.props?.dispose();
    this.postfx.dispose();
    // 实体视图统一交还对象池销毁（共享几何只释放一次）
    this.entityViews.length = 0;
    this.entityPool.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

