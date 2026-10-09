// settlement.ts — 结算页信息架构层（e-settlement · ac-32 · 链 v8 冻结面 numeric.settlement）
//
// 纪律（链 v8 修补④⑤⑥ 定死口径）：
//   纯视图模型 + 纯几何（零 DOM 依赖，Node 可直测）；数值唯一真源 = generated/ux-data；
//   文案唯一真源 = theme SETTLEMENT_TEXT / NEARMISS_TEXT（spec copy 枚举的代码面，契约逐字机判）；
//   零玩法逻辑改动：输入只读现成状态面（score/chain/movesUsed/goals），行动层只产出意图
//   （restart = doRestart 同源同路径；daily = daily.seed() 开局同源），本模块不发任何玩法调用。
//   槽位 element id 单源：SLOT_IDS（spec ac-32.slots ↔ e-settlement.elementIds ↔ 本表三方一致，
//   契约机判；canvas 面槽位以逻辑 id 暴露 __G2_SETTLEMENT 观测口，smoke 按id断言）。
//   输入封印：视图仅 cooled 态出现（inputSeal = cooled 既有封印）；出现延迟/入场时序冻结值直取。
import { NUMERIC_UX } from '../generated/ux-data.mjs';
import { SETTLEMENT_TEXT, NEARMISS_TEXT } from './theme.mjs';

/** 面板几何最小输入（解耦 renderer.Layout；调用方传布局的 w/h 即可） */
                              
            
            
 

export const SLOT_IDS = [
  'result-slot-score',
  'result-slot-chain',
  'result-slot-moves',
  'result-slot-attribution',
  'result-slot-action-restart',
  'result-slot-action-daily',
]         ;

                                               

                                 
             
                                                                           
                 
               
                   
                       
 

                                 
                               
                      
                      
                                        
 

                                  
                                                        
                                                                
                                                              
 

                                   
                
                
                    
                                                                 
                           
                       
                        
                                                                            
                       
                                                                         
                                                 
 

export function settlementNumeric() {
  const st = NUMERIC_UX.settlement;
  if (!st || typeof st.touchTargetMinPx !== 'number') throw new Error('settlement: 链 v8 numeric.settlement 缺组（重跑 tools/gen-ux-data.mjs）');
  return st;
}

/**
 * 归因层文案（单源分支器）：
 *   near-miss 规则文案（P1/P2 模板 / P3 带 chain）→ 差值文案（bestGap）→ 个人最佳边界降级（edge）
 *   → 无可消除（movesEnded）→ null（无归因行；survive-to-cool 且无 near-miss 的常态局）
 */
export function attributionCopy(opts   
                                  
                       
                 
                              
                        
                 
                                                 
 )                {
  if (opts.rule === 'P1') return NEARMISS_TEXT['nm-copy-settle-chain'].replace('{chainTarget}', String(opts.chainTarget ?? ''));
  if (opts.rule === 'P2') return NEARMISS_TEXT['nm-copy-settle-firstclear'];
  if (opts.rule === 'P3') return NEARMISS_TEXT['nm-copy-settle-hands'].replace('{chain}', String(opts.chain ?? ''));
  if (opts.bestGap && opts.bestGap.best > 0) {
    return NEARMISS_TEXT['nm-copy-personal-best-gap']
      .replace('{best}', String(opts.bestGap.best))
      .replace('{gap}', String(opts.bestGap.gap));
  }
  if (typeof opts.personalBest === 'number' && typeof opts.score === 'number') {
    // e-personal-best 边界（=0/低分/新纪录）：edge 降级文案仅在低分或清档时替代通用行
    if (opts.personalBest <= 0) return SETTLEMENT_TEXT.attributionNone;
    if (opts.score < opts.personalBest * 0.5) return NEARMISS_TEXT['nm-copy-personal-best-edge'];
  }
  if (opts.movesEnded) return SETTLEMENT_TEXT.attributionNone;
  return null;
}

/** 结算视图（纯）：cooled 态由调用方把关；本模块只在被调用时组装，零副作用 */
export function computeSettlementView(inputs                  )                 {
  const n = settlementNumeric();
  const attribution = attributionCopy({
    rule: inputs.rule,
    movesEnded: inputs.movesEnded ?? true,
    chain: inputs.chain,
    personalBest: inputs.personalBest,
    score: inputs.score,
    bestGap: inputs.bestGap ?? null,
  });
  const slots                                 = {
    'result-slot-score': { id: 'result-slot-score', layer: 'P0-result', label: SETTLEMENT_TEXT.scoreLabel, text: String(inputs.score), visible: true, interactive: false },
    'result-slot-chain': { id: 'result-slot-chain', layer: 'P1-result', label: SETTLEMENT_TEXT.chainLabel, text: String(inputs.chain), visible: true, interactive: false },
    'result-slot-moves': { id: 'result-slot-moves', layer: 'P2-result', label: SETTLEMENT_TEXT.movesLabel, text: String(inputs.movesUsed), visible: true, interactive: false },
    'result-slot-attribution': { id: 'result-slot-attribution', layer: 'P3-attribution-action', text: attribution ?? '', visible: attribution !== null, interactive: false },
    'result-slot-action-restart': { id: 'result-slot-action-restart', layer: 'P3-attribution-action', label: SETTLEMENT_TEXT.actionRestart, text: '', visible: true, interactive: true },
    'result-slot-action-daily': { id: 'result-slot-action-daily', layer: 'P3-attribution-action', label: SETTLEMENT_TEXT.actionDaily, text: '', visible: inputs.dailyVisible, interactive: true },
  };
  return { inputSeal: 'cooled-existing', showDelayMs: n.showDelayMs, enterAnimMs: n.enterAnimMs, slots };
}

/** 结算面板几何（纯）：行动按钮高度 ≥ touchTargetMinPx（48dp ≈ css px @1x；最低机型档基准） */
export function settlementRects(layout             , _opts                            = {})                  {
  const n = settlementNumeric();
  const minTouch = n.touchTargetMinPx;
  const panelW = Math.min(layout.w * 0.86, 420);
  const panelH = Math.max(layout.h * 0.4, 300);
  const panel = {
    x: (layout.w - panelW) / 2,
    y: layout.h * 0.2,
    w: panelW,
    h: panelH,
  };
  const btnH = Math.max(minTouch, layout.h * 0.062);
  const btnW = Math.min(panelW * 0.62, 240);
  const actionY = panel.y + panel.h - btnH - Math.max(16, layout.h * 0.022);
  const actionRestart = { x: (layout.w - btnW) / 2, y: actionY, w: btnW, h: btnH };
  const actionDaily = { x: (layout.w - btnW) / 2, y: actionY - btnH - Math.max(10, layout.h * 0.014), w: btnW, h: btnH };
  return { panel, actionRestart, actionDaily };
}

/** 命中检测（纯）：结算出现期间的行动层命中（其余触点由调用方吞掉 = 输入封印） */
export function settlementHit(rects                 , px        , py        , opts                           )                             {
  const inRect = (r                                                )          =>
    px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  if (inRect(rects.actionRestart)) return 'restart';
  if (opts.dailyVisible && inRect(rects.actionDaily)) return 'daily';
  return null;
}


//# sourceURL=render/settlement.ts