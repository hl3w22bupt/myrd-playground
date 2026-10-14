// 美术复证轮 2026-10-12 ③：三方色值全等机判（style-card-v1.md ↔ theme.ts ↔ approved design-spec.json）
// 派生自 art-reverify-20261011/check-palette-consistency.mjs —— 仅改三处指向：
//   ROOT → 当前 run 工作区；CARD → style-card-v1.md（v0 已退役归档）；SPEC → design-spec.json（v1.1 approved，替代 v0 draft）。
// 判据逻辑（表行解析 / THEME 字面量解析 / 8 token 全等 / 清单外 token 检出）逐行沿旧版不动。
// 依据纪律：token-single-source-chain + hash-chain-cross-consistency。只读检查：不写任何工程文件。EXIT 0 = 全等；EXIT 1 = 漂移。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // …/.myrd/blackboard/wheat-squad/gate-logs/art-reverify-20261012
const ROOT = join(HERE, '..', '..', '..', '..', '..'); // run 工作区仓根
const CARD = join(ROOT, '.myrd/blackboard/wheat-squad/style-card-v1.md');
const THEME = join(ROOT, 'games/wheat-squad/src/render/theme.ts');
const SPEC = join(ROOT, '.myrd/spec/wheat-squad/design-spec.json');

const fail = [];
const KEYS = ['wheatGold','wheatDeep','fieldGreen','fieldDeep','skyCream','pestBrown','accentRed','inkBrown'];

// ① 风格卡 md：解析「| token | `#XXXXXX` |」表行
const cardText = readFileSync(CARD, 'utf8');
const card = {};
for (const m of cardText.matchAll(/^\| (\w+) \| `(#[0-9A-Fa-f]{6})` \|/gm)) card[m[1]] = m[2].toUpperCase();

// ② theme.ts：解析 THEME 对象字面量
const themeText = readFileSync(THEME, 'utf8');
const theme = {};
for (const m of themeText.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) theme[m[1]] = m[2].toUpperCase();

// ③ approved spec numeric.palette
const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const specPalette = spec?.numeric?.palette ?? spec?.spec?.numeric?.palette ?? null;
const specNorm = {};
if (specPalette) {
  for (const [k, v] of Object.entries(specPalette)) {
    const hex = typeof v === 'string' ? v : (v?.hex ?? v?.value);
    if (typeof hex === 'string') specNorm[k] = hex.toUpperCase();
  }
}

console.log(`[i] 卡=${CARD}`);
console.log(`[i] 卡 token 数=${Object.keys(card).length} · theme token 数=${Object.keys(theme).length} · spec palette token 数=${Object.keys(specNorm).length}`);

for (const k of KEYS) {
  const c = card[k], t = theme[k], s = specNorm[k];
  if (!c) { fail.push(`卡缺 token ${k}`); continue; }
  if (!t) { fail.push(`theme.ts 缺 token ${k}`); continue; }
  if (!s) { fail.push(`spec numeric.palette 缺 token ${k}`); continue; }
  if (c !== t || c !== s) fail.push(`漂移 ${k}: 卡=${c} theme=${t} spec=${s}`);
  else console.log(`[PASS] ${k} = ${c}（三方全等）`);
}

// ④ 附加：theme.ts 内不得出现 8 token 之外的裸 hex（token-single-source-chain）
const extra = Object.keys(theme).filter(k => !KEYS.includes(k));
if (extra.length) fail.push(`theme.ts 出现清单外 token: ${extra.join(',')}`);

if (fail.length) {
  console.error('[FAIL] 色值一致性机判未过：');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log('RESULT: PASS — 风格卡 v1/theme.ts/approved spec 三方 8 色逐值全等，无清单外 token');
