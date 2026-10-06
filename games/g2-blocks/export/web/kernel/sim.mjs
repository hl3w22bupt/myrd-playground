// sim.ts — 确定性仿真内核（e-kernel-sim · fixed 16ms 步长累加器 + MAX_DT 钳制 + fastForward）
//
// 单手结算顺序唯一（ac-08 × ac-07 双判）：
//   交换 → 消除判定 → 计分(含连击加成) → [炉冷判·落定结算后] → 重力 → 补手 → [炉冷判·补手后]
//   连锁：重力+补手后若仍有三连 → 继续消除/计分/重力/补手，直至无新消除（步名只记首次，明细落 waves）
// 状态 = { board[64], score, chain, movesUsed, cool, status }（spec entities.e-kernel-sim 口径 + 链扩展）
// 判定全按 spec numeric 冻结值现读；本文件零禁用随机源（内核唯一随机入口 = rng.ts 的 mulberry32/seededRng）。
import { areAdjacent, applyGravity, createBoard, createBoardFromCells, findMatches, refill } from './board.mjs';
import { createCombo } from './combo.mjs';
import { isDeadlocked } from './deadlock.mjs';
import { numeric } from '../generated/spec-data.mjs';
import { seededRng,          } from './rng.mjs';

                                             

                           
                  
                
                
                    
                
                    
 

                           
                  
                 
 

                              
                                                                               
                                         
                                                  
                    
                                        
                 
                                                           
              
 

                             
              
                    
                
                
                     
                
                                      
                  
                                                       
                        
                    
 

                      
                  
                                         
                  
                                                                                        
                                                               
                      
 

export function createSim(opts                    = {})      {
  const n = numeric();
  const combo = createCombo();
  let rng      = seededRng(opts.seed); // seed 缺省 = spec DEFAULT_SEED（rng.ts 内取）
  let board = createBoard(opts.seed ?? n.DEFAULT_SEED);
  let score = 0;
  let movesUsed = 0;
  let cool = false;
  let status            = 'playing';
  let accMs = 0;
  let ticks = 0;

  const state           = {
    get board() { return board.cells; },
    get score() { return score; },
    get chain() { return combo.state.chain; },
    get movesUsed() { return movesUsed; },
    get cool() { return cool; },
    get status() { return status; },
  };

  function waveGain(clearedCount        )         {
    if (clearedCount < 3) return 0;
    const { baseClear3, perExtraBlock } = n.scoring;
    return baseClear3 + (clearedCount - 3) * perExtraBlock;
  }

  function swap(a        , b        )             {
    const trace           = [];
    const probes                = [];
    const waves             = [];
    const record = (step        ) => { trace.push(step); };
    const boardHash = ()         => {
      let h = 2166136261;
      for (let i = 0; i < board.cells.length; i += 1) { h ^= board.cells[i]; h = Math.imul(h, 16777619); }
      return h >>> 0;
    };
    // 炉冷探针（任一判点触发即记录真实时点：phase + 盘面哈希 + 满员数 + 序号）
    const probe = (phase                      )          => {
      record('deadlock-check');
      probes.push({
        phase,
        boardHash: boardHash(),
        filled: board.cells.reduce((acc, c) => acc + (c >= 0 ? 1 : 0), 0),
        idx: probes.length,
      });
      return isDeadlocked(board);
    };
    if (status !== 'playing') {
      return { ok: false, cleared: [], bonus: 0, chain: combo.state.chain, scoreAfter: score, cool, trace, probes, waves };
    }
    // ① 交换（仅相邻合法；非法零副作用）
    if (!areAdjacent(a, b)) {
      return { ok: false, cleared: [], bonus: 0, chain: combo.state.chain, scoreAfter: score, cool, trace, probes, waves };
    }
    record('swap');
    const cells = board.cells.slice();
    const tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp;
    board = { cells, cols: board.cols, rows: board.rows };

    // ② 消除判定 → ③ 计分（含连击加成）→ [判点一] → 重力 → 补手，连锁至稳态
    let appliedBonus = 0;
    let handBonusApplied = 0; // 本手实发连击加成（ac-06 向量裁决值）
    let firstWave = true;
    let afterSettle = false;
    let settleProbed = false;
    let clearedAll           = [];
    for (;;) {
      const matched = findMatches(board);
      record('match');
      if (matched.length === 0) break;
      // 计分（本手首次消除登记连击；加成每手一次）
      let gained = waveGain(matched.length);
      if (firstWave) {
        handBonusApplied = combo.registerClear();
        appliedBonus = handBonusApplied;
        firstWave = false;
      }
      gained += appliedBonus;
      appliedBonus = 0;
      score += gained;
      record('score');
      waves.push({ cleared: matched.length, gained });
      clearedAll = clearedAll.concat(matched);
      // 重力（落定：消除块落地、顶部成 -1 空洞）
      const g = applyGravity(board, matched);
      board = g.board;
      record('gravity');
      if (!settleProbed) {
        // ④ 判点一「落定结算后」：重力落定后、补手前（盘面含消除空洞 -1）——真实时点机判见 ac-07
        afterSettle = probe('after-settle');
        settleProbed = true;
      }
      // 补手
      board = refill(g.board, rng);
      record('refill');
    }
    if (firstWave) {
      // 非消除手：连击归零（ac-06 / numeric.combo.resetOnNonClear）；落定结算后判点照行
      combo.registerNonClear();
      afterSettle = probe('after-settle');
    }
    movesUsed += 1;

    // ④ 判点二「补手后」（ac-07：任一为真即炉冷；探针恒全穷举）
    const afterRefill = probe('after-refill');
    cool = n.deadlock.anyTrueMeansCool ? (afterSettle || afterRefill) : (afterSettle && afterRefill);
    if (cool) {
      status = 'cooled';
    }
    return { ok: true, cleared: clearedAll, bonus: handBonusApplied, chain: combo.state.chain, scoreAfter: score, cool, trace, probes, waves };
  }

  return {
    state,
    swap,
    restart()       {
      rng = seededRng(opts.seed);
      board = createBoard(opts.seed ?? n.DEFAULT_SEED);
      score = 0;
      movesUsed = 0;
      cool = false;
      status = 'playing';
      combo.reset();
      accMs = 0;
      ticks = 0;
    },
    loadBoard(cells          )       {
      board = createBoardFromCells(cells);
    },
    fastForward(ms        )         {
      const clamped = Math.min(ms, n.MAX_DT_MS);
      accMs += clamped;
      while (accMs >= n.FIXED_STEP_MS) {
        accMs -= n.FIXED_STEP_MS;
        ticks += 1;
      }
      return ticks;
    },
    tickCount()         {
      return ticks;
    },
  };
}


//# sourceURL=kernel/sim.ts