/**
 * render/quality —— 画质三档 + 自动降档（架构文档 01 §3）。
 * 与仿真无关：只影响渲染参数（像素比/阴影/视距/雾/抗锯齿提示）。
 */

import type { PerfSample } from '../perf/sampler';
import { POSTFX_MSAA_HIGH, POSTFX_SCALE_MEDIUM } from '../content/render';

export type QualityLevel = 'low' | 'medium' | 'high';

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
  /** 是否启用后处理（单 pass 合成；low 关闭直通，零额外成本） */
  postFx: boolean;
  /** 后处理 RT 分辨率缩放（1 = 全分辨率） */
  postFxScale: number;
  /** 后处理 RT MSAA 采样数（0 = 关闭） */
  postFxMsaa: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    level: 'low', pixelRatio: 0.75, shadows: false, shadowMapSize: 512, viewDistance: 320, lootDensity: 0.4,
    postFx: false, postFxScale: 0.75, postFxMsaa: 0,
  },
  medium: {
    level: 'medium', pixelRatio: 1, shadows: true, shadowMapSize: 1024, viewDistance: 620, lootDensity: 1,
    postFx: true, postFxScale: POSTFX_SCALE_MEDIUM, postFxMsaa: 0,
  },
  high: {
    level: 'high', pixelRatio: 2, shadows: true, shadowMapSize: 2048, viewDistance: 1200, lootDensity: 1,
    postFx: true, postFxScale: 1, postFxMsaa: POSTFX_MSAA_HIGH,
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
