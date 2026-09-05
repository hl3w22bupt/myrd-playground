/**
 * renderfx.spec —— 画面升级步（阴影/雾效/Bloom 后处理 + LOD + 合批 + 对象池）的确定性断言。
 * 全部可在 Node 运行（无 GL 依赖）：配置表一致性、LOD 纯函数、实例合批槽位池、Bloom 链路结构。
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY_PRESETS, type QualityLevel } from '../src/render/quality';
import { BloomPostFx, type PostFxRenderer } from '../src/render/postfx';
import {
  ENTITY_DETAIL_FULL,
  ENTITY_DETAIL_MEDIUM,
  ENTITY_DETAIL_MINIMAL,
  partVisibleAtDetail,
  pickEntityDetail,
} from '../src/render/lod';
import { EntityViewPool } from '../src/render/entityPool';
import {
  BLOOM_BY_QUALITY,
  ENTITY_BATCH_MESH_COUNT,
  ENTITY_LOD_BY_QUALITY,
  TERRAIN_SEGMENTS_BY_QUALITY,
} from '../src/content/render';
import { ENTITY_CAP } from '../src/content/constants';

const LEVELS: QualityLevel[] = ['low', 'medium', 'high'];

// ——— 实例矩阵断言助手（直接读元素：decompose 对全零矩阵会返回 scale 1，不可用）——

/** 读取某部件某槽位的实例矩阵副本 */
function matOf(mesh: THREE.InstancedMesh, slot: number): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(slot, m);
  return m;
}

/** 基向量是否全零（= 该实例被隐藏/LOD 降级，不产生片元） */
function isZeroScaled(m: THREE.Matrix4): boolean {
  const e = m.elements;
  return (
    e[0] === 0 && e[1] === 0 && e[2] === 0 &&
    e[4] === 0 && e[5] === 0 && e[6] === 0 &&
    e[8] === 0 && e[9] === 0 && e[10] === 0
  );
}

/** 平移分量（实例位置） */
function posOf(m: THREE.Matrix4): [number, number, number] {
  return [m.elements[12]!, m.elements[13]!, m.elements[14]!];
}

describe('画面升级配置表（content/render，数值唯一来源）', () => {
  it('Bloom：low 关闭（最低档帧预算优先），medium/high 开启且 high 强度更大', () => {
    expect(BLOOM_BY_QUALITY.low.enabled).toBe(false);
    expect(BLOOM_BY_QUALITY.medium.enabled).toBe(true);
    expect(BLOOM_BY_QUALITY.high.enabled).toBe(true);
    expect(BLOOM_BY_QUALITY.high.strength).toBeGreaterThan(BLOOM_BY_QUALITY.medium.strength);
    expect(BLOOM_BY_QUALITY.medium.strength).toBeGreaterThan(0);
    for (const level of ['medium', 'high'] as const) {
      const b = BLOOM_BY_QUALITY[level];
      expect(b.radius).toBeGreaterThan(0);
      expect(b.threshold).toBeGreaterThan(0);
      expect(b.threshold).toBeLessThanOrEqual(1);
    }
  });

  it('LOD：全档位启用，nearDist < midDist，low 档阈值最激进（更早降细节）', () => {
    for (const level of LEVELS) {
      const l = ENTITY_LOD_BY_QUALITY[level];
      expect(l.enabled).toBe(true);
      expect(l.nearDist).toBeGreaterThan(0);
      expect(l.midDist).toBeGreaterThan(l.nearDist);
    }
    expect(ENTITY_LOD_BY_QUALITY.low.nearDist).toBeLessThan(ENTITY_LOD_BY_QUALITY.medium.nearDist);
    expect(ENTITY_LOD_BY_QUALITY.medium.nearDist).toBeLessThan(ENTITY_LOD_BY_QUALITY.high.nearDist);
  });

  it('地形段数随档位单调不减（high ≥ medium ≥ low，且为正偶数）', () => {
    expect(TERRAIN_SEGMENTS_BY_QUALITY.high).toBeGreaterThanOrEqual(TERRAIN_SEGMENTS_BY_QUALITY.medium);
    expect(TERRAIN_SEGMENTS_BY_QUALITY.medium).toBeGreaterThanOrEqual(TERRAIN_SEGMENTS_BY_QUALITY.low);
    for (const level of LEVELS) {
      expect(TERRAIN_SEGMENTS_BY_QUALITY[level]).toBeGreaterThan(0);
    }
  });

  it('quality preset 完整派生自配置表（档位切换时后处理/LOD/地形联动同一来源）', () => {
    for (const level of LEVELS) {
      const preset = QUALITY_PRESETS[level];
      expect(preset.bloom).toBe(BLOOM_BY_QUALITY[level]);
      expect(preset.lod).toBe(ENTITY_LOD_BY_QUALITY[level]);
      expect(preset.terrainSegments).toBe(TERRAIN_SEGMENTS_BY_QUALITY[level]);
    }
    // 最低档：无阴影 + 无 Bloom（帧预算优先），视距最小
    expect(QUALITY_PRESETS.low.shadows).toBe(false);
    expect(QUALITY_PRESETS.low.bloom.enabled).toBe(false);
    expect(QUALITY_PRESETS.low.viewDistance).toBeLessThan(QUALITY_PRESETS.medium.viewDistance);
  });

  it('合批不变量：部件 mesh 数 = 3（躯干/头/枪），且实体池容量 = 实体上限', () => {
    expect(ENTITY_BATCH_MESH_COUNT).toBe(3);
    expect(ENTITY_CAP).toBeGreaterThanOrEqual(ENTITY_BATCH_MESH_COUNT * 6); // 20 实体 / 3 部件仍有合批收益
  });
});

describe('实体 LOD 判定（render/lod 纯函数）', () => {
  it('距离阈值三级切换：< near 完整、< mid 中等、≥ mid 极简', () => {
    const lod = { enabled: true, nearDist: 70, midDist: 180 };
    expect(pickEntityDetail(0, lod)).toBe(ENTITY_DETAIL_FULL);
    expect(pickEntityDetail(69.999, lod)).toBe(ENTITY_DETAIL_FULL);
    expect(pickEntityDetail(70, lod)).toBe(ENTITY_DETAIL_MEDIUM);
    expect(pickEntityDetail(179.9, lod)).toBe(ENTITY_DETAIL_MEDIUM);
    expect(pickEntityDetail(180, lod)).toBe(ENTITY_DETAIL_MINIMAL);
    expect(pickEntityDetail(2000, lod)).toBe(ENTITY_DETAIL_MINIMAL);
  });

  it('禁用 LOD 时恒为完整细节（画面不因 LOD 降级）', () => {
    const lod = { enabled: false, nearDist: 1, midDist: 2 };
    expect(pickEntityDetail(0, lod)).toBe(ENTITY_DETAIL_FULL);
    expect(pickEntityDetail(9999, lod)).toBe(ENTITY_DETAIL_FULL);
  });

  it('部件可见性：FULL 全保留、MEDIUM 保留躯干+头、MINIMAL 仅躯干', () => {
    expect(partVisibleAtDetail(0, ENTITY_DETAIL_FULL)).toBe(true);
    expect(partVisibleAtDetail(1, ENTITY_DETAIL_FULL)).toBe(true);
    expect(partVisibleAtDetail(2, ENTITY_DETAIL_FULL)).toBe(true);

    expect(partVisibleAtDetail(0, ENTITY_DETAIL_MEDIUM)).toBe(true);
    expect(partVisibleAtDetail(1, ENTITY_DETAIL_MEDIUM)).toBe(true);
    expect(partVisibleAtDetail(2, ENTITY_DETAIL_MEDIUM)).toBe(false);

    expect(partVisibleAtDetail(0, ENTITY_DETAIL_MINIMAL)).toBe(true);
    expect(partVisibleAtDetail(1, ENTITY_DETAIL_MINIMAL)).toBe(false);
    expect(partVisibleAtDetail(2, ENTITY_DETAIL_MINIMAL)).toBe(false);
  });
});

describe('实体实例合批槽位池（render/entityPool）', () => {
  it('合批不变量：部件 mesh 恒为 3 个 InstancedMesh，draw call 与实体数无关', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 6);
    expect(pool.partMeshes.length).toBe(ENTITY_BATCH_MESH_COUNT);
    expect(pool.drawCalls).toBe(ENTITY_BATCH_MESH_COUNT);
    for (const mesh of pool.partMeshes) {
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBe(6);
      expect(mesh.frustumCulled).toBe(false); // 实例分布全图，禁用包围球剔除
    }
    pool.dispose();
  });

  it('槽位池容量封顶：取尽返回 null，release 后槽位可复用（O(1) 归还）', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 3);
    const a = pool.acquire()!;
    const b = pool.acquire()!;
    pool.acquire();
    expect(pool.acquire()).toBeNull();
    expect(pool.acquiredCount).toBe(3);
    pool.release(b);
    expect(pool.acquiredCount).toBe(2);
    const again = pool.acquire()!;
    expect(again).toBe(b); // 同一视图对象复用（零创建）
    expect(again.slot).toBe(b.slot);
    void a;
    pool.dispose();
  });

  it('sync 写入实例矩阵：可见实体三部件按站姿偏移，隐藏实体全部置零（防残影）', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 4);
    const v = pool.acquire()!;
    v.visible = true;
    v.x = 10;
    v.y = 5;
    v.z = -3;
    v.yaw = 0;
    pool.sync();

    // FULL 细节：三部件都画，位置 = 实体位置 + 部件站姿偏移（无旋转时 x/z 与实体一致）
    // （instanceMatrix 为 Float32 存储，位置断言用近似比较）
    const bodyPos = posOf(matOf(pool.partMeshes[0]!, v.slot));
    const headPos = posOf(matOf(pool.partMeshes[1]!, v.slot));
    const gunPos = posOf(matOf(pool.partMeshes[2]!, v.slot));
    expect(bodyPos[0]).toBeCloseTo(10, 5);
    expect(bodyPos[1]).toBeCloseTo(5.95, 5);
    expect(bodyPos[2]).toBeCloseTo(-3, 5);
    expect(headPos[1]).toBeCloseTo(6.62, 5);
    expect(gunPos[1]).toBeCloseTo(6.25, 5);
    expect(gunPos[2]).toBeCloseTo(-2.5, 5);
    for (const mesh of pool.partMeshes) {
      expect(isZeroScaled(matOf(mesh, v.slot))).toBe(false);
    }

    // 朝向联动：部件偏移随 yaw 旋转（绕 Y 90°：局部 (0.22, 0.5) → (0.5, -0.22)）
    v.yaw = Math.PI / 2;
    pool.sync();
    const rotatedGunPos = posOf(matOf(pool.partMeshes[2]!, v.slot));
    expect(rotatedGunPos[0]).toBeCloseTo(10 + 0.5, 5);
    expect(rotatedGunPos[2]).toBeCloseTo(-3 - 0.22, 5);

    // 隐藏 → 三部件全部零缩放（零基向量、无平移）
    v.visible = false;
    pool.sync();
    for (const mesh of pool.partMeshes) {
      const m = matOf(mesh, v.slot);
      expect(isZeroScaled(m)).toBe(true);
      expect(posOf(m)).toEqual([0, 0, 0]);
    }
    pool.dispose();
  });

  it('LOD 协作：MINIMAL 细节只画躯干，头/枪置零（远处省顶点，draw call 不变）', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 2);
    const v = pool.acquire()!;
    v.visible = true;
    v.detail = ENTITY_DETAIL_MINIMAL;
    pool.sync();

    expect(isZeroScaled(matOf(pool.partMeshes[0]!, v.slot))).toBe(false);
    expect(isZeroScaled(matOf(pool.partMeshes[1]!, v.slot))).toBe(true);
    expect(isZeroScaled(matOf(pool.partMeshes[2]!, v.slot))).toBe(true);

    // MEDIUM：躯干 + 头，枪隐藏
    v.detail = ENTITY_DETAIL_MEDIUM;
    pool.sync();
    expect(isZeroScaled(matOf(pool.partMeshes[0]!, v.slot))).toBe(false);
    expect(isZeroScaled(matOf(pool.partMeshes[1]!, v.slot))).toBe(false);
    expect(isZeroScaled(matOf(pool.partMeshes[2]!, v.slot))).toBe(true);
    pool.dispose();
  });

  it('tint + 受击闪白：sync 脏检查写实例色（颜色不变不重复标记上传）', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 2);
    const v = pool.acquire()!;
    v.visible = true;
    pool.tint(v, 0xff0000);
    pool.sync();
    const body = pool.partMeshes[0]!;
    const color = new THREE.Color();
    body.getColorAt(v.slot, color);
    expect(color.r).toBeCloseTo(1, 5);
    expect(color.g).toBeCloseTo(0, 5);

    // 无 hurt 且颜色未变 → 不再写色（脏检查）
    const uploadsBefore = body.instanceColor ? body.instanceColor.version : -1;
    pool.sync();
    const uploadsAfter = body.instanceColor ? body.instanceColor.version : -1;
    expect(uploadsAfter).toBe(uploadsBefore);

    // 受击 → 闪白提亮（向白色插值）
    v.hurtT = 1;
    pool.sync();
    body.getColorAt(v.slot, color);
    expect(color.g).toBeGreaterThan(0);
    pool.dispose();
  });

  it('release 立即置零矩阵（防残影），releaseAll 归还全部槽位', () => {
    const scene = new THREE.Scene();
    const pool = new EntityViewPool(scene, 2);
    const v = pool.acquire()!;
    v.visible = true;
    v.x = 42;
    pool.sync();
    pool.release(v);
    expect(pool.acquiredCount).toBe(0);
    for (const mesh of pool.partMeshes) {
      expect(isZeroScaled(matOf(mesh, v.slot))).toBe(true);
    }

    const x = pool.acquire()!;
    const y = pool.acquire()!;
    expect(pool.acquire()).toBeNull();
    pool.releaseAll();
    expect(pool.acquiredCount).toBe(0);
    expect(pool.acquire()).not.toBeNull();
    void x;
    void y;
    pool.dispose();
  });
});

describe('Bloom 光照后处理链（render/postfx）', () => {
  /** EffectComposer 所需 renderer 最小 stub（Node 无 GL；记录调用以断言渲染路径） */
  function makeStubRenderer(width = 800, height = 600) {
    const size = new THREE.Vector2(width, height);
    const calls = { render: 0, setRenderTargetNonNull: 0, setSize: 0 };
    const renderer: PostFxRenderer = {
      getSize: (target) => target.copy(size),
      getPixelRatio: () => 1,
      getRenderTarget: () => null,
      setRenderTarget: (target) => {
        if (target !== null) calls.setRenderTargetNonNull += 1;
      },
      render: () => {
        calls.render += 1;
      },
      clear: () => {},
      getClearColor: (target) => target.setRGB(0, 0, 0),
      getClearAlpha: () => 1,
      setClearColor: () => {},
      autoClear: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.18,
      outputColorSpace: THREE.SRGBColorSpace,
    };
    return { renderer, calls };
  }

  const BLOOM_ON = { enabled: true, strength: 0.42, radius: 0.55, threshold: 0.8 };
  const BLOOM_OFF = { enabled: false, strength: 0, radius: 0, threshold: 1 };

  it('启用时链路 = RenderPass + UnrealBloomPass + OutputPass，渲染走后处理路径', () => {
    const { renderer, calls } = makeStubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const fx = new BloomPostFx(renderer, scene, camera, BLOOM_ON);

    expect(fx.enabled).toBe(true);
    expect(fx.passCount).toBe(3);
    const before = calls.setRenderTargetNonNull;
    fx.render(1 / 60);
    expect(calls.setRenderTargetNonNull).toBeGreaterThan(before); // 写入离屏 render target（后处理路径）

    // Bloom 参数写入 pass（档位联动）
    fx.setParams({ enabled: true, strength: 0.9, radius: 0.6, threshold: 0.5 });
    fx.render(1 / 60);
    expect(fx.passCount).toBe(3);
    fx.dispose();
  });

  it('关闭时零开销直通：无 pass、无离屏 render target，渲染直达 renderer.render', () => {
    const { renderer, calls } = makeStubRenderer();
    const fx = new BloomPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), BLOOM_OFF);
    expect(fx.enabled).toBe(false);
    expect(fx.passCount).toBe(0);

    fx.render(1 / 60);
    expect(calls.render).toBe(1);
    expect(calls.setRenderTargetNonNull).toBe(0); // 不创建/不写任何离屏 target

    // 档位切到关闭 → 幂等（不重复构建），仍直通
    fx.setParams(BLOOM_OFF);
    fx.render(1 / 60);
    expect(calls.render).toBe(2);
    expect(calls.setRenderTargetNonNull).toBe(0);
    fx.dispose();
  });

  it('开关幂等 + 可逆：enable→disable→enable 复用同一实例，dispose 后回直通', () => {
    const { renderer, calls } = makeStubRenderer();
    const fx = new BloomPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), BLOOM_OFF);

    fx.setEnabled(false);
    expect(fx.passCount).toBe(0);
    fx.setEnabled(true);
    expect(fx.passCount).toBe(3);
    fx.setEnabled(true); // 重复开启不重复分配
    expect(fx.passCount).toBe(3);
    fx.setEnabled(false);
    expect(fx.enabled).toBe(false);
    expect(fx.passCount).toBe(0);
    fx.render(1 / 60);
    expect(calls.render).toBe(1);
    expect(calls.setRenderTargetNonNull).toBe(0);

    fx.setEnabled(true);
    fx.dispose();
    expect(fx.passCount).toBe(0);
    expect(fx.enabled).toBe(false);
    fx.render(1 / 60);
    expect(calls.render).toBe(2);
  });

  it('setSize 透传：关闭时记录尺寸（惰性构建用），开启时联动 composer 与 pass', () => {
    const { renderer } = makeStubRenderer();
    const fx = new BloomPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), BLOOM_OFF);
    fx.setSize(1280, 720); // 关闭态：仅记录，零分配
    expect(fx.enabled).toBe(false);

    fx.setParams(BLOOM_ON); // 惰性构建使用已记录尺寸
    expect(fx.passCount).toBe(3);
    fx.dispose();
  });

  it('档位映射：low 直通、medium/high 走后处理（与 content 配置一致）', () => {
    for (const level of LEVELS) {
      const params = QUALITY_PRESETS[level].bloom;
      const { renderer } = makeStubRenderer();
      const fx = new BloomPostFx(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), params);
      expect(fx.enabled).toBe(params.enabled);
      expect(fx.passCount).toBe(params.enabled ? 3 : 0);
      fx.dispose();
    }
  });
});
