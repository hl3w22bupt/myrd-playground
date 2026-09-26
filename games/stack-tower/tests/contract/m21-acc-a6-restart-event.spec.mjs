#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a6 — tower-ripple 契约新增 restart 事件（spec v3 content.towerRipple.restart）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a6-restart-event.spec.mjs
 * 断言：sim.restart('button'/'keyboard') 上抛恰 {type,source} 载荷；无 screen-flash 语义；
 *       sfx-restart 在 12 文件清单内（≤200ms，critical）且 restart 触发其出声。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createSim } from '../../build/kernel/sim.js';
import { createAudioManager } from '../../build/audio/audio-manager.js';
import { createFakeAudioCtx, createFakeClock, createFakeStorage, fakeBufferLoader } from './_audio-fake.mjs';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GAME_DIR = resolve(import.meta.dirname, '..', '..');

runContract({
  id: 'acc-a6',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e06-tower-ripple',
  needs: ['build/kernel/sim.js', 'build/audio/audio-manager.js'],
  checks: [
    {
      name: 'restart(button) / restart(keyboard) 上抛恰 {type,source} 载荷',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        for (const source of ['button', 'keyboard']) {
          const h = sim.createSim({ seed: 20260925 });
          h.tick({ type: 'drop' });
          const events = h.restart(source);
          assertEq(events.length, 1, `${source} 事件数恰 1`);
          const e = events[0];
          assertEq(
            JSON.stringify(Object.keys(e).sort()),
            JSON.stringify(['source', 'type']),
            `${source} 载荷恰 {type,source}`,
          );
          assertEq(e.source, source, 'source 载荷');
          // 复位语义不变：塔回单块、分数清零
          assertEq(h.snapshot().score, 0, '重开清零');
          assertEq(h.snapshot().tower.length, 1, '塔回单块');
        }
        // 无 screen-flash 语义字段（与主波纹同纪律）
        const e = sim.createSim({ seed: 1 }).restart('button')[0];
        for (const banned of ['screen_flash', 'screenFlash', 'flash', 'aha', 'overlay']) {
          assert(!Object.keys(e).includes(banned), `携带被禁字段: ${banned}`);
        }
      },
    },
    {
      name: 'sfx-restart 在 12 文件清单（≤200ms，critical=true）',
      fn: async () => {
        const manifest = JSON.parse(readFileSync(join(GAME_DIR, 'assets', 'sfx', 'manifest.json'), 'utf8'));
        const r = manifest.events['restart'];
        assert(r, 'manifest 缺 restart 事件');
        assertEq(r.m4a, 'sfx-restart.m4a', '命名 = sfx- + 事件 id');
        assert(r.durationMs <= 200, `restart ${r.durationMs}ms 超 200ms`);
        assertEq(r.critical, true, 'restart critical');
      },
    },
    {
      name: 'restart 触发 sfx-restart 出声（管理器全链）',
      fn: async () => {
        const fake = createFakeAudioCtx();
        const clock = createFakeClock();
        const m = createAudioManager({ ctx: fake.ctx, storage: createFakeStorage(), now: clock.now, loadBuffer: fakeBufferLoader() });
        await m.unlock();
        const r = m.play('restart', 0);
        assertEq(r.reason, 'ok', 'restart 出声');
        assertEq(fake.sources[0].playbackRate.value, 1, 'restart 不参与升调（rate=1）');
      },
    },
  ],
});
