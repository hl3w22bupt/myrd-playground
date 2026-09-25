#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a3 — 静音持久（localStorage `st.settings.muted`）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a3-mute-persist.spec.mjs
 * 断言：toggle 后落盘；重建实例读回静音态；静音态 play 零输出节点。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createAudioManager } from '../../build/audio/audio-manager.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';

const deps = (fake, storage, clock) => ({ ctx: fake.ctx, storage, now: clock.now, loadBuffer: fakeBufferLoader() });

runContract({
  id: 'acc-a3',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-audio-manager',
  needs: ['build/audio/audio-manager.js'],
  checks: [
    {
      name: 'toggle 落盘 st.settings.muted（"1"/"0"）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const storage = createFakeStorage();
        const m = createAudioManager(deps(fake, storage, clock));
        assertEq(m.isMuted(), false, '初始不静音');
        assertEq(m.toggleMute(), true, 'toggle 后静音');
        assertEq(storage.dump()['st.settings.muted'], '1', '持久化 "1"');
        m.setMuted(false);
        assertEq(storage.dump()['st.settings.muted'], '0', '持久化 "0"');
      },
    },
    {
      name: '重建实例读回静音态（刷新/重开语义）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const storage = createFakeStorage();
        createAudioManager(deps(fake, storage, clock)).setMuted(true);
        const m2 = createAudioManager(deps(fake, storage, clock));
        assertEq(m2.isMuted(), true, '新实例读回静音');
      },
    },
    {
      name: '静音态 play 零输出节点（零 source / 零 osc）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const storage = createFakeStorage();
        const m = createAudioManager(deps(fake, storage, clock));
        m.setMuted(true);
        await m.unlock();
        const r = m.play('perfect', 3);
        assertEq(r.reason, 'muted', '静音 reason');
        assertEq(r.played, false, '静音不发声');
        assertEq(fake.sources.length, 0, '零 source');
        assertEq(fake.oscillators.length, 0, '零 oscillator');
      },
    },
    {
      name: '存储不可用（隐私模式）：静音仅会话内生效，不抛错',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
        const m = createAudioManager(deps(fake, broken, clock));
        assertEq(m.toggleMute(), true, 'toggle 正常返回');
        assert(m.isMuted(), '会话内静音生效');
      },
    },
  ],
});
