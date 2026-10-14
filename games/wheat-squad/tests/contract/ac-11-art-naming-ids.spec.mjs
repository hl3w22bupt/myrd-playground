// ac-11-art-naming-ids — ac-art-2（AC-A2 · auto）：清单件 id ↔ spec entities ids 逐字一致 + 无清单外资产
//
// ⚠️ 知情窄面披露（2026-10-13 QA 驳回 ③ · 升级主策划裁决中）：ac-art-2 statement 字面为
// 「清单逐件 id ∈ spec entities ids；清单外未登记资产 = 违例」，而本件面1仅机判 category==='entity'
// 类条目——manifest 中 ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3 四件非 entity 类 id
// 既不在 spec.entities 亦不在 spec.assets，按 statement 字面即违例而本件绿（机判窄于 statement）。
// 处置：statement 语义变更（id ∈ entities∪assets 登记集）或 spec.assets 补登四件均属 spec 修订
// ——按红线不走程序单方面改判据，升级主策划裁决（blockers.md 本轮区段）；裁决落地前本件
// 维持既有判据（不扩不缩、不造第二真源），窄面以本披露为知情登记。
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
