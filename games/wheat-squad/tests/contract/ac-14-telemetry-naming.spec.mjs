// ac-14-telemetry-naming — D1 打回修复：埋点定名三方同名机判（spec 单源 → 接线 → 断言）
// 背景（QA 对抗审查 D1）：run_duration_ms 曾以载荷键 durationMs 接线、冒烟读 re.durationMs 自算值，
// 且无任何契约件机判键名≡接线键名（run_duration_ms 仅以注释出现即逃逸 53/0+13/0 双绿）。
// 本件三条机判全部「剥注释后」匹配——注释出现不算命中（防注释掩护，machine-judge 纪律）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, loadSpec, ROOT } from './helpers.mjs';

const spec = loadSpec();
const doc = spec.spec ?? spec;
const fields = Object.keys(doc.meta.telemetryFields ?? {});
assert(fields.length >= 5, `telemetryFields 应 ≥5 键，实得 ${fields.length}`);

// 剥注释（行注释 // 与块注释 /* */）；字符串字面量内 // 不做特殊处理——本仓源码无 URL 字面量键
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

// ① 接线面：src/game.ts 剥注释后，每个 telemetryField 键逐字出现（对象键 `k:` 或字面量 'k'）
const gameSrc = stripComments(readFileSync(join(ROOT, 'src', 'game.ts'), 'utf8'));
for (const f of fields) {
  const hit = new RegExp(`(['"]${f}['"])|([^\\w]${f}\\s*:)`).test(gameSrc);
  assert(hit, `接线面缺定名键「${f}」（剥注释后未命中：既无对象键也无字符串字面量）`);
}

// ② 断言面：tools/smoke.mjs 剥注释后，run_duration_ms 逐字出现（键名/字面量/属性访问三形态任一），且旧键绝迹
const smokeSrc = stripComments(readFileSync(join(ROOT, 'tools', 'smoke.mjs'), 'utf8'));
const keyRef = (f) => new RegExp(`(['"]${f}['"])|([^\\w]${f}\\s*:)|(\\.${f}\\b)`);
assert(keyRef('run_duration_ms').test(smokeSrc),
  '断言面（smoke.mjs）剥注释后缺 run_duration_ms 逐字键名');
assert(!/\bre\.durationMs\b/.test(smokeSrc) && !/durationMs\s*:/.test(smokeSrc),
  '断言面仍读旧键 durationMs（三方同名破裂）');

// ③ 结局枚举同源：从 spec 文本机器提取 reason 域，实现面枚举必须 ⊆ 且关键值命中
//    spec :258 run_duration_ms 描述「（victory/timeout/defeat）」= 结局域单源
const reasonDesc = String(doc.meta.telemetryFields['run_duration_ms'] ?? '');
const m = reasonDesc.match(/[（(]([^）)]+)[）)]/);
assert(m, 'spec run_duration_ms 描述缺结局域括注');
const specReasons = m[1].split('/').map((s) => s.trim()).filter(Boolean).sort();
assert(specReasons.join(',') === 'defeat,timeout,victory',
  `spec 结局势应为 {victory, timeout, defeat}，实得 {${specReasons.join(', ')}}`);
const simSrc = stripComments(readFileSync(join(ROOT, 'src', 'kernel', 'sim.ts'), 'utf8'));
const settleSrc = stripComments(readFileSync(join(ROOT, 'src', 'settlement.ts'), 'utf8'));
const implReasons = new Set();
for (const src of [simSrc, settleSrc]) {
  for (const mm of src.matchAll(/endedReason(?:\s*=?\s*)['"]([a-z]+)['"]/g)) implReasons.add(mm[1]);
  for (const mm of src.matchAll(/reason\??:\s*[^;]*?'([a-z]+)'/g)) implReasons.add(mm[1]);
}
assert(implReasons.size > 0, '实现面未解析到任何 endedReason/reason 字面量');
for (const r of implReasons) {
  assert(specReasons.includes(r), `实现面结局值「${r}」不在 spec 结局势 {${specReasons.join(', ')}} 内（命名漂移）`);
}
assert(specReasons.every((r) => implReasons.has(r)), `spec 结局势 {${specReasons.join(', ')}} 未被实现面完整覆盖（实得 {${[...implReasons].join(', ')}}）`);

// ④ placementOffline 结构机判（D2）：行为级公式锁定（非源码 grep）——offline = base × min(hours, cap) × levelCoef
const { placementOffline } = await import(join(ROOT, 'src', 'kernel', 'sim.ts'));
assert(typeof placementOffline === 'function', 'placementOffline 未导出（e-placement-bank 公式实体缺失）');
const cases = [[2, 3, 5, 1.5], [10, 8, 6, 1], [1.25, 0.5, 2, 2], [7, 24, 12, 0.5]];
for (const [base, hours, cap, coef] of cases) {
  const got = placementOffline(base, hours, cap, coef);
  const want = base * Math.min(hours, cap) * coef;
  assert(got === want, `placementOffline(${base},${hours},${cap},${coef}) = ${got} ≠ 冻结式 ${want}（base×min(hours,cap)×levelCoef）`);
}
assert(placementOffline(5, 99, 12, 1) === 60, 'placementOffline 未按 capHours 封顶（超时钳制缺失）');

console.log(`PASS ac-14 埋点定名三方同名（接线+断言面 ${fields.length} 键逐字 · 结局势 {${specReasons.join(',')}} 同源 · placementOffline 冻结式行为锁定）`);
