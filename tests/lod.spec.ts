/**
 * tests/lod.spec —— 实体 LOD 分级（render/lod 纯逻辑，Node 可断言）。
 * 覆盖：full/simple/off 边界、部件显隐映射、画质档位与 LOD 阈值联动、玩家不参与剔除。
 */

import { describe, expect, it } from 'vitest';
import { entityLodSettings, pickEntityLod, shouldApplyEntityLod } from '../src/render/lod';
import { QUALITY_PRESETS } from '../src/render/quality';

/** full=2 / simple=1 / off=0，用于量化「细节保留程度」 */
function detailScore(distance: number, level: 'low' | 'medium' | 'high'): number {
  const preset = QUALITY_PRESETS[level];
  const lod = pickEntityLod(distance, preset);
  return lod === 'full' ? 2 : lod === 'simple' ? 1 : 0;
}

describe('实体 LOD 分级（render/lod）', () => {
  it('按相机距离选择 full/simple/off（medium 档边界）', () => {
    const preset = QUALITY_PRESETS.medium;
    expect(pickEntityLod(0, preset)).toBe('full');
    expect(pickEntityLod(preset.lodDetailFar - 1, preset)).toBe('full');
    expect(pickEntityLod(preset.lodDetailFar, preset)).toBe('simple');
    expect(pickEntityLod(preset.lodCullFar - 1, preset)).toBe('simple');
    expect(pickEntityLod(preset.lodCullFar, preset)).toBe('off');
    expect(pickEntityLod(10_000, preset)).toBe('off');
  });

  it('LOD settings 部件显隐映射正确', () => {
    expect(entityLodSettings('full')).toEqual({ body: true, head: true, gun: true });
    expect(entityLodSettings('simple')).toEqual({ body: true, head: false, gun: false });
    expect(entityLodSettings('off')).toEqual({ body: false, head: false, gun: false });
  });

  it('负距离按 0 处理（同一实体/相机重叠）', () => {
    expect(pickEntityLod(-5, QUALITY_PRESETS.high)).toBe('full');
  });

  it('画质档位联动：同距离下高画质保留更多细节', () => {
    // 200m：low→simple，medium→simple，high→full
    expect(detailScore(200, 'low')).toBe(1);
    expect(detailScore(200, 'medium')).toBe(1);
    expect(detailScore(200, 'high')).toBe(2);
    // 700m：low/medium→off（越档剔除），high→simple
    expect(detailScore(700, 'low')).toBe(0);
    expect(detailScore(700, 'medium')).toBe(0);
    expect(detailScore(700, 'high')).toBe(1);
    // 档位间细节保留不随距离倒挂
    for (const d of [50, 150, 300, 620, 900, 1500]) {
      expect(detailScore(d, 'high')).toBeGreaterThanOrEqual(detailScore(d, 'medium'));
      expect(detailScore(d, 'medium')).toBeGreaterThanOrEqual(detailScore(d, 'low'));
    }
  });

  it('玩家不参与 LOD 剔除，AI 参与', () => {
    expect(shouldApplyEntityLod(true)).toBe(false);
    expect(shouldApplyEntityLod(false)).toBe(true);
  });
});
