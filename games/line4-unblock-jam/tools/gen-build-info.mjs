#!/usr/bin/env node
// gen-build-info.mjs — 构建 sha 指纹注入（line4-unblock-jam · 首笔注入本轮完成）
//
// 产出 src/generated/build-info.mjs：gitSha + 脏树标记 + 注入时刻。构建面唯一指纹源，
// manifest/冒烟报告引用同一产物（判例：line3 构建面锚 gitSha+specAnchor 双写）。
// 运行：node tools/gen-build-info.mjs
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function git(args) {
  try { return execSync(`git ${args}`, { cwd: repoRoot }).toString().trim(); } catch { return null; }
}
const sha = git('rev-parse HEAD') ?? 'unknown-no-git';
const dirty = (git('status --porcelain') ?? '').length > 0;
const injectedAt = new Date().toISOString();
// 时间只进注入件（构建面），内核零 Date.now 纪律不受影响。

const out = `// 由 tools/gen-build-info.mjs 生成 —— 构建面指纹（首笔注入 2026-10-24）
export const BUILD_INFO = {
  gitSha: '${sha}',
  dirtyTree: ${dirty},
  injectedAt: '${injectedAt}',
  game: 'line4-unblock-jam',
};
`;
const outPath = resolve(here, '../src/generated/build-info.mjs');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`[gen-build-info] OK -> ${outPath}（sha=${sha.slice(0, 12)} dirty=${dirty}）`);
