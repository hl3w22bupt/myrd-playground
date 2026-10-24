#!/usr/bin/env node
// tools/r1re-a2-chain-count.mjs — A2 start→end 事件链计数补采工具（F1 驳回修正版）
//
// 口径（spec ac-a2 statement 样本意图）：runDuration.sampleSeeds(20) 种子局 —— 20 局必须来自
// 20 个真实生效的种子，禁同种子复制充数。
// F1 修正（2026-10-16 QA 驳回）：旧版计算 seed 只进标签未传装配（createGame 硬绑 DEFAULT_SEED、
//   sim.ts void seed——真实种子面=cfg.rng），20 行实为同一种子逐字节复制。修正 = 装配后、首个
//   tick 消费前覆写 cfg.rng = seededRng(seed)（与契约 helpers.driveRun 的 opts.seed 装配同语义：
//   cfg.rng 单一确定性面，sim 内全部随机消费点 st.cfg.rng.next()）；createSim 第二参按签名对称
//   传真 seed（void 内弃置，语义对称）。并加种子敏感机判（fail-closed：kills 唯一值 <2 ⇒ 注入
//   未生效或仿真种子不敏感，显式失败不静默）。
// 语义：每局遥测面恰好一条 run_start 且其后恰好一条 run_end（链长=2、有序、不重不漏），
//      run_duration_ms ≡ tick×FIXED_STEP_MS（直读真实发射载荷——D1 修复口径沿袭）。
// 判定面分工：ac-a2 契约判定面（checks/ac-a2-run-duration-band.mjs → ac-03 判例经 helpers.driveRun
//            真实变 seed）零改动；本件 = 补采证据落档面。
// F2 修正：绑定面改 loadSpecRow()（wrapped 全件含 _platform——loadSpec() 只回 .spec 内容面，
//   旧版 specChainId/Version/Status 恒 null）。
// 退出码：0 = ≥20 链全完整且带内且种子敏感机判过；1 = 任一断言失败（fail-closed 不吞错）。
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const { loadSpec, loadSpecRow } = await import(join(ROOT, 'tests', 'contract', 'helpers.mjs'));
const { createGame, pickUpgradeHost } = await import(new URL('../src/game.ts', import.meta.url).pathname);
const { seededRng } = await import(new URL('../src/kernel/loop.ts', import.meta.url).pathname);

const spec = loadSpec(); // 内容面（.spec 六段）
const specRow = loadSpecRow(); // wrapped 全件（_platform 链锚——F2）
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
  // F1 修正：种子真实注入——装配后、首个 tick 前（此时仿真零 rng 消费），整局生效
  g.state.cfg.rng = seededRng(seed);
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
    kills: g.state.kills, // 种子敏感披露面（敌序列由 cfg.rng 驱动）
    waveIndex: g.state.waveIndex,
    ok: fail.length === 0,
    fail,
  });
}

// F1 修正机判：种子必须真实生效（fail-closed）——20 独立种子下 kills 唯一值 <2 ⇒ 注入未生效
const uniqueKills = new Set(rows.map((r) => r.kills)).size;
const uniqueDur = new Set(rows.map((r) => r.durationMs)).size;
const seedSensitive = uniqueKills >= 2;
const seedFail = [];
if (!seedSensitive) seedFail.push(`kills 唯一值=${uniqueKills} <2 ⇒ 种子注入未生效或仿真种子不敏感（fail-closed）`);
if (new Set(rows.map((r) => r.seed)).size !== rows.length) seedFail.push('种子标签重复（循环装配异常）');

const okRows = rows.filter((r) => r.ok);
const ds = okRows.map((r) => r.durationSec).sort((a, b) => a - b);
const p50 = ds[Math.floor(ds.length / 2)];
const p90 = ds[Math.ceil(ds.length * 0.9) - 1];
const victories = okRows.filter((r) => r.reason === 'victory').length;
const inBand = p50 >= rd.p50MinSec && p50 <= rd.p50MaxSec && p90 <= rd.p90MaxSec;

const doc = {
  generatedAtUtc: utc,
  purpose: 'A2 start→end 事件链计数补采（≥20 完整模拟局，禁混真人局——retestProtocol②）· F1 修正版：20 真实种子局',
  binding: {
    gitSha,
    specChainId: specRow._platform?.id ?? null,
    specChainVersion: specRow._platform?.version ?? null,
    specChainStatus: specRow._platform?.status ?? null,
    specMetaVersion: spec.meta?.version,
    seedAssembly: 'createGame 装配后、首个 tick 消费前覆写 cfg.rng=seededRng(seed)（cfg.rng 单一确定性面，≡契约 helpers.driveRun opts.seed 装配语义）',
  },
  method: `createGame × ${rows.length} 真实种子（DEFAULT_SEED(${n.DEFAULT_SEED})+i，i∈[0,${rows.length})）· 装配后注入 cfg.rng · game.ts 装配面真实 step 驱动 · 遥测 run_start/run_end 链计数 + 种子敏感机判`,
  result: {
    chains: okRows.length,
    chainsRequired: MIN_CHAINS,
    chainsComplete: okRows.length >= MIN_CHAINS,
    seedSensitive,
    uniqueKills,
    uniqueDurationMs: uniqueDur,
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
console.log(`A2-CHAIN-COUNT: ${okRows.length}/${rows.length} 链完整 P50=${p50}s P90=${p90}s victory=${victories}/${rows.length} 带内=${inBand} 种子敏感=${seedSensitive}(kills 唯一值=${uniqueKills}, durationMs 唯一值=${uniqueDur}) → ${out}`);
if (okRows.length < MIN_CHAINS || !inBand || !seedSensitive || seedFail.length > 0) {
  for (const m of seedFail) console.error('A2-CHAIN-COUNT: ' + m);
  console.error('A2-CHAIN-COUNT: FAIL（链数不足/带外/种子注入未生效——fail-closed）');
  process.exit(1);
}
