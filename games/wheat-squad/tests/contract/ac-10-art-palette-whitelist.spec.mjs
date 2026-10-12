// ac-10-art-palette-whitelist — ac-art-1（AC-A1 · auto）：源码/素材色值 ⊆ numeric.palette 白名单
// 扫描面：src/**/*.ts（含 build 镜像外真源）+ qa/submission/*.svg + assets/manifest.json
// 白名单：spec numeric.palette 8 色（大小写不敏感精确匹配；thresholdDeltaE 容差仅适用于卡↔spec 八色本身比对，代码面必须逐字 token）
import { assert, loadSpec, ROOT } from './helpers.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const spec = loadSpec();
const whitelist = new Set(
  Object.entries(spec.numeric.palette)
    .filter(([k]) => k !== 'thresholdDeltaE')
    .map(([, v]) => String(v).toLowerCase()),
);
assert(whitelist.size >= 8, `白名单色数 ${whitelist.size} < 8（palette 缺色）`);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'build' || name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$|\.svg$|\.json$/.test(extname(p))) files.push(p);
  }
})(join(ROOT, 'src'));
for (const sub of ['qa/submission', 'assets']) {
  const dir = join(ROOT, sub);
  if (existsSync(dir)) (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  })(dir);
}
import { existsSync } from 'node:fs';
const violations = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    if (!whitelist.has(m[0].toLowerCase())) violations.push(`${f}: ${m[0]}`);
  }
}
assert(violations.length === 0, `色板白名单违例 ${violations.length} 处：\n  ${violations.slice(0, 10).join('\n  ')}`);
console.log(`PASS ac-art-1(auto) ${files.length} 文件扫描 · 色值全部 ⊆ palette 白名单(${whitelist.size} 色) · 零违例`);
