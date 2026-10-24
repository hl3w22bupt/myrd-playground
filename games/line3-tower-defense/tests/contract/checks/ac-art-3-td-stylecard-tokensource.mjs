// ac-art-3-td-stylecard-tokensource — 风格卡 token 单源
// spec acceptance ac-art-3：渲染层只读 theme.ts token（src+tools 裸 hex 扫描=0 命中，白名单声明面除外）；
// theme.ts 四要素与 .myrd/blackboard/line3-tower-defense/assets.md 风格卡 v1 逐值一致。
import { loadSpec, assert, GAME_ROOT, WS_ROOT } from '../helpers.mjs';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const spec = loadSpec();
const wl = spec.numeric.palette.whitelist;

// ① 裸 hex 只允许出现在 theme.ts（声明面）；theme.ts 内 hex ⊆ 白名单（ac-art-1 已扫全集，此处单源口径）
function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) yield* walk(f);
    else if (/\.(ts|mjs)$/.test(n)) yield f;
  }
}
// 声明面 = src/kernel/config.ts（MIRRORED 镜像 spec.numeric.palette，单源链
// spec→config→theme→render）；theme.ts 起全链零裸 hex（token 派生）。
const DECL = join('src', 'kernel', 'config.ts');
const offenders = [];
for (const dir of ['src', 'tools']) {
  for (const f of walk(join(GAME_ROOT, dir))) {
    const rel = f.slice(GAME_ROOT.length + 1);
    const text = readFileSync(f, 'utf8');
    const hexes = text.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    if (hexes.length > 0 && rel !== DECL) offenders.push(`${rel}: ${hexes.join(',')}`);
  }
}
assert(offenders.length === 0, `声明面（config.ts）外裸 hex 命中（单源破坏）:\n  ${offenders.join('\n  ')}`);
const themeText = readFileSync(join(GAME_ROOT, 'src', 'render', 'theme.ts'), 'utf8');
assert(!/#[0-9a-fA-F]{6}\b/.test(themeText), 'theme.ts 出现裸 hex（应由 MIRRORED 派生）');

// ② theme.ts PALETTE ≡ spec whitelist ≡ assets.md 风格卡 v1 调色板表
const { PALETTE } = await import(join(GAME_ROOT, 'src', 'render', 'theme.ts'));
const specEntries = Object.entries(wl).map(([k, v]) => [k, String(v).toUpperCase()]);
const tokenMap = {
  'bg-deep': PALETTE.bgDeep, 'core-coral': PALETTE.coreCoral, 'enemy-berry': PALETTE.enemyBerry,
  'field': PALETTE.field, 'grid-line': PALETTE.gridLine, 'path-sand': PALETTE.pathSand,
  'text-cream': PALETTE.textCream, 'turret-green': PALETTE.turretGreen,
};
for (const [k, v] of specEntries) {
  assert(tokenMap[k] !== undefined, `theme.ts 缺 token ${k}`);
  assert(tokenMap[k].toUpperCase() === v, `token ${k} 漂移: theme=${tokenMap[k]} spec=${v}`);
}
const assetsPath = join(WS_ROOT, '.myrd', 'blackboard', 'line3-tower-defense', 'assets.md');
assert(existsSync(assetsPath), '黑板风格卡 assets.md 缺失');
const md = readFileSync(assetsPath, 'utf8');
const tableRows = [...md.matchAll(/\|\s*([a-z-]+)\s*\|\s*`#([0-9A-Fa-f]{6})`\s*\|/g)];
assert(tableRows.length >= 8, `风格卡调色板表行 ${tableRows.length} < 8`);
for (const [, token, hex] of tableRows) {
  const specHex = (wl[token] ?? '').toUpperCase();
  if (specHex) assert(`#${hex.toUpperCase()}` === specHex, `风格卡 ${token}=${hex} 与 spec ${specHex} 漂移`);
}
console.log(`PASS ac-art-3-td-stylecard-tokensource 裸 hex 仅 config.ts 声明面（spec→config→theme 单源链）· PALETTE≡spec≡风格卡 ${tableRows.length} 行逐值一致`);
