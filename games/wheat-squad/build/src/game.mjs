// game.ts — 组装面（wheat-squad · spec e-upgrade-picker/e-telemetry 落点 + boot 装配）
//
// 纪律：内核零平台感知（sim 纯仿真）；本件 = 输入/渲染循环/三选一视图/结算视图/debug 机读面。
// spec 单源装载（numeric 全量注入 sim，零手抄第二份——预置件纪律 4）。
import { seededRng } from './kernel/loop.mjs';
import { createSim, offerUpgrades, pickUpgrade, settlementFacts, stepSim,                                UPGRADE_LABEL } from './kernel/sim.mjs';
import { computeLayout, drawEffects, drawField, drawHud, drawPests, drawSquad,             } from './render/renderer.mjs';
import { THEME } from './render/theme.mjs';
import { buildSettlement } from './settlement.mjs';

                                

export function loadSpec()       {
  // 发现序：G2WS_SPEC_PATH → 一号仓 .myrd/spec/wheat-squad/design-spec.json（repo-one 同构判例）
  if (process.env.G2WS_SPEC_PATH) return JSON.parse(require('node:fs').readFileSync(process.env.G2WS_SPEC_PATH, 'utf8'));
  // 浏览器面：由 boot 注入 window.__G2WS_SPEC（index.html 内联 fetch 失败时占位）
  const g = globalThis                                     ;
  if (g.__G2WS_SPEC) return g.__G2WS_SPEC;
  throw new Error('wheat-squad spec 未装载（G2WS_SPEC_PATH 或 __G2WS_SPEC 缺位）');
}

                       
                           
                 
                                           
                  
                           
                                              
                              
 

export function numericToConfig(spec      , rng                              )            {
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

export function createGame(specRaw      , canvasW = 390, canvasH = 640)       {
  const spec       = specRaw.spec ?? specRaw; // wrapped 导出件（{schemaVersion,spec,_platform}）解包；内容面直传兼容
  const cfg = numericToConfig(spec, seededRng(spec.numeric.DEFAULT_SEED));
  cfg.field = { w: canvasW, h: canvasH };
  const state = createSim(cfg, spec.numeric.DEFAULT_SEED);
  const telemetry                                      = [];
  const layout = computeLayout(canvasW, canvasH);
  const game       = {
    state,
    layout,
    pointer: null,
    restart()       {
      const fresh = createSim(cfg, spec.numeric.DEFAULT_SEED);
      Object.assign(state, fresh);
      telemetry.push({ id: 'run_start', tick: state.tick });
    },
    step(dtMs        )       {
      if (state.choices) return; // 三选一悬停时冻结战局（选择即生效的前置）
      if (state.phase === 'running' && telemetry.every((t) => t.id !== 'run_start')) telemetry.push({ id: 'run_start', tick: 0 });
      state.captain.target = game.pointer;
      stepSim(state, dtMs);
      if (state.firstKillTick !== null && !telemetry.some((t) => t.id === 'first_kill')) telemetry.push({ id: 'first_kill', tick: state.firstKillTick });
      // 埋点三方同名（spec meta.telemetryFields = 本处 = 冒烟断言）：first_core_action_at / run_duration_ms / feedback_latency_ms
      if (state.firstCoreActionTick !== null && !telemetry.some((t) => t.id === 'first_core_action_at')) {
        telemetry.push({ id: 'first_core_action_at', tick: state.firstCoreActionTick, atMs: state.firstCoreActionTick * spec.numeric.FIXED_STEP_MS });
      }
      const fbEv = state.feedbackEvents[0];
      if (fbEv && !telemetry.some((t) => t.id === 'feedback_latency_ms')) {
        telemetry.push({ id: 'feedback_latency_ms', tick: fbEv.tick, latencyMs: fbEv.latencyMs, channels: fbEv.channels });
      }
      if (state.phase === 'ended' && !telemetry.some((t) => t.id === 'run_end')) {
        telemetry.push({ id: 'run_end', tick: state.tick, durationMs: state.tick * spec.numeric.FIXED_STEP_MS, reason: state.endedReason });
      }
    },
    render(ctx                          )       {
      drawField(ctx, layout, state.tick);
      drawPests(ctx, state);
      drawEffects(ctx, state);
      drawSquad(ctx, state);
      drawHud(ctx, layout, state);
      if (state.choices) renderUpgradePicker(ctx, layout, state);
      if (state.phase === 'ended') renderSettlement(ctx, layout, state);
    },
    telemetryEvents()           { return telemetry.map((t) => t.id); },
  };
  return game;
}

function renderUpgradePicker(ctx                          , L        , st          )       {
  ctx.fillStyle = THEME.scrimInk;
  ctx.fillRect(0, 0, L.w, L.h);
  const cards = st.choices || [];
  const cw = 96, ch = 120, gap = 12;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = (L.w - total) / 2;
  const y0 = L.h / 2 - ch / 2;
  cards.forEach((id, i) => {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = THEME.skyCream;
    ctx.fillRect(x, y0, cw, ch);
    ctx.strokeStyle = THEME.wheatDeep;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y0, cw, ch);
    ctx.fillStyle = THEME.inkBrown;
    ctx.font = '600 12px system-ui, sans-serif';
    wrapText(ctx, UPGRADE_LABEL[id], x + 8, y0 + 24, cw - 16, 16);
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText(`点选 ${i + 1}`, x + 8, y0 + ch - 12);
  });
}

function renderSettlement(ctx                          , L        , st          )       {
  const facts = settlementFacts(st);
  const view = buildSettlement(facts, st.endedReason || 'timeout');
  ctx.fillStyle = THEME.panelCream;
  ctx.fillRect(L.w * 0.08, L.h * 0.18, L.w * 0.84, L.h * 0.56);
  ctx.strokeStyle = THEME.wheatDeep;
  ctx.lineWidth = 3;
  ctx.strokeRect(L.w * 0.08, L.h * 0.18, L.w * 0.84, L.h * 0.56);
  ctx.fillStyle = THEME.inkBrown;
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText(view.headline, L.w * 0.12, L.h * 0.18 + 34);
  ctx.font = '500 12px system-ui, sans-serif';
  view.rows.forEach((r, i) => ctx.fillText(r, L.w * 0.12, L.h * 0.18 + 60 + i * 18));
  ctx.fillStyle = THEME.accentRed;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(view.restartHint, L.w * 0.12, L.h * 0.18 + L.h * 0.56 - 16);
}

function wrapText(ctx                          , text        , x        , y        , maxW        , lineH        )       {
  let line = ''; let yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lineH; }
    else line += ch;
  }
  ctx.fillText(line, x, yy);
}

/** 三选一点选命中（视图坐标 → 选项 index；game.ts#upgradePicker 对外接口） */
export function upgradePickerHit(game      , x        , y        )                {
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
export function pickUpgradeHost(game      , choiceIndex        )          {
  if (!game.state.choices) return false;
  pickUpgrade(game.state, choiceIndex);
  return true;
}

export function offerIfNeeded(game      )       {
  if (game.state.choices === null && game.state.xp >= 5 && game.state.phase === 'running') offerUpgrades(game.state);
}
