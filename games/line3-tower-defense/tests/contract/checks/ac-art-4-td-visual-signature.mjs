// ac-art-4-td-visual-signature — 视觉签名全覆盖
// spec acceptance ac-art-4：assets.md 视觉签名映射表在盘且「需视觉可观察=是」的判据/路径条目
//（a1/a4/a5 + 5 条 path id）逐条有映射键，机判=键集合全等。样本量=映射表全键核。
import { loadSpec, assert, WS_ROOT } from '../helpers.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const spec = loadSpec();
const mdPath = join(WS_ROOT, '.myrd', 'blackboard', 'line3-tower-defense', 'assets.md');
assert(existsSync(mdPath), 'assets.md 缺失（视觉签名映射表承载面）');
const md = readFileSync(mdPath, 'utf8');
// 解析「视觉签名映射」表第一列（判据/path id 键）
const secIdx = md.indexOf('视觉签名映射');
assert(secIdx >= 0, '视觉签名映射表节缺失');
const sec = md.slice(secIdx, md.indexOf('##', secIdx) === -1 ? md.length : md.indexOf('##', secIdx));
const keys = [...sec.matchAll(/^\|\s*([^|\n]+?)\s*\|/gm)].map((m) => m[1]).filter((k) => k !== '判据/path id' && !/^-+$/.test(k.trim()));
const normalized = new Set(keys.map((k) => {
  const t = k.trim();
  const m = /^(a\d+)/.exec(t);
  if (m) return m[1];
  const p = /^(path-[a-z0-9-]+)$/.exec(t);
  if (p) return p[1];
  return t;
}));
const expected = new Set(['a1', 'a4', 'a5', ...spec.world.operationPaths.map((p) => p.id)]);
const missing = [...expected].filter((k) => !normalized.has(k));
const extra = [...normalized].filter((k) => !expected.has(k));
assert(missing.length === 0, `映射表缺键: ${missing.join(',')}`);
assert(extra.length === 0, `映射表多键（集合须全等）: ${extra.join(',')}`);
console.log(`PASS ac-art-4-td-visual-signature 映射键集合全等 ${normalized.size}/${expected.size}（a1/a4/a5 + 5 path id）`);
