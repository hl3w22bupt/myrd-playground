#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a2 — 移动端首手势解锁（iOS 纪律，单元级 spy）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a2-unlock.spec.mjs
 * 断言：解锁前 play 不出声（入队挂起）；unlock() 后 state=running、挂起队列补放、后续事件直接出声。
 * 真机（iOS Safari）项挂日期另行核销（见 docs/qa-m21-verification.md）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createAudioManager } from '../../build/audio/audio-manager.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';

runContract({
  id: 'acc-a2',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/audio/audio-manager.js'],
  checks: [
    {
      name: '解锁前：play 挂起不出声（零 source 创建，pending 入队）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
        const r = m.play('place', 0);
        assertEq(r.reason, 'locked', '未解锁 reason');
        assertEq(r.played, false, '未解锁不发声');
        assertEq(fake.sources.length, 0, '未解锁零 source');
        assertEq(m.pendingCount(), 1, '挂起队列长度');
      },
    },
    {
      name: 'unlock 后：state=running，挂起请求补放（队首到队尾依序出声）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
        m.play('place', 0);
        m.play('perfect', 1);
        assertEq(m.pendingCount(), 2, '挂起 2 条');
        await m.unlock();
        assertEq(fake.ctx.state, 'running', 'AudioContext state');
        assertEq(m.pendingCount(), 0, '队列清空');
        assertEq(fake.sources.filter((s) => s.started).length, 2, '挂起请求补放');
      },
    },
    {
      name: '解锁后直接出声 + 预解码装载（buffer tier）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
        await m.unlock();
        const r = m.play('place', 0);
        assertEq(r.reason, 'ok', '解锁后出声');
        assertEq(r.tier, 'buffer', '走 sfx-pack buffer 层');
        assert(fake.sources[0].started, 'source 已 start');
        assert(fake.sources[0].playbackRate.value === 1, '零半音 rate=1');
      },
    },
  ],
});
