// run-all.mjs — 契约 runner（逐件对账 spec acceptance id+命令；wheat-squad 判例平移）
// 口径：
//   ① 双向对账：acceptance(mode=auto).id ≡ checks/<id>.mjs 文件集合（多/缺/错位即红）
//   ② 每条 auto check 子进程隔离实跑（exit 0=PASS；非 0=FAIL 带原文）
//   ③ manual 条目（a3 真人面）单列 PEND-未判定，不与 fail 混计、不计绿（0 红 ≠ 绿红线）
//   ④ 全部 auto PASS 才 exit 0；任何 FAIL/PEND-实现 → exit 1

import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = join(HERE, '..', '..');
const { loadSpec } = await import(join(HERE, 'helpers.mjs'));
const spec = loadSpec();

const acc = spec.acceptance ?? [];
const auto = acc.filter((a) => a.mode === 'auto');
const manual = acc.filter((a) => a.mode !== 'auto');
const files = readdirSync(join(HERE, 'checks')).filter((f) => f.endsWith('.mjs')).sort();
const autoIds = auto.map((a) => a.id).sort();

// ① 双向对账（id ≡ 文件名去后缀 ≡ check 命令末段）
const fileIds = files.map((f) => basename(f, '.mjs'));
if (JSON.stringify(autoIds) !== JSON.stringify(fileIds)) {
  console.error(`RUN-ALL: FAIL acceptance↔check 文件失配\n  仅 spec: ${autoIds.filter((x) => !fileIds.includes(x)).join(',') || '∅'}\n  仅文件: ${fileIds.filter((x) => !autoIds.includes(x)).join(',') || '∅'}`);
  process.exit(1);
}
for (const a of auto) {
  const expect = `tests/contract/checks/${a.id}.mjs`;
  if (!String(a.check).includes(a.id) || !String(a.check).endsWith(`${a.id}.mjs`)) {
    console.error(`RUN-ALL: FAIL check 命令与 id 错位: ${a.id} → ${a.check}`);
    process.exit(1);
  }
  void expect;
}

// ② 隔离实跑
const rows = [];
let pass = 0, fail = 0;
for (const a of auto) {
  const f = join(HERE, 'checks', `${a.id}.mjs`);
  const t0 = Date.now();
  try {
    const out = execFileSync(process.execPath, [f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    rows.push({ id: a.id, verdict: 'PASS', ms: Date.now() - t0, line: (out.trim().split('\n').pop() ?? '').slice(0, 220) });
    pass += 1;
  } catch (err) {
    const out = String(err.stdout ?? '') + String(err.stderr ?? '');
    rows.push({ id: a.id, verdict: 'FAIL', ms: Date.now() - t0, line: out.trim().split('\n').slice(-3).join(' | ').slice(0, 400) });
    fail += 1;
  }
}

// ③ 报表
console.log('—— 契约 runner（line3-tower-defense · spec 链 ' + (spec.meta?.version ?? '?') + '）——');
for (const r of rows) console.log(`  ${r.verdict.padEnd(4)} ${r.id} (${r.ms}ms) ${r.verdict === 'PASS' ? '· ' + r.line : '· ' + r.line}`);
for (const m of manual) console.log(`  PEND ${m.id}（manual 真人面 · 未判定·待采 · 机器不代采）`);
console.log(`—— 合计 auto ${pass} PASS / ${fail} FAIL · manual PEND ${manual.length} ——`);
if (fail > 0) {
  console.error('RUN-ALL: FAIL 存在红项（0 红 ≠ 绿；全 pending 不得报全绿）');
  process.exit(1);
}
console.log(`RUN-ALL: PASS 机判面 ${pass}/${auto.length} 全绿（manual ${manual.length} 条真人面单列未判定）`);
