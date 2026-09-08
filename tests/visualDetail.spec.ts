/**
 * tests/visualDetail.spec —— 画质档画面细节配置表断言（60FPS 红线护栏）。
 * 背景：本地帧率基准复测发现「低档仍渲染天空穹顶/云层/植被/粒子带」造成帧率回退，
 * 因此引入按档位门控的 VISUAL_DETAIL 配置表；本测试锁定其结构约束，
 * 防止未来调参把低档推回超预算（不触碰玩法逻辑）。
 */

import { describe, expect, it } from 'vitest';
import {
  VISUAL_DETAIL,
  ZONE_PARTICLE_COUNT,
} from '../src/content/render';

type Level = keyof typeof VISUAL_DETAIL;
const LEVELS: Level[] = ['low', 'medium', 'high'];

describe('画质档画面细节配置表（content/render VISUAL_DETAIL）', () => {
  it('三档齐全且布尔门控单调递增（低档不开天空 extras）', () => {
    expect(LEVELS.length).toBe(3);
    expect(VISUAL_DETAIL.low.skyDome).toBe(false);
    expect(VISUAL_DETAIL.low.clouds).toBe(false);
    expect(VISUAL_DETAIL.low.sunGlow).toBe(false);
    // 中/高档保留完整天空层次（AC2②远景观感）
    for (const lvl of ['medium', 'high'] as Level[]) {
      expect(VISUAL_DETAIL[lvl].skyDome, lvl).toBe(true);
      expect(VISUAL_DETAIL[lvl].clouds, lvl).toBe(true);
      expect(VISUAL_DETAIL[lvl].sunGlow, lvl).toBe(true);
    }
  });

  it('植被/粒子预算随档位单调不减，且不小于 0', () => {
    for (const key of ['trees', 'grass', 'zoneParticles'] as const) {
      const [lo, mid, hi] = LEVELS.map((l) => VISUAL_DETAIL[l][key]);
      expect(lo, `low.${key}`).toBeGreaterThanOrEqual(0);
      expect(mid, `medium.${key}`).toBeGreaterThanOrEqual(lo);
      expect(hi, `high.${key}`).toBeGreaterThanOrEqual(mid);
    }
  });

  it('低档预算受限：60FPS 红线护栏（低档不渲染毒圈粒子带，植被受限）', () => {
    expect(VISUAL_DETAIL.low.zoneParticles).toBe(0);
    expect(VISUAL_DETAIL.low.trees).toBeLessThanOrEqual(120);
    expect(VISUAL_DETAIL.low.grass).toBeLessThanOrEqual(200);
  });

  it('毒圈粒子带预算不得超过固定缓冲容量', () => {
    for (const lvl of LEVELS) {
      expect(VISUAL_DETAIL[lvl].zoneParticles).toBeLessThanOrEqual(ZONE_PARTICLE_COUNT);
    }
  });
});
