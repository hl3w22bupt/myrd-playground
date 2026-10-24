// board.ts — 炉板（e-board · 8×8 · 判定全按 spec numeric 冻结值现读，零硬编码）
//
// spec 口径：
//   grid = { cols, rows, cells }；blockTypes；spawn.orientation = uniform_random（补手等概率取类型）
//   ac-03 仅相邻（上下左右 ≤4 向）交换合法
//   ac-04 三连及以上即消除，L/T 交点只计一次
//   ac-05 消除后重力下落、顶部补手补满
import { seededRng, uniformInt,          } from './rng.mjs';
import { numeric } from '../generated/spec-data.mjs';

                        
                  
               
               
 

                                
               
                 
 

function dims()                                                {
  const n = numeric();
  return { cols: n.grid.cols, rows: n.grid.rows, types: n.blockTypes };
}

/** uniform_random 初始化：seeded RNG 单源逐格取类型 */
export function createBoard(seed        )        {
  const { cols, rows, types } = dims();
  const rng      = seededRng(seed);
  const cells = Array.from({ length: cols * rows }, () => uniformInt(rng, types));
  return { cells, cols, rows };
}

/** 测试注入（契约测试钩子，与 seededRng 同级的确定性测试面） */
export function createBoardFromCells(cells          )        {
  const { cols, rows, types } = dims();
  if (cells.length !== cols * rows) throw new Error(`布盘格数 ${cells.length} ≠ ${cols * rows}`);
  if (cells.some((t) => !Number.isInteger(t) || t < 0 || t >= types)) throw new Error('布盘类型越界');
  return { cells: cells.slice(), cols, rows };
}

/** 上下左右 ≤4 向相邻（ac-03） */
export function areAdjacent(a        , b        )          {
  const { cols, rows } = dims();
  const total = cols * rows;
  if (a < 0 || b < 0 || a >= total || b >= total || a === b) return false;
  const ax = a % cols; const ay = Math.floor(a / cols);
  const bx = b % cols; const by = Math.floor(b / cols);
  const dx = Math.abs(ax - bx); const dy = Math.abs(ay - by);
  return dx + dy === 1;
}

/** 三连及以上判定（行/列双向扫描，L/T 交点天然去重：格去重收集） */
export function findMatches(board       )           {
  const { cols, rows } = dims();
  const matched = new Set        ();
  // 行扫描
  for (let y = 0; y < rows; y += 1) {
    let runStart = 0;
    for (let x = 1; x <= cols; x += 1) {
      const prev = board.cells[y * cols + x - 1];
      const cur = x < cols ? board.cells[y * cols + x] : -1;
      if (cur !== prev) {
        const runLen = x - runStart;
        if (prev >= 0 && runLen >= 3) {
          for (let k = runStart; k < x; k += 1) matched.add(y * cols + k);
        }
        runStart = x;
      }
    }
  }
  // 列扫描
  for (let x = 0; x < cols; x += 1) {
    let runStart = 0;
    for (let y = 1; y <= rows; y += 1) {
      const prev = board.cells[(y - 1) * cols + x];
      const cur = y < rows ? board.cells[y * cols + x] : -1;
      if (cur !== prev) {
        const runLen = y - runStart;
        if (prev >= 0 && runLen >= 3) {
          for (let k = runStart; k < y; k += 1) matched.add(k * cols + x);
        }
        runStart = y;
      }
    }
  }
  return [...matched].sort((a, b) => a - b);
}

/** 重力下落：每列非空块沉底，顶部置 -1 空位（由 refill 补满） */
export function applyGravity(board       , matched          )                {
  const { cols, rows } = dims();
  const cells = board.cells.slice();
  for (const idx of matched) cells[idx] = -1;
  let moved = matched.length > 0;
  for (let x = 0; x < cols; x += 1) {
    let write = rows - 1;
    for (let y = rows - 1; y >= 0; y -= 1) {
      const v = cells[y * cols + x];
      if (v >= 0) {
        if (write !== y) moved = true;
        cells[write * cols + x] = v;
        write -= 1;
      }
    }
    for (let y = write; y >= 0; y -= 1) cells[y * cols + x] = -1;
  }
  return { board: { cells, cols, rows }, moved };
}

/** 顶部补手补满（uniform_random：seeded rng 等概率取类型） */
export function refill(board       , rng     )        {
  const { cols, rows, types } = dims();
  const cells = board.cells.slice();
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i] < 0) cells[i] = uniformInt(rng, types);
  }
  return { cells, cols, rows };
}

/** swap-probe：交换 (a,b) 后是否产生消除（炉冷全穷举/教学提示共用原语） */
export function probeSwapCreatesMatch(board       , a        , b        )          {
  if (!areAdjacent(a, b)) return false;
  const cells = board.cells.slice();
  const tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp;
  return findMatches({ cells, cols: board.cols, rows: board.rows }).length > 0;
}


//# sourceURL=kernel/board.ts