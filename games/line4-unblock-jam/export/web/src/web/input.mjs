// web/input.ts — 可玩面指针输入（line4-unblock-jam · 表现层）
//
// 交互契约：滑动轴二值（entities/car.ts isAxisAligned 唯一实现）——横车只左右、纵车只上下；
// 拖拽中=pending（kernel/session 零计数语义由模型层落定通道承担），松手落定或回弹。
import { occupancy,          } from '../entities/lot.mjs';
import { isAxisAligned } from '../entities/car.mjs';
                                        

                            
                       
                                    
                                   
                                      
                         
 

export function createDrag()            { return { carId: null, startPx: { x: 0, y: 0 }, lastPx: { x: 0, y: 0 }, axis: null }; }

/** px → 格坐标（含视口原点/缩放；出界返回 null） */
export function cellAt(px        , py        , lot     , view      )                                      {
  const s = 48 * view.scale;
  const col = Math.floor((px - view.ox) / s), row = Math.floor((py - view.oy) / s);
  if (row < 0 || col < 0 || row >= lot.size || col >= lot.size) return null;
  return { row, col };
}

/** 按下选车：命中格必须是某车的占格（障碍/空格不选） */
export function pickCar(d           , lot     , px        , py        , view      )                {
  const cell = cellAt(px, py, lot, view);
  if (!cell) return null;
  const grid = occupancy(lot);
  const id = grid[cell.row][cell.col];
  if (!id || id === 'obstacle') return null;
  d.carId = id;
  d.startPx = { x: px, y: py };
  d.lastPx = { x: px, y: py };
  d.axis = null;
  return id;
}

/** 拖动中：锁定轴后把位移折算成格数（横车→dCol，纵车→dRow） */
export function dragDelta(d           , lot     , px        , py        , view      )         {
  if (!d.carId) return 0;
  const car = lot.cars.find((c) => c.id === d.carId);
  if (!car) return 0;
  d.lastPx = { x: px, y: py };
  const dx = px - d.startPx.x, dy = py - d.startPx.y;
  const s = 48 * view.scale;
  const DEAD = 8;
  if (!d.axis) {
    if (Math.abs(dx) > DEAD && isAxisAligned(car, 0, Math.sign(dx))) d.axis = 'h';
    else if (Math.abs(dy) > DEAD && isAxisAligned(car, Math.sign(dy), 0)) d.axis = 'v';
    else return 0;
  }
  if (d.axis !== car.orient) return 0; // 轴锁死后反向轴零输入（isAxisAligned 二次断言）
  return Math.round((car.orient === 'h' ? dx : dy) / s);
}

/** 松手：返回落定格数并清空拖拽态（dCells 由模型层 applyDrag 试探裁决落定/回弹） */
export function releaseDrag(d           , lot     , scale        )                                           {
  if (!d.carId) return null;
  const car = lot.cars.find((c) => c.id === d.carId);
  if (!car) { d.carId = null; return null; }
  const dx = d.lastPx.x - d.startPx.x, dy = d.lastPx.y - d.startPx.y;
  const s = 48 * scale;
  const dCells = car.orient === 'h' ? Math.round(dx / s) : Math.round(dy / s);
  const id = d.carId;
  d.carId = null; d.axis = null;
  return { carId: id, dCells };
}
