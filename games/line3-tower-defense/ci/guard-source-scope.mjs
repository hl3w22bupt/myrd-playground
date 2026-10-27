#!/usr/bin/env node
// ci/guard-source-scope.mjs — line3-tower-defense 源面纪律扫描（verify.sh ④）
// 三判零容忍（fail-closed，均剥注释后扫描）：
//   ① 确定性违例：Math.random / Date.now（det-1 同口径，双保险）
//   ② 位图构造：new Image / createImageBitmap / OffscreenCanvas / 位图扩展名引用（tex-1 同口径）
//   ③ 裸 hex 出声明面：src+tools 内 hex 字面量只允许 src/kernel/config.ts（白名单声明面，ac-art-3 同口径）
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = join(HERE, '..');
const DECL = join('src', 'kernel', 'config.ts');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const violations = [];
let files = 0;

function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) yield* walk(f);
    else if (/\.(ts|mjs)$/.test(n)) yield f;
  }
}
for (const dir of ['src', 'tools']) {
  for (const f of walk(join(GAME_ROOT, dir))) {
    files += 1;
    const rel = f.slice(GAME_ROOT.length + 1);
    const code = strip(readFileSync(f, 'utf8'));
    if (/Math\.random|Date\.now/.test(code)) violations.push(`${rel}: Math.random/Date.now 命中（det-1）`);
    if (/new\s+Image\s*\(|createImageBitmap\s*\(|new\s+ImageData\s*\(|OffscreenCanvas\s*\(|\.png|\.jpg|\.jpeg|\.webp|\.gif/.test(code)) {
      violations.push(`${rel}: 位图构造/外部贴图引用（tex-1）`);
    }
    const hexes = code.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    if (hexes.length > 0 && rel !== DECL) violations.push(`${rel}: 裸 hex ${hexes.join(',')} 出声明面（ac-art-3）`);
  }
}
if (files < 10) { console.error(`SCOPE: FAIL 扫描面过小 ${files} 文件`); process.exit(1); }
if (violations.length > 0) {
  console.error(`SCOPE: FAIL ${violations.length} 处违例:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
console.log(`SCOPE: PASS src+tools ${files} 文件（确定性/零位图/裸 hex 声明面）三判零违例`);
