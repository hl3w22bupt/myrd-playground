// ac-07-no-texture — tex-1：仓库零位图 + 源码零 image 加载构造（沿 g2-blocks ac-13）
import { assert, loadSpec } from './helpers.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const spec = loadSpec(); void spec;
const ROOT = new URL('../..', import.meta.url).pathname;
const bad = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(png|jpg|jpeg|gif|webp|bmp|ico)$/i.test(f)) bad.push(p); } };
walk(ROOT);
assert(bad.length === 0, `仓库出现位图文件: ${bad.join(', ')}`);
const { readFileSync } = await import('node:fs');
const srcFiles = [];
const walkTs = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walkTs(p); else if (/\.(ts|mjs)$/.test(f)) srcFiles.push(p); } };
walkTs(join(ROOT, 'src'));
for (const f of srcFiles) {
  const s = readFileSync(f, 'utf8');
  assert(!/new\s+Image|drawImage|createImageBitmap/.test(s), `${f} 出现贴图加载构造`);
}
console.log(`PASS tex-1 零位图文件 + ${srcFiles.length} 源文件零贴图构造`);
