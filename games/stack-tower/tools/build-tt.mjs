/**
 * tt 提审包组包器（C · spec v1.5 content.platform dy-submission-kit 条目落点）。
 *
 * 产出 export/tt/（可提审抖音小游戏包）：
 *   1. tsc -p tsconfig.tt.json（module=commonjs，主包 CJS 树，零打包器依赖）
 *   2. tt/ 骨架（game.json / project.config.json / game.js）——抖音无开放数据域独立子包机制，
 *      好友榜数据通道收敛为 tt 云存储单通道（dy-runtime 验收口径原文①）
 *   3. 运行时资产（sfx m4a / bgm 环 / dy-share-card 分享卡 + dy-icon；商店截图属提审材料不入包）
 *   4. manifest.json —— 逐件 sha256 + 主包体积（预算断言见 scripts/check-tt-bundle-size.mjs）
 *
 * 红线：本脚本零触碰 export/wx/（C 轮 wx 包零变更，B0 在案基线 sha256 不动）。
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(GAME, 'export/tt');
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// 1) 主包 CJS 树
console.log('[1/4] tsc (module=commonjs) → export/tt/build-tt/');
execSync('node node_modules/typescript/bin/tsc -p tsconfig.tt.json', { cwd: GAME, stdio: 'inherit' });

// 2) 骨架
console.log('[2/4] 骨架落包（game.json / project.config.json / game.js）');
mkdirSync(EXPORT, { recursive: true });
for (const f of ['game.json', 'project.config.json', 'game.js']) {
  cpSync(path.join(GAME, 'tt', f), path.join(EXPORT, f));
}

// 3) 运行时资产
console.log('[3/4] 运行时资产拷贝');
const copyTree = (src, dest) => {
  if (!existsSync(src)) return 0;
  let n = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyTree(s, d);
    else {
      mkdirSync(path.dirname(d), { recursive: true });
      cpSync(s, d);
      n += 1;
    }
  }
  return n;
};
let assetCount = 0;
assetCount += copyTree(path.join(GAME, 'assets/sfx'), path.join(EXPORT, 'assets/sfx'));
assetCount += copyTree(path.join(GAME, 'assets/bgm'), path.join(EXPORT, 'assets/bgm'));
// 平台素材：仅运行时 + IDE 识别件入包（分享卡 + 图标）；商店截图属提审材料，留仓库不入包
for (const f of ['share-card.png', 'icon.png']) {
  const src = path.join(GAME, 'assets/tt', f);
  if (existsSync(src)) {
    mkdirSync(path.join(EXPORT, 'assets/tt'), { recursive: true });
    cpSync(src, path.join(EXPORT, 'assets/tt', f));
    assetCount += 1;
  } else {
    console.error(`FAIL dy 素材缺件：assets/tt/${f}（先跑 node tools/gen-tt-assets.mjs）`);
    process.exit(1);
  }
}
console.log(`      资产 ${assetCount} 件（sfx / bgm / dy-share-card / dy-icon；商店截图属提审材料不入包）`);

// 4) manifest.json（逐件 sha256 + 主包体积；抖音无开放数据域子包 → 子包分列恒 0）
console.log('[4/4] manifest.json（sha256 清单 + 主包分列体积）');
const walk = (dir, base = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    return e.isDirectory() ? walk(p, rel) : [{ path: rel, bytes: statSync(p).size, sha256: sha256(p) }];
  });
const files = walk(EXPORT)
  .filter((f) => f.path !== 'manifest.json') // 自指排除：manifest 清单不含自身（自报 hash 必漂移）
  .sort((a, b) => a.path.localeCompare(b.path));
const specExport = JSON.parse(readFileSync(path.join(GAME, '../../.myrd/spec/stack-tower-spec.json'), 'utf8'));
const budgets = specExport.spec.content.platform.budgets;
const mainBytes = files.reduce((s, f) => s + f.bytes, 0);
const subpackageBytes = files.filter((f) => /(^|\/)subpackages?\//.test(f.path)).reduce((s, f) => s + f.bytes, 0);
const manifest = {
  generatedAt: new Date().toISOString(),
  spec: { id: specExport._platform.platformSpecId, version: specExport._platform.version, numericFreeze: specExport.spec.content.platform.numericFreeze },
  platform: 'douyin-minigame（tt 运行时）',
  budgets: { mainPackageMaxBytes: budgets.mainPackageMaxBytes, openDataContextMaxBytes: budgets.openDataContextMaxBytes },
  sizes: {
    mainBytes,
    subpackageBytes,
    mainWithinBudget: mainBytes <= budgets.mainPackageMaxBytes,
  },
  files,
};
writeFileSync(path.join(EXPORT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`[out ] ${EXPORT}`);
console.log(`[size] 主包 ${(mainBytes / 1024).toFixed(1)}KB / 预算 ${(budgets.mainPackageMaxBytes / 1024 / 1024).toFixed(0)}MB —— ${manifest.sizes.mainWithinBudget ? 'PASS' : 'OVER!'}`);
console.log(`[size] 子包 ${subpackageBytes}B（分列口径：抖音无开放数据域独立子包机制，好友榜走 tt 云存储单通道）`);
console.log(`[done] ${files.length} 件落包，manifest 逐件 sha256 就绪`);
if (!manifest.sizes.mainWithinBudget) process.exit(1);
