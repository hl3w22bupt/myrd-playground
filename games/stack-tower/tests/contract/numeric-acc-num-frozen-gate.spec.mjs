#!/usr/bin/env node
/**
 * 契约测试 acc-num — numeric 冻结机械断言（spec v1.2，数值总闸加固）。
 * 复现：node games/stack-tower/tests/contract/numeric-acc-num-frozen-gate.spec.mjs
 * 断言：
 *  ① v1 冻结七键 v1 vs v1.2 键序无关深比全等 + sha256 相等；
 *  ② build/kernel/numeric.js 与 spec.numeric 全量镜像（e07 总闸口径延续）；
 *  ③ numeric.opening 组两侧同构（3–5 块开局摆位）。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runContract, assertEq, assert, loadSpec, stableStringify, loadBuildModule, REPO_ROOT } from './_runner.mjs';

const FROZEN_KEYS = ['DEFAULT_SEED', 'FIXED_STEP_MS', 'MAX_DT_MS', 'perfect_window', 'cut_width', 'scoring', 'difficulty'];

function frozenOf(specObj) {
  const out = {};
  for (const k of FROZEN_KEYS) out[k] = specObj.numeric[k];
  return out;
}
const sha256 = (o) => createHash('sha256').update(stableStringify(o)).digest('hex');

runContract({
  id: 'acc-num',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-num-frozen-gate',
  needs: ['build/kernel/numeric.js'],
  checks: [
    {
      name: 'v1 冻结七键深比 + sha256 全等（v1 vs v1.2）',
      fn: async () => {
        const v1 = JSON.parse(readFileSync(path.join(REPO_ROOT, '.myrd', 'spec', 'stack-tower-spec-v1.json'), 'utf8'));
        const v1spec = v1.spec ?? v1;
        const v12 = loadSpec().spec;
        for (const k of FROZEN_KEYS) {
          assert(v1spec.numeric[k] !== undefined, `v1 缺冻结键 ${k}`);
          assert(v12.numeric[k] !== undefined, `v1.2 缺冻结键 ${k}`);
          assertEq(stableStringify(v1spec.numeric[k]), stableStringify(v12.numeric[k]), `冻结键 ${k} 深比`);
        }
        assertEq(sha256(frozenOf(v1spec)), sha256(frozenOf(v12)), '冻结七键 sha256（键序无关）');
      },
    },
    {
      name: 'numeric.js 与 spec.numeric 全量镜像（键序无关深比）',
      fn: async ({ 'build/kernel/numeric.js': num }) => {
        const spec = loadSpec().spec;
        assertEq(stableStringify(num.NUMERIC), stableStringify(spec.numeric), 'NUMERIC ↔ spec.numeric 镜像');
      },
    },
    {
      name: 'opening 组两侧同构（STACK_MIN=3 / STACK_MAX=5 / JITTER=6）',
      fn: async ({ 'build/kernel/numeric.js': num }) => {
        const spec = loadSpec().spec;
        assert(spec.numeric.opening, 'spec.numeric.opening 缺失');
        assertEq(stableStringify(num.NUMERIC.opening), stableStringify(spec.numeric.opening), 'opening 镜像');
        assertEq(num.NUMERIC.opening.STACK_MIN_BLOCKS, 3, 'STACK_MIN_BLOCKS');
        assertEq(num.NUMERIC.opening.STACK_MAX_BLOCKS, 5, 'STACK_MAX_BLOCKS');
      },
    },
  ],
});
