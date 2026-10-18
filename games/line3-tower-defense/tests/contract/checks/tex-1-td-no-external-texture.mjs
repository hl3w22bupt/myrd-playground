// tex-1-td-no-external-texture — 零外部贴图
// spec acceptance tex-1：源文件零位图构造调用（Image/bitmap 源扫描=0 命中），
//                       可见资产全部程序化生成并入 manifest 逐件带 hash。样本量=全仓源扫描。
import { stripComments, GAME_ROOT, assert } from '../helpers.mjs';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) yield* walk(f);
    else if (/\.(ts|mjs)$/.test(n)) yield f;
  }
}
const PATTERN = /new\s+Image\s*\(|createImageBitmap\s*\(|new\s+ImageData\s*\(|OffscreenCanvas\s*\(|\.png|\.jpg|\.jpeg|\.webp|\.gif/;
let hits = 0, scanned = 0;
for (const dir of ['src', 'tools']) {
  for (const f of walk(join(GAME_ROOT, dir))) {
    const code = stripComments(readFileSync(f, 'utf8'));
    const m = code.match(new RegExp(PATTERN, 'g'));
    if (m) { throw new Error(`ASSERT: 位图构造/外部贴图引用 ${f}: ${m.join(',')}`); }
    scanned += 1;
  }
}
assert(scanned >= 10, `源扫描面过小 ${scanned} 文件`);
// 可见资产 = 程序化生成件 manifest（ac-art-2 同件）逐件带 hash
const manifestPath = join(GAME_ROOT, 'assets', 'game-art', 'manifest.json');
assert(existsSync(manifestPath), 'assets/game-art/manifest.json 缺失（可见资产未入 manifest）');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert(Array.isArray(manifest.assets), 'manifest.assets 非数组');
for (const a of manifest.assets) {
  assert(a.id && a.generator && /^[0-9a-f]{64}$/.test(a.sha256), `manifest 件缺 id/generator/sha256: ${a.id ?? '?'}`);
}
console.log(`PASS tex-1-td-no-external-texture src+tools 扫描 ${scanned} 文件零位图构造 · manifest ${manifest.assets.length} 件全带 hash`);
