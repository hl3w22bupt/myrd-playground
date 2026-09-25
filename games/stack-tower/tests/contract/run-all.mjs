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
  'lvl-01-stack-tower_e01-spawn-first-block.spec.mjs',
  'lvl-01-stack-tower_e02-swing-motion.spec.mjs',
  'lvl-01-stack-tower_e03-drop-input.spec.mjs',
  'lvl-01-stack-tower_e04-overlap-cut.spec.mjs',
  'lvl-01-stack-tower_e05-perfect-window.spec.mjs',
  'lvl-01-stack-tower_e06-tower-ripple.spec.mjs',
  'lvl-01-stack-tower_e07-score-hud.spec.mjs',
  'lvl-01-stack-tower_e08-fail-recover.spec.mjs',
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
