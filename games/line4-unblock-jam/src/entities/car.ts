// entities/car.ts — 车辆实体（line4-unblock-jam · spec v0.2 entities[e-car]）
//
// spec expect（逐条对齐）：朝向（横/纵二值）+ 占格（1×2 或 1×3）+ 滑动轴（仅沿朝向轴拖动）；
// 目标车固定红色档 #EF4444、普通车橙/绿/蓝三档（palette 单源=src/platform/theme.ts ≡ 风格卡 v1）。
// 拖动只产生「沿朝向轴」的候选位移；合法性判定与落定计数走 kernel/session.ts 控名人。
export type Orient = 'h' | 'v';
export type CarColor = 'red' | 'orange' | 'green' | 'blue';

export interface Car {
  id: string;
  orient: Orient;
  row: number;
  col: number;
  len: 2 | 3;
  color: CarColor;
}

/** 目标车构造（v0 冻结：横放红色，spec palette #EF4444） */
export function targetCar(row: number, col: number, len: 2 | 3 = 2): Car {
  return { id: 'car-target', orient: 'h', row, col, len, color: 'red' };
}

/** 普通车构造 */
export function car(id: string, orient: Orient, row: number, col: number, len: 2 | 3, color: Exclude<CarColor, 'red'>): Car {
  return { id, orient, row, col, len, color };
}

/** 滑动轴断言：拖动向量必须与朝向轴平行（spec「仅沿朝向轴拖动」）——横车只走列，纵车只走行 */
export function isAxisAligned(c: Car, dRow: number, dCol: number): boolean {
  if (c.orient === 'h') return dRow === 0 && dCol !== 0;
  return dCol === 0 && dRow !== 0;
}

/** 单步滑动候选（+1/-1 沿朝向轴）；越界/碰撞判定在 lot.hasCollision */
export function slideStep(c: Car, dir: 1 | -1): { row: number; col: number } {
  return c.orient === 'h' ? { row: c.row, col: c.col + dir } : { row: c.row + dir, col: c.col };
}

/** 应用位移（纯函数，返回新车；调用方负责先过 hasCollision + settleMove 控名人） */
export function moved(c: Car, dRow: number, dCol: number): Car {
  if (!isAxisAligned(c, dRow, dCol)) throw new Error(`car:${c.id} 非法拖动方向（违背滑动轴）`);
  return { ...c, row: c.row + dRow, col: c.col + dCol };
}
