#!/usr/bin/env node
/**
 * 契约测试 acc-a8 — P0 资产 13 项逐件查表（spec v1.2；asset-check 并入 contract-check 同门）。
 * 复现：node games/stack-tower/tests/contract/assets-acc-a8-p0-table.spec.mjs
 * 查表判据：hex±5 / 禁描边 / 渐变方向二值 / 几何 ±10% 拒收 + sha256 防漂移。
 * 执行体：tests/assets-neon-check.mjs（独立 CLI 可跑，本契约逐件断言其结果）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { runNeonAssetCheck } from '../assets-neon-check.mjs';

runContract({
  id: 'acc-a8',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-theme-constants',
  needs: [],
  checks: [
    {
      name: 'P0 13 件逐件 PASS（完整性 + hex±5 + 禁描边 + 渐变二值 + 几何 ±10%）',
      fn: async () => {
        const { pass, rows } = runNeonAssetCheck();
        assertEq(rows.length, 13, 'P0 资产件数（a08..a20）');
        const failed = rows.filter((r) => !r.pass);
        for (const r of failed) assert(false, `${r.id}: ${r.reasons.join('; ')}`);
        assert(pass, '全表 PASS');
      },
    },
    {
      name: 'spec assets 段对齐：a08..a20 逐项在档（id 对齐）',
      fn: async () => {
        const spec = (await import('./_runner.mjs')).loadSpec().spec;
        const ids = new Set(spec.assets.map((a) => a.id));
        for (let i = 8; i <= 20; i++) {
          assert(ids.has(`a${String(i).padStart(2, '0')}`), `spec assets 缺 a${String(i).padStart(2, '0')}`);
        }
        const { rows } = runNeonAssetCheck();
        for (const r of rows) assert(ids.has(r.id), `manifest 件 ${r.id} 未在 spec assets 段登记`);
      },
    },
  ],
});
