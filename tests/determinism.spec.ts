/**
 * tests/determinism —— 确定性守恒回归（核心红线）。
 * 同 seed + 同意图序列必须逐 tick 复现：实体/缩圈全部关键状态位一致。
 * 守护对象：意图通道、对象池、零分配重写等任何触及 core 的改动不得引入非确定性
 *（此前仓库内仅跳伞段有逐 tick 复现断言，交火/缩圈/AI 决策段无守恒检查）。
 */

import { describe, expect, it } from 'vitest';
import { createWorldForTest, tickWorld } from '../src/core';
import type { PlayerIntent, World } from '../src/core';

/** 脚本化玩家：只产意图（与真实玩家同通道），且为 w.tick 的纯函数（确定性） */
function scriptedPlayer(w: World): PlayerIntent[] {
  const p = w.player;
  if (p.state === 'plane') {
    return w.tick >= 120 ? [{ kind: 'jumpFromPlane' }] : [];
  }
  if (p.state === 'freefall' || p.state === 'parachute') {
    return [
      {
        kind: 'freefallControl',
        dirX: Math.sin(w.tick / 37),
        dirZ: Math.cos(w.tick / 53),
        dive: 0.4,
      },
    ];
  }
  const out: PlayerIntent[] = [
    { kind: 'aim', yaw: w.tick / 977, pitch: Math.sin(w.tick / 300) * 0.2 },
  ];
  if (w.tick % 3 === 0) {
    out.push({
      kind: 'move',
      dirX: Math.sin(w.tick / 91),
      dirZ: Math.cos(w.tick / 113),
      sprint: w.tick % 6 === 0,
    });
  }
  out.push(w.tick % 2 === 0 ? { kind: 'fire' } : { kind: 'stopFire' });
  if (w.tick % 240 === 0) out.push({ kind: 'reload' });
  return out;
}

/** 逐 tick 关键状态键：存活/位置/血量/状态/击杀/当前武器弹匣 + 缩圈相位/圆心/半径/计时 */
function stateKey(w: World): string {
  const parts: string[] = [
    `t=${w.tick}`,
    `z=${w.zone.phase},${w.zone.mode},${w.zone.timerMs},${w.zone.center.x},${w.zone.center.z},${w.zone.radius}`,
  ];
  for (const e of w.entities) {
    const slot = e.weapons[e.activeWeapon];
    parts.push(
      `${e.id}|${e.alive ? 1 : 0}|${e.pos.x},${e.pos.y},${e.pos.z}|${e.hp}|${e.state}|${e.kills}|` +
        `${slot ? `${slot.weapon}:${slot.magazine}` : 'none'}`,
    );
  }
  return parts.join('\n');
}

describe('确定性守恒（core 全量模拟）', () => {
  it('同 seed 同意图序列：每 200 tick 状态完全一致（覆盖跳伞/拾取/交火/缩圈/AI 决策）', () => {
    const TICKS = 3000;
    const run = (): string[] => {
      const w = createWorldForTest({ seed: 20260906, playerCount: 1, aiCount: 12 });
      const marks: string[] = [];
      for (let t = 1; t <= TICKS; t++) {
        tickWorld(w, scriptedPlayer(w));
        if (t % 200 === 0 || w.status === 'ended') marks.push(stateKey(w));
        if (w.status === 'ended') break;
      }
      return marks;
    };
    const first = run();
    const second = run();
    expect(first.length).toBeGreaterThan(5);
    expect(first).toEqual(second);
  });
});
