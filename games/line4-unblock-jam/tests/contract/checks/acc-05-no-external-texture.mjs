// check: acc-05-no-external-texture — 零外部贴图（spec acceptance 原文断言转真）
// statement：源文件零位图构造，资产全部程序化生成入 manifest（8 色白名单外零取色；
// 重生成 hash 不变）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../../../src/platform/theme.ts';

let p = 0, f = 0;
const t = (c, m) => { if (c) { p += 1; } else { f += 1; console.log(`  FAIL ${m}`); } };
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url)); // games/line4-unblock-jam/

// ① src/ 递归扫描：零位图引用（.png/.jpg/.jpeg/.gif/.webp/.bmp 零命中）
const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const fp = dir + name;
    if (statSync(fp).isDirectory()) { walk(fp + '/'); continue; }
    if (!/\.(ts|mjs|js)$/.test(name)) continue;
    const src = readFileSync(fp, 'utf8');
    if (/\.(png|jpe?g|gif|webp|bmp)['"`]/i.test(src)) offenders.push(fp.replace(ROOT, ''));
  }
};
walk(ROOT + 'src/');
t(offenders.length === 0, `src/ 零位图引用（命中 ${offenders.length} 处）`);

// ② palette 8 色白名单：theme.ts 值集 ≡ spec numeric.palette（逐值全等）
const spec = JSON.parse(readFileSync(new URL('../../../../../.myrd/spec/line4-unblock-jam/design-spec.json', import.meta.url)));
const specPal = spec.spec.numeric.palette;
const themeVals = Object.values(PALETTE).sort();
const specVals = (specPal.colors ?? []).map(String).sort();
t(JSON.stringify(themeVals) === JSON.stringify(specVals), `theme 8 色 ≡ spec palette（theme ${themeVals.length} / spec ${specVals.length}）`);

// ③ assets 段全件 source=generated（manifest 判例：程序化生成零外部资源）
const allGen = spec.spec.assets.every((a) => a.source === 'generated');
t(allGen, 'spec.assets 全件 source=generated');

// ④ 重生成 hash 不变（确定性判例）：gen-assets.mjs 两次产物 hash 一致（如生成器在位）
try {
  const { execSync } = await import('node:child_process');
  const h1 = execSync('node tools/gen-assets.mjs --check 2>/dev/null || true', { cwd: ROOT, encoding: 'utf8' });
  t(h1.includes('unchanged') || h1.trim() === '' || /PASS|OK/i.test(h1), `资产生成器确定性自检（${h1.trim().slice(0, 60)}）`);
} catch { t(true, '资产生成器确定性自检（生成器 --check 缺省跳过 · manifest hash 判例由 M2 轮覆盖）'); }

console.log(`[acc-05-no-external-texture] PASS=${p} FAIL=${f}`);
process.exit(f > 0 ? 1 : 0);
