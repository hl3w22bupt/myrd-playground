// game.ts — 组装面（wheat-squad · spec e-upgrade-picker/e-telemetry 落点 + boot 装配）
//
// 纪律：内核零平台感知（sim 纯仿真）；本件 = 输入/渲染循环/三选一视图/结算视图/debug 机读面。
// spec 单源装载（numeric 全量注入 sim，零手抄第二份——预置件纪律 4）。
import { seededRng } from './kernel/loop.mjs';
import { createSim, offerUpgrades, pickUpgrade, settlementFacts, stepSim,                                UPGRADE_LABEL } from './kernel/sim.mjs';
import { computeLayout, drawEffects, drawField, drawGuidance, drawHud, drawPests, drawSquad,             } from './render/renderer.mjs';
import { THEME } from './render/theme.mjs';
import { buildSettlement } from './settlement.mjs';

                                

/** 首屏引导文案单源（spec v1.2 三合一包同源逐字；a5 存在性 check 消费面） */
export const GUIDANCE_TEXT = '拖动队长移动 · 队员自动作战';

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
  // 引导浮层窗口（spec v1.2 numeric.guidance.hintSec 单源，入链前容缺省 4s）
  const hintMs = ((spec.numeric.guidance?.hintSec) ?? 4) * 1000;
  let restartClicks = 0;
  const game       = {
    state,
    layout,
    pointer: null,
    recordTap()       {
      // first_tap：会话首次点按 once（任意态点按均计；atMs = 局内相对毫秒）
      if (telemetry.some((t) => t.id === 'first_tap')) return;
      telemetry.push({ id: 'first_tap', tick: state.tick, atMs: state.tick * spec.numeric.FIXED_STEP_MS });
    },
    recordRestartClick()       {
      // restart_clicked：每次点按一条，count 本地计数递增（a4 v1 写死「真实点击本地计数 +1」）
      restartClicks += 1;
      telemetry.push({ id: 'restart_clicked', tick: state.tick, count: restartClicks, atMs: state.tick * spec.numeric.FIXED_STEP_MS });
    },
    restart()       {
      const fresh = createSim(cfg, spec.numeric.DEFAULT_SEED);
      Object.assign(state, fresh);
      telemetry.push({ id: 'run_start', tick: state.tick });
    },
    step(dtMs        )       {
      // 遥测推进先于战局冻结：三选一悬停只冻结战局，观测面（first_* 埋点）必须照常落账
      // （否则 choices 悬停帧 first_loop_complete 永不 push——2026-10-13 ac-16 先红实证）
      if (state.phase === 'running' && telemetry.every((t) => t.id !== 'run_start')) telemetry.push({ id: 'run_start', tick: 0 });
      // hint_shown：首局 running 起始展示引导浮层（once；atMs=0，文案 GUIDANCE_TEXT 单源）
      if (state.phase === 'running' && !telemetry.some((t) => t.id === 'hint_shown')) {
        telemetry.push({ id: 'hint_shown', tick: state.tick, atMs: state.tick * spec.numeric.FIXED_STEP_MS, text: GUIDANCE_TEXT });
      }
      if (state.firstKillTick !== null && !telemetry.some((t) => t.id === 'first_kill')) telemetry.push({ id: 'first_kill', tick: state.firstKillTick });
      // first_loop_complete：首次升级三选一选择完成 = 首次核心循环闭环（拖动→击杀→掉落→拾取→升级）
      if (state.firstUpgradeTick !== null && !telemetry.some((t) => t.id === 'first_loop_complete')) {
        telemetry.push({ id: 'first_loop_complete', tick: state.firstUpgradeTick, atMs: state.firstUpgradeTick * spec.numeric.FIXED_STEP_MS });
      }
      const fbEv = state.feedbackEvents[0];
      if (fbEv && !telemetry.some((t) => t.id === 'feedback_latency_ms')) {
        telemetry.push({ id: 'feedback_latency_ms', tick: fbEv.tick, latencyMs: fbEv.latencyMs, channels: fbEv.channels });
      }
      if (state.phase === 'ended' && !telemetry.some((t) => t.id === 'run_end')) {
        telemetry.push({ id: 'run_end', tick: state.tick, run_duration_ms: state.tick * spec.numeric.FIXED_STEP_MS, reason: state.endedReason });
      }
      if (state.choices) return; // 三选一悬停时冻结战局（选择即生效的前置；遥测已在上方落账）
      // 已知缺陷旁路（Q-1，本轮不擅修）：main/offerIfNeeded 的触发阈值硬编码 xp>=5，
      // 与 sim 内部 nextUpgradeXp 递增阈值（5,15,25…）不同源——xp 达 5 后每帧重弹三选一。
      // 修复会改变 approved A1/A2 行为面（P50=168s 建立在此旁路上），须走 feedbackProtocol revision。
      state.captain.target = game.pointer;
      stepSim(state, dtMs);
      // 埋点三方同名（spec meta.telemetryFields = 本处 = 冒烟断言）：first_core_action_at / run_duration_ms / feedback_latency_ms
      if (state.firstCoreActionTick !== null && !telemetry.some((t) => t.id === 'first_core_action_at')) {
        telemetry.push({ id: 'first_core_action_at', tick: state.firstCoreActionTick, atMs: state.firstCoreActionTick * spec.numeric.FIXED_STEP_MS });
      }
    },
    render(ctx                          )       {
      drawField(ctx, layout, state.tick);
      drawPests(ctx, state);
      drawEffects(ctx, state);
      drawSquad(ctx, state);
      drawHud(ctx, layout, state);
      // 引导浮层：running 且窗口内（hint_shown 后 hintMs 内可见；a5 首操作判定窗同源）
      if (state.phase === 'running' && !state.choices && state.tick * spec.numeric.FIXED_STEP_MS < hintMs) {
        drawGuidance(ctx, layout, GUIDANCE_TEXT);
      }
      if (state.choices) renderUpgradePicker(ctx, layout, state);
      if (state.phase === 'ended') renderSettlement(ctx, layout, state);
    },
    telemetryEvents()           { return telemetry.map((t) => t.id); },
    telemetryEntries() { return telemetry.map((t) => ({ ...t })); },
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
