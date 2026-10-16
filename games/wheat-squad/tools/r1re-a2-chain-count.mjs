#!/usr/bin/env node
// tools/r1re-a2-chain-count.mjs — R1 复测三态分流收口轮 · A2 start→end 事件链计数补采工具
//
// 口径（本轮任务书）：A2 按 ≥20 完整模拟局（start→end 事件链计数），禁混真人局。
// 语义：每局（每种子一个独立 game 实例）遥测面上必须恰好出现一条 run_start 且其后恰好一条 run_end
//      （链长=2、有序、不重不漏），run_end 载荷键 = spec meta.telemetryFields 定名（run_duration_ms/reason），
//      run_duration_ms ≡ tick×FIXED_STEP_MS（禁自算替代，直读真实发射载荷——D1 修复口径沿袭）。
// 判定面分工：ac-a2 契约判定面（checks/ac-a2-run-duration-band.mjs → ac-03 spec）零改动；
//            本件 = 补采证据落档面（duration-log.mjs 同类），输出 qa/r1re-a2-chain-log-<date>.json。
// 退出码：0 = ≥20 链全完整且带内；1 = 任一断言失败（fail-closed 不吞错）。
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const { loadSpec } = await import(join(ROOT, 'tests', 'contract', 'helpers.mjs')); // spec 装载走契约 helpers（不经 game.ts 内部 loadSpec——其 require 分支与 Node ESM 顶层 await 互斥）
const { createGame, pickUpgradeHost } = await import(new URL('../src/game.ts', import.meta.url).pathname);

const spec = loadSpec();
const n = spec.numeric;
const rd = n.runDuration;
const stepMs = n.FIXED_STEP_MS;
const utc = new Date().toISOString();
const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

const MIN_CHAINS = 20;
const rows = [];
for (let i = 0; i < Math.max(rd.sampleSeeds, MIN_CHAINS); i += 1) {
  const seed = n.DEFAULT_SEED + i;
  const g = createGame(spec, 390, 640);
  g.pointer = { x: 195, y: 320 }; // 首次核心操作（指令注入，驻点不位移——与 ac-a2 判定面 driveRun 同语义）
  let guard = 0;
  while (guard < 2_000_000) {
    guard += 1;
    g.step(stepMs);
    if (g.state.choices) pickUpgradeHost(g, 0); // 恒选第 0 项（确定性输入面，同判定面）
    if (g.telemetryEntries().some((t) => t.id === 'run_end')) break;
  }
  const ev = g.telemetryEntries();
  const starts = ev.filter((t) => t.id === 'run_start');
  const ends = ev.filter((t) => t.id === 'run_end');
  const fail = [];
  if (guard >= 2_000_000) fail.push('guard 耗尽未结算');
  if (starts.length !== 1) fail.push(`run_start 计数=${starts.length} ≠1`);
  if (ends.length !== 1) fail.push(`run_end 计数=${ends.length} ≠1`);
  const sIdx = starts.length === 1 ? ev.indexOf(starts[0]) : -1;
  const eIdx = ends.length === 1 ? ev.indexOf(ends[0]) : -1;
  if (sIdx >= 0 && eIdx >= 0 && !(sIdx < eIdx)) fail.push('链序非法（run_start 未先于 run_end）');
  const end = ends[0];
  if (end && end.run_duration_ms !== g.state.tick * stepMs) fail.push(`run_duration_ms=${end?.run_duration_ms} ≠ tick×step=${g.state.tick * stepMs}`);
  if (end && !['victory', 'timeout', 'defeat'].includes(String(end.reason))) fail.push(`reason=${end?.reason} 不在结局势`);
  rows.push({
    seed,
    chain: 'run_start→run_end',
    chainLen: sIdx >= 0 && eIdx >= 0 && sIdx < eIdx ? 2 : 0,
    durationMs: end ? end.run_duration_ms : null,
    durationSec: end ? Math.round(end.run_duration_ms / 100) / 10 : null,
    reason: end ? end.reason : null,
    ok: fail.length === 0,
    fail,
  });
}

const okRows = rows.filter((r) => r.ok);
const ds = okRows.map((r) => r.durationSec).sort((a, b) => a - b);
const p50 = ds[Math.floor(ds.length / 2)];
const p90 = ds[Math.ceil(ds.length * 0.9) - 1];
const victories = okRows.filter((r) => r.reason === 'victory').length;
const inBand = p50 >= rd.p50MinSec && p50 <= rd.p50MaxSec && p90 <= rd.p90MaxSec;

const doc = {
  generatedAtUtc: utc,
  purpose: 'R1 复测三态分流收口轮 · A2 start→end 事件链计数补采（≥20 完整模拟局，禁混真人局——retestProtocol②）',
  binding: {
    gitSha,
    specChainId: spec._platform?.id ?? null,
    specChainVersion: spec._platform?.version ?? null,
    specChainStatus: spec._platform?.status ?? null,
    specMetaVersion: spec.meta?.version,
  },
  method: `createGame × ${rows.length} 种子（DEFAULT_SEED(${n.DEFAULT_SEED})+i）· game.ts 装配面真实 step 驱动 · 遥测 run_start/run_end 链计数`,
  result: {
    chains: okRows.length,
    chainsRequired: MIN_CHAINS,
    chainsComplete: okRows.length >= MIN_CHAINS,
    p50Sec: p50,
    p90Sec: p90,
    victoryCount: victories,
    total: rows.length,
    inBand,
    band: { p50MinSec: rd.p50MinSec, p50MaxSec: rd.p50MaxSec, p90MaxSec: rd.p90MaxSec },
  },
  rows,
};
const out = join(ROOT, 'qa', `r1re-a2-chain-log-${utc.slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`A2-CHAIN-COUNT: ${okRows.length}/${rows.length} 链完整 P50=${p50}s P90=${p90}s victory=${victories}/${rows.length} 带内=${inBand} → ${out}`);
if (okRows.length < MIN_CHAINS || !inBand) {
  console.error('A2-CHAIN-COUNT: FAIL（链数不足或带外——fail-closed）');
  process.exit(1);
}
