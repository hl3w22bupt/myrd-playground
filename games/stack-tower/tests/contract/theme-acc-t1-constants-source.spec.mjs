#!/usr/bin/env node
/**
 * 契约测试 acc-t1 — theme.js 单一常量源契约（spec v1.2，e-theme-constants 锚点）。
 * 复现：node games/stack-tower/tests/contract/theme-acc-t1-constants-source.spec.mjs
 * 断言：
 *  ① render/ui 源码零散落十六进制色值字面量（theme.ts 自身与测试夹具除外）；
 *  ② render/ui 源码零 juice 时限/池上限常量的本地重定义；
 *  ③ theme.js 构建产物与 spec 登记值一致（四预算 + 池 200）。
 * 例外语义：跨行模板字符串内 ${NEON.x} 插值非字面量；注释行剔除后再扫描。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { runContract, assertEq, assert, loadBuildModule, GAME_DIR } from './_runner.mjs';

const SCAN_DIRS = ['src/render', 'src/ui'];
const THEME_FILE = path.join(GAME_DIR, 'src', 'render', 'theme.ts');

function listTs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** 剔除行注释与块注释后再扫描（避免误伤说明文字中的色值示例） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

runContract({
  id: 'acc-t1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-theme-constants',
  needs: ['build/render/theme.js'],
  checks: [
    {
      name: 'render/ui 零散落十六进制色值（theme.ts 除外）',
      fn: async () => {
        const offenders = [];
        for (const dir of SCAN_DIRS) {
          for (const file of listTs(path.join(GAME_DIR, dir))) {
            if (file === THEME_FILE) continue; // 真源自身豁免
            const code = stripComments(readFileSync(file, 'utf8'));
            if (/#[0-9a-fA-F]{3,8}\b/.test(code)) offenders.push(path.relative(GAME_DIR, file));
          }
        }
        assertEq(offenders.join(','), '', '散落色值文件（应只有 theme.ts）');
      },
    },
    {
      name: 'juice/池常量零本地重定义（必须 import 自 theme）',
      fn: async () => {
        const banned = /(const|let|var)\s+(FIRST_BLOCK_BUDGET_MS|JUICE_LATENCY_MS|AUDIO_DISPATCH_BUDGET_MS|RESTART_BUDGET_MS|RIPPLE_POOL_MAX)\b/;
        const offenders = [];
        for (const dir of SCAN_DIRS) {
          for (const file of listTs(path.join(GAME_DIR, dir))) {
            if (file === THEME_FILE) continue;
            if (banned.test(stripComments(readFileSync(file, 'utf8')))) offenders.push(path.relative(GAME_DIR, file));
          }
        }
        assertEq(offenders.join(','), '', '常量私设文件');
      },
    },
    {
      name: 'theme.js 构建产物与 spec 登记值一致（四预算 + 池 200）',
      fn: async ({ 'build/render/theme.js': theme }) => {
        assertEq(theme.JUICE.FIRST_BLOCK_BUDGET_MS, 3000, 'FIRST_BLOCK_BUDGET_MS（acc-j1）');
        assertEq(theme.JUICE.JUICE_LATENCY_MS, 100, 'JUICE_LATENCY_MS（acc-j2）');
        assertEq(theme.JUICE.AUDIO_DISPATCH_BUDGET_MS, 50, 'AUDIO_DISPATCH_BUDGET_MS（acc-j3）');
        assertEq(theme.JUICE.RESTART_BUDGET_MS, 1500, 'RESTART_BUDGET_MS（acc-j4）');
        assertEq(theme.RIPPLE_POOL_MAX, 200, 'RIPPLE_POOL_MAX（e-ripple-renderer）');
        assert(theme.BLOCK_NEON_CYCLE.length === 6, '霓虹六色循环（a09..a14）');
      },
    },
  ],
});
