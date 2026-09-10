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
import { makeBuildingTexture, makeCanopyTexture, makeGroundTexture } from './textures';
import { AutoQuality, QUALITY_PRESETS, type QualityLevel, type QualityPreset } from './quality';
import { PostFX } from './postfx';
import {
  entityLodSettings,
  pickEntityLod,
  shouldApplyEntityLod,
  type EntityLodLevel,
} from './lod';

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
  medkit_first: 0xcfe0f0,
  medkit_bandage: 0xf2ead6,
};

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private pack: ContentPack;
  private match: MatchHandle;
  private effects: EffectLayer;
  private autoQuality: AutoQuality;
  private preset: QualityPreset;

  // 静态场景
  private terrainMesh: THREE.Mesh;
  private buildingMesh: THREE.InstancedMesh;
  private dirLight: THREE.DirectionalLight;

  // 后处理（Bloom + 色调映射输出；构造失败/低档时走直渲）
  private postFX: PostFX | null = null;

  // 动态对象池（实体视图回收复用，避免淘汰/重生反复建几何与材质）
  private entityViews = new Map<string, EntityView>();
  private freeViews: EntityView[] = [];
  private lootInst: THREE.InstancedMesh;
  private lootShown = 0;
  private zoneWall: THREE.Mesh;
  private zoneRing: THREE.LineLoop;
  private planeMesh: THREE.Group;
  private canopyMat: THREE.MeshStandardMaterial;

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
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.applyRendererQuality();

    this.scene = new THREE.Scene();
    const sky = new THREE.Color(0x9fb8cf);
    this.scene.background = sky;

    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.3,
      3000,
    );

    // —— 光照（AC2②：方向光 + 雾效明暗层次）——
    const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x54503c, 0.85);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff2d8, 1.35);
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

    // —— 建筑（Instanced，PBR 材质纹理）——
    const bTex = makeBuildingTexture();
    const bMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.92, metalness: 0.05 });
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
    const lootMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
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

    // —— 降落伞（每实体一把，空中单位可多个同时滑翔）——
    this.canopyMat = new THREE.MeshStandardMaterial({
      map: makeCanopyTexture(),
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });

    this.effects = new EffectLayer(this.scene);

    // —— 后处理（Bloom + 色调映射收口）；构造失败则整体置 null → 直渲降级 ——
    try {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      this.postFX = new PostFX(this.renderer, this.scene, this.camera, w, h);
      this.postFX.configure(this.preset);
    } catch (err) {
      this.postFX = null;
      void err;
    }
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
      this.applyRendererQuality();
      this.applyDirLightShadow();
      this.postFX?.configure(this.preset);
      // 像素比变化后重设合成器缓冲尺寸，避免 Bloom 内部分辨率失真
      this.postFX?.setSize(this.container.clientWidth, Math.max(1, this.container.clientHeight));
      this.applyFog();
      return after;
    }
    return null;
  }

  /** 将画质档位应用到 renderer（像素比/阴影/色调映射/曝光） */
  private applyRendererQuality(): void {
    const p = this.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatio));
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = p.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = p.exposure;
  }

  /** 应用方向光阴影开关与贴图尺寸（切换档位时释放旧阴影贴图以便重建） */
  private applyDirLightShadow(): void {
    const p = this.preset;
    this.dirLight.castShadow = p.shadows;
    if (p.shadows) {
      this.dirLight.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
      if (this.dirLight.shadow.map) {
        this.dirLight.shadow.map.dispose();
        this.dirLight.shadow.map = null;
      }
    }
  }

  private applyFog(): void {
    this.scene.fog = new THREE.Fog(0x9fb8cf, this.preset.viewDistance * 0.45, this.preset.viewDistance);
  }

  // ———————————————————— 场景构建 ————————————————————

  private buildTerrain(): THREE.Mesh {
    const seg = this.preset.terrainSegments;
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
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: makeGroundTexture(),
      roughness: 1,
      metalness: 0,
    });
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
      new THREE.MeshStandardMaterial({ color: 0x5d6b60, roughness: 0.6, metalness: 0.3 }),
    );
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0x4e5a52, roughness: 0.7, metalness: 0.2 }),
    );
    g.add(wing);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4e5a52, roughness: 0.7, metalness: 0.2 }),
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
    this.effects.consumeEvents(events);
    this.syncEntities(snap, alpha);
    this.syncLoot(snap);
    this.syncZone(snap);
    this.syncPlane(snap);
    this.effects.update(dtSec);
    this.updateCamera(snap, alpha);
    this.updateSun(snap);

    // 中/高档走合成器（Bloom + 色调映射收口）；低档/降级直渲省合成开销
    if (this.postFX && this.postFX.enabled) {
      this.postFX.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private syncEntities(snap: WorldSnapshot, alpha: number): void {
    const seen = new Set<string>();
    for (const e of snap.entities) {
      seen.add(e.id);
      let view = this.entityViews.get(e.id);
      if (!view) {
        view = this.acquireEntityView(e.kind);
        this.entityViews.set(e.id, view);
      }
      const active = e.alive && e.state !== 'plane';
      if (!active) {
        view.group.visible = false;
        continue;
      }

      // 位置插值（只做渲染插值，不回写逻辑状态）。LOD 剔除时也推进 prev，避免回显时跳变。
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
        (view.body.material as THREE.MeshStandardMaterial).emissive.setScalar(Math.max(0, view.hurtT) * 2);
      }

      // 降落伞挂载（每实体独立，多单位空中互不干扰）
      const chuteVisible = e.state === 'parachute';
      if (view.canopy.visible !== chuteVisible) view.canopy.visible = chuteVisible;
      if (chuteVisible) view.canopy.position.set(0, 3.4, 0);

      // 实体 LOD：非玩家实体按相机距离降档（simple 隐藏头/枪，off 整体剔除）
      const isPlayer = e.kind === 'player';
      const camDist = Math.hypot(
        view.group.position.x - this.camera.position.x,
        view.group.position.y - this.camera.position.y,
        view.group.position.z - this.camera.position.z,
      );
      const level: EntityLodLevel = shouldApplyEntityLod(isPlayer)
        ? pickEntityLod(camDist, this.preset)
        : 'full';
      const lod = entityLodSettings(level);
      view.body.visible = lod.body;
      view.head.visible = lod.head;
      view.gun.visible = lod.gun;
      view.group.visible = lod.body;
    }
    // 已不在快照中的实体 → 回收视图到对象池（保留几何/材质，供下次重生复用）
    for (const [id, view] of this.entityViews) {
      if (!seen.has(id)) {
        this.scene.remove(view.group);
        view.group.visible = false;
        this.freeViews.push(view);
        this.entityViews.delete(id);
      }
    }
  }

  /** 实体视图对象池：优先回收复用，避免淘汰/重生反复建几何与材质 */
  private acquireEntityView(kind: 'player' | 'ai'): EntityView {
    const recycled = this.freeViews.pop();
    if (recycled) {
      recycled.hurtT = 0;
      recycled.prevPos = null;
      recycled.group.visible = false;
      recycled.canopy.visible = false;
      const bodyMat = recycled.body.material as THREE.MeshStandardMaterial;
      bodyMat.color.setHex(ENTITY_COLORS[kind]);
      bodyMat.emissive.setScalar(0);
      this.scene.add(recycled.group);
      return recycled;
    }
    const created = this.createEntityView(kind);
    created.group.visible = false;
    return created;
  }

  private createEntityView(kind: 'player' | 'ai'): EntityView {
    const group = new THREE.Group();
    const color = ENTITY_COLORS[kind];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 3, 8), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.7, metalness: 0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), headMat);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    // 朝向指示（枪）
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.45, metalness: 0.6 });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), gunMat);
    gun.position.set(0.22, 1.25, 0.5);
    group.add(gun);
    // 降落伞（挂在实体组内，随实体位置移动）
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      this.canopyMat,
    );
    canopy.visible = false;
    group.add(canopy);
    this.scene.add(group);
    return { group, body, head, gun, canopy, prevPos: null, hurtT: 0 };
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
    this.postFX?.setSize(w, h);
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  dispose(): void {
    this.disposed = true;
    this.effects.dispose();
    for (const [, view] of this.entityViews) disposeGroup(view.group);
    this.entityViews.clear();
    for (const view of this.freeViews) disposeGroup(view.group);
    this.freeViews.length = 0;
    this.postFX?.dispose();
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
  head: THREE.Mesh;
  gun: THREE.Mesh;
  canopy: THREE.Mesh;
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
