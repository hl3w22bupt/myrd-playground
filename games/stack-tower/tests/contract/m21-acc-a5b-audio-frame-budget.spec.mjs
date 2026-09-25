#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a5b — 有声开销预算（QA 修正②拆分，seeded 自动化）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a5b-audio-frame-budget.spec.mjs
 * 口径：seed=20260925、3 秒（187 tick @16ms）、20 连 tap；有声局（AudioManager 调度全链）
 * 相对静音局逐 tick 帧耗对比 —— 有声局零新增 >50ms 帧（且 jank 计数不增）。
 * 真机帧率（p95 ≤18.2ms）由 ?fps=1 覆盖层 + 真机清单核销（acc-a5b 真机挂账）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createSim } from '../../build/kernel/sim.js';
import { createAudioManager, semitonesForCombo } from '../../build/audio/audio-manager.js';
import { frameStats, withinFrameBudget } from '../../build/ui/fps-overlay.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';

const SEED = 20260925;
const TICKS = 187; // 3 秒 @16ms
const TAPS = 20;

/** 有声/静音双跑：同一 seeded 输入序，逐 tick 帧耗（ms） */
function runRound({ withSound }) {
  const h = createSim({ seed: SEED });
  const fake = createFakeAudioCtx();
  const clock = createFakeClock();
  const m =
    withSound &&
    createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
  const durations = [];
  let taps = 0;
  let combo = 0;
  for (let t = 0; t < TICKS; t++) {
    const t0 = process.hrtime.bigint();
    const drop = taps < TAPS && t % 9 === 0; // 20 连 tap（均匀分布，落在去抖间隔语义之外）
    if (drop) taps++;
    const events = h.tick(drop ? { type: 'drop' } : undefined);
    if (m) {
      combo = h.snapshot().combo;
      for (const e of events) {
        if (e.type === 'block-placed') m.play('place', semitonesForCombo(combo));
        else if (e.type === 'tower-ripple') m.play('perfect', semitonesForCombo(combo));
        else if (e.type === 'game-over') m.play('game-over', 0);
        else if (e.type === 'restart') m.play('restart', 0);
      }
    }
    const t1 = process.hrtime.bigint();
    durations.push(Number(t1 - t0) / 1e6);
  }
  assertEq(taps, TAPS, 'tap 数一致');
  return durations;
}

runContract({
  id: 'acc-a5b',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/kernel/sim.js', 'build/audio/audio-manager.js', 'build/ui/fps-overlay.js'],
  checks: [
    {
      name: '有声局零 >50ms 帧，且 jank 计数不高于静音局',
      fn: async () => {
        const muted = runRound({ withSound: false });
        const sound = runRound({ withSound: true });
        const mutedStats = frameStats(muted);
        const soundStats = frameStats(sound);
        assert(
          soundStats.jankCount === 0,
          `有声局出现 >50ms 帧 ${soundStats.jankCount} 个（max ${Math.max(...sound).toFixed(2)}ms）`,
        );
        assert(
          soundStats.jankCount <= mutedStats.jankCount,
          `有声局新增 jank：sound ${soundStats.jankCount} vs muted ${mutedStats.jankCount}`,
        );
        console.log(
          `    [budget] sound p95=${soundStats.p95Ms.toFixed(3)}ms max=${Math.max(...sound).toFixed(3)}ms | muted p95=${mutedStats.p95Ms.toFixed(3)}ms`,
        );
      },
    },
    {
      name: '帧预算判据纯函数：p95≤18.2 且零 jank 才算达标',
      fn: async () => {
        assert(withinFrameBudget(frameStats([16, 16.5, 17, 18.2])), '达标序列判 true');
        assert(!withinFrameBudget(frameStats([16, 19])), 'p95 超 18.2 判 false');
        assert(!withinFrameBudget(frameStats([16, 60])), '出现 60ms 帧判 false');
        assertEq(frameStats([]).count, 0, '空序列安全');
      },
    },
  ],
});
