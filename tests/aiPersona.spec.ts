/**
 * aiPersona.spec —— AI 行为多样化（玩法缺口补齐项的自动化断言）：
 * 1) 人格分配：同 seed 确定性一致、同局内多样、多 seed 覆盖全部人格；
 * 2) 人格数值：全部为对 AI 全局参数的缩放（视野/交火距离/反应/误差/侧移）且与 content/ai 一致；
 * 3) 行为差异（可观测）：狙击手 200m 交火而突击手同距不交火；
 * 4) 低血撤退：血量低于人格阈值且有医疗时脱离交火治疗（aiState = heal）；
 * 5) 点射节流：交火存在开火窗口与冷却（burstReadyAtMs 生效）。
 * AI 行为多样性不破坏共用通道约束：全部行为仍只通过 PlayerIntent 表达。
 */

import { describe, expect, it } from 'vitest';
import { AI_PERSONALITIES } from '../src/content/ai';
import { tickWorld, vec3 } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

/** 构造单挑场景：AI（可指定人格）与目标对峙 distance 米，无遮挡、圈安全 */
function setupDuel(seed: number, persona: 'assault' | 'sniper' | 'skirmisher' | 'looter', distance: number) {
  const w = makeWorld(seed, 1);
  runUntilLanded(w, { x: 500, z: 500 });
  const ai = w.entities[1];
  const target = w.player;
  w.buildings.length = 0;
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.center = vec3(500, 0, 500);
  w.zone.radius = 2000;
  w.zone.dps = 0;
  ai.persona = persona;
  ai.state = 'ground';
  ai.pos = vec3(500, 0, 500);
  ai.hp = 100;
  ai.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
  ai.weapons[1] = null;
  ai.activeWeapon = 0;
  ai.ammoReserve['ammo_556'] = 300;
  target.state = 'ground';
  target.pos = vec3(500 + distance, 0, 500);
  target.hp = 1e9;
  return { w, ai, target };
}

describe('AI 行为多样化（persona）', () => {
  it('人格分配确定性：同 seed 两次初始化人格序列一致', () => {
    const a = makeWorld(140);
    const b = makeWorld(140);
    const pa = a.entities.filter((e) => e.kind === 'ai').map((e) => e.persona);
    const pb = b.entities.filter((e) => e.kind === 'ai').map((e) => e.persona);
    expect(pa).toEqual(pb);
  });

  it('人格多样性：12 名 AI 覆盖 ≥2 种人格；多 seed 覆盖全部 4 种人格', () => {
    const personas = makeWorld(141)
      .entities.filter((e) => e.kind === 'ai')
      .map((e) => e.persona);
    expect(new Set(personas).size).toBeGreaterThanOrEqual(2);

    const seen = new Set<string>();
    for (const seed of [141, 142, 143, 144, 145, 146, 147, 148]) {
      for (const e of makeWorld(seed).entities) {
        if (e.kind === 'ai') seen.add(e.persona);
      }
    }
    expect([...seen].sort()).toEqual(['assault', 'looter', 'skirmisher', 'sniper']);
  });

  it('人格数值：全部为 content/ai.AI_PERSONALITIES 定义的全局参数缩放', () => {
    const w = makeWorld(149);
    const cfg = w.pack.ai;
    const sniper = AI_PERSONALITIES.sniper;
    const assault = AI_PERSONALITIES.assault;
    // 缩放后可区分（AC4 参数可区分精神的行为版）
    expect(cfg.visionRange * sniper.visionMul).toBeGreaterThan(cfg.visionRange * assault.visionMul);
    expect(cfg.fireRange * sniper.fireRangeMul).toBeGreaterThan(cfg.fireRange * assault.fireRangeMul);
    expect(cfg.reactionMs * sniper.reactionMsMul).toBeGreaterThan(cfg.reactionMs * assault.reactionMsMul);
    expect(sniper.engageDist).toBeGreaterThan(assault.engageDist);
    // 分配权重非零（人格可被抽取）
    for (const p of Object.values(AI_PERSONALITIES)) {
      expect(p.weight).toBeGreaterThan(0);
    }
  });

  it('行为差异可观测：狙击手 200m 开火，突击手同距不开火（保持交战距离差异）', () => {
    const firedWithin = (persona: 'assault' | 'sniper'): boolean => {
      const { w, ai } = setupDuel(150, persona, 200);
      let fired = false;
      for (let i = 0; i < 400 && !fired; i++) {
        tickWorld(w, []);
        for (const ev of w.events) {
          if (ev.type === 'shotFired' && ev.entityId === ai.id) fired = true;
        }
        w.events.length = 0;
      }
      return fired;
    };
    expect(firedWithin('sniper')).toBe(true); // 狙击：fireRange 280m、视野 272m → 200m 交火
    expect(firedWithin('assault')).toBe(false); // 突击：fireRange 140m、视野 170m → 200m 不接触
  });

  it('低血撤退：血量低于人格阈值且可见敌人时 aiState = heal 并发起治疗', () => {
    const { w, ai, target } = setupDuel(151, 'looter', 30);
    ai.hp = 20; // looter retreatHpRatio = 0.5
    // 无武器：关键拾取优先于交火 → 先拾取脚下的绷带，随后进入撤退治疗分支
    ai.weapons[0] = null;
    ai.ammoReserve['ammo_556'] = 0;
    w.loots.push({ id: 't_p', item: 'bandage', pos: vec3(ai.pos.x + 0.5, 0, ai.pos.z), taken: false });
    // 目标可见（30m < 视野）
    let sawHeal = false;
    for (let i = 0; i < 600 && !sawHeal; i++) {
      tickWorld(w, []);
      target.pendingIntents = [];
      target.moveDirX = 0;
      target.moveDirZ = 0;
      if (ai.aiState === 'heal' || ai.medkitUntilMs !== null) sawHeal = true;
    }
    expect(sawHeal).toBe(true);
  });

  it('点射节流：交火存在开火窗口与冷却，不无限连射', () => {
    const { w, ai } = setupDuel(152, 'assault', 30);
    // 强制索敌：目标就在眼前
    const firedTicks: boolean[] = [];
    for (let i = 0; i < 600; i++) {
      tickWorld(w, []);
      // 开火状态由 AI 决策帧产出的意图逐 tick 应用，此处仅观测
      firedTicks.push(ai.firing);
      w.events.length = 0;
    }
    const firingCount = firedTicks.filter(Boolean).length;
    expect(firingCount).toBeGreaterThan(10); // 有开火窗口
    expect(firingCount).toBeLessThan(firedTicks.length); // 存在冷却（非全程开火）
    expect(ai.burstReadyAtMs).toBeGreaterThan(0); // 节流时间戳被设置过
  });
});
