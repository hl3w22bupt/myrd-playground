// nearmiss.ts — 惜败反馈判定器（e-nearmiss · ac-31 · 链 v8 冻结面 numeric.nearMiss）
//
// 纪律（链 v8 修补①② 定死口径）：
//   纯函数 + 零 DOM + 零内核改动：只读复用 kernel/board probeSwapCreatesMatch 探针原语
//   （deadlock 同源面，禁改内核）；数值唯一真源 = generated/ux-data（链 v8 现读，零手抄第二份）。
//   行列同权：候选行 = 「一步可成消」候选交换两格所在行 y 的并集（升序去重，tie-break =
//   cell-index-asc，由探针扫描顺序天然保证）；列向候选与行向候选同权入并集。
//   末态口径：本模块所有评估一律吃「消除结算 + 重力补手完成后的同逻辑帧末态棋盘」——
//   调用方（main.ts）在 game.swap 返回后的同一调用栈内评估，禁传中级联/动画中间态。
//   弱反馈频控：每行 1 次/局（perRowPerRun）+ 全局 ≤3 次/局（globalPerRun）；超限只分类上报
//   （capType per-row / global），不展示不排程。
//   强反馈：本版无通道（strongFeedback.inVersion=false）——本模块不提供任何强反馈面（修补②）。
import { NUMERIC_UX } from '../generated/ux-data.mjs';
import { SFX } from './theme.mjs';
import { probeSwapCreatesMatch,            } from '../kernel/board.mjs';

                                 
                       
                       
 

                                   
                 
               
                      
                     
                      
                              
                    
 

                           
                 
                                                                   
 

                                                       
                                                             

/** 链 v8 冻结面读取口（单源；缺组即抛——防静默降级） */
export function nearMissNumeric() {
  const nm = NUMERIC_UX.nearMiss;
  if (!nm?.weakFeedback || !nm?.predicate) throw new Error('nearmiss: 链 v8 numeric.nearMiss 缺组（重跑 tools/gen-ux-data.mjs）');
  return nm;
}

/** 弱反馈频控配置（契约断言面同源） */
export function nearMissConfig()                 {
  const wf = nearMissNumeric().weakFeedback;
  return { perRowPerRun: wf.perRowPerRun, globalPerRun: wf.globalPerRun };
}

/** 新局判定器状态（seed 只随遥测出站；判定本身是棋盘纯函数，天然 seed 可复现） */
export function createNearMissRun(opts                                  )                   {
  return {
    runSeq: opts.runSeq,
    seed: opts.seed,
    shownRows: [],
    shownCount: 0,
    runMaxChain: 0,
    firstClearAt: null,
    moveCount: 0,
  };
}

/** 末态棋盘「一步可成消」候选行集合（行列同权 · 升序去重 · tie-break cell-index-asc） */
export function oneAwayRows(board       )           {
  // 行列同权 = spec numeric.nearMiss.predicate.axisParity 的实现消费面（声明键逐次校验，漂移即拒）
  if (nearMissNumeric().predicate.axisParity !== 'row-col-equal') {
    throw new Error('oneAwayRows: 链面 axisParity ≠ row-col-equal（口径漂移，拒绝评估）');
  }
  const { cols, rows } = board;
  const hit = new Set        ();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const a = y * cols + x;
      // 右邻 + 下邻（无向对去重：每对只探一次；覆盖 ≤4 向全邻接）
      if (x + 1 < cols) probe(board, a, a + 1, y, y, hit);
      if (y + 1 < rows) probe(board, a, a + cols, y, y + 1, hit);
    }
  }
  return [...hit].sort((p, q) => p - q);
}

function probe(board       , a        , b        , rowA        , rowB        , hit             )       {
  if (probeSwapCreatesMatch(board, a, b)) {
    hit.add(rowA);
    hit.add(rowB);
  }
}

/** 弱反馈频控闸门（纯）：返回可展示行与被帽行分类；不推进状态（推进归 applyShow） */
export function planShow(state                  , rows          , cfg                )           {
  const show           = [];
  const capped                                                           = [];
  for (const row of rows) {
    if (state.shownRows.includes(row)) {
      mergeCap(capped, [row], 'per-row');
      continue;
    }
    if (state.shownCount + show.length >= cfg.globalPerRun) {
      mergeCap(capped, [row], 'global');
      continue;
    }
    show.push(row);
  }
  return { show, capped };
}

function mergeCap(capped                                                          , rows          , capType                      )       {
  const last = capped[capped.length - 1];
  if (last && last.capType === capType) last.rows.push(...rows);
  else capped.push({ rows: [...rows], capType });
}

/** 频控状态推进（展示后调用；每行 1 次/局 记账 + 全局计数） */
export function applyShow(state                  , rows          )       {
  for (const row of rows) if (!state.shownRows.includes(row)) state.shownRows.push(row);
  state.shownCount += rows.length;
}

/** 手观测（每手末态调用一次；首消手序 1-based） */
export function observeMove(state                  , opts                                                               )       {
  state.moveCount += 1;
  if (opts.cleared && state.firstClearAt === null) state.firstClearAt = state.moveCount;
  if (opts.chain > state.runMaxChain) state.runMaxChain = opts.chain;
  void opts.handsLeft;
}

/**
 * 炉冷结算三择一（P1→P2→P3 首中；链 v8 predicate.settlementRules）：
 *   P1 连击差一：chainTarget ≠ null 且 runMaxChain = chainTarget − chainDelta 且 < chainTarget
 *   P2 首消差一步：firstClearWithinMoves ≠ null 且 firstClearAt − firstClearWithinMoves ∈ [1..movesDelta]
 *   P3 剩手惜败：handsLeft ≠ null 且 handsLeft ≤ 1 且 runMaxChain ≥ minChain
 */
export function settlementRule(
  state                                                        ,
  goals                                                                      ,
  handsLeft               ,
  movesDeltaUnused         ,
)                 {
  const p = nearMissNumeric().predicate;
  void movesDeltaUnused;
  if (goals.chainTarget !== null && state.runMaxChain === goals.chainTarget - p.chainDelta && state.runMaxChain < goals.chainTarget) return 'P1';
  if (goals.firstClearWithinMoves !== null && state.firstClearAt !== null) {
    const late = state.firstClearAt - goals.firstClearWithinMoves;
    if (late >= 1 && late <= p.movesDelta) return 'P2';
  }
  if (handsLeft !== null && handsLeft <= 1 && state.runMaxChain >= p.minChain) return 'P3';
  return null;
}

/** 个人最佳边界（e-personal-best）：=0/低分降级；常规差值 gap；新纪录 record（无差值文案） */
export function personalBestCopyKind(opts                                         )                       {
  if (opts.personalBest <= 0) return 'edge';
  if (opts.score >= opts.personalBest) return 'record';
  if (opts.score < opts.personalBest * 0.5) return 'edge';
  return 'gap';
}

/**
 * near-miss 音效变体规格（链 v8 sfx 用途表 · e-sfx-usage）：第二档（combo）声部的**派生变体**——
 *   tail=descending → freq 镜像反转（上行变下行尾音）；durationScale=0.5 → 时长减半；
 *   波形/包络/增益/失谐全部承第二档原值（零新数值零手抄）。数值真源 = theme SFX（第二档）+
 *   numeric.nearMiss.sfx（变参），本函数是唯一派生点（契约件逐字段机判）。
 */
export function nearMissSfxSpec()   
                                                                               
                                                                             
  {
  const cfg = nearMissNumeric().sfx;
  if (cfg.tier !== 2) throw new Error('nearmiss sfx: 用途表钉第二档（tier=2），链面漂移');
  const base = SFX.find((s) => s.kind === 'combo');
  if (!base) throw new Error('nearmiss sfx: theme SFX 缺第二档声部（combo）');
  const descending = cfg.tail === 'descending';
  return {
    id: 'near-miss-t2-variant',
    kind: 'nearmiss',
    wave: base.wave,
    freqFromHz: descending ? base.freqToHz : base.freqFromHz,
    freqToHz: descending ? base.freqFromHz : base.freqToHz,
    durationMs: Math.round(base.durationMs * cfg.durationScale),
    envelope: base.envelope,
    gainMul: base.gainMul,
    detuneCents: base.detuneCents,
  };
}


//# sourceURL=render/nearmiss.ts