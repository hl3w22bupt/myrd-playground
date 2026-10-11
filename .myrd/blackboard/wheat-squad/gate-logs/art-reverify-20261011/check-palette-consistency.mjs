// 美术复证轮 ②：三方色值全等机判（style-card-v0.md ↔ theme.ts ↔ spec numeric.palette）
// 依据纪律：token-single-source-chain + hash-chain-cross-consistency（多处交叉核对一致）
// 只读检查：不写任何工程文件。EXIT 0 = 全等；EXIT 1 = 存在漂移。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = '/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmv34u4y0000tm9mxr9gy7y45';
const CARD = join(ROOT, '.myrd/blackboard/wheat-squad/style-card-v0.md');
const THEME = join(ROOT, 'games/wheat-squad/src/render/theme.ts');
const SPEC = join(ROOT, '.myrd/spec/wheat-squad/design-spec-v0-draft.json');

const fail = [];
const KEYS = ['wheatGold','wheatDeep','fieldGreen','fieldDeep','skyCream','pestBrown','accentRed','inkBrown'];

// ① 参考卡 md：解析「| token | `#XXXXXX` |」表行
const cardText = readFileSync(CARD, 'utf8');
const card = {};
for (const m of cardText.matchAll(/^\| (\w+) \| `(#[0-9A-Fa-f]{6})` \|/gm)) card[m[1]] = m[2].toUpperCase();

// ② theme.ts：解析 THEME 对象字面量
const themeText = readFileSync(THEME, 'utf8');
const theme = {};
for (const m of themeText.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) theme[m[1]] = m[2].toUpperCase();

// ③ spec numeric.palette
const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const specPalette = spec?.numeric?.palette ?? spec?.spec?.numeric?.palette ?? null;
const specNorm = {};
if (specPalette) {
  // 兼容 {token: hex} 与 {token: {hex/value}} 两种形态
  for (const [k, v] of Object.entries(specPalette)) {
    const hex = typeof v === 'string' ? v : (v?.hex ?? v?.value);
    if (typeof hex === 'string') specNorm[k] = hex.toUpperCase();
  }
}

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
console.log('RESULT: PASS — 参考卡/theme.ts/spec 三方 8 色逐值全等，无清单外 token');
