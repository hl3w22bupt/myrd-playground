#!/usr/bin/env node
/**
 * 契约测试 acc-b5 — 存档迁移零损（spec v1.4）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b5-save-migration.spec.mjs
 * 断言：
 *  ① 真实 v1.3 fixture 非空（muted + anonId 两键缺一即 FAIL）；
 *  ② 迁移后既有两键逐字节一致；st.meta.save.v2 带 schemaVersion="2" + createdAt/updatedAt；
 *  ③ 重复迁移幂等（meta 段零变化）；
 *  ④ 损坏 JSON 安全降级（不抛错，meta 段重建，既有键保留）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadBuildModule, GAME_DIR } from './_runner.mjs';

const SAVE = 'build/meta/save.js';
const FIXTURE = join(GAME_DIR, 'tests', 'fixtures', 'save-v13-fixture.json');

function storageFrom(snapshot) {
  const m = new Map(Object.entries(snapshot));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}

runContract({
  id: 'acc-b5',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-save-migration',
  needs: [SAVE],
  checks: [
    {
      name: '真实 v1.3 fixture 非空：muted + anonId 两键齐备',
      fn: async () => {
        const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
        assert(typeof fixture['st.settings.muted'] === 'string' && fixture['st.settings.muted'] !== '', 'muted 非空');
        assert(/^[0-9a-f-]{36}$/.test(fixture['st.telemetry.anonId']), 'anonId 为 UUID 形态');
      },
    },
    {
      name: '迁移零损：既有两键逐字节一致；v2 段 schemaVersion=2 + 时间戳',
      fn: async () => {
        const save = (await loadBuildModule(SAVE)).mod;
        const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
        const storage = storageFrom(fixture);
        const report = save.migrateV13(storage, '2026-09-29T01:00:00.000Z');
        assert(report.created, '首迁移新建 meta 段');
        for (const k of save.V13_KEYS) {
          assertEq(storage.getItem(k), fixture[k], `既有键零触碰 ${k}`);
          assertEq(report.preservedKeys.includes(k), true, `报告含 ${k}`);
        }
        const v2 = JSON.parse(storage.getItem(save.META_SAVE_KEY));
        assertEq(v2.schemaVersion, '2', 'schemaVersion=2');
        assert(v2.createdAt === '2026-09-29T01:00:00.000Z' && v2.updatedAt === '2026-09-29T01:00:00.000Z', '时间戳在案');
      },
    },
    {
      name: '重复迁移幂等：meta 段零变化（created=false）',
      fn: async () => {
        const save = (await loadBuildModule(SAVE)).mod;
        const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
        const storage = storageFrom(fixture);
        save.migrateV13(storage, '2026-09-29T01:00:00.000Z');
        const before = storage.getItem(save.META_SAVE_KEY);
        const report = save.migrateV13(storage, '2026-09-29T09:00:00.000Z');
        assert(!report.created, '二次迁移不重建');
        assertEq(storage.getItem(save.META_SAVE_KEY), before, 'meta 段逐字节一致');
      },
    },
    {
      name: '损坏 JSON 安全降级：不抛错、meta 段重建、既有键保留',
      fn: async () => {
        const save = (await loadBuildModule(SAVE)).mod;
        const storage = storageFrom({
          'st.settings.muted': '1',
          'st.telemetry.anonId': 'deadbeef-0000-4000-8000-000000000000',
          [save.META_SAVE_KEY]: '{corrupted!!',
        });
        const s = save.loadMetaSave(storage, '2026-09-29T01:00:00.000Z');
        assertEq(s.schemaVersion, '2', '降级为新建 v2');
        assertEq(storage.getItem('st.settings.muted'), '1', '既有键保留');
      },
    },
  ],
});
