#!/usr/bin/env node
/**
 * 契约测试 acc-b2 — 每日挑战 seed 确定性（spec v1.4）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b2-daily-seed.spec.mjs
 * 断言：
 *  ① 同 UTC+8 日期字符串 → 同 seed 同 sfc32 序列（逐值复现）；
 *  ② 跨日 seed 必变；sfc32 流随日期变化；
 *  ③ 全链路确定性：build/meta/seed.js 与 build/meta/daily.js 源无 Math.random。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadBuildModule, GAME_DIR } from './_runner.mjs';

const SEED = 'build/meta/seed.js';
const DAILY = 'build/meta/daily.js';

runContract({
  id: 'acc-b2',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-daily',
  needs: [SEED, DAILY],
  checks: [
    {
      name: '同日同 seed：challengeDate→seed 两次相等；sfc32 前 64 值逐值相等',
      fn: async () => {
        const seed = (await loadBuildModule(SEED)).mod;
        const daily = (await loadBuildModule(DAILY)).mod;
        const a = daily.createDailyChallenge('2026-09-29T01:00:00.000Z'); // UTC+8 当日 09:00
        const b = daily.createDailyChallenge('2026-09-29T15:59:59.000Z'); // UTC+8 当日 23:59
        assertEq(a.challengeDate, '2026-09-29', 'A 日期');
        assertEq(b.challengeDate, '2026-09-29', 'B 日期');
        assertEq(a.seed, seed.seedFromDate('2026-09-29'), 'seed = seedFromDate(日期)');
        assertEq(a.seed, b.seed, '同日 seed 相等');
        const seqA = Array.from({ length: 64 }, () => a.rng.next());
        const seqB = Array.from({ length: 64 }, () => b.rng.next());
        assertEq(JSON.stringify(seqA), JSON.stringify(seqB), 'sfc32 序列逐值复现');
        for (const v of seqA) assert(v >= 0 && v < 1, `sfc32 值域 [0,1)：${v}`);
      },
    },
    {
      name: '跨日 seed 必变 + 随机流互异',
      fn: async () => {
        const daily = (await loadBuildModule(DAILY)).mod;
        const d1 = daily.createDailyChallenge('2026-09-29T16:00:00.000Z'); // UTC+8 2026-09-30 00:00
        const d2 = daily.createDailyChallenge('2026-09-29T15:59:59.000Z'); // UTC+8 2026-09-29 23:59
        assertEq(d1.challengeDate, '2026-09-30', '跨日边界后日期 +1');
        assert(d1.seed !== d2.seed, '跨日 seed 必变');
        assert(d1.rng.next() !== d2.rng.next(), '跨日 sfc32 流互异（首值）');
      },
    },
    {
      name: '确定性红线：meta 构建产物无 Math.random()/Date.now() 调用形态',
      fn: async () => {
        for (const f of ['build/meta/seed.js', 'build/meta/daily.js', 'build/meta/claim.js', 'build/meta/streak.js']) {
          const src = readFileSync(join(GAME_DIR, f), 'utf8');
          assert(!/Math\.random\s*\(/.test(src), `${f} 无 Math.random( 调用`);
          assert(!/Date\.now\s*\(/.test(src), `${f} 无 Date.now( 调用`);
        }
      },
    },
  ],
});
