// ac-11-art-naming-ids — ac-art-2（AC-A2 · auto）：清单件 id ↔ spec entities ids 逐字一致 + 无清单外资产
import { assert, loadSpec, ROOT } from './helpers.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const spec = loadSpec();
const entityIds = new Set(spec.entities.map((e) => e.id));
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8'));
const entries = manifest.assets ?? [];
assert(entries.length > 0, 'manifest 无资产条目');
assert(entries.length <= entityIds.size, `清单 ${entries.length} 件 > 封顶 ${entityIds.size}（资产总数封顶 = entities 数）`);

// 面1：entity 类 id 必须 ∈ spec entities ids（逐字）
for (const a of entries.filter((a) => a.category === 'entity')) {
  assert(entityIds.has(a.id), `entity 资产 id「${a.id}」不在 spec entities（命名↔id 一致性违例）`);
}

// 面2：登记件的 source 文件必须存在（锚点防虚构；`path#symbol` 锚取 # 前路径判存在）
for (const a of entries) {
  const filePart = String(a.source).split('#')[0];
  const src = join(ROOT, '..', '..', filePart);
  assert(existsSync(src), `清单件 ${a.id} source 不存在: ${filePart}`);
}

// 面3：无清单外资产——assets/ 与 qa/submission/ 下实际文件 ⊆ 清单登记集合（双方统一绝对路径比对）
const registered = new Set(entries.map((a) => join(ROOT, '..', '..', ...String(a.source).split('#')[0].split('/'))));
const actual = [];
for (const sub of ['assets', 'qa/submission']) {
  const dir = join(ROOT, sub);
  if (!existsSync(dir)) continue;
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (p.endsWith('.import') || name === 'README.md' || name === 'manifest.json') continue; // README/manifest 为文档与登记器非资产
      actual.push(p);
    }
  })(dir);
}
const unregistered = actual.filter((p) => !registered.has(p));
assert(unregistered.length === 0, `清单外未登记资产：\n  ${unregistered.join('\n  ')}`);
console.log(`PASS ac-art-2(auto) 清单 ${entries.length} 件 ≤ 封顶 ${entityIds.size} · entity 类 id 全部 ∈ entities ids · source 锚点全在盘 · 零清单外资产`);
