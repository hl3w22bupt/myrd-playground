/**
 * render/quality —— 画质三档 + 自动降档（架构文档 01 §3）。
 * 与仿真无关：只影响渲染参数（像素比/阴影/视距/雾/抗锯齿提示）。
 */

import type { PerfSample } from '../perf/sampler';
import {
  BLOOM_BY_QUALITY,
  ENTITY_LOD_BY_QUALITY,
  TERRAIN_SEGMENTS_BY_QUALITY,
  type RenderQualityLevel,
} from '../content/render';

export type QualityLevel = RenderQualityLevel;

/** Bloom 后处理参数（数值唯一来源：content/render BLOOM_BY_QUALITY） */
export interface BloomParams {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

/** 实体 LOD 配置（数值唯一来源：content/render ENTITY_LOD_BY_QUALITY） */
export interface LodParams {
  enabled: boolean;
  /** 近景阈值（m）：完整模型（躯干+头+枪） */
  nearDist: number;
  /** 中景阈值（m）：中等模型（躯干+头）；≥ 此距离走极简（仅躯干） */
  midDist: number;
}

export interface QualityPreset {
  level: QualityLevel;
  /** 渲染像素比上限 */
  pixelRatio: number;
  /** 是否开启阴影 */
  shadows: boolean;
  /** 阴影贴图尺寸 */
  shadowMapSize: number;
  /** 视距/雾距离（m） */
  viewDistance: number;
  /** 物资实例显示密度 0..1 */
  lootDensity: number;
  /** Bloom 后处理参数（本步新增） */
  bloom: BloomParams;
  /** 实体 LOD 配置（本步新增） */
  lod: LodParams;
  /** 地形网格段数（构建期一次性生效，自动升降档不重建地形） */
  terrainSegments: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    level: 'low',
    pixelRatio: 0.75,
    shadows: false,
    shadowMapSize: 512,
    viewDistance: 320,
    lootDensity: 0.4,
    bloom: BLOOM_BY_QUALITY.low,
    lod: ENTITY_LOD_BY_QUALITY.low,
    terrainSegments: TERRAIN_SEGMENTS_BY_QUALITY.low,
  },
  medium: {
    level: 'medium',
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    viewDistance: 620,
    lootDensity: 1,
    bloom: BLOOM_BY_QUALITY.medium,
    lod: ENTITY_LOD_BY_QUALITY.medium,
    terrainSegments: TERRAIN_SEGMENTS_BY_QUALITY.medium,
  },
  high: {
    level: 'high',
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    viewDistance: 1200,
    lootDensity: 1,
    bloom: BLOOM_BY_QUALITY.high,
    lod: ENTITY_LOD_BY_QUALITY.high,
    terrainSegments: TERRAIN_SEGMENTS_BY_QUALITY.high,
  },
};

/** 默认档位：按设备粗分（移动 → Low，桌面 → Medium） */
export function detectDefaultQuality(): QualityLevel {
  const touch = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return touch ? 'low' : 'medium';
}

/** 自动降档状态机：2s 一窗，连续 2 窗 FPS<45 降档；连续 5 窗 FPS>58 升档（每分钟至多一次） */
export class AutoQuality {
  private lowStreak = 0;
  private highStreak = 0;
  private lastUpgradeAt = -Infinity;

  constructor(private level: QualityLevel = detectDefaultQuality()) {}

  get current(): QualityLevel {
    return this.level;
  }

  set(level: QualityLevel): void {
    this.level = level;
    this.lowStreak = 0;
    this.highStreak = 0;
  }

  /** @param nowMs performance.now()，@param elapsedMs 开机以来的毫秒 */
  update(sample: PerfSample, nowMs: number): QualityLevel {
    if (sample.fps <= 0) return this.level;
    if (sample.fps < 45) {
      this.lowStreak += 1;
      this.highStreak = 0;
    } else if (sample.fps > 58) {
      this.highStreak += 1;
      this.lowStreak = 0;
    } else {
      this.lowStreak = 0;
      this.highStreak = 0;
    }

    if (this.lowStreak >= 2) {
      this.lowStreak = 0;
      if (this.level === 'high') {
        this.level = 'medium';
        return this.level;
      }
      if (this.level === 'medium') {
        this.level = 'low';
        return this.level;
      }
      return this.level; // low 已是底线
    }

    if (this.highStreak >= 5 && nowMs - this.lastUpgradeAt > 60_000) {
      this.highStreak = 0;
      this.lastUpgradeAt = nowMs;
      if (this.level === 'low') {
        this.level = 'medium';
      } else if (this.level === 'medium') {
        this.level = 'high';
      }
    }
    return this.level;
  }
}
