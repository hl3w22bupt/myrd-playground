/**
 * render.spec —— 画质光照后处理 + LOD 合批叠加步的确定性断言（Node 可跑，不依赖 WebGL）：
 *
 * 1) content/render 配置表：LOD/后处理/降频数值的约束（禁止硬编码的数值唯一来源）；
 * 2) vegLod 纯逻辑：分块划分、距离剔除的可见性决策（近处可见 / 远处隐藏 / 全零分配）；
 * 3) postfx 纯函数：RT 分辨率计算（关闭 → 0，降采样 → floor 缩放，最小 2px）；
 * 4) quality preset：后处理按档位门控（low 直通 / medium 降采样 / high 全分辨率 + MSAA）。
 */

import { describe, expect, it } from 'vitest';
import { MAP_SIZE } from '../src/content/constants';
import {
  GRASS_LOD_DISTANCE,
  LOOT_ANIM_HZ,
  POSTFX_CONTRAST,
  POSTFX_MSAA_HIGH,
  POSTFX_SATURATION,
  POSTFX_SCALE_MEDIUM,
  POSTFX_VIGNETTE,
  SHADOW_UPDATE_HZ,
  TREE_LOD_DISTANCE,
  VEG_CHUNK_SIZE,
  VEG_LOD_UPDATE_HZ,
} from '../src/content/render';
import {
  buildChunks,
  chunkBoundRadius,
  chunkGridCount,
  grassLodRadius,
  treeLodRadius,
  updateVisibility,
  type VegChunk,
} from '../src/render/vegLod';
import { postFxResolution } from '../src/render/postfx';
import { QUALITY_PRESETS } from '../src/render/quality';

describe('content/render 配置表（LOD/后处理/降频数值约束）', () => {
  it('植被分块边长整除地图：1600/160 → 10×10 = 100 块', () => {
    expect(MAP_SIZE).toBe(1600);
    expect(MAP_SIZE % VEG_CHUNK_SIZE).toBe(0);
    expect(chunkGridCount(MAP_SIZE, VEG_CHUNK_SIZE)).toBe(10);
  });

  it('LOD 距离为正且树 > 草（树冠在雾中比草丛更晚不可辨）', () => {
    expect(GRASS_LOD_DISTANCE).toBeGreaterThan(0);
    expect(TREE_LOD_DISTANCE).toBeGreaterThan(GRASS_LOD_DISTANCE);
    expect(TREE_LOD_DISTANCE).toBeLessThan(MAP_SIZE / 2);
  });

  it('降频参数均为正：LOD 决策 10Hz、物资动画 20Hz、阴影 20Hz', () => {
    expect(VEG_LOD_UPDATE_HZ).toBeGreaterThan(0);
    expect(VEG_LOD_UPDATE_HZ).toBeLessThanOrEqual(60);
    expect(LOOT_ANIM_HZ).toBeGreaterThan(0);
    expect(LOOT_ANIM_HZ).toBeLessThanOrEqual(60);
    expect(SHADOW_UPDATE_HZ).toBeGreaterThan(0);
    expect(SHADOW_UPDATE_HZ).toBeLessThanOrEqual(60);
  });

  it('后处理参数在有效区间：缩放 ∈ (0,1]、暗角 ∈ [0,1)、饱和/对比 ≥ 1、MSAA ≥ 0', () => {
    expect(POSTFX_SCALE_MEDIUM).toBeGreaterThan(0);
    expect(POSTFX_SCALE_MEDIUM).toBeLessThanOrEqual(1);
    expect(POSTFX_VIGNETTE).toBeGreaterThanOrEqual(0);
    expect(POSTFX_VIGNETTE).toBeLessThan(1);
    expect(POSTFX_SATURATION).toBeGreaterThanOrEqual(1);
    expect(POSTFX_CONTRAST).toBeGreaterThanOrEqual(1);
    expect(POSTFX_MSAA_HIGH).toBeGreaterThanOrEqual(0);
  });
});

describe('植被分块 LOD 纯逻辑（render/vegLod）', () => {
  it('buildChunks：数量与块中心按行优先网格分布', () => {
    const chunks = buildChunks(MAP_SIZE, VEG_CHUNK_SIZE);
    expect(chunks).toHaveLength(100);
    // 块边长 160m，首块中心 (80, 80)，末块中心 (1520, 1520)
    expect(chunks[0]!.cx).toBe(80);
    expect(chunks[0]!.cz).toBe(80);
    expect(chunks[99]!.cx).toBe(1520);
    expect(chunks[99]!.cz).toBe(1520);
    // 全部初始可见（未决策前不漏画）
    for (const c of chunks) expect(c.visible).toBe(true);
  });

  it('updateVisibility：相机附近块可见、远角块隐藏，且写入原数组（零分配）', () => {
    const chunks: VegChunk[] = buildChunks(MAP_SIZE, VEG_CHUNK_SIZE);
    const sameRef = updateVisibility(chunks, 800, 800, treeLodRadius(MAP_SIZE, VEG_CHUNK_SIZE));

    // 相机在地图中心：树剔除半径 = 560 + 块外接半径 ≈ 681 → 半径 2 块内（~640m 内）可见
    const center = chunks[55]!; // (880, 880)：距中心 ~113m，必可见
    const farCorner = chunks[0]!; // (80, 80)：距中心 ~1018m，必隐藏
    expect(center.visible).toBe(true);
    expect(farCorner.visible).toBe(false);

    // 可见标志已写入原数组（调用方直接搬运，无新数组分配）
    expect(sameRef).toBeGreaterThan(0);
    expect(sameRef).toBe(chunks.filter((c) => c.visible).length);
  });

  it('相机在地图外远端：全部块隐藏（GPU 零植被提交）', () => {
    const chunks = buildChunks(MAP_SIZE, VEG_CHUNK_SIZE);
    const visible = updateVisibility(chunks, MAP_SIZE + 5000, MAP_SIZE + 5000, treeLodRadius(MAP_SIZE, VEG_CHUNK_SIZE));
    expect(visible).toBe(0);
    expect(chunks.some((c) => c.visible)).toBe(false);
  });

  it('草剔除半径 < 树剔除半径；块外接半径为正且随块边长增大', () => {
    expect(grassLodRadius(MAP_SIZE, VEG_CHUNK_SIZE)).toBeLessThan(treeLodRadius(MAP_SIZE, VEG_CHUNK_SIZE));
    expect(chunkBoundRadius(MAP_SIZE, VEG_CHUNK_SIZE)).toBeGreaterThan(0);
    expect(chunkBoundRadius(MAP_SIZE, VEG_CHUNK_SIZE * 2)).toBeGreaterThan(chunkBoundRadius(MAP_SIZE, VEG_CHUNK_SIZE));
  });
});

describe('后处理分辨率计算（render/postfx 纯函数）', () => {
  it('关闭后处理 → 0×0（调用方直通 renderer.render）', () => {
    expect(postFxResolution(false, 1, 1920, 1080)).toEqual({ width: 0, height: 0 });
  });

  it('降采样取 floor 且不低于 2px（防 0 尺寸非法 RT）', () => {
    expect(postFxResolution(true, POSTFX_SCALE_MEDIUM, 1920, 1080)).toEqual({ width: 1440, height: 810 });
    expect(postFxResolution(true, 1, 3, 3)).toEqual({ width: 3, height: 3 });
    expect(postFxResolution(true, 0.5, 3, 3)).toEqual({ width: 2, height: 2 });
  });
});

describe('画质 preset 的后处理门控（render/quality）', () => {
  it('low 直通（零后处理成本）；medium 降采样无 MSAA；high 全分辨率 + MSAA', () => {
    expect(QUALITY_PRESETS.low.postFx).toBe(false);
    expect(QUALITY_PRESETS.low.postFxMsaa).toBe(0);

    expect(QUALITY_PRESETS.medium.postFx).toBe(true);
    expect(QUALITY_PRESETS.medium.postFxScale).toBe(POSTFX_SCALE_MEDIUM);
    expect(QUALITY_PRESETS.medium.postFxMsaa).toBe(0);

    expect(QUALITY_PRESETS.high.postFx).toBe(true);
    expect(QUALITY_PRESETS.high.postFxScale).toBe(1);
    expect(QUALITY_PRESETS.high.postFxMsaa).toBe(POSTFX_MSAA_HIGH);
  });

  it('既有档位语义不变：阴影/视距/物资密度随档位单调不减', () => {
    expect(QUALITY_PRESETS.low.shadows).toBe(false);
    expect(QUALITY_PRESETS.medium.shadows).toBe(true);
    expect(QUALITY_PRESETS.high.shadowMapSize).toBeGreaterThan(QUALITY_PRESETS.medium.shadowMapSize);
    expect(QUALITY_PRESETS.high.viewDistance).toBeGreaterThan(QUALITY_PRESETS.medium.viewDistance);
    expect(QUALITY_PRESETS.medium.lootDensity).toBeGreaterThanOrEqual(QUALITY_PRESETS.low.lootDensity);
  });
});
