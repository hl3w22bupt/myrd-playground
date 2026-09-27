#!/usr/bin/env node
/**
 * 契约测试 acc-e1 — 数据事件三要素定版（spec v1.2，五钩子埋点契约）。
 * 复现：node games/stack-tower/tests/contract/telemetry-acc-e1-hooks.spec.mjs
 * 断言：
 *  ① 事件名枚举封闭：{session_start, session_end, block_place, perfect_hit, game_over, restart}，枚举外丢弃；
 *  ② 每事件载荷双时间戳（client_ts ISO8601 + mono_ms number）+ anon_id（UUID v4，零 PII）
 *     + schema_version + client_version；
 *  ③ perfect_hit 携带 dispatch_ms/play_ms（acc-j3 可测点）且 play−dispatch ≤ 50；
 *  ④ 触发次数口径：六事件各发一次 → sink 恰 6 条；session_start/end 各 1；
 *  ⑤ 异常隔离：sink 抛错不外溢。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createTelemetryEmitter, TELEMETRY_EVENTS } from '../../build/telemetry/emitter.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeEmitter(sink) {
  let t = 0;
  return createTelemetryEmitter({
    now: () => (t += 16),
    isoNow: () => '2026-09-27T09:00:00.000Z',
    uuid: () => '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
    loadAnonId: () => null,
    saveAnonId: () => {},
    sink,
  });
}

runContract({
  id: 'acc-e1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-telemetry-emitter',
  needs: ['build/telemetry/emitter.js'],
  checks: [
    {
      name: '枚举封闭：六事件名单，枚举外事件名丢弃',
      fn: async () => {
        assertEq(TELEMETRY_EVENTS.length, 6, '枚举事件数');
        assertEq(
          [...TELEMETRY_EVENTS].sort().join(','),
          'block_place,game_over,perfect_hit,restart,session_end,session_start',
          '枚举名单',
        );
        const got = [];
        const em = makeEmitter((p) => got.push(p));
        em.emit('bogus_event');
        assertEq(got.length, 0, '枚举外事件被丢弃');
      },
    },
    {
      name: '三要素齐备：双时间戳 + 匿名 UUID v4 + 版本字段（六事件逐条）',
      fn: async () => {
        const got = [];
        const em = makeEmitter((p) => got.push(p));
        for (const ev of TELEMETRY_EVENTS) em.emit(ev);
        assertEq(got.length, 6, '六事件各一条');
        for (const p of got) {
          assert(!Number.isNaN(Date.parse(p.client_ts)), `${p.event}.client_ts 为 ISO8601`);
          assert(typeof p.mono_ms === 'number' && Number.isFinite(p.mono_ms), `${p.event}.mono_ms 为数值`);
          assert(UUID_RE.test(p.anon_id), `${p.event}.anon_id 为 UUID v4`);
          assert(p.schema_version === '1', `${p.event}.schema_version`);
          assert(p.client_version.length > 0, `${p.event}.client_version`);
          assert(!JSON.stringify(p).toLowerCase().includes('nickname'), '零 PII 抽查');
        }
        // 匿名 id 全局一致（会话级同一 anon_id）
        assertEq(new Set(got.map((p) => p.anon_id)).size, 1, 'anon_id 会话内一致');
      },
    },
    {
      name: 'perfect_hit 双毫秒（acc-j3 可测点）：play−dispatch ≤ 50ms',
      fn: async () => {
        const got = [];
        const em = makeEmitter((p) => got.push(p));
        em.emit('perfect_hit', { dispatch_ms: 1000, play_ms: 1032 });
        const p = got[0];
        assertEq(p.event, 'perfect_hit', '事件名');
        assert(typeof p.dispatch_ms === 'number' && typeof p.play_ms === 'number', 'dispatch/play 双毫秒');
        assert(p.play_ms - p.dispatch_ms <= 50, '音画预算 ≤50ms');
      },
    },
    {
      name: '异常隔离：sink 抛错不外溢、后续事件继续',
      fn: async () => {
        const got = [];
        const em = makeEmitter((p) => {
          got.push(p);
          if (p.event === 'block_place') throw new Error('sink down');
        });
        em.emit('block_place');
        em.emit('session_start');
        assertEq(got.length, 2, '埋点故障不中断后续发射');
      },
    },
  ],
});
