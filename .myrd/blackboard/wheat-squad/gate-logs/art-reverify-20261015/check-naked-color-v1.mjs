// 美术复证轮 2026-10-15 · 裸色值单源链扫描（沿 r8 ③b 两规则面口径）
// 规则面一：src 代码面除 theme.ts 外 0 裸 hex(#XXXXXX) / 0 rgba(数字…（钦定唯一入口 = theme.ts token + withAlpha helper）
// 规则面二：manifest.json 0 hex；qa/submission SVG 模板色值 ⊆ theme.ts 白名单 8 色
// 只读检查：不写任何工程文件。EXIT 0 = 零违例；EXIT 1 = 有违例。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..'); // 仓根
const THEME = join(ROOT, 'games/wheat-squad/src/render/theme.ts');

const fail = [];
// 白名单自 theme.ts 单源解析（不硬编码色值）
const themeText = readFileSync(THEME, 'utf8');
const whitelist = new Set();
for (const m of themeText.matchAll(/'(#[0-9A-Fa-f]{6})'/g)) whitelist.add(m[1].toUpperCase());
console.log(`[i] 白名单（theme.ts 单源）= ${[...whitelist].join(' ')}`);

// 规则面一：src/*.ts 除 theme.ts
const SRC = join(ROOT, 'games/wheat-squad/src');
const walk = (d) => readdirSync(d).flatMap(n => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
for (const f of walk(SRC)) {
  if (f === THEME || extname(f) !== '.ts') continue;
  const text = readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length + 1);
  for (const m of text.matchAll(/#[0-9A-Fa-f]{6}/g)) fail.push(`裸hex ${rel}: ${m[0]}`);
  for (const m of text.matchAll(/rgba\(\s*\d/g)) fail.push(`裸rgba ${rel}: ${m[0]}…`);
}
console.log(`[i] 规则面一扫描完成（src 除 theme.ts，命中 ${fail.length}）`);

// 规则面二：manifest.json 0 hex
const manText = readFileSync(join(ROOT, 'games/wheat-squad/assets/manifest.json'), 'utf8');
const hexes = [...manText.matchAll(/#[0-9A-Fa-f]{6}/g)];
if (hexes.length) fail.push(`manifest 裸hex ×${hexes.length}: ${hexes.map(h => h[0]).join(',')}`);
console.log(`[i] manifest.json 裸hex = ${hexes.length}`);

// 规则面二：SVG 模板 ⊆ 白名单
const SUB = join(ROOT, 'games/wheat-squad/qa/submission');
let svgFiles = 0, svgColors = 0;
for (const f of readdirSync(SUB).filter(n => n.endsWith('.svg'))) {
  svgFiles++;
  const text = readFileSync(join(SUB, f), 'utf8');
  for (const m of text.matchAll(/#[0-9A-Fa-f]{6}/g)) {
    svgColors++;
    if (!whitelist.has(m[0].toUpperCase())) fail.push(`清单外色 ${f}: ${m[0]}`);
  }
}
console.log(`[i] SVG 模板 ${svgFiles} 件 · 色值 ${svgColors} 处（非白名单命中已计入 fail）`);

if (fail.length) {
  console.error('[FAIL] 裸色值单源链扫描违例：');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log('RESULT: PASS — 两规则面零违例（代码面零裸 hex/rgba · manifest 零 hex · SVG ⊆ 白名单 8 色）');
