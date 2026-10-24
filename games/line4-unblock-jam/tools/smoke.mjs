#!/usr/bin/env node
// smoke.mjs — 空壳冒烟（line4-unblock-jam · 中性脚手架 · 零玩法）
//
// 无头冒烟（零浏览器依赖）：内核确定性 + 计数控名人/pending 恒等 + telemetry 单一出口 + 构建指纹 四面全过
// → SCAFFOLD-SMOKE: PASS。运行：node tools/smoke.mjs（node ≥22，TS 内置 type stripping，零 npm 依赖）
import { createSession, start, step, seededRng } from '../src/kernel/loop.ts';
import { createSessionState, begin, pendingDrag, cancelPending, settleMove, settleExitFrame, getCounters } from '../src/kernel/session.ts';
import { createTelemetryHub, keySetParity, TELEMETRY_SPEC_KEYS } from '../src/telemetry/telemetry.ts';
import { NUMERIC } from '../src/generated/spec-data.mjs';
import { BUILD_INFO } from '../src/generated/build-info.mjs';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) process.exitCode = 1; };

// ① 内核确定性（同 seed 双跑逐字节一致）
const runOnce = () => {
  let s = start(createSession(NUMERIC.DEFAULT_SEED));
  const rng = seededRng(NUMERIC.DEFAULT_SEED);
  for (let i = 0; i < 8; i += 1) s = step(s, NUMERIC.FIXED_STEP_MS, { advance: rng.next() > 0.2 });
  return s;
};
const a = runOnce(); const b = runOnce();
check('内核确定性（同 seed 双跑逐字节）', JSON.stringify(a) === JSON.stringify(b), `tick=${a.tick} elapsedMs=${a.elapsedMs}`);

// ② 计数控名人 + pending 不计连击（恒等机制面）
let st = begin(createSessionState(NUMERIC.DEFAULT_SEED));
st = pendingDrag(st);
const pendingZero = getCounters(st).comboCount === 0; // pending 零计数
st = cancelPending(st);
st = settleMove(st);
st = settleExitFrame(st);
const c = getCounters(st);
check('计数控名人/pending 不计连击', pendingZero && c.moveCount === 1 && c.comboCount === 1,
  `pending增量=0 move=${c.moveCount} combo=${c.comboCount}（唯一所有权=src/kernel/session.ts）`);

// ③ telemetry 单一判读出口（fail-closed + 键集合全等）
const hub = createTelemetryHub();
let rejected = false;
try { hub.record('bypass_key', 1); } catch { rejected = true; }
hub.record('fps_min', 58);
check('telemetry 单一出口（非契约键拒绝 + 键集合 ≡ spec）', rejected && keySetParity(TELEMETRY_SPEC_KEYS).equal,
  `契约键 ${TELEMETRY_SPEC_KEYS.length} 个全等 · 旁路键已拒`);

// ④ 构建 sha 指纹（首笔注入在位）
check('构建 sha 指纹在位', typeof BUILD_INFO.gitSha === 'string' && BUILD_INFO.gitSha.length === 40,
  `sha=${BUILD_INFO.gitSha.slice(0, 12)} dirty=${BUILD_INFO.dirtyTree}`);

const passCount = results.filter((x) => x.ok).length;
for (const x of results) console.log(`[scaffold-smoke] ${x.name} ${x.ok ? '✓' : '✗'} ${x.detail}`);
console.log(`SCAFFOLD-SMOKE: ${process.exitCode ? 'FAIL' : 'PASS'}（${passCount}/${results.length} 面）`);
