#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a5a — critical 音不挤占（QA 修正②拆分，单元级 spy）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a5a-critical-priority.spec.mjs
 * 断言：8 voices 满载时 miss/game-over/restart 仍出声（抢占最老非 critical，池不超 8）；
 *       非 critical 满载丢弃（pool-full）；critical 之间互不抢占。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createAudioManager } from '../../build/audio/audio-manager.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';

/** 满载 8 个非 critical voice（手动钟不推进 → 全部存活） */
function fillPool(clock) {
  const fake = createFakeAudioCtx();
  const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
  return { fake, m, fill: async () => {
    await m.unlock();
    for (let i = 0; i < 8; i++) {
      const r = m.play('place', 0);
      assert(r.played, `填充第 ${i + 1} 个 voice`);
      clock.advance(1);
    }
    assertEq(m.activeVoiceCount(), 8, '池满 8');
  } };
}

runContract({
  id: 'acc-a5a',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/audio/audio-manager.js'],
  checks: [
    {
      name: '满载时非 critical 被丢弃（pool-full，不超池）',
      fn: async () => {
        const clock = createFakeClock();
        const { fake, m, fill } = fillPool(clock);
        await fill();
        const before = fake.sources.length;
        const r = m.play('perfect', 1);
        assertEq(r.reason, 'pool-full', '非 critical 满载丢弃');
        assertEq(fake.sources.length, before, '未新增 source');
        assertEq(m.activeVoiceCount(), 8, '池仍 8');
      },
    },
    {
      name: '满载时 miss / game-over / restart 仍出声（抢占最老非 critical，池恒 ≤8）',
      fn: async () => {
        for (const criticalEvent of ['miss', 'game-over', 'restart']) {
          const clock = createFakeClock();
          const { fake, m, fill } = fillPool(clock);
          await fill();
          const firstSource = fake.sources[0];
          const r = m.play(criticalEvent, 0);
          assertEq(r.reason, 'ok', `${criticalEvent} 满载仍出声`);
          assertEq(r.tier, 'buffer', `${criticalEvent} 走 buffer 层`);
          assertEq(firstSource.stopped, true, '最老非 critical 被抢占停止');
          assert(m.activeVoiceCount() <= 8, '池不超 8');
        }
      },
    },
    {
      name: 'critical 之间互不抢占（未满池中 critical 全部存活）',
      fn: async () => {
        const clock = createFakeClock();
        const fake = createFakeAudioCtx();
        const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
        await m.unlock();
        for (const e of ['miss', 'game-over', 'restart']) {
          assert(m.play(e, 0).played, `${e} 出声`);
          clock.advance(1);
        }
        // critical 池未满 8 → 全部存活，且互不停止
        assertEq(m.activeVoiceCount(), 3, 'critical 全部存活');
        assert(fake.sources.every((s) => !s.stopped), '互不抢占');
      },
    },
  ],
});
