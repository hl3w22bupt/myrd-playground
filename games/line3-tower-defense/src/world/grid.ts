// grid.ts — e-grid：20×12 布防网格 + 敌军路径 + 禁建面（路径格+核心 2×2）· 布局单源
// spec: entities/e-grid · world.sceneSpec（20×12 格战场 640×384 逻辑面 · 1 条敌军路径 ·
//       核心据点 2×2 格 · 网格化布防位禁建区=路径格+核心 2×2）
// 渲染层坐标全以「逻辑像素 = 格 32px」为基准（theme.SCALE），本文件是格子/路径唯一事实。

export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const CELL_PX = 32;
export const FIELD_W = GRID_COLS * CELL_PX; // 640
export const FIELD_H = GRID_ROWS * CELL_PX; // 384

/** 敌军路径折点（格坐标 col,row；起点 col=-1=场外入场）→ 终点=核心入口 */
export const PATH_WAYPOINTS: Array<[number, number]> = [
  [-1, 6], [4, 6], [4, 2], [9, 2], [9, 9], [14, 9], [14, 5], [17, 5],
];

/** 核心据点 2×2（格坐标）——路径末格 (17,5) 即核心入口 */
export const CORE_TILES: Array<[number, number]> = [[17, 5], [18, 5], [17, 6], [18, 6]];

/** 路径折点 → 逻辑像素坐标（格中心） */
export function waypointPx(col: number, row: number): { x: number; y: number } {
  return { x: (col + 0.5) * CELL_PX, y: (row + 0.5) * CELL_PX };
}

/** 路径分段（像素折线）+ 累计长度表——敌军以 pathDistPx 推进，查表得像素位（零浮点漂移面：单次线性插值） */
export const PATH_SEGMENTS = PATH_WAYPOINTS.slice(1).map((p, i) => {
  const a = waypointPx(PATH_WAYPOINTS[i][0], PATH_WAYPOINTS[i][1]);
  const b = waypointPx(p[0], p[1]);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { a, b, len };
});
export const PATH_TOTAL_PX = PATH_SEGMENTS.reduce((s, seg) => s + seg.len, 0);

/** pathDistPx → 像素坐标（顺序查累计长度，确定性） */
export function pointAt(distPx: number): { x: number; y: number } {
  let d = distPx;
  for (const seg of PATH_SEGMENTS) {
    if (d <= seg.len) {
      const t = seg.len === 0 ? 0 : d / seg.len;
      return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
    }
    d -= seg.len;
  }
  const last = PATH_SEGMENTS[PATH_SEGMENTS.length - 1];
  return { x: last.b.x, y: last.b.y };
}

/** 路径格集合（含场外入场列的可见段；col<0 不入集合） */
export const PATH_TILES: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (let i = 1; i < PATH_WAYPOINTS.length; i += 1) {
    const [c0, r0] = PATH_WAYPOINTS[i - 1];
    const [c1, r1] = PATH_WAYPOINTS[i];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    for (;;) {
      if (c >= 0) s.add(`${c},${r}`);
      if (c === c1 && r === r1) break;
      c += dc; r += dr;
    }
  }
  return s;
})();

export const CORE_TILE_KEYS: ReadonlySet<string> = new Set(CORE_TILES.map(([c, r]) => `${c},${r}`));

/** 布防合法性：界内 ∧ 非路径格 ∧ 非核心格 ∧ 未占用（占用状态机由 sim 持有） */
export function isBuildable(col: number, row: number, occupied: ReadonlySet<string>): boolean {
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return false;
  const k = `${col},${row}`;
  return !PATH_TILES.has(k) && !CORE_TILE_KEYS.has(k) && !occupied.has(k);
}

/** 自动布防参考位（契约 harness 用；静态有序表=确定性；全部可建——inv 自检见 a1/a2 helpers） */
export const AUTO_BUILD_SPOTS: Array<[number, number]> = [
  [5, 4], [8, 3], [10, 4], [13, 8], [13, 4], [8, 8],
  [11, 7], [15, 6], [3, 7], [6, 7], [12, 3], [16, 7],
];

/** 自检：AUTO_BUILD_SPOTS 全部落在可建面（布局改动时首道闸） */
export function assertAutoSpotsBuildable(): void {
  for (const [c, r] of AUTO_BUILD_SPOTS) {
    if (!isBuildable(c, r, new Set())) {
      throw new Error(`AUTO_BUILD_SPOTS 含禁建格: (${c},${r})——布局单源 grid.ts 与参考位表失配`);
    }
  }
}

/** 格中心像素（布防/索敌距离计算共用） */
export function tileCenter(col: number, row: number): { x: number; y: number } {
  return waypointPx(col, row);
}

/** 射程圈半径像素（turret.rangeTilesBase × 32；等级加成在 sim 侧公式） */
export function rangePx(rangeTiles: number): number {
  return rangeTiles * CELL_PX;
}
