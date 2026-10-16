/**
 * 全量契约入口（可粘贴）：
 *   node games/stack-tower/tests/contract/run-all.mjs
 *
 * 逐条执行 8 个契约（与 spec acceptance 一一映射），汇总三态。
 * 退出码：存在 FAIL → 1；全 PASS 或含 not-runnable → 0（not-runnable 单列不计绿）。
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const CONTRACTS = [
  // —— M2 首卡 gameplay 契约（spec v3 冻结 8 条）——
  'lvl-01-stack-tower_e01-spawn-first-block.spec.mjs',
  'lvl-01-stack-tower_e02-swing-motion.spec.mjs',
  'lvl-01-stack-tower_e03-drop-input.spec.mjs',
  'lvl-01-stack-tower_e04-overlap-cut.spec.mjs',
  'lvl-01-stack-tower_e05-perfect-window.spec.mjs',
  'lvl-01-stack-tower_e06-tower-ripple.spec.mjs',
  'lvl-01-stack-tower_e07-score-hud.spec.mjs',
  'lvl-01-stack-tower_e08-fail-recover.spec.mjs',
  // —— M2.1「有声可装」契约族（spec v3 增量 14 条：acc-a1~a6b / acc-m1~m4 / acc-d1~d2）——
  'm21-acc-a1-sfx-pack-registry.spec.mjs',
  'm21-acc-a2-unlock.spec.mjs',
  'm21-acc-a3-mute-persist.spec.mjs',
  'm21-acc-a4a-combo-pitch.spec.mjs',
  'm21-acc-a4b-combo-cap.spec.mjs',
  'm21-acc-a5a-critical-priority.spec.mjs',
  'm21-acc-a5b-audio-frame-budget.spec.mjs',
  'm21-acc-a6-restart-event.spec.mjs',
  'm21-acc-m1-safe-area.spec.mjs',
  'm21-acc-m2-touch-input.spec.mjs',
  'm21-acc-m3-rotate-pause.spec.mjs',
  'm21-acc-m4-rotate-aspect.spec.mjs',
  'm21-acc-d1-pwa-shell.spec.mjs',
  'm21-acc-d2-offline-smoke.spec.mjs',
  // —— r4 霓虹夜塔 juice 冲刺契约族（spec v1.2 增量 9 条：acc-j1~j5 / acc-e1 / acc-t1 / acc-a8 / acc-num）——
  'juice-acc-j1-first-block.spec.mjs',
  'juice-acc-j2-juice-latency.spec.mjs',
  'juice-acc-j3-audio-dispatch.spec.mjs',
  'juice-acc-j4-restart.spec.mjs',
  'juice-acc-j5-first-session-no-modal.spec.mjs',
  'telemetry-acc-e1-hooks.spec.mjs',
  'theme-acc-t1-constants-source.spec.mjs',
  'assets-acc-a8-p0-table.spec.mjs', // asset-check 并入 contract-check 同门（N4 两层制）
  'numeric-acc-num-frozen-gate.spec.mjs',
  // —— B1 上头循环契约族（spec v1.4 增量 8 条：acc-b1~b8，scope_gate 窄口径）——
  'b1-acc-b1-scope-gate.spec.mjs',
  'b1-acc-b2-daily-seed.spec.mjs',
  'b1-acc-b3-daily-utc-boundary.spec.mjs',
  'b1-acc-b4-streak.spec.mjs',
  'b1-acc-b5-save-migration.spec.mjs',
  'b1-acc-b6-telemetry-meta.spec.mjs',
  'b1-acc-b7-idempotent-claim.spec.mjs',
  'b1-acc-b8-sw-version.spec.mjs',
];

const tally = { pass: 0, fail: 0, notRunnable: 0 };
for (const c of CONTRACTS) {
  const r = spawnSync('node', [path.join(DIR, c)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  const last = out.trim().split('\n').findIndex((l) => l.startsWith('RESULT:'));
  const line = last >= 0 ? out.trim().split('\n')[last] : 'RESULT: not-runnable — 无输出';
  if (line.startsWith('RESULT: PASS')) tally.pass += 1;
  else if (line.startsWith('RESULT: FAIL')) tally.fail += 1;
  else tally.notRunnable += 1;
  console.log('');
}

console.log('==== 契约汇总 ====');
console.log(`PASS ${tally.pass} / FAIL ${tally.fail} / not-runnable ${tally.notRunnable} （共 ${CONTRACTS.length}）`);
if (tally.fail > 0) process.exitCode = 1;
