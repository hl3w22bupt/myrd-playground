#!/usr/bin/env node
// port-gate-checklist.mjs — 移植门禁 checklist 脚本（line4-unblock-jam · 工程准备件⑤）
//
// 用途：wx/dy 移植轮的机器预检清单（人工面另走提审日核对表——G-7 判例口径，脚本不代行人工判断）。
// 运行：node tools/port-gate-checklist.mjs [--target wx|dy|web]
// 全过 exit=0；任一 FAIL exit=1（显式失败，不静默）。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(here, '..');
const repoRoot = resolve(gameRoot, '../..');
// --target 缺省=web。缺陷修复（2026-10-24 续接核实轮）：旧写法 indexOf('--target')+1 在未传参时=0，
// 把 argv[0]（node 二进制路径）当 target，门禁标签失真（PORT-GATE(/opt/.../node)）；含 '/' 一律视为无效回退 web。
const targetIdx = process.argv.indexOf('--target');
const targetRaw = targetIdx !== -1 ? process.argv[targetIdx + 1] : 'web';
const target = (targetRaw && !targetRaw.includes('/') ? targetRaw : 'web').toLowerCase();

const results = [];
const check = (id, name, ok, detail = '') => { results.push({ id, name, ok, detail }); };

// ① 契约件在位（游戏门禁路径判例：spec 导出在 .myrd/spec/<slug>/design-spec.json）
const specPath = resolve(repoRoot, `.myrd/spec/line4-unblock-jam/design-spec.json`);
check('P-01', '契约件在位', existsSync(specPath), specPath);
let specStatus = 'absent';
if (existsSync(specPath)) {
  const doc = JSON.parse(readFileSync(specPath, 'utf8'));
  specStatus = doc._platform?.status ?? 'local';
}
// 契约红线：非 approved = 契约面未生效（移植轮不得依赖契约强制模式）
check('P-02', '契约链 approved 资质', specStatus === 'approved', `链上状态=${specStatus}（draft=契约面未生效，移植轮止步预检）`);

// ② 内核纯度：kernel/ 零平台感知、零 Math.random/Date.now（匹配前剥离注释——纪律文字写在注释里不算违例）
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const kernelDir = join(gameRoot, 'src/kernel');
const kernelFiles = existsSync(kernelDir) ? readdirSync(kernelDir).filter((f) => f.endsWith('.ts')) : [];
let kernelPure = kernelFiles.length > 0;
let kernelDetail = '';
for (const f of kernelFiles) {
  const src = stripComments(readFileSync(join(kernelDir, f), 'utf8'));
  if (/Math\.random|Date\.now|from '\.\.\/platform/.test(src)) { kernelPure = false; kernelDetail += `${f} 违例;`; }
}
check('P-03', '内核纯度（零 Math.random/Date.now/零平台 import）', kernelPure, kernelDetail || `${kernelFiles.length} 文件全净`);

// ③ 零外部贴图：assets/ 内零位图（本轮规划落点，出现 .png 以外的二进制位图即 FAIL；
//    审查通过版生成的 .png 走 manifest hash 面另检——此处检「源码零位图构造」）
const srcDir = join(gameRoot, 'src');
let noBitmap = true;
const scan = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { scan(p); continue; }
    if (!/\.(ts|mjs|js)$/.test(f.name)) continue;
    if (/new Image\(|createImageBitmap|\.png['"`]/.test(readFileSync(p, 'utf8'))) noBitmap = false;
  }
};
if (existsSync(srcDir)) scan(srcDir);
check('P-04', '零外部贴图（源码零位图构造）', noBitmap);

// ⑤ telemetry 键集合全等（acc-07 口径直跑）
let parityOk = false; let parityDetail = '';
try {
  const { keySetParity } = await import('../src/telemetry/telemetry.ts');
  const { TELEMETRY_KEYS } = await import('../src/generated/spec-data.mjs');
  const r = keySetParity(TELEMETRY_KEYS);
  parityOk = r.equal; parityDetail = r.equal ? `${TELEMETRY_KEYS.length} 键全等` : `missing=${r.missing} extra=${r.extra}`;
} catch (e) { parityDetail = `import 失败：${e.message}`; }
check('P-05', 'telemetry 键集合 ≡ spec numeric.telemetry', parityOk, parityDetail);

// ⑥ 目标平台面（wx/dy 预检：平台接口差异点清单——脚本只列项不判定人工结论）
if (target !== 'web') {
  const hostImpl = ['index.ts'].map((f) => existsSync(join(gameRoot, 'src/platform', `host-${target}`, f)));
  check(`P-06-${target}`, `宿主实现面 host-${target}/（移植轮落地件）`, hostImpl.some(Boolean), '缺=预检提示，不阻塞本轮中性面');
}

// —— 汇总 ——
let failed = 0;
for (const r of results) {
  if (!r.ok && r.id !== 'P-02' && !r.id.startsWith('P-06')) failed += 1; // P-02/P-06 为门槛提示面（见下）
  console.log(`[port-gate] ${r.id} ${r.name} ${r.ok ? '✓' : '✗'} ${r.detail}`);
}
// P-02 口径：draft 态 = 本轮预期（v0 draft），输出 GATE-NOTE 而非 FAIL——移植轮真开工以 approved 为闸门
const p02 = results.find((r) => r.id === 'P-02');
if (p02 && !p02.ok) console.log(`[port-gate] GATE-NOTE: 契约链 ${p02.detail}——移植轮开工前置=spec approved（红线，非本轮缺陷）`);
const hardFail = results.filter((r) => !r.ok && r.id !== 'P-02' && !r.id.startsWith('P-06')).length;
console.log(`PORT-GATE(${target}): ${hardFail === 0 ? 'PASS' : 'FAIL'}（硬检 ${results.length - 2} 项中 FAIL=${hardFail}）`);
process.exit(hardFail === 0 ? 0 : 1);
