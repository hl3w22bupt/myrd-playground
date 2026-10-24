// platform/theme.ts — 视觉 token 单源（line4-unblock-jam · 风格卡 v1 冻结值）
//
// 单源纪律（spec world.styleDerivation）：调色板 8 色 = 风格卡 v1 冻结值（2026-10-24，
// 单源 .myrd/blackboard/line4-unblock-jam/assets.md §一 ≡ spec numeric.palette，逐字一致）；
// 渲染层只读本 token；色值改动必须走 spec revision，禁止两头各改各的。
export const PALETTE = {
  ground: '#F2EFE6', // 地面底（米白）
  gridLine: '#D9D2C5', // 网格线/障碍（浅灰米）
  ink: '#2B2D42', // UI 主字/描线（墨蓝）
  shadow: '#111111', // 阴影/文字（黑）
  target: '#EF4444', // 目标车/红轮警示（红）
  carWarm: '#F59E0B', // 普通车暖档（橙）
  carCool: '#10B981', // 普通车冷档/成功反馈（绿）
  carAlt: '#3B82F6', // 普通车冷色档/UI 次（蓝）
} as const;

export const PALETTE_HEX_LIST: readonly string[] = Object.values(PALETTE);

// 四要素其余冻结值（风格卡 v1）：光照=无光源平面色块（唯一立体暗示 1 档 12% alpha 投影）
export const SHADOW_ALPHA = 0.12;
export const SHADOW_OFFSET_PX = 2;
// 线条=无描边圆角块：车块 8px / UI·障碍 4px；网格线 1px
export const RADIUS_CAR_PX = 8;
export const RADIUS_UI_PX = 4;
export const GRID_LINE_PX = 1;
// 比例=俯视 2D 正交：车 1×2 格、网格 48px 设计基准、出口门 2 格宽
export const GRID_CELL_PX = 48;
export const CAR_GRID_LEN = 2;
export const EXIT_GATE_CELLS = 2;
