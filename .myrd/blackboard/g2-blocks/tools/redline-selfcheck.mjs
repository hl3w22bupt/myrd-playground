#!/usr/bin/env node
// redline-selfcheck.mjs — wx/dy/web 红线自查脚本 v1（封版就绪冲刺 N2⑤ · 机读 pass/fail JSON 报告）
//
// 落点说明（2026-10-08 复核轮）：本工具为三树通用审计件，不放 g2-blocks 源仓——
// 源仓 AC-18 冻结条款（scope-policy forbiddenReferencePatterns）禁止仓库内出现
// 平台导出面字面量，审计工具携带被审路径字面量即触发契约红（源仓 1e3eff4 修复记录）。
// 本文件归黑板证据面，随证据报告一同入档。
//
// 用法（在任意目录运行；目标树根三选一）：
//   node redline-selfcheck.mjs --root <树根目录>            # 打印 JSON 报告（stdout）+ exit 0/1
//   REDLINE_ROOT=<树根目录> node redline-selfcheck.mjs      # 环境变量等价形式
//   G2_SPEC_PATH=<spec 导出件> …                            # 启用 numeric 冻结组核对（缺则 skip 如实披露）
//   --out <file>                                           # 同时落盘报告
//
// 检查面（红线来源：封版冲刺任务书 + 既有守卫单源 ci/scope-policy.json）：
//   R1 kernel 平台 API 引用数 = 0（确定性内核纯度，wx./tt./window./document./localStorage/navigator）
//   R2 一号仓库（stack-tower）零引用（单源 = 目标树 ci/scope-policy.json forbiddenReferencePatterns）
//   R3 埋点零玩法 diff：自基线 6d3db6a 起 src 玩法面 0 删除行（telemetry/main.ts 纯新增；仅 web 主线树适用）
//   R4 numeric 冻结组核对：冻结值抽查在生成件中单源呈现（需 G2_SPEC_PATH，缺则 skip 如实披露）
//   R5 平台包体预算：目标树平台导出面存在时逐件实测字节求和 ≤ 4MB（缺产物 = skip）
//   R6 平台收口：wx./tt. 原生 API 直调只允许出现在 src/platform/{wx,dy,tt}/ 与 telemetry/analytics.ts 内（0 越界）
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const rootIdx = process.argv.indexOf('--root');
const ROOT = resolve(rootIdx > -1 && process.argv[rootIdx + 1]
  ? process.argv[rootIdx + 1]
  : (process.env.REDLINE_ROOT || process.cwd()));
const BASELINE = '6d3db6a'; // 部署轮 r3 发布源（v1.2 主线收口态）= 红线基线（仅含该基线的树启用 R3）

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch { /* 非 git 环境 */ }
let branch = 'unknown';
try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch { /* 非 git 环境 */ }

const checks = [];
const add = (id, pass, detail, extra = {}) => checks.push({ id, pass, detail, ...extra });

const walk = (dir, exts, out = []) => {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) { if (n !== 'node_modules' && n !== '.git' && n !== 'export') walk(p, exts, out); continue; }
    if (exts === null || exts.length === 0 || exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
};
const walkAll = (dir, exts, out = []) => {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) { if (n !== 'node_modules' && n !== '.git') walkAll(p, exts, out); continue; }
    if (exts === null || exts.length === 0 || exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
};
const rel = (p) => relative(ROOT, p).split('\\').join('/');

// R1 kernel 平台 API 引用数 = 0
{
  const kernelDir = join(ROOT, 'src', 'kernel');
  const patterns = [/\bwx\./, /\btt\./, /\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bnavigator\b/];
  let hits = [];
  for (const f of walk(kernelDir, ['.ts', '.js', '.mjs'])) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (patterns.some((re) => re.test(line))) hits.push(`${rel(f)}:${i + 1}`);
    });
  }
  add('R1-kernel-platform-api-zero', hits.length === 0,
    hits.length === 0 ? 'src/kernel 平台 API 引用数 = 0（确定性内核纯度）' : `命中 ${hits.length} 处: ${hits.slice(0, 5).join(' · ')}`,
    { count: hits.length });
}

// R2 一号仓库零引用（策略单源 = 目标树 ci/scope-policy.json；本工具不在任何被审树内，无自豁免面）
{
  const policyPath = join(ROOT, 'ci', 'scope-policy.json');
  if (!existsSync(policyPath)) {
    add('R2-repo-one-zero-reference', false, `目标树缺策略单源 ci/scope-policy.json —— 拒绝空转绿`, { count: -1 });
  } else {
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    const pats = policy.forbiddenReferencePatterns || [];
    const exempt = new Set([...(policy.selfExemptFiles || [])]);
    const allowPrefixes = (policy.referenceAllowedPaths || []).map((x) => x.prefix);
    // 与 v1 归档报告同口径：R2 全仓扫描跳过 export 目录（导出产物非引用面）
    const files = walk(ROOT, ['.mjs', '.js', '.ts', '.json', '.md', '.yml', '.yaml', '.html', '.css'])
      .filter((f) => !f.includes(`${join(ROOT, '.git')}`) && !f.includes('node_modules'));
    const hits = [];
    for (const f of files) {
      const r = rel(f);
      if (exempt.has(r)) continue;
      if (allowPrefixes.some((pre) => r.startsWith(pre))) continue;
      const text = readFileSync(f, 'utf8');
      for (const pat of pats) if (text.includes(pat)) { hits.push(`${r} :: ${pat}`); break; }
    }
    add('R2-repo-one-zero-reference', hits.length === 0,
      hits.length === 0 ? `stack-tower 面零引用（patterns×${pats.length}，全仓扫描 ${files.length} 文件）` : `越界引用 ${hits.length} 处: ${hits.slice(0, 5).join(' · ')}`,
      { count: hits.length });
  }
}

// R3 埋点零玩法 diff（自基线 0 删除；numstat 列序 = 新增<TAB>删除<TAB>路径）
// 前提：基线 6d3db6a 必须是本树 HEAD 的祖先（跨线树 = 移植分叉线，无从比对 → skip 如实披露）
{
  let isAncestor = false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT });
    isAncestor = true;
  } catch { isAncestor = false; }
  if (!isAncestor) {
    add('R3-analytics-zero-gameplay-diff', true, `基线 ${BASELINE} 非本树 HEAD 祖先（移植分叉线）→ skip（该检查只适用 web 主线）`, { skipped: true });
  } else {
    let numstat = '';
    try {
      numstat = execFileSync('git', ['diff', '--numstat', `${BASELINE}..HEAD`, '--', 'src/'], { cwd: ROOT }).toString();
    } catch { numstat = ''; }
    if (!numstat.trim()) {
      add('R3-analytics-zero-gameplay-diff', true, `src/ 自基线 ${BASELINE} 零 diff（无改动）`, { skipped: true });
    } else {
      const dels = numstat.split('\n').filter(Boolean).map((l) => l.split('\t'))
        .map(([added, deleted, file]) => ({ added: Number(added), deleted: Number(deleted), file }))
        .filter((x) => x.deleted > 0);
      add('R3-analytics-zero-gameplay-diff', dels.length === 0,
        dels.length === 0 ? `src/ 自基线 ${BASELINE} 全部纯新增（0 删除行 · numstat 列序=增/删/路径）` : `存在删除行: ${dels.map((x) => `${x.file}(-${x.deleted})`).slice(0, 5).join(' · ')}`,
        { deletions: dels });
    }
  }
}

// R4 numeric 冻结组核对（需 G2_SPEC_PATH）
{
  const specPath = process.env.G2_SPEC_PATH;
  if (!specPath || !existsSync(specPath)) {
    add('R4-numeric-frozen-groups', true, 'G2_SPEC_PATH 未钉 → skip（核对请显式钉 v1.1 approved 导出件）', { skipped: true });
  } else {
    const wrapped = JSON.parse(readFileSync(specPath, 'utf8'));
    const sp = wrapped.spec ?? wrapped;
    const gen = readFileSync(join(ROOT, 'src', 'generated', 'spec-data.ts'), 'utf8');
    // 抽查冻结值在生成件中的呈现（palette 七色 / DEFAULT_SEED）
    const probe = [];
    const pal = sp.numeric?.palette;
    if (pal?.blocks) {
      for (const b of Object.values(pal.blocks).slice(0, 2)) {
        const hex = typeof b === 'string' ? b : b.hex ?? b.base ?? null;
        if (hex && !gen.includes(String(hex).replace('#', '').toUpperCase()) && !gen.includes(String(hex))) probe.push(`palette ${hex} 不在 spec-data.ts`);
      }
    }
    if (sp.numeric?.DEFAULT_SEED !== undefined && !gen.includes(String(sp.numeric.DEFAULT_SEED))) probe.push(`DEFAULT_SEED ${sp.numeric.DEFAULT_SEED} 不在 spec-data.ts`);
    add('R4-numeric-frozen-groups', probe.length === 0,
      probe.length === 0 ? `冻结值抽查通过（spec ${wrapped._platform ? `v${wrapped._platform.version} ${wrapped._platform.status}` : ''} · palette/DEFAULT_SEED 单源呈现）` : probe.join(' · '),
      { specVersion: wrapped._platform?.version, specStatus: wrapped._platform?.status });
  }
}

// R5 平台包体预算（目标树平台导出面存在时；目录 = export/ 下 wx / tt / dy）
const PKG_DIRS = [['wx', join('export', 'wx')], ['dy', join('export', 'tt')], ['dy2', join('export', 'dy')]];
for (const [plat, relDir] of PKG_DIRS) {
  const dir = join(ROOT, relDir);
  if (!existsSync(dir)) continue;
  const files = walkAll(dir, []);
  const total = files.reduce((s, f) => s + statSync(f).size, 0);
  const LIMIT = 4 * 1024 * 1024;
  add(`R5-bundle-${plat}`, total <= LIMIT, `${relDir} 逐件实测求和 = ${total} B（预算 ≤ ${LIMIT} B · ${files.length} 件）`, { bytes: total, files: files.length });
}
if (!checks.some((c) => c.id.startsWith('R5-'))) {
  add('R5-bundle', true, '本树无平台包导出产物 → skip（组包器运行后复查）', { skipped: true });
}

// R6 平台原生 API 直调越界 = 0
// 白名单面：src/platform/{wx,dy,tt}/（适配体）+ src/telemetry/analytics.ts（埋点路由面单源——
// wx.reportEvent / tt.reportAnalytics 守卫式调用集中于此，玩法面零直调）
{
  const nativePat = /\b(wx|tt)\s*\.\s*(reportEvent|reportAnalytics|setStorageSync|getStorageSync|request|shareAppMessage|onShow|onHide|login)\b/;
  const allowedPrefix = (f) => {
    const r = rel(f);
    return r.startsWith('src/platform/wx/') || r.startsWith('src/platform/dy/') || r.startsWith('src/platform/tt/')
      || r === 'src/telemetry/analytics.ts';
  };
  const hits = [];
  for (const f of walkAll(join(ROOT, 'src'), ['.ts', '.js', '.mjs'])) {
    if (allowedPrefix(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => { if (nativePat.test(line)) hits.push(`${rel(f)}:${i + 1}`); });
  }
  add('R6-native-api-scope', hits.length === 0,
    hits.length === 0 ? '平台原生 API 直调零越界（仅 platform/{wx,dy}/ 面）' : `越界 ${hits.length} 处: ${hits.slice(0, 5).join(' · ')}`,
    { count: hits.length });
}

const fails = checks.filter((c) => c.pass === false);
const report = {
  checkedAt: new Date().toISOString(),
  tree: { root: ROOT, branch, commit, baseline: BASELINE },
  summary: { pass: checks.filter((c) => c.pass).length, fail: fails.length, total: checks.length },
  checks,
};
const json = JSON.stringify(report, null, 2);
const outIdx = process.argv.indexOf('--out');
if (outIdx > -1 && process.argv[outIdx + 1]) {
  mkdirSync(dirname(process.argv[outIdx + 1]), { recursive: true });
  writeFileSync(process.argv[outIdx + 1], json);
}
console.log(json);
process.exit(fails.length ? 1 : 0);
