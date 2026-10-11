// helpers.mjs — 契约共享件：spec 装载（spec 单源）+ 断言 + 仿真驱动
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');

export function loadSpecRow() {
  if (process.env.G2WS_SPEC_PATH) return JSON.parse(readFileSync(process.env.G2WS_SPEC_PATH, 'utf8'));
  let dir = ROOT;
  for (let i = 0; i < 6; i += 1) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    const cands = [];
    for (const n of readdirSafe(dir)) {
      const c = join(dir, n, '.myrd', 'spec', 'wheat-squad', 'design-spec.json');
      try { cands.push({ c, at: JSON.parse(readFileSync(c, 'utf8'))?._platform?.updatedAt ?? '' }); } catch { /* skip */ }
    }
    cands.sort((a, b) => b.at.localeCompare(a.at));
    if (cands.length > 0) return JSON.parse(readFileSync(cands[0].c, 'utf8'));
  }
  throw new Error('wheat-squad spec 导出件未找到（设 G2WS_SPEC_PATH）');
}

/** 内容面（spec 六段本体；契约断言消费）——wrapped 导出件的 .spec 面 */
export function loadSpec() {
  return loadSpecRow().spec;
}
function readdirSafe(d) { try { return readdirSync(d).filter((x) => x.startsWith('run-')); } catch { return []; } }

export function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** 固定输入驱动一局到结算（确定性：dt 恒定 + 指针目标点恒定） */
export async function driveRun(spec, opts = {}) {
  const { createSim, stepSim, offerUpgrades, pickUpgrade } = await import(join(ROOT, 'src', 'kernel', 'sim.ts'));
  const { seededRng } = await import(join(ROOT, 'src', 'kernel', 'loop.ts'));
  const n = spec.numeric;
  const cfg = {
    rng: seededRng(opts.seed ?? n.DEFAULT_SEED),
    field: { w: 390, h: 640 },
    stepMs: n.FIXED_STEP_MS,
    captain: n.captain, squad: n.squad, enemy: n.enemy, wave: n.wave,
    upgrade: n.upgrade, firstKillBudgetSec: n.firstKillBudgetSec,
    feedback: n.feedback, perf: n.perf, runDuration: n.runDuration,
  };
  const st = createSim(cfg, opts.seed ?? n.DEFAULT_SEED);
  const dt = opts.dtMs ?? n.FIXED_STEP_MS;
  let guard = 0;
  while (st.phase === 'running' && guard < 5_000_000) {
    guard += 1;
    stepSim(st, dt);
    if (st.choices) pickUpgrade(st, 0); // 恒选第 0 项（确定性输入面）
  }
  return st;
}
