/**
 * render/quality —— 画质三档 + 自动降档（架构文档 01 §3）。
 * 与仿真无关：只影响渲染参数（像素比/阴影/视距/雾/色调映射/Bloom/实体 LOD/地形分段）。
 * 纯 TS，不依赖 three —— 可在 Node 下直接断言（tests/quality.spec.ts）。
 */

import type { PerfSample } from '../perf/sampler';

export type QualityLevel = 'low' | 'medium' | 'high';

/** 色调映射：高/中档用 ACES（Filmic），低档关闭以省片元开销 */
export type ToneMapMode = 'aces' | 'none';

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
  /** 色调映射模式（'none' = 无后期色调映射） */
  toneMapping: ToneMapMode;
  /** 色调映射曝光（低档无用） */
  exposure: number;
  /** 是否启用 Bloom（UnrealBloomPass） */
  bloom: boolean;
  /** Bloom 强度 */
  bloomStrength: number;
  /** Bloom 扩散半径（像素，相对内部分辨率） */
  bloomRadius: number;
  /** Bloom 亮度阈值（仅高于该亮度的像素参与泛光） */
  bloomThreshold: number;
  /** 实体 LOD：与相机距离超过该值（m）→ 隐藏头/枪等高频部件（simple） */
  lodDetailFar: number;
  /** 实体 LOD：与相机距离超过该值（m）→ 整体剔除（off） */
  lodCullFar: number;
  /** 地形网格分段数（越高越精细；构建期生效） */
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
    toneMapping: 'none',
    exposure: 1,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,
    lodDetailFar: 70,
    lodCullFar: 320,
    terrainSegments: 96,
  },
  medium: {
    level: 'medium',
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    viewDistance: 620,
    lootDensity: 1,
    toneMapping: 'aces',
    exposure: 1.05,
    bloom: true,
    bloomStrength: 0.5,
    bloomRadius: 0.45,
    bloomThreshold: 0.8,
    lodDetailFar: 150,
    lodCullFar: 620,
    terrainSegments: 140,
  },
  high: {
    level: 'high',
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    viewDistance: 1200,
    lootDensity: 1,
    toneMapping: 'aces',
    exposure: 1.12,
    bloom: true,
    bloomStrength: 0.85,
    bloomRadius: 0.55,
    bloomThreshold: 0.75,
    lodDetailFar: 260,
    lodCullFar: 1200,
    terrainSegments: 180,
  },
};

/** 档位序号：low=0 / medium=1 / high=2（供单调断言与降/升档比较） */
export function qualityRank(level: QualityLevel): number {
  return level === 'low' ? 0 : level === 'medium' ? 1 : 2;
}

/** 后处理是否启用（合成器路径） */
export function usesPostFx(preset: QualityPreset): boolean {
  return preset.bloom && preset.toneMapping !== 'none';
}

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
