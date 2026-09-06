/**
 * core/systems/lifecycle —— 对局状态机 lobby → parachuting → playing → ended；
 * 胜负判定（仅剩 1 名存活者）与结算（排名/淘汰数/用时）。
 */

import { MAX_MATCH_MS } from '../../content/constants';
import type { World } from '../world';
import type { MatchResult, ResultRow } from '../types';
import { pushEvent } from '../world';

export function updateLifecycle(w: World): void {
  if (w.status === 'lobby') {
    w.status = 'parachuting';
  } else if (w.status === 'parachuting') {
    const playerLanded = w.player.state === 'ground';
    if (playerLanded) w.status = 'playing';
  }
}

export function checkMatchEnd(w: World): void {
  if (w.status === 'ended') return;
  // 性能：本函数每 tick（50Hz）调用一次，先标量计数，仅在终局时才物化存活数组
  //（此前 filter 每 tick 分配 1 数组 + 1 闭包，与 eliminate/zoneDamage 的同类写法不一致）
  const ents = w.entities;
  let aliveCount = 0;
  for (let i = 0; i < ents.length; i++) {
    if (ents[i].alive) aliveCount += 1;
  }
  const timeout = w.elapsedMs >= MAX_MATCH_MS;
  if (aliveCount <= 1 || timeout) {
    const alive: World['entities'] = [];
    for (let i = 0; i < ents.length; i++) {
      if (ents[i].alive) alive.push(ents[i]);
    }
    endMatch(w, alive, timeout);
  }
}

function endMatch(w: World, alive: World['entities'], timeout: boolean): void {
  // 存活者按淘汰数排名（并列按 index）
  const sorted = [...alive].sort((a, b) => b.kills - a.kills || a.index - b.index);
  sorted.forEach((e, i) => {
    e.rank = i + 1;
  });

  // 同时死亡兜底（终局坍缩同秒毒杀多人）：最后淘汰且淘汰数最高者记为第 1 名
  if (sorted.length === 0) {
    const dead = w.entities
      .filter((e) => !e.alive)
      .sort((a, b) => (b.eliminatedAtMs ?? 0) - (a.eliminatedAtMs ?? 0) || b.kills - a.kills || a.index - b.index);
    if (dead.length > 0) {
      const lastAt = dead[0].eliminatedAtMs ?? 0;
      const coDead = dead.filter((e) => e.eliminatedAtMs === lastAt);
      coDead.forEach((e, i) => {
        e.rank = i + 1;
      });
    }
  }

  const rows: ResultRow[] = w.entities
    .map((e) => ({
      entityId: e.id,
      kind: e.kind,
      rank: e.rank ?? w.entities.length,
      kills: e.kills,
      eliminatedAtMs: e.eliminatedAtMs,
    }))
    .sort((a, b) => a.rank - b.rank);

  const winner = sorted[0] ?? null;
  const player = w.player;
  const result: MatchResult = {
    winnerId: winner ? winner.id : null,
    winnerKind: winner ? winner.kind : null,
    totalEntities: w.entities.length,
    elapsedMs: w.elapsedMs,
    rankings: rows,
    playerRank: player.rank ?? null,
    playerKills: player.kills,
  };

  w.result = result;
  w.status = 'ended';
  void timeout;
  pushEvent(w, { type: 'matchEnded', result });
}
