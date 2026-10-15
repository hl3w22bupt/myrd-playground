#!/usr/bin/env node
// guard-repo-scope.mjs — g2-blocks 仓库范围守卫（AC-18）+ 一号仓库零接触自检（AC-17）
//
// 用法：
//   node ci/guard-repo-scope.mjs                     # 扫本仓库：禁止引用一号仓库路径/产物
//   node ci/guard-repo-scope.mjs --self-check <一号仓库根>  # 核对一号仓库 git status 只含白名单路径
// 退出码：0=绿 1=红（参数错也 1；不吞错不降级）
// 策略单源：ci/scope-policy.json（本文件不手抄正则/白名单）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const policy = JSON.parse(readFileSync(join(ROOT, 'ci', 'scope-policy.json'), 'utf8'));
const argv = process.argv.slice(2);
const selfCheckIdx = argv.indexOf('--self-check');
const repoOnePath = selfCheckIdx >= 0 ? argv[selfCheckIdx + 1] : null;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'export') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- 模式 1：本仓库不得引用一号仓库路径 ----------
if (!repoOnePath) {
  const exempt = new Set(policy.selfExemptFiles.map((f) => join(ROOT, f)));
  const allowedPrefixes = (policy.referenceAllowedPaths || []).map((r) => r.prefix);
  const isAllowed = (rel) => allowedPrefixes.some((p) => (rel === p.replace(/\/$/, '') || rel.startsWith(p)));
  const files = walk(ROOT).filter((f) => policy.scannedExtensions.includes(extname(f)) && !exempt.has(f));
  const hits = [];
  let allowedHits = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    const text = readFileSync(f, 'utf8');
    for (const pat of policy.forbiddenReferencePatterns) {
      if (text.includes(pat)) {
        if (isAllowed(rel)) allowedHits += 1;
        else hits.push(`${rel} :: ${pat}`);
      }
    }
  }
  if (hits.length) {
    console.error('SCOPE-GUARD RED 越界引用（代码/工程文件不得引用一号仓库路径；spec 真源按策略豁免）：');
    hits.forEach((h) => console.error(`  - ${h}`));
    process.exit(1);
  }
  console.log(`SCOPE-GUARD PASS 本仓库 ${files.length} 文件零越界引用（策略单源 ci/scope-policy.json；spec 真源豁免面命中 ${allowedHits} 处，属契约条款声明）`);
  process.exit(0);
}

// ---------- 模式 2：一号仓库零接触自检 ----------
const { execFileSync } = await import('node:child_process');
let status;
try {
  status = execFileSync('git', ['-C', repoOnePath, 'status', '--porcelain'], { encoding: 'utf8' });
} catch (e) {
  console.error(`SELF-CHECK RED 无法读取一号仓库状态: ${e.message}`);
  process.exit(1);
}
const lines = status.split('\n').filter(Boolean);
// 白名单条目归一化：字符串前缀或 {prefix} 对象双形态兼容（O-01：对象形态曾使 startsWith 恒 false）
const normPrefix = (p) => (typeof p === 'string' ? p : String(p && p.prefix || ''));
const allowedPrefixes = policy.repoOne.allowedNewPaths.map(normPrefix).filter(Boolean);
const exemptPrefixes = (policy.repoOne.exemptTouchPrefixes || []).map(normPrefix).filter(Boolean);
const bad = [];
for (const line of lines) {
  const code = line.slice(0, 2);
  const path = line.slice(3).trim().replace(/^"|"$/g, '');
  const allowedNew = allowedPrefixes.some((p) => path.startsWith(p));
  const allowedMod = policy.repoOne.allowedPreExistingModifiedPaths.includes(path);
  const exempt = exemptPrefixes.some((p) => path.startsWith(p));
  const forbidden = policy.repoOne.forbiddenTouchGlobs.some((g) => (path === g.replace(/\/$/, '') || path.startsWith(g)));
  if (exempt) continue; // 显式豁免面（如二线 wheat-squad 部署面）优先于 forbidden 判定——策略单源声明，非静默放行
  if (forbidden) bad.push(`[越界] ${code} ${path}`);
  else if (!allowedNew && !allowedMod) bad.push(`[白名单外] ${code} ${path}`);
}
console.log(`# 一号仓库 git status 共 ${lines.length} 行；白名单内新增区 = ${allowedPrefixes.join(' / ')}`);
lines.forEach((l) => console.log(`#   ${l}`));
if (bad.length) {
  console.error('SELF-CHECK RED 一号仓库零接触被破坏：');
  bad.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log(`SELF-CHECK PASS 一号仓库零接触（${lines.length} 行全部在白名单内，无 tracked 工程文件改动）`);
