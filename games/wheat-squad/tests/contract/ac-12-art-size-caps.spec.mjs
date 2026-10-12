// ac-12-art-size-caps — ac-art-3（AC-A3 · auto）：逐件 ≤ artCaps + build 首包 ≤ firstPackageMaxMB
import { assert, loadSpec, ROOT } from './helpers.mjs';
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const spec = loadSpec();
const caps = spec.numeric.artCaps;
assert(caps && caps.firstPackageMaxMB, 'spec 缺 numeric.artCaps（机型档反推上限未入 spec）');

// 面1：清单登记的落盘件逐件 ≤ sizeCapKB
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8'));
let checked = 0;
for (const a of manifest.assets ?? []) {
  const p = join(ROOT, '..', '..', a.source);
  if (!existsSyncSafe(p)) continue;
  const kb = statSync(p).size / 1024;
  const cap = a.sizeCapKB ?? caps.singleAssetMaxKB;
  assert(kb <= cap, `${a.id} ${kb.toFixed(1)}KB > 上限 ${cap}KB`);
  checked += 1;
}

// 面2：build 首包 ≤ firstPackageMaxMB（首包 = build/ 全部文件总和——懒加载前必须就位的体积口径）
let buildBytes = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else buildBytes += statSync(p).size;
  }
})(join(ROOT, 'build'));
const mb = buildBytes / 1024 / 1024;
assert(mb <= caps.firstPackageMaxMB, `build 首包 ${mb.toFixed(2)}MB > ${caps.firstPackageMaxMB}MB`);
console.log(`PASS ac-art-3(auto) 落盘清单件 ${checked} 逐件达标 · build 首包 ${mb.toFixed(2)}MB ≤ ${caps.firstPackageMaxMB}MB`);
function existsSyncSafe(p) { try { return statSync(p).isFile(); } catch { return false; } }
