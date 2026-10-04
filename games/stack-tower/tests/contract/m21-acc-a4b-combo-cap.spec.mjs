#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a4b — 连击升调封顶：≥13 连恒 +12（QA 修正①拆分）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a4b-combo-cap.spec.mjs
 * 断言：第 13、14 块（及任意更高连击）semitones 均 = 12（CAP），rate 相同不再增加。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { semitonesForCombo, playbackRateFor } from '../../build/audio/audio-manager.js';

runContract({
  id: 'acc-a4b',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/audio/audio-manager.js'],
  checks: [
    {
      name: '第 13、14 块（及 20/99 连）均 +12 封顶',
      fn: async () => {
        for (const combo of [13, 14, 20, 99]) {
          assertEq(semitonesForCombo(combo), 12, `${combo} 连封顶 +12`);
        }
      },
    },
    {
      name: '封顶后 rate 不再增加（12 连与 99 连 rate 相等）',
      fn: async () => {
        assertEq(playbackRateFor(semitonesForCombo(12)), playbackRateFor(semitonesForCombo(99)), '封顶 rate 相等');
        assert(playbackRateFor(12) < playbackRateFor(11) * 2, 'rate 序列仍在 2^1 封内（12 半音=八度）');
        assertEq(playbackRateFor(12), 2, '12 半音恰为一个八度（2 倍频）');
      },
    },
    {
      name: '连续序列无跳变：1..14 半音序列 = 1..12,12,12',
      fn: async () => {
        const seq = [];
        for (let n = 1; n <= 14; n++) seq.push(semitonesForCombo(n));
        assertEq(JSON.stringify(seq), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12]), '封顶序列');
      },
    },
  ],
});
