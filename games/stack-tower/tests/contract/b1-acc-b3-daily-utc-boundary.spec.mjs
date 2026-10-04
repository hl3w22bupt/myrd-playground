#!/usr/bin/env node
/**
 * 契约测试 acc-b3 — 每日挑战 UTC+8 时区边界（spec v1.4，锁定决策②）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b3-daily-utc-boundary.spec.mjs
 * 断言：
 *  ① 任务书原文边界：UTC 23:30 与该时区（UTC+8）00:30 归入不同挑战日；
 *  ② challengeDate 形如 YYYY-MM-DD；偏移量恰 UTC+8（480 分钟）；
 *  ③ 日期派生只吃注入 ISO 字符串（实现内零时钟读取——文件级断言）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadBuildModule, GAME_DIR } from './_runner.mjs';

const DAILY = 'build/meta/daily.js';

runContract({
  id: 'acc-b3',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-daily-tz',
  needs: [DAILY],
  checks: [
    {
      name: 'UTC 23:30 vs 该时区 00:30 归入不同挑战日（任务书原文用例）',
      fn: async () => {
        const daily = (await loadBuildModule(DAILY)).mod;
        const utc2330 = daily.challengeDateOf('2026-09-29T23:30:00.000Z'); // UTC+8 次日 07:30
        const tz0030 = daily.challengeDateOf('2026-09-29T16:30:00.000Z'); // UTC+8 次日 00:30
        assertEq(utc2330, '2026-09-30', 'UTC 23:30 → UTC+8 当日 2026-09-30 07:30');
        assertEq(tz0030, '2026-09-30', 'UTC+8 00:30 → 同一挑战日 2026-09-30');
        // 边界两侧：UTC 15:59:59 仍属前一日，UTC 16:00:00 翻日
        assertEq(daily.challengeDateOf('2026-09-29T15:59:59.000Z'), '2026-09-29', 'UTC 15:59:59 → 前一日');
        assertEq(daily.challengeDateOf('2026-09-29T16:00:00.000Z'), '2026-09-30', 'UTC 16:00:00 → 翻日');
      },
    },
    {
      name: 'challengeDate 形如 YYYY-MM-DD；TZ_OFFSET=480（UTC+8）',
      fn: async () => {
        const daily = (await loadBuildModule(DAILY)).mod;
        assertEq(daily.TZ_OFFSET_MINUTES, 480, '偏移 480 分钟');
        const s = daily.challengeDateOf('2026-01-05T12:00:00.000Z');
        assert(/^\d{4}-\d{2}-\d{2}$/.test(s), `YYYY-MM-DD 形态：${s}`);
      },
    },
    {
      name: '实现内零时钟读取：daily.js 无 Date.now() 调用 / 无参 new Date()',
      fn: async () => {
        const src = readFileSync(join(GAME_DIR, 'build/meta/daily.js'), 'utf8');
        assert(!/Date\.now\s*\(/.test(src), '无 Date.now( 调用');
        assert(!/new Date\(\s*\)/.test(src), '无无参 new Date()（时钟必须注入）');
      },
    },
  ],
});
