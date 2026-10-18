// helpers.mjs — 契约共享件：spec 装载（单源）+ 镜像断言 + 驱动器 + headless 绘桩
// 口径：approved spec 导出件 = 唯一输入（env G2L3_SPEC_PATH 可指认；默认沿本仓相对路径，
// 兄弟 run 场景走 run-* 扫描 updatedAt 最新——wheat-squad loadSpecRow 判例同构）。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GAME_ROOT = join(HERE, '..', '..');
export const WS_ROOT = join(GAME_ROOT, '..', '..');

export function loadSpecRow() {
  if (process.env.G2L3_SPEC_PATH) return JSON.parse(readFileSync(process.env.G2L3_SPEC_PATH, 'utf8'));
  const local = join(WS_ROOT, '.myrd', 'spec', 'line3-tower-defense', 'design-spec.json');
  if (existsSync(local)) return JSON.parse(readFileSync(local, 'utf8'));
  let dir = GAME_ROOT;
  for (let i = 0; i < 6; i += 1) {
    dir = dirname(dir);
    if (dir === dirname(dir)) break;
    const cands = [];
    for (const n of readdirSafe(dir)) {
      const c = join(dir, n, '.myrd', 'spec', 'line3-tower-defense', 'design-spec.json');
      try { cands.push({ c, at: JSON.parse(readFileSync(c, 'utf8'))?._platform?.updatedAt ?? '' }); } catch { /* skip */ }
    }
    cands.sort((a, b) => b.at.localeCompare(a.at));
    if (cands.length > 0) return JSON.parse(readFileSync(cands[0].c, 'utf8'));
  }
  throw new Error('line3 spec 导出件未找到（设 G2L3_SPEC_PATH）');
}
function readdirSafe(d) { try { return readdirSync(d).filter((x) => x.startsWith('run-')); } catch { return []; } }

export function loadSpec() { return loadSpecRow().spec; }
export function assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }

// —— 配置单源（镜像断言先打：MIRRORED ≡ spec 投影）——
const kernelDir = join(GAME_ROOT, 'src', 'kernel');
const { configFromSpec, assertConfigMirror } = await import(join(kernelDir, 'config.ts'));
const { createRun } = await import(join(kernelDir, 'state.ts'));
const { stepSim, placeTurret, upgradeTurret } = await import(join(kernelDir, 'sim.ts'));
const grid = await import(join(GAME_ROOT, 'src', 'world', 'grid.ts'));
const { Game } = await import(join(GAME_ROOT, 'src', 'game.ts'));

let cfgCache = null;
export function loadCfg() {
  if (cfgCache) return cfgCache;
  const cfg = configFromSpec(loadSpecRow());
  assertConfigMirror(cfg); // 数值面漂移即全组红（spec-first-numeric-change 铁律）
  cfgCache = cfg;
  return cfg;
}

// —— harness 自动布防策略（确定性；代表「可玩基线」非产品逻辑）——
// 末段走廊优先 8 塔 → 全员 L2 → 逐塔 L3；20 种子采样 P50=282s/P90=335s（2026-10-18 校准，见 levels.md 映射表）
export const AUTO_POLICY_SPOTS = [
  [15, 6], [13, 4], [16, 7], [11, 7], [13, 8], [8, 8], [10, 4], [8, 3], [5, 4], [3, 7], [6, 7], [12, 3],
];
export function autoPolicy(state, cfg) {
  if (state.turrets.length < 8 && state.gold >= cfg.turret.costPlace) {
    const [c, r] = AUTO_POLICY_SPOTS[state.turrets.length];
    return placeTurret(state, cfg, c, r).ok;
  }
  if (state.turrets.length === cfg.turret.levels + 5) {
    const l1 = state.turrets.filter((t) => t.level === 1).sort((a, b) => a.id - b.id)[0];
    if (l1 && state.gold >= Math.round(cfg.turret.costUpgradeBase)) return upgradeTurret(state, cfg, l1.id).ok;
    const l2 = state.turrets.filter((t) => t.level === 2).sort((a, b) => a.id - b.id)[0];
    if (l2 && state.gold >= Math.round(cfg.turret.costUpgradeBase * cfg.turret.costUpgradeGrowth)) return upgradeTurret(state, cfg, l2.id).ok;
  }
  return false;
}

/** 内核直驱一局到结算（det/perf/采样面） */
export function driveKernelRun(cfg, seed, opts = {}) {
  const st = createRun(cfg, seed, opts.recordHashes ?? false);
  const peak = { n: 0, tick: 0 };
  const stepMs = [];
  let guard = 0;
  while (st.status === 'running' && guard < 60000) {
    autoPolicy(st, cfg);
    const t0 = performance.now();
    stepSim(st, cfg);
    stepMs.push(performance.now() - t0);
    const n = st.enemies.filter((e) => e.alive).length + st.turrets.length + st.projectiles.length;
    if (n > peak.n) { peak.n = n; peak.tick = st.tick; }
    guard += 1;
  }
  return { state: st, peak, stepMs, guard };
}

/** Game 全链路驱一局（遥测面：run_start→run_end 事件链） */
export function driveGameRun(cfg, seed, opts = {}) {
  const game = new Game({ cfg, seed, sink: opts.sink, recordHashes: false });
  if (opts.titleMs !== 0) game.advanceTitle(opts.titleMs ?? 400);
  if (game.phase === 'title') game.pointerDown(320, 252); // 开始布防（中央按钮）
  let guard = 0;
  while (game.phase === 'running' && guard < 60000) {
    autoPolicy(game.sim, cfg);
    game.tick(1);
    guard += 1;
  }
  return game;
}

/** headless 绘桩（renderer ctx 最小同构；计数不渲染） */
export function stubCtx() {
  const ops = [];
  const mk = (name) => (...args) => { ops.push([name, args.length]); };
  return {
    ops,
    fillRect: mk('fillRect'), strokeRect: mk('strokeRect'),
    beginPath: mk('beginPath'), moveTo: mk('moveTo'), lineTo: mk('lineTo'),
    arc: mk('arc'), fill: mk('fill'), stroke: mk('stroke'), closePath: mk('closePath'),
    fillText: mk('fillText'), setLineDash: mk('setLineDash'),
    save: mk('save'), restore: mk('restore'), translate: mk('translate'), scale: mk('scale'),
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', lineCap: 'butt',
  };
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

/** 剥注释（源扫描面：防注释文本误报；字符串字面量保留——fnd-1/hex 扫描均需） */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export function readSrc(rels) {
  return rels.map((r) => ({ rel: r, text: readFileSync(join(GAME_ROOT, r), 'utf8') }));
}

export { createRun, stepSim, placeTurret, upgradeTurret, grid, Game };
