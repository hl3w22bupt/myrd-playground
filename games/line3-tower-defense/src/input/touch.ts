// e-input — 触控/指针输入：operationPaths 5 条交互承接（放置/升级/加速/重开/引导消散）
// spec: entities/e-input · first_tap/first_placement_at 事件源 · 占位不写玩法
export const OPERATION_PATH_IDS = [
  "path-place-turret-01",
  "path-upgrade-turret-01",
  "path-speed-toggle-01",
  "path-restart-01",
  "path-guidance-dismiss-01",
] as const;
