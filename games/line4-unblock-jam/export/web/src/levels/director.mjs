// levels/director.ts — 关卡谱系导演（line4-unblock-jam · spec v0.2 entities[e-level-director]）
//
// spec expect（逐条对齐）：seed→布局参数派生（谱系参数显式 PEND-待校准，不编实测数）+
// 红轮编排（三红轮边界进入/完成/失败的执行者，数值读 numeric 冻结值）。
// 确定性纪律：mulberry32（kernel/loop.ts 判例）——同 seed 派生布局逐字节一致（acc-01 根）。
// 本实体只做派生与编排；布局存储在 entities/lot.ts（只存不生成）。
import { seededRng,          } from '../kernel/loop.mjs';
import { GRID } from '../entities/lot.mjs';
import { car, targetCar,          } from '../entities/car.mjs';
                                              

/** 内置确定性布局模板（v0 骨干 4 帖 · 全部人工验证 1–3 步可解；谱系扩展 PEND-待校准） */
                          
               
                                                                
                                                                
                                                                                                               
                                     
 

const LAYOUTS                   = [
  {
    name: 'warmup-1', par: 4, target: [2, 0],
    cars: [{ orient: 'v', row: 0, col: 3, len: 2, color: 'orange' }],
    obstacles: [[4, 4], [0, 1]],
  },
  {
    name: 'warmup-2', par: 6, target: [2, 1],
    cars: [{ orient: 'v', row: 1, col: 4, len: 3, color: 'green' }, { orient: 'h', row: 4, col: 0, len: 2, color: 'orange' }],
    obstacles: [[5, 3], [0, 0]],
  },
  {
    name: 'standard-1', par: 8, target: [2, 0],
    cars: [
      { orient: 'v', row: 0, col: 2, len: 2, color: 'blue' },
      { orient: 'v', row: 3, col: 4, len: 3, color: 'orange' },
      { orient: 'h', row: 1, col: 3, len: 2, color: 'green' },
    ],
    obstacles: [[5, 1], [0, 5]],
  },
  {
    name: 'red-round-1', par: 5, target: [2, 1],
    cars: [
      { orient: 'v', row: 0, col: 3, len: 2, color: 'orange' },
      { orient: 'h', row: 3, col: 2, len: 3, color: 'blue' },
    ],
    obstacles: [[0, 4], [5, 1]],
  },
];

/** 镜像变换（水平翻转；出口恒右边界，镜像只翻行内位置）：横车 col'=size-len-col · 竖车/障碍 col'=size-1-col */
function mirrorCol(size        , orient           , col        , len        )         {
  return orient === 'h' ? size - col - len : size - 1 - col;
}

/** seed → Lot 派生（确定性：template=seed mod N，variant=rng 镜像布尔） */
export function deriveLot(seed        )                                          {
  const tpl = LAYOUTS[((seed % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length];
  const rng      = seededRng(seed);
  const flip = rng.next() > 0.5; // 变体唯一自由度=水平镜像（保 1–3 步可解结构）
  const t = targetCar(tpl.target[0], flip ? GRID - tpl.target[1] - 2 : tpl.target[1]);
  const cars        = [t];
  for (let i = 0; i < tpl.cars.length; i += 1) {
    const c = tpl.cars[i];
    const col = flip ? mirrorCol(GRID, c.orient, c.col, c.len) : c.col;
    cars.push(car(`car-${i + 1}`, c.orient, c.row, col, c.len, c.color));
  }
  const obstacles = new Set(tpl.obstacles.map(([r, c]) => `${r},${flip ? GRID - 1 - c : c}`));
  return { size: GRID, obstacles, exit: { row: 2, side: 'right' }, cars, template: tpl.name, par: tpl.par };
}

// —— 可滑动解序列（BFS 最少步；acc-01「可滑动解序列」判读根 + 冒烟 bot 复用） ——

                                                                      
                                                                                      

/** 状态键（全部车坐标扁平化；障碍/出口静态不入键） */
function lotKey(lot     )         {
  return lot.cars.map((c) => `${c.id}:${c.row},${c.col}`).sort().join('|');
}

function applyMove(lot     , m           )      {
  const cars = lot.cars.map((c) => (c.id === m.id ? { ...c, row: c.row + m.dRow, col: c.col + m.dCol } : c));
  return { ...lot, cars };
}

/** BFS 最少滑动步求解（6×6 空间有界；同 seed 解序列逐字节一致） */
export function solveLot(lot     )              {
  const t = lot.cars.find((c) => c.color === 'red');
  if (!t) return { solvable: false, steps: -1, moves: [] };
  const done = (l     )          => l.cars.find((c) => c.color === 'red') .col >= l.size; // 车尾越过出口线=整车驶出（spec 口径）
  const queue                                          = [{ lot, moves: [] }];
  const seen = new Set        ([lotKey(lot)]);
  while (queue.length > 0) {
    const cur = queue.shift() ;
    if (done(cur.lot)) return { solvable: true, steps: cur.moves.length, moves: cur.moves };
    if (cur.moves.length >= 24) continue; // 深度帽（防病态布局爆队列；模板均 ≤6 步）
    for (const c of cur.lot.cars) {
      for (const dir of [1, -1]         ) {
        const dRow = c.orient === 'v' ? dir : 0;
        const dCol = c.orient === 'h' ? dir : 0;
        // 逐格试探（1..3 步滑动），落点全空才入队
        for (let k = 1; k <= 3; k += 1) {
          const nr = c.row + dRow * k;
          const nc = c.col + dCol * k;
          if (hasCollisionPath(cur.lot, c, nr, nc)) break;
          const nextLot = applyMove(cur.lot, { id: c.id, dRow: dRow * k, dCol: dCol * k });
          const key = lotKey(nextLot);
          if (seen.has(key)) continue;
          seen.add(key);
          queue.push({ lot: nextLot, moves: [...cur.moves, { id: c.id, dRow: dRow * k, dCol: dCol * k }] });
        }
      }
    }
  }
  return { solvable: false, steps: -1, moves: [] };
}

/** 路径占用检查（滑过中间格须全空；终点越界=可出界（出口面）其它面不可） */
function hasCollisionPath(lot     , c     , nr        , nc        )          {
  const steps = Math.abs(c.orient === 'h' ? nc - c.col : nr - c.row);
  for (let k = 1; k <= steps; k += 1) {
    const r = c.orient === 'v' ? c.row + Math.sign(nr - c.row) * k : c.row;
    const col = c.orient === 'h' ? c.col + Math.sign(nc - c.col) * k : c.col;
    if (col >= lot.size && c.color === 'red' && r === lot.exit.row) return false; // 目标车出界=驶出
    if (r >= lot.size || col >= lot.size || r < 0 || col < 0) return true;
    if (lot.obstacles.has(`${r},${col}`)) return true;
    for (const o of lot.cars) {
      if (o.id === c.id) continue;
      const hit = o.orient === 'h'
        ? r === o.row && col >= o.col && col < o.col + o.len
        : col === o.col && r >= o.row && r < o.row + o.len;
      if (hit) return true;
    }
  }
  return false;
}

// —— 红轮编排（acc-04 三边界执行者 · 数值读 numeric 冻结值） ——

                                                         

                                
                                      
                                  
                                         
                                         
                                                          
                                       
                                                            
 

/** 三红轮边界唯一裁判（数值只读 spec.numeric，禁本文件写死第二份）
 *  语义依 approved spec 写死面：level-2/el-red-clear「redRoundStepBudget 内驶出即红轮通关」、
 *  level-2/el-red-fail「红轮步数超预算即 level.fail」——驶出不豁免超预算（2026-10-25 驳回项1 勘误，
 *  删除旧「驶出即完成（预算只影响评价面）」分支：该分支违背 spec 原文）。 */
export function planRedRound(i               )                                                                             {
  if (i.exited && i.redMoves <= i.budget) return { verdict: 'clear', shouldDowngrade: false, nextStreak: 0 };
  const nextStreak = i.failStreak + 1;
  return { verdict: 'fail', shouldDowngrade: nextStreak >= i.downgrade, nextStreak };    // 超预算（驶出亦不豁免）或未驶出 = fail + 连败计数
}

/** 红轮进入边界（进入谓词独立成函数，acc-04 机判逐条过） */
export function shouldEnterRedRound(prevMoves        , par        )          {
  return prevMoves <= par;
}
