// ac-09-placement-structure — fv-pend（PEND 面的 check）：placement 结构冻结 + 待校准语义在档
import { assert, loadSpec } from './helpers.mjs';
const spec = loadSpec();
const p = spec.numeric.placement;
assert(typeof p.structure === 'string' && p.structure.includes('base') && p.structure.includes('min(hours, cap)'), 'placement 结构式缺失/变形');
for (const k of ['basePerHour', 'capHours', 'levelCoef']) assert(typeof p[k] === 'number', `placement.${k} 缺数值`);
assert(/待校准/.test(p.note || ''), 'placement 待校准语义缺失（禁编数红线面）');
const pend = spec.acceptance.find((a) => a.id === 'fv-pend-placement-calibration');
assert(pend && pend.mode === 'PEND', 'acceptance 缺 fv-pend PEND 条');
console.log('PASS fv-pend placement 结构冻结 + 待校准语义在档（校准走 revision）');
