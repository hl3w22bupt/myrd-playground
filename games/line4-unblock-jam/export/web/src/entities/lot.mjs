// entities/lot.ts — 场地网格（line4-unblock-jam · spec v0.2 entities[e-lot]）
//
// spec expect（逐条对齐）：场地网格：布局矩阵 + 障碍位 + 出口开口位；
// 布局由谱系导演按 seed 派生，本实体只存不生成（零生成逻辑，生成在 levels/director.ts）。
// 确定性纪律：零 Math.random / 零 Date.now（kernel/loop.ts 判例）。
                                    

export const GRID = 6; // 6×6 网格（挪车判例基准 · 出口在右边界）

                           
                      
              
                              
                
 

                      
                    
               
                                
                                 
             
                 
                   
                       
 

export const cellKey = (row        , col        )         => `${row},${col}`;

/** 占位矩阵：每格 → 车 id | 'obstacle' | null（渲染与碰撞共用，只读） */
export function occupancy(lot     )                      {
  const grid                      = Array.from({ length: lot.size }, () => Array(lot.size).fill(null));
  for (const r of lot.obstacles) {
    const [row, col] = r.split(',').map(Number);
    grid[row][col] = 'obstacle';
  }
  for (const car of lot.cars) {
    for (let i = 0; i < car.len; i += 1) {
      const row = car.orient === 'h' ? car.row : car.row + i;
      const col = car.orient === 'h' ? car.col + i : car.col;
      grid[row][col] = car.id;
    }
  }
  return grid;
}

/** 目标车查找（v0 冻结：唯一红色横放目标车） */
export function targetCar(lot     )      {
  const t = lot.cars.find((c) => c.color === 'red');
  if (!t) throw new Error('lot: 目标车（red）缺失——布局非法');
  return t;
}

/** 越界/碰撞检测（滑动轴合法性由 car.ts 断言，此处只查终态占用） */
export function hasCollision(lot     , row        , col        , len        , orient           , ignoreId        )          {
  for (let i = 0; i < len; i += 1) {
    const r = orient === 'h' ? row : row + i;
    const c = orient === 'h' ? col + i : col;
    if (r < 0 || c < 0 || r >= lot.size || c >= lot.size) return true;
    if (lot.obstacles.has(cellKey(r, c))) return true;
    const hit = lot.cars.find((x) => x.id !== ignoreId && x.orient === 'h'
      ? r === x.row && c >= x.col && c < x.col + x.len
      : false);
    if (hit) return true;
    const hitV = lot.cars.find((x) => x.id !== ignoreId && x.orient === 'v'
      ? c === x.col && r >= x.row && r < x.row + x.len
      : false);
    if (hitV) return true;
  }
  return false;
}
