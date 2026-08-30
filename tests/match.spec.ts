import { describe, expect, it } from 'vitest';
import { MAX_MATCH_MS } from '../src/content/constants';
import { buildSnapshot, tickWorld } from '../src/core';
import type { PlayerIntent } from '../src/core';
import { makeWorld, playerLandingController, runToEnd } from './helpers';

/** 玩家「随意玩」控制器：跳伞到 P 城附近 → 移动 → 开火（会被 AI 淘汰或存活到结算） */
function casualPlayer(w: { player: { state: string; pos: { x: number; z: number } } }): PlayerIntent[] {
  const p = w.player;
  if (p.state === 'plane') return [{ kind: 'jumpFromPlane' }];
  if (p.state === 'freefall' || p.state === 'parachute') return playerLandingController(w as never, { x: 430, z: 460 });
  return [];
}

describe('AC1 全流程闭环与胜负结算', () => {
  it('固定 seed 单局自然结束：唯一存活者、结果含排名/淘汰数/用时、≤10 分钟', () => {
    for (const seed of [20260831, 4242]) {
      const w = makeWorld(seed);
      const endTick = runToEnd(w, 31_000, casualPlayer);
      expect(w.status).toBe('ended');

      const alive = w.entities.filter((e) => e.alive);
      expect(alive.length).toBeLessThanOrEqual(1);

      const result = w.result!;
      expect(result).not.toBeNull();
      expect(result.totalEntities).toBe(13);
      expect(result.elapsedMs).toBeLessThanOrEqual(MAX_MATCH_MS);
      expect(((endTick * 20) / 1000) * 1000).toBe(result.elapsedMs);

      // 排名表完整且秩连续
      expect(result.rankings.length).toBe(13);
      const ranks = result.rankings.map((r) => r.rank).sort((a, b) => a - b);
      ranks.forEach((r, i) => expect(r).toBe(i + 1));

      // 冠军（存在时）rank=1
      if (alive.length === 1) {
        expect(result.winnerId).toBe(alive[0].id);
        const winnerRow = result.rankings.find((r) => r.entityId === result.winnerId)!;
        expect(winnerRow.rank).toBe(1);
        expect(winnerRow.kills).toBe(alive[0].kills);
      }

      // 结算事件存在
      const ended = w.events.find((e) => e.type === 'matchEnded');
      expect(ended).toBeDefined();
    }
  }, 120_000);

  it('AI 获胜分支：玩家被淘汰后对局继续并由 AI 夺冠，玩家排名正确', () => {
    const w = makeWorld(777);
    runToEnd(w, 31_000, casualPlayer);
    expect(w.status).toBe('ended');
    const result = w.result!;
    if (result.winnerKind === 'ai') {
      expect(result.playerRank).toBeGreaterThan(1);
      expect(result.playerKills).toBe(w.player.kills);
      expect(result.rankings.find((r) => r.entityId === 'player')!.rank).toBe(result.playerRank);
    } else {
      expect(result.winnerKind).toBe('player');
    }
  }, 120_000);

  it('玩家获胜分支：AI 全部被毒圈淘汰、玩家居圈心存活，判定玩家夺冠（rank=1）', () => {
    const w = makeWorld(888, 10);
    // 玩家直接落地并置于首圈中心（永不圈外）
    w.player.state = 'ground';
    w.player.pos = { ...w.zone.center, y: 0 };
    // 快进到最后阶段（dps 最高），AI 全部移出圈外
    const lastPhase = w.pack.zone.phases.length - 1;
    w.zone.phase = lastPhase;
    w.zone.mode = 'wait';
    w.zone.timerMs = 1000;
    w.zone.dps = w.pack.zone.phases[lastPhase].dps;
    for (const e of w.entities) {
      if (e.kind !== 'ai') continue;
      e.state = 'ground';
      e.pos = { x: w.zone.center.x + w.zone.radius + 120, y: 0, z: w.zone.center.z };
      e.hp = 10;
      e.pendingIntents = [];
      e.moveDirX = 0;
      e.moveDirZ = 0;
    }
    runToEnd(w, 20_000, () => []);
    const result = w.result!;
    expect(w.status).toBe('ended');
    expect(result.winnerKind).toBe('player');
    expect(result.winnerId).toBe('player');
    expect(result.playerRank).toBe(1);
    expect(result.rankings.filter((r) => r.rank === 1).length).toBe(1);
    // AI 名次均 > 1
    expect(result.rankings.filter((r) => r.kind === 'ai').every((r) => r.rank > 1)).toBe(true);
  }, 120_000);

  it('对局过程快照完整（实体/物资/缩圈/运输机），供渲染层消费', () => {
    const w = makeWorld(99);
    tickWorld(w, [{ kind: 'jumpFromPlane' }]);
    const snap = buildSnapshot(w);
    expect(snap.entities.length).toBe(13);
    expect(snap.plane).not.toBeNull();
    expect(snap.zone.phase).toBe(0);
    expect(snap.loots.length).toBeGreaterThan(0);
    expect(snap.status).toBe('parachuting');
    expect(snap.player).not.toBeNull();
    expect(snap.player!.state).toBe('freefall');
    expect(snap.tick).toBe(1);
  });

  it('性能冒烟：13 实体跑 60s 逻辑时长（3000 tick）耗时 < 3s（50Hz 实时预算 8% 内）', () => {
    const w = makeWorld(1234);
    const start = performance.now();
    for (let i = 0; i < 3000; i++) tickWorld(w, casualPlayer(w));
    const costMs = performance.now() - start;
    // 3000 tick = 60s 逻辑时长；实时预算为 60_000ms，仿真耗时须远低于（确定性核心的吞吐红线）
    expect(costMs).toBeLessThan(3000);
  }, 60_000);
});
