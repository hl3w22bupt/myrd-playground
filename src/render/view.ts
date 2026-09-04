/**
 * render/view —— Three.js 表现层：快照 → 场景对象映射（渲染唯一数据源 = core snapshot）。
 * 引擎边界：本目录之外禁止 import three（CI lint 强制）。
 */

import * as THREE from 'three';
import type { GameEvent, MatchHandle, Vec3, WorldSnapshot } from '../core/types';
import type { World } from '../core/world';
import { terrainHeightAt } from '../core/mapgen';
import { MAP_SIZE } from '../content/constants';
import type { ContentPack } from '../content';
import { EffectLayer } from './effects';
import { SkyDome } from './sky';
import { PropsLayer } from './props';
import { makeBuildingTexture, makeCanopyTexture, makeGroundTexture } from './textures';
import { AutoQuality, QUALITY_PRESETS, type QualityLevel, type QualityPreset } from './quality';

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

  // 动态对象池
  private entityViews = new Map<string, EntityView>();
  private lootInst: THREE.InstancedMesh;
  private lootShown = 0;
  private zoneWall: THREE.Mesh;
  private zoneRing: THREE.LineLoop;
  private planeMesh: THREE.Group;
  private canopy: THREE.Mesh;
  private canopyFor: string | null = null;

  private tmpMat4 = new THREE.Matrix4();
  private tmpQuat = new THREE.Quaternion();
  private tmpVec = new THREE.Vector3();
  private tmpEuler = new THREE.Euler();
  private tmpColor = new THREE.Color();
  private oneScale = new THREE.Vector3(1, 1, 1);
  private disposed = false;

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

    this.effects = new EffectLayer(this.scene);

    // —— 天空穹顶 + 植被点缀（AC2①②：远景层次与场景细节）——
    this.sky = new SkyDome(this.scene);
    this.props = new PropsLayer(this.scene, pack, match.world.buildings, this.autoQuality.current);
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
    this.effects.consumeEvents(events, (id) => this.entityWorldPos(id));
    this.syncEntities(snap, alpha);
    this.syncLoot(snap);
    this.syncZone(snap);
    this.syncPlane(snap);
    this.effects.updateZoneDrift(snap.zone.center, snap.zone.radius, dtSec);
    this.effects.update(dtSec);
    this.updateCamera(snap, alpha);
    this.updateSun(snap);
    if (this.sky) this.sky.update(this.camera.position, dtSec);

    this.renderer.render(this.scene, this.camera);
  }

  /** 实体当前渲染位置（特效事件定位用；只读插值视图，不回写仿真） */
  private entityWorldPos(id: string): Vec3 | null {
    const view = this.entityViews.get(id);
    if (!view || !view.group.visible) return null;
    return { x: view.group.position.x, y: view.group.position.y + 1, z: view.group.position.z };
  }

  private syncEntities(snap: WorldSnapshot, alpha: number): void {
    const seen = new Set<string>();
    for (const e of snap.entities) {
      seen.add(e.id);
      let view = this.entityViews.get(e.id);
      if (!view) {
        view = this.createEntityView(e.kind);
        this.entityViews.set(e.id, view);
      }
      const active = e.alive && e.state !== 'plane';
      view.group.visible = active;
      if (!active) continue;

      // 位置插值（只做渲染插值，不回写逻辑状态）
      const prev = view.prevPos;
      const ix = prev ? prev.x + (e.pos.x - prev.x) * alpha : e.pos.x;
      const iy = prev ? prev.y + (e.pos.y - prev.y) * alpha : e.pos.y;
      const iz = prev ? prev.z + (e.pos.z - prev.z) * alpha : e.pos.z;
      view.group.position.set(ix, iy, iz);
      view.group.rotation.y = -e.yaw;
      if (prev) {
        prev.x = e.pos.x;
        prev.y = e.pos.y;
        prev.z = e.pos.z;
      } else {
        view.prevPos = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
      }

      // 受击闪白
      if (view.hurtT > 0) {
        view.hurtT -= 1 / 60;
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
    for (const [id, view] of this.entityViews) {
      if (!seen.has(id)) {
        this.scene.remove(view.group);
        disposeGroup(view.group);
        this.entityViews.delete(id);
      }
    }
  }

  private createEntityView(kind: 'player' | 'ai'): EntityView {
    const group = new THREE.Group();
    const color = ENTITY_COLORS[kind];
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 3, 8), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9b38c }),
    );
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    // 朝向指示（枪）
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x33383d }),
    );
    gun.position.set(0.22, 1.25, 0.5);
    group.add(gun);
    this.scene.add(group);
    return { group, body, prevPos: null, hurtT: 0 };
  }

  private syncLoot(snap: WorldSnapshot): void {
    const count = Math.min(snap.loots.length, Math.floor(this.lootInst.instanceMatrix.count * this.preset.lootDensity));
    const t = performance.now() / 1000;
    for (let i = 0; i < count; i++) {
      const l = snap.loots[i];
      const bob = Math.sin(t * 2 + i) * 0.08;
      this.tmpEuler.set(0, t * 0.8 + i, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpMat4.compose(
        this.tmpVec.set(l.pos.x, l.pos.y + 0.45 + bob, l.pos.z),
        this.tmpQuat,
        this.oneScale,
      );
      this.lootInst.setMatrixAt(i, this.tmpMat4);
      const color = LOOT_COLORS[l.item] ?? 0xcccccc;
      this.lootInst.setColorAt(i, this.tmpColor.setHex(color));
    }
    this.lootShown = count;
    this.lootInst.count = count;
    this.lootInst.instanceMatrix.needsUpdate = true;
    if (this.lootInst.instanceColor) this.lootInst.instanceColor.needsUpdate = true;
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
    const p = snap.entities.find((e) => e.id === 'player');
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
    const p = snap.entities.find((e) => e.id === 'player');
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
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.disposed = true;
    this.effects.dispose();
    this.sky?.dispose();
    this.props?.dispose();
    for (const [, view] of this.entityViews) disposeGroup(view.group);
    this.entityViews.clear();
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

interface EntityView {
  group: THREE.Group;
  body: THREE.Mesh;
  prevPos: Vec3 | null;
  hurtT: number;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
