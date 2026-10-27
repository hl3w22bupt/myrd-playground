// e-input — 触控/指针输入：operationPaths 5 条交互承接（放置/升级/加速/重开/引导消散）
// spec: entities/e-input · first_tap/first_placement_at 事件源
// 输入面 = 逻辑像素坐标（视图换算在 scene 层）→ 语义动作（Game 层执行）。

import type { SimState, } from "../kernel/state.ts";
import type { GameConfig } from "../kernel/config.ts";
import { isBuildable } from "../world/grid.ts";
import { SCALE } from "../render/theme.ts";

export const OPERATION_PATH_IDS = [
  "path-place-turret-01",
  "path-upgrade-turret-01",
  "path-speed-toggle-01",
  "path-restart-01",
  "path-guidance-dismiss-01",
] as const;
export type OperationPathId = (typeof OPERATION_PATH_IDS)[number];

/** 语义动作（headless 与真指针同构——a6 五条路径机判入口） */
export type PointerAction =
  | { kind: "start" }
  | { kind: "tile"; col: number; row: number }
  | { kind: "confirm-place" }
  | { kind: "select-turret"; turretId: number }
  | { kind: "confirm-upgrade" }
  | { kind: "speed-toggle" }
  | { kind: "restart" }
  | { kind: "none" };

export const FIELD_W = SCALE.cols * SCALE.cellPx;
export const FIELD_H = SCALE.rows * SCALE.cellPx;

function inRect(x: number, y: number, x0: number, y0: number, w: number, h: number): boolean {
  return x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h;
}

/** 标题屏命中：开始按钮（中央 144×40） */
export function titleHit(x: number, y: number): PointerAction {
  if (inRect(x, y, FIELD_W / 2 - 72, FIELD_H / 2 + 40, 144, 40)) return { kind: "start" };
  return { kind: "none" };
}

/** 结算屏命中：再来一局按钮 */
export function settlementHit(x: number, y: number): PointerAction {
  if (inRect(x, y, FIELD_W / 2 - 72, FIELD_H / 2 + 24, 144, 40)) return { kind: "restart" };
  return { kind: "none" };
}

/** 运行屏命中解析（UI 状态由 Game 层持有；此处只读判别） */
export function resolvePointer(
  state: SimState,
  cfg: GameConfig,
  x: number,
  y: number,
  ui: { pendingTile: string | null; selectedTurretId: number | null },
): PointerAction {
  // ① HUD 加速按钮（右上 72×28）
  if (inRect(x, y, FIELD_W - 88, 8, 72, 28)) return { kind: "speed-toggle" };
  // ② 底部确认菜单（放置/升级二步确认）
  if (ui.pendingTile && inRect(x, y, FIELD_W / 2 - 90, FIELD_H - 56, 180, 40)) return { kind: "confirm-place" };
  if (ui.selectedTurretId !== null && inRect(x, y, FIELD_W / 2 - 90, FIELD_H - 56, 180, 40)) return { kind: "confirm-upgrade" };
  // ③ 已建炮塔点选
  const col = Math.floor(x / SCALE.cellPx), row = Math.floor(y / SCALE.cellPx);
  const t = state.turrets.find((tt) => tt.col === col && tt.row === row);
  if (t) return { kind: "select-turret", turretId: t.id };
  // ④ 空布防格点选（禁建格=路径+核心+已占 → none）
  if (isBuildable(col, row, new Set(state.occupied))) return { kind: "tile", col, row };
  return { kind: "none" };
}
