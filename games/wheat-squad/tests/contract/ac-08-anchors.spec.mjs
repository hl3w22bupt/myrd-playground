// ac-08-anchors — anchor-1：entities 13 + levels 2 落点在盘（悬空 = 缺陷）
import { assert, loadSpec } from './helpers.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const spec = loadSpec();
const ONE = (() => { // 一号仓根 = spec 导出件所在工作区根
  let dir = join(new URL('../..', import.meta.url).pathname);
  for (let i = 0; i < 6; i += 1) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    const c = join(dir, '.myrd', 'spec', 'wheat-squad', 'design-spec.json');
    if (existsSync(c)) return dir;
  }
  return process.cwd();
})();
assert(spec.entities.length === 13, `entities ${spec.entities.length} ≠ 13`);
assert(spec.levels.length === 2, `levels ${spec.levels.length} ≠ 2`);
let miss = 0;
// 花括号多路径展开（与统一门禁 expandBracePaths 同语义）+ `#符号` 锚取 # 前路径
function expandBracePaths(p) {
  const m = /\{([^}]+)\}/.exec(p ?? '');
  if (!m) return [p];
  const prefix = p.slice(0, m.index);
  const suffix = p.slice(m.index + m[0].length);
  return m[1].split(',').map((alt) => prefix + alt.trim() + suffix);
}
for (const e of spec.entities) {
  for (const raw of expandBracePaths(String(e.script || ''))) {
    const f = raw.split('#')[0];
    const p = join(ONE, f);
    if (!existsSync(p)) { miss += 1; console.log(`  MISS ${e.id} -> ${f}`); }
  }
}
for (const l of spec.levels) for (const el of l.elements) assert(el.id && el.expect, `levels 元素缺 id/expect: ${l.id}`);
assert(miss === 0, `${miss} 个 entity 落点悬空`);
// 落点文件非空（在盘且可读；花括号展开后逐路径核对）
for (const e of spec.entities) {
  for (const raw of expandBracePaths(String(e.script || ''))) {
    const f = raw.split('#')[0];
    assert(readFileSync(join(ONE, f), 'utf8').length > 50, `${f} 空文件（假落点）`);
  }
}
console.log(`PASS anchor-1 entities 13/13 + levels 2/2 落点在盘非空`);
