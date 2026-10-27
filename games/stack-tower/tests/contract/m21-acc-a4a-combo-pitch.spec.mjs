#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a4a — 连击升调：5 连逐块 +1 半音；miss 重置（QA 修正①拆分）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a4a-combo-pitch.spec.mjs
 * 断言：semitonesForCombo(1..5)=1..5；playbackRate=2^(n/12)；miss（combo=0）归零 rate=1；
 *       seeded 内核 5 连 perfect 序列逐块驱动升调（经 sim + 数值公式全链）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createAudioManager, semitonesForCombo, playbackRateFor } from '../../build/audio/audio-manager.js';
import { createSim } from '../../build/kernel/sim.js';
import { perfectDistance } from '../../build/kernel/numeric.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';

function dropAtPerfect(h, thresh) {
  for (let i = 0; i < 400; i++) {
    h.fastForward(1);
    const s = h.snapshot();
    if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) <= thresh) break;
  }
  return h.tick({ type: 'drop' });
}

runContract({
  id: 'acc-a4a',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/audio/audio-manager.js', 'build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: 'semitonesForCombo(1..5) = 1..5；rate = 2^(n/12) 逐块递增',
      fn: async () => {
        const rates = [];
        for (let n = 1; n <= 5; n++) {
          assertEq(semitonesForCombo(n), n, `${n} 连升 ${n} 半音`);
          rates.push(playbackRateFor(semitonesForCombo(n)));
        }
        for (let i = 1; i < rates.length; i++) assert(rates[i] > rates[i - 1], 'rate 随连击单调递增');
        assert(rates.every((r, i) => Math.abs(r - 2 ** ((i + 1) / 12)) < 1e-12), 'rate = 2^(n/12) 逐块');
      },
    },
    {
      name: 'miss 重置：combo=0 → 0 半音（rate 回 1）',
      fn: async () => {
        assertEq(semitonesForCombo(0), 0, 'miss 后 0 半音');
        assertEq(playbackRateFor(0), 1, 'rate 回 1');
        const h = createSim({ seed: 20260925 });
        dropAtPerfect(h, perfectDistance(1)); // perfect → combo 1
        dropAtPerfect(h, perfectDistance(1)); // perfect → combo 2
        // 非 perfect 落块 → miss：摆块扫过中轴最远时落
        for (let i = 0; i < 400; i++) {
          h.fastForward(1);
          const s = h.snapshot();
          if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) > perfectDistance(1) + 20) break;
        }
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().combo, 0, '内核 combo 归零（miss）');
        assertEq(semitonesForCombo(h.snapshot().combo), 0, 'miss 后升调归零');
      },
    },
    {
      name: 'seeded 5 连 perfect：音频层逐块收 1..5 半音（管理器全链）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const m = createAudioManager({
          ctx: fake.ctx,
          storage: createFakeStorage(),
          now: clock.now,
          loadBuffer: fakeBufferLoader(),
        });
        await m.unlock();
        const h = createSim({ seed: 20260925 });
        const got = [];
        for (let n = 0; n < 5; n++) {
          const events = dropAtPerfect(h, perfectDistance(1));
          const combo = h.snapshot().combo;
          const placed = events.some((e) => e.type === 'block-placed');
          if (placed) {
            const r = m.play('place', semitonesForCombo(combo));
            assert(r.played, `第 ${n + 1} 块出声`);
            got.push(r.semitones);
          }
          clock.advance(320); // 让 voice 过期，避免占满音池
        }
        assertEq(JSON.stringify(got), JSON.stringify([1, 2, 3, 4, 5]), '逐块 +1 半音序列');
      },
    },
  ],
});
