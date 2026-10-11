// game.ts — 组装面（wheat-squad · spec e-upgrade-picker/e-telemetry 落点 + boot 装配）
//
// 纪律：内核零平台感知（sim 纯仿真）；本件 = 输入/渲染循环/三选一视图/结算视图/debug 机读面。
// spec 单源装载（numeric 全量注入 sim，零手抄第二份——预置件纪律 4）。
import { seededRng } from './kernel/loop.ts';
import { createSim, offerUpgrades, pickUpgrade, settlementFacts, stepSim, type SimConfig, type SimState, UPGRADE_LABEL } from './kernel/sim.ts';
import { computeLayout, drawEffects, drawField, drawHud, drawPests, drawSquad, type Layout } from './render/renderer.ts';
import { buildSettlement } from './settlement.ts';

type Json = Record<string, any>;

export function loadSpec(): Json {
  // 发现序：G2WS_SPEC_PATH → 一号仓 .myrd/spec/wheat-squad/design-spec.json（repo-one 同构判例）
  if (process.env.G2WS_SPEC_PATH) return JSON.parse(require('node:fs').readFileSync(process.env.G2WS_SPEC_PATH, 'utf8'));
  // 浏览器面：由 boot 注入 window.__G2WS_SPEC（index.html 内联 fetch 失败时占位）
  const g = globalThis as unknown as { __G2WS_SPEC?: Json };
  if (g.__G2WS_SPEC) return g.__G2WS_SPEC;
  throw new Error('wheat-squad spec 未装载（G2WS_SPEC_PATH 或 __G2WS_SPEC 缺位）');
}

export interface Game {
  readonly state: SimState;
  layout: Layout;
  pointer: { x: number; y: number } | null;
  restart(): void;
  step(dtMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  telemetryEvents(): string[];
}

export function numericToConfig(spec: Json, rng: ReturnType<typeof seededRng>): SimConfig {
  const n = spec.numeric;
  return {
    rng,
    field: { w: 390, h: 640 },
    stepMs: n.FIXED_STEP_MS,
    captain: n.captain,
    squad: n.squad,
    enemy: n.enemy,
    wave: n.wave,
    upgrade: n.upgrade,
    firstKillBudgetSec: n.firstKillBudgetSec,
    feedback: n.feedback,
    perf: n.perf,
    runDuration: n.runDuration,
  };
}

export function createGame(specRaw: Json, canvasW = 390, canvasH = 640): Game {
  const spec: Json = specRaw.spec ?? specRaw; // wrapped 导出件（{schemaVersion,spec,_platform}）解包；内容面直传兼容
  const cfg = numericToConfig(spec, seededRng(spec.numeric.DEFAULT_SEED));
  cfg.field = { w: canvasW, h: canvasH };
  const state = createSim(cfg, spec.numeric.DEFAULT_SEED);
  const telemetry: Array<{ id: string; tick: number }> = [];
  const layout = computeLayout(canvasW, canvasH);
  const game: Game = {
    state,
    layout,
    pointer: null,
    restart(): void {
      const fresh = createSim(cfg, spec.numeric.DEFAULT_SEED);
      Object.assign(state, fresh);
      telemetry.push({ id: 'run_start', tick: state.tick });
    },
    step(dtMs: number): void {
      if (state.choices) return; // 三选一悬停时冻结战局（选择即生效的前置）
      if (state.phase === 'running' && telemetry.every((t) => t.id !== 'run_start')) telemetry.push({ id: 'run_start', tick: 0 });
      state.captain.target = game.pointer;
      stepSim(state, dtMs);
      if (state.firstKillTick !== null && !telemetry.some((t) => t.id === 'first_kill')) telemetry.push({ id: 'first_kill', tick: state.firstKillTick });
      if (state.phase === 'ended' && !telemetry.some((t) => t.id === 'run_end')) {
        telemetry.push({ id: 'run_end', tick: state.tick });
      }
    },
    render(ctx: CanvasRenderingContext2D): void {
      drawField(ctx, layout, state.tick);
      drawPests(ctx, state);
      drawEffects(ctx, state);
      drawSquad(ctx, state);
      drawHud(ctx, layout, state);
      if (state.choices) renderUpgradePicker(ctx, layout, state);
      if (state.phase === 'ended') renderSettlement(ctx, layout, state);
    },
    telemetryEvents(): string[] { return telemetry.map((t) => t.id); },
  };
  return game;
}

function renderUpgradePicker(ctx: CanvasRenderingContext2D, L: Layout, st: SimState): void {
  ctx.fillStyle = 'rgba(74,56,38,0.55)';
  ctx.fillRect(0, 0, L.w, L.h);
  const cards = st.choices || [];
  const cw = 96, ch = 120, gap = 12;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = (L.w - total) / 2;
  const y0 = L.h / 2 - ch / 2;
  cards.forEach((id, i) => {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = '#F5EDD8';
    ctx.fillRect(x, y0, cw, ch);
    ctx.strokeStyle = '#C99530';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y0, cw, ch);
    ctx.fillStyle = '#4A3826';
    ctx.font = '600 12px system-ui, sans-serif';
    wrapText(ctx, UPGRADE_LABEL[id], x + 8, y0 + 24, cw - 16, 16);
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText(`点选 ${i + 1}`, x + 8, y0 + ch - 12);
  });
}

function renderSettlement(ctx: CanvasRenderingContext2D, L: Layout, st: SimState): void {
  const facts = settlementFacts(st);
  const view = buildSettlement(facts, st.endedReason || 'timeout');
  ctx.fillStyle = 'rgba(245,237,216,0.96)';
  ctx.fillRect(L.w * 0.08, L.h * 0.18, L.w * 0.84, L.h * 0.56);
  ctx.strokeStyle = '#C99530';
  ctx.lineWidth = 3;
  ctx.strokeRect(L.w * 0.08, L.h * 0.18, L.w * 0.84, L.h * 0.56);
  ctx.fillStyle = '#4A3826';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText(view.headline, L.w * 0.12, L.h * 0.18 + 34);
  ctx.font = '500 12px system-ui, sans-serif';
  view.rows.forEach((r, i) => ctx.fillText(r, L.w * 0.12, L.h * 0.18 + 60 + i * 18));
  ctx.fillStyle = '#D2543E';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(view.restartHint, L.w * 0.12, L.h * 0.18 + L.h * 0.56 - 16);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  let line = ''; let yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lineH; }
    else line += ch;
  }
  ctx.fillText(line, x, yy);
}

/** 三选一点选命中（视图坐标 → 选项 index；game.ts#upgradePicker 对外接口） */
export function upgradePickerHit(game: Game, x: number, y: number): number | null {
  if (!game.state.choices) return null;
  const L = game.layout;
  const cards = game.state.choices;
  const cw = 96, ch = 120, gap = 12;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = (L.w - total) / 2;
  const y0 = L.h / 2 - ch / 2;
  for (let i = 0; i < cards.length; i += 1) {
    const cx = x0 + i * (cw + gap);
    if (x >= cx && x <= cx + cw && y >= y0 && y <= y0 + ch) {
      pickUpgrade(game.state, i);
      game.telemetryEvents().push && void 0;
      return i;
    }
  }
  return null;
}

/** 机读点选口（main debug 面 → 真实选择路径；smoke/契约消费） */
export function pickUpgradeHost(game: Game, choiceIndex: number): boolean {
  if (!game.state.choices) return false;
  pickUpgrade(game.state, choiceIndex);
  return true;
}

export function offerIfNeeded(game: Game): void {
  if (game.state.choices === null && game.state.xp >= 5 && game.state.phase === 'running') offerUpgrades(game.state);
}
