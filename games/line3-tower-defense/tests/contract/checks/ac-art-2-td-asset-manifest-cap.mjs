// ac-art-2-td-asset-manifest-cap — 资产清单封顶
// spec acceptance ac-art-2：首批可见资产 ≤13 件，manifest 逐件带生成器行号+hash
// 且重生成 hash 不变（确定性）。样本量=manifest 全件数核。
import { assert, GAME_ROOT } from '../helpers.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const manifestPath = join(GAME_ROOT, 'assets', 'game-art', 'manifest.json');
assert(existsSync(manifestPath), 'assets/game-art/manifest.json 缺失');
const before = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(before);
const assets = manifest.assets;
assert(Array.isArray(assets), 'manifest.assets 非数组');
assert(assets.length <= 13, `首批资产 ${assets.length} 件 > 13 封顶`);
for (const a of assets) {
  assert(a.id && a.generator, `件缺 id/generator: ${JSON.stringify(a).slice(0, 80)}`);
  assert(/:\d+/.test(a.generator), `件 ${a.id} generator 无行号锚: ${a.generator}`);
  assert(/^[0-9a-f]{64}$/.test(a.sha256), `件 ${a.id} sha256 非法`);
}
// 确定性：重生成后逐字节一致
execFileSync(process.execPath, [join(GAME_ROOT, 'tools', 'art-manifest.mjs')], { cwd: GAME_ROOT });
const after = readFileSync(manifestPath, 'utf8');
assert(before === after, '重生成后 manifest 漂移（确定性破坏）');
console.log(`PASS ac-art-2-td-asset-manifest-cap ${assets.length}/13 件逐件带 生成器行号+sha256 · 重生成逐字节一致`);
