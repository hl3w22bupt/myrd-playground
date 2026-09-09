/**
 * aiPersona.spec —— AI 敌人多样化（玩法缺口补齐项）：
 * 1) 每名 AI 开局被分配一个 content/ai 的人格（按权重、确定性抽取）；
 * 2) 同 seed 人格分配完全复现；
 * 3) 单局内存在多类人格（行为差异），跨 seed 可覆盖全部 4 类；
 * 4) 人格乘数经 aiPersonaParams 生效：视野/交火距离/反应/准度/拾取范围可区分。
 */

import { describe, expect, it } from 'vitest';
import { AI_PERSONALITIES } from '../src/content';
import type { AiPersonaId } from '../src/content';
import { aiPersonaParams } from '../src/core';
import type { Entity, World } from '../src/core';
import { makeWorld } from './helpers';

function aiPersonas(w: World): AiPersonaId[] {
  return w.entities.filter((e) => e.kind === 'ai').map((e) => e.aiPersona);
}

/** 把一个 AI 实体的人格换成指定 id（仅测试用；不影响其它状态） */
function withPersona(w: World, id: AiPersonaId): Entity {
  const e = w.entities.find((x) => x.kind === 'ai')!;
  e.aiPersona = id;
  return e;
}

describe('AC5b AI 敌人多样化（人格）', () => {
  it('AI 被分配人格且来自 content/ai 配置表；单局内 ≥2 类', () => {
    const w = makeWorld(707);
    const personaIds = aiPersonas(w);
    expect(personaIds.length).toBeGreaterThanOrEqual(10);
    const distinct = new Set(personaIds);
    for (const id of distinct) {
      expect(AI_PERSONALITIES[id]).toBeDefined();
    }
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  it('跨多 seed 覆盖全部 4 类人格（确定性权重抽取无空洞）', () => {
    const seen = new Set<AiPersonaId>();
    for (let seed = 1; seed <= 24; seed++) {
      for (const id of aiPersonas(makeWorld(seed))) seen.add(id);
    }
    expect(seen.size).toBe(Object.keys(AI_PERSONALITIES).length);
    expect(seen.has('assault')).toBe(true);
    expect(seen.has('sniper')).toBe(true);
  });

  it('同 seed 人格分配确定性复现', () => {
    expect(aiPersonas(makeWorld(888))).toEqual(aiPersonas(makeWorld(888)));
  });

  it('人格乘数生效：aiPersonaParams 反映视野/交火距离/反应/准度/拾取范围差异', () => {
    const w = makeWorld(9);
    const params = (id: AiPersonaId) => aiPersonaParams(w, withPersona(w, id));
    const sniper = params('sniper');
    const skirmisher = params('skirmisher');
    const assault = params('assault');
    const looter = params('looter');

    // 狙击手视野最远、交火距离最大、反应最慢、最准
    expect(sniper.visionRange).toBeGreaterThan(looter.visionRange);
    expect(sniper.fireRange).toBeGreaterThan(skirmisher.fireRange);
    expect(sniper.reactionMs).toBeGreaterThan(assault.reactionMs);
    expect(sniper.aimErrMul).toBeLessThan(skirmisher.aimErrMul);
    // 搜刮者拾取范围最大；游击兵反应最快、最不准
    expect(looter.lootRange).toBeGreaterThan(assault.lootRange);
    expect(skirmisher.reactionMs).toBeLessThan(assault.reactionMs);
    expect(skirmisher.aimErrMul).toBeGreaterThan(assault.aimErrMul);
    // 突击手为基准（全部乘数 = 1）
    expect(assault.visionRange).toBeCloseTo(w.pack.ai.visionRange, 9);
    expect(assault.fireRange).toBeCloseTo(w.pack.ai.fireRange, 9);
  });
});
