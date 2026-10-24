#!/usr/bin/env node
/**
 * 契约测试 acc-b1 — scope_gate 判定落死（spec v1.4，B1 上头循环轮）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b1-scope-gate.spec.mjs
 * 断言：
 *  ① scopeGate.decision="narrow"；hooksInScope=[daily-challenge,streak-display]；hooksDeferred=[missions]；
 *  ② items 含 missions-deferred 且不含 missions 运行时条目（顺延语义）；
 *  ③ 附录 A mission schema：「id 必填全局去重」硬约束在案；
 *  ④ N0 证据档案存在且含三行对照表（85% / 3 局 / 20%）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadSpec, REPO_ROOT } from './_runner.mjs';

runContract({
  id: 'acc-b1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-scope-gate',
  needs: [],
  checks: [
    {
      name: 'scope_gate=narrow：hooksInScope 两钩子，missions 顺延',
      fn: async () => {
        const ret = loadSpec().spec.content.retention;
        assertEq(ret.scopeGate.decision, 'narrow', 'decision');
        assertEq(JSON.stringify([...ret.scopeGate.hooksInScope].sort()), '["daily-challenge","streak-display"]', 'hooksInScope');
        assertEq(JSON.stringify(ret.scopeGate.hooksDeferred), '["missions"]', 'hooksDeferred');
      },
    },
    {
      name: 'items：missions-deferred 在案，无 missions 运行时条目；每条带落点+可执行 check',
      fn: async () => {
        const ret = loadSpec().spec.content.retention;
        const ids = ret.items.map((i) => i.id);
        assert(ids.includes('missions-deferred'), 'missions-deferred 条目在案');
        assert(!ids.includes('missions'), 'missions 运行时条目不得出现（顺延）');
        for (const it of ret.items) {
          assert(Array.isArray(it.files) && it.files.length > 0, `${it.id} 带落点文件`);
          assert(typeof it.check === 'string' && it.check.includes('node games/stack-tower/'), `${it.id} 带可执行 check`);
        }
      },
    },
    {
      name: '附录 A：mission schema id 必填全局去重硬约束',
      fn: async () => {
        const appA = loadSpec().spec.content.retention.appendices.missionJsonSchema;
        const idField = appA.requiredFields.find((f) => f.field === 'id');
        assert(idField, 'requiredFields 含 id');
        assert(/必填/.test(idField.constraint) && /去重/.test(idField.constraint), 'id 约束含「必填」+「去重」');
      },
    },
    {
      name: 'N0 证据档案存在且含三行对照表（85% / 3 局 / 20% 与样本量结论）',
      fn: async () => {
        const p = join(REPO_ROOT, '.myrd', 'blackboard', 'n0-data-audit-b1.md');
        assert(existsSync(p), 'n0-data-audit-b1.md 存在');
        const t = readFileSync(p, 'utf8');
        assert(t.includes('85%'), '含 85% 门槛');
        assert(t.includes('3 局'), '含 3 局门槛');
        assert(t.includes('20%'), '含 20% 门槛');
        assert(t.includes('样本量'), '含样本量口径');
      },
    },
  ],
});
