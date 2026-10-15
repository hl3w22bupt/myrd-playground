// ac-09-placement-structure — fv-pend（PEND 面的 check）：placement 结构冻结 + 待校准语义在档
// D2 打回修复（QA 对抗审查）：此前仅机判 spec 侧文本，placementOffline 公式实体（sim.ts）无测试消费，
// 「结构冻结」无机判锁定——本件补行为级机判：导入真实公式实体，逐例对拍冻结式。
import { assert, loadSpec, ROOT } from './helpers.mjs';
import { join } from 'node:path';
const spec = loadSpec();
const p = spec.numeric.placement;
assert(typeof p.structure === 'string' && p.structure.includes('base') && p.structure.includes('min(hours, cap)'), 'placement 结构式缺失/变形');
for (const k of ['basePerHour', 'capHours', 'levelCoef']) assert(typeof p[k] === 'number', `placement.${k} 缺数值`);
assert(/待校准/.test(p.note || ''), 'placement 待校准语义缺失（禁编数红线面）');
const pend = spec.acceptance.find((a) => a.id === 'fv-pend-placement-calibration');
assert(pend && pend.mode === 'PEND', 'acceptance 缺 fv-pend PEND 条');

// 行为级结构锁定（D2）：公式实体 = base × min(hours, capHours) × levelCoef（结构冻结，数值待校准不进门禁）
const { placementOffline } = await import(join(ROOT, 'src', 'kernel', 'sim.ts'));
assert(typeof placementOffline === 'function', 'placementOffline 未导出（e-placement-bank 公式实体缺失）');
const cases = [[2, 3, 5, 1.5], [10, 8, 6, 1], [1.25, 0.5, 2, 2], [7, 24, 12, 0.5]];
for (const [base, hours, cap, coef] of cases) {
  const got = placementOffline(base, hours, cap, coef);
  const want = base * Math.min(hours, cap) * coef;
  assert(got === want, `placementOffline(${base},${hours},${cap},${coef}) = ${got} ≠ 冻结式 ${want}`);
}
assert(placementOffline(5, 99, 12, 1) === 60, 'placementOffline 未按 capHours 封顶（超时钳制缺失）');
console.log('PASS fv-pend placement 结构冻结（spec 文本 + 公式实体行为级对拍）+ 待校准语义在档（校准走 revision）');
