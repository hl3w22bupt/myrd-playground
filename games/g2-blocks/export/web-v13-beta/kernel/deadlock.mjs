// deadlock.ts — 炉冷判定器（e-deadlock · ac-07 全穷举 swap-probe）
//
// spec 口径（numeric.deadlock 冻结块）：
//   algorithm = exhaustive_swap_probe：对每格 ≤4 个相邻方向做 swap-probe，任一可成三消即存在手，
//   全部不可成才判炉冷（isDeadlocked 不提前退出，探针数恒 = grid.cells × directionsMax）
//   checkAfterSettle + checkAfterRefill 双判，anyTrueMeansCool（sim 结算流水落实）
import { probeSwapCreatesMatch,            } from './board.mjs';
import { numeric } from '../generated/spec-data.mjs';

                               
            
            
 

const DIRS                          = [[1, 0], [-1, 0], [0, 1], [0, -1]];

                      
                            
                 
 

function scan(board       , mode                        , trace           )             {
  const { cols, rows } = numeric().grid;
  const dirs = DIRS.slice(0, numeric().deadlock.directionsMax);
  let probes = 0;
  let move                      = null;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const a = y * cols + x;
      for (const [dx, dy] of dirs) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        probes += 1;
        if (trace) trace.push('probe');
        if (probeSwapCreatesMatch(board, a, b(nx, ny, cols))) {
          move = { a, b: b(nx, ny, cols) };
          if (mode === 'first') return { move, probes };
        }
      }
    }
  }
  return { move, probes };
}

function b(x        , y        , cols        )         { return y * cols + x; }

/** 炉冷判定：全穷举（不短路），无任何可成手 → true */
export function isDeadlocked(board       , trace           )          {
  return scan(board, 'exhaustive', trace).move === null;
}

/** 可行手检索（教学提示用）：命中即返（与炉冷判定共用探针原语，语义同 spec） */
export function findAnyMove(board       )                      {
  return scan(board, 'first').move;
}


//# sourceURL=kernel/deadlock.ts