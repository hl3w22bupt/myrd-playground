// check: acc-07-telemetry-key-parity — 埋点单一判读出口键集合全等（spec acceptance 原文断言转真）
// statement：telemetry hub 对外键集合 ≡ numeric.telemetry 三列（key/target/sampling）键集合，
// 逐键全等零旁路。
import { createTelemetryHub, keySetParity, TELEMETRY_SPEC_KEYS } from '../../../src/telemetry/telemetry.ts';
import { NUMERIC } from '../../../src/generated/spec-data.mjs';

let p = 0, f = 0;
const t = (c, m) => { if (c) { p += 1; } else { f += 1; console.log(`  FAIL ${m}`); } };

// ① hub 键集合 ≡ spec 三列键集合（严格全等）
const parity = keySetParity(TELEMETRY_SPEC_KEYS);
t(parity.equal, `hub 键集合 ≡ spec 三列（missing=${parity.missing.join(',')} extra=${parity.extra.join(',')}）`);

// ② 键集合 = 6 键（spec numeric.telemetry 三列行数）
t(TELEMETRY_SPEC_KEYS.length === 6, `键数=6（实际 ${TELEMETRY_SPEC_KEYS.length}）`);

// ③ 六键逐枚举（first60s_guide_done_rate / car_exit_latency_ms_p95 / combo_pending_violations /
//    frame_time_p95_ms / fps_min / session_complete_rate_bot）
for (const k of ['first60s_guide_done_rate', 'car_exit_latency_ms_p95', 'combo_pending_violations',
  'frame_time_p95_ms', 'fps_min', 'session_complete_rate_bot']) {
  t(TELEMETRY_SPEC_KEYS.includes(k), `契约键在位：${k}`);
}

// ④ 旁路键 fail-closed：非契约键 record 必抛错
const hub = createTelemetryHub();
let rejected = false;
try { hub.record('not_a_spec_key', 1); } catch { rejected = true; }
t(rejected, '旁路键被拒（fail-closed 抛错）');

// ⑤ 契约键正常入 hub 且缓冲可判读
hub.record('combo_pending_violations', 0);
const drained = hub.drain();
t(drained.length === 1 && drained[0].key === 'combo_pending_violations' && drained[0].value === 0, '契约键入 hub 可判读');

console.log(`[acc-07-telemetry-key-parity] PASS=${p} FAIL=${f}`);
process.exit(f > 0 ? 1 : 0);
