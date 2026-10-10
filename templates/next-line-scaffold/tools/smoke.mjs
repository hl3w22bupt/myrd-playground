#!/usr/bin/env node
// smoke.mjs — 空壳冒烟工具（新线脚手架空壳 · 预置件①）
//
// 无头冒烟（零浏览器依赖）：内核确定性 + 平台门面 + 契约模板 三面全过 → SCAFFOLD-SMOKE: PASS。
// 运行：node tools/smoke.mjs（node ≥22，TS 走内置 type stripping，零 npm 依赖）。
import { createNoopPlatform } from '../src/platform/index.ts';
import { createKernel, start, step, seededRng } from '../src/kernel/loop.ts';
import acTemplate from '../tests/contract/ac-template.spec.mjs';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) process.exitCode = 1; };

// ① 内核确定性：同 seed 双跑逐字节一致 + 零 Math.random 依赖
const runOnce = () => {
  const k = start(createKernel(20261010));
  const rng = seededRng(20261010);
  let s = k;
  for (let i = 0; i < 5; i += 1) s = step(s, { advance: true, gain: Math.floor(rng.next() * 10) });
  return s;
};
const a = runOnce(); const b = runOnce();
check('内核确定性（同 seed 双跑逐字节）', JSON.stringify(a) === JSON.stringify(b), `score=${a.score} tick=${a.tick}`);
check('phase 推进', a.phase === 'running' && a.tick === 5);

// ② 平台门面：noop 平台可注册、track 走缓冲、storage kind 显式
const p = createNoopPlatform();
p.track('probe_event', { v: 1 });
check('平台门面 noop 可用（显式 kind）', p.name === 'noop' && p.storage.kind === 'noop');

// ③ 契约模板真实执行
const r = acTemplate();
check('契约模板 PASS', r.pass === true, r.detail);

const passCount = results.filter((x) => x.ok).length;
for (const x of results) console.log(`[scaffold-smoke] ${x.name} ${x.ok ? '✓' : '✗'} ${x.detail}`);
console.log(`SCAFFOLD-SMOKE: ${process.exitCode ? 'FAIL' : 'PASS'}（${passCount}/${results.length} 面）`);
