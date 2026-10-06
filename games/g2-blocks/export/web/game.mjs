// game.ts — 游戏层（无 DOM，可无头契约测试）：sim + 音频同帧接线 + 教学提示 + 关卡目标
//
// ac-15：消除命中 → 音效调用与反馈完成同帧发起（本文件在 sim.swap 返回的同一调用栈内同步接线）；
//        音频缺失不阻塞玩法（audio 缺位走空实现）。
// ac-11/level-1 el-hint：教学提示只在含 kind=hint 元素的关卡出现，完成首次三消或 N 手后不再出现
//        （N 从 spec levels[].elements[].expect 文本现读，零硬编码）。
// 关卡目标（goals）从 spec levels[].goal 文本现读；movesLeft 显示面 = 手数上限 − 已用（无上限关卡为 null）。
import { createSim,                                          } from './kernel/sim.mjs';
import { findAnyMove,                   } from './kernel/deadlock.mjs';
import { numeric, LEVELS } from './generated/spec-data.mjs';

                            
                             
                             
               
                  
 

                           
                      
                       
 

                             
                                       
                            
                             
                         
 

                       
                           
                                         
                                   
                  
                              
                           
                      
                                                       
                             
                    
 

const noopAudio            = { clear() {}, combo() {}, cool() {}, restart() {} };
const noopPerf           = { settleStart() {}, feedbackDone() {} };

export function createGame(opts                                                                          = {})       {
  const levels = LEVELS;
  const levelId = opts.levelId ?? levels[0].id;
  const level = levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`spec levels 缺 ${levelId}`);

  const sim = createSim({ seed: opts.seed });
  const audio = opts.audio ?? noopAudio;
  const perf = opts.perf ?? noopPerf;

  // 教学提示：仅含 kind=hint 元素的关卡；上限手数从 expect 文本现读（find 无匹配归一为 null，防 undefined ≠ null 误判）
  const hintElement = (level.elements || []).find((e) => e.kind === 'hint') ?? null;
  const hintLimit = hintElement ? hintMovesLimit(hintElement.expect) : null;
  let firstClearDone = false;

  function hintMovesLimit(text        )                {
    const m = /或\s*(\d+)\s*手后不再出现/.exec(text || '');
    return m ? Number(m[1]) : null;
  }

  return {
    state: sim.state,
    swap(a        , b        )             {
      const r = sim.swap(a, b);
      if (r.ok && r.cleared.length > 0) {
        if (!firstClearDone) firstClearDone = true;
        // 反馈完成点 = 手结算完成（同一调用栈）；消除音与反馈同帧发起（ac-15）
        audio.clear(r.chain);
        if (r.chain >= numeric().combo.appliesFromChain) audio.combo(r.chain);
      }
      if (r.ok && r.cool) audio.cool();
      return r;
    },
    loadBoard(cells          )       { sim.loadBoard(cells); },
    restart()       {
      sim.restart();
      firstClearDone = false;
      audio.restart();
    },
    hint()                      {
      if (!hintElement) return null;
      if (firstClearDone) return null;
      if (hintLimit !== null && sim.state.movesUsed >= hintLimit) return null;
      return findAnyMove({ cells: sim.state.board, cols: numeric().grid.cols, rows: numeric().grid.rows });
    },
    hintAvailable()          {
      return hintElement !== null && !firstClearDone && (hintLimit === null || sim.state.movesUsed < hintLimit);
    },
    goals()             {
      return parseGoals(level.goal || '');
    },
    goalEval() {
      const g = this.goals();
      const reasons           = [];
      let achieved = true;
      if (g.firstClearWithinMoves !== null) {
        reasons.push(`首消窗口 ${g.firstClearWithinMoves} 手（提示面完成即达成）`);
      }
      if (g.movesLimit !== null) {
        const ok = sim.state.movesUsed <= g.movesLimit;
        achieved = achieved && ok;
        reasons.push(`手数 ${sim.state.movesUsed}/${g.movesLimit} ${ok ? '✓' : '✗'}`);
      }
      if (g.chainTarget !== null) {
        reasons.push(`连击目标 ≥${g.chainTarget}（存活至炉冷后裁决）`);
      }
      return { achieved, reasons };
    },
    movesLeft()                {
      const g = parseGoals(level.goal || '');
      return g.movesLimit === null ? null : Math.max(0, g.movesLimit - sim.state.movesUsed);
    },
    levelId()         { return levelId; },
  };
}

/** 关卡目标文本 → 结构化目标（全部现读自 spec，正则只做提取不做造值） */
export function parseGoals(text        )             {
  const firstClear = /(\d+)\s*步内完成首次三消/.exec(text);
  const movesChain = /(\d+)\s*手内打出\s*≥?\s*(\d+)\s*连击并存活到炉冷/.exec(text);
  return {
    firstClearWithinMoves: firstClear ? Number(firstClear[1]) : null,
    movesLimit: movesChain ? Number(movesChain[1]) : null,
    chainTarget: movesChain ? Number(movesChain[2]) : null,
    surviveToCool: movesChain !== null,
  };
}


//# sourceURL=game.ts