/**
 * tests/quality.spec —— 画质三档配置 + 自动降档（render/quality 纯逻辑，Node 可断言）。
 * 覆盖：三档渲染成本单调、后处理启用条件、AutoQuality 降/升档与 60s 冷却。
 */

import { describe, expect, it } from 'vitest';
import { AutoQuality, QUALITY_PRESETS, qualityRank, usesPostFx } from '../src/render/quality';
import type { PerfSample } from '../src/perf/sampler';

function sample(fps: number): PerfSample {
  const frameMs = fps > 0 ? 1000 / fps : 0;
  return { fps, low1Fps: fps, p95FrameMs: frameMs, avgFrameMs: frameMs, heapMb: null };
}

describe('画质三档配置（render/quality）', () => {
  it('low/medium/high 渲染成本单调递增且彼此可区分', () => {
    const low = QUALITY_PRESETS.low;
    const med = QUALITY_PRESETS.medium;
    const high = QUALITY_PRESETS.high;

    // 成本相关字段单调递增
    expect(low.pixelRatio).toBeLessThan(med.pixelRatio);
    expect(med.pixelRatio).toBeLessThan(high.pixelRatio);
    expect(low.shadowMapSize).toBeLessThan(med.shadowMapSize);
    expect(med.shadowMapSize).toBeLessThan(high.shadowMapSize);
    expect(low.viewDistance).toBeLessThan(med.viewDistance);
    expect(med.viewDistance).toBeLessThan(high.viewDistance);
    expect(low.terrainSegments).toBeLessThan(med.terrainSegments);
    expect(med.terrainSegments).toBeLessThan(high.terrainSegments);

    // LOD 阈值单调：高画质保留细节更远
    expect(low.lodDetailFar).toBeLessThan(med.lodDetailFar);
    expect(med.lodDetailFar).toBeLessThan(high.lodDetailFar);
    expect(low.lodCullFar).toBeLessThan(med.lodCullFar);
    expect(med.lodCullFar).toBeLessThan(high.lodCullFar);

    // 低档关闭阴影与 Bloom；中高档开启（表现/成本分档）
    expect(low.shadows).toBe(false);
    expect(med.shadows).toBe(true);
    expect(high.shadows).toBe(true);
    expect(low.bloom).toBe(false);
    expect(med.bloom).toBe(true);
    expect(high.bloom).toBe(true);
    expect(med.bloomStrength).toBeLessThan(high.bloomStrength);
  });

  it('usesPostFx 仅在 Bloom + ACES 的档位启用合成器', () => {
    expect(usesPostFx(QUALITY_PRESETS.low)).toBe(false);
    expect(usesPostFx(QUALITY_PRESETS.medium)).toBe(true);
    expect(usesPostFx(QUALITY_PRESETS.high)).toBe(true);
  });

  it('qualityRank 排序稳定', () => {
    expect(qualityRank('low')).toBe(0);
    expect(qualityRank('medium')).toBe(1);
    expect(qualityRank('high')).toBe(2);
  });
});

describe('AutoQuality 自动降/升档', () => {
  it('连续低帧率逐档下降至 low 底线', () => {
    const aq = new AutoQuality('high');
    expect(aq.current).toBe('high');
    expect(aq.update(sample(30), 0)).toBe('high'); // 第 1 窗计数，未达降档阈值
    expect(aq.update(sample(30), 1)).toBe('medium'); // 连续 2 窗 → high→medium（计数清零）
    expect(aq.update(sample(30), 2)).toBe('medium'); // 新计数第 1 窗
    expect(aq.update(sample(30), 3)).toBe('low'); // 再连续 2 窗 → medium→low
    expect(aq.update(sample(30), 4)).toBe('low'); // 已是底线，不再降
  });

  it('高帧率累积窗口升档，受 60s 冷却限制', () => {
    const aq = new AutoQuality('low');
    // 5 个高帧窗口 → low → medium（lastUpgradeAt≈4ms；初始 -Infinity 视为冷却已过）
    expect(aq.update(sample(60), 0)).toBe('low');
    expect(aq.update(sample(60), 1)).toBe('low');
    expect(aq.update(sample(60), 2)).toBe('low');
    expect(aq.update(sample(60), 3)).toBe('low');
    expect(aq.update(sample(60), 4)).toBe('medium');

    // 冷却期（<60s）：即便高帧窗口继续累积也不升档
    for (let i = 5; i <= 9; i++) aq.update(sample(60), 5000 + i);
    expect(aq.update(sample(60), 5010)).toBe('medium');

    // 冷却期过后（距上次升档 >60s）→ medium → high
    for (let i = 0; i < 5; i++) aq.update(sample(60), 70_000 + i);
    expect(aq.update(sample(60), 70_005)).toBe('high');
  });

  it('帧率回到 45..58 区间会中断降档计数', () => {
    const aq = new AutoQuality('medium');
    aq.update(sample(30), 0); // lowStreak=1
    aq.update(sample(30), 1); // lowStreak=2 → 应触发降档
    expect(aq.current).toBe('low');
    // 回到中帧率清空计数，之后单次低帧不再降
    const again = new AutoQuality('medium');
    again.update(sample(30), 0); // lowStreak=1
    again.update(sample(50), 1); // 45..58 → 清零
    again.update(sample(30), 2); // lowStreak=1
    expect(again.current).toBe('medium');
  });
});
