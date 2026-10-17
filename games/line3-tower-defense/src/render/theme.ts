// 风格卡 v1 token 单源（.myrd/blackboard/line3-tower-defense/assets.md · 2026-10-17 美术锁定）
// spec: numeric.palette.whitelist —— 渲染层只读本文件，src 零裸 hex（ac-art-1/ac-art-3）
export const PALETTE = {
  bgDeep: "#202A38",
  field: "#2F4156",
  pathSand: "#E9D8A6",
  gridLine: "#47617C",
  coreCoral: "#E76F51",
  enemyBerry: "#B75D69",
  turretGreen: "#81B29A",
  textCream: "#F4F1DE",
} as const;
// 派生规则（唯一允许的色值生成方式，新增色相=违例）
export const DERIVE = {
  turretLevelMix: [0, 0.2, 0.4], // Lv1..3 = turret-green × text-cream 混合比
  enemyHpMix: [0, 0.3], // 满血/残血 = enemy-berry × bg-deep
  flashMixWith: "#F4F1DE", // hitFlash 混白锚
  flashMs: 90,
} as const;
export const STROKE = { widthPx: 2, radiusPx: 4 };
export const PATH_ARROW = { widthPx: 4, dash: true, alpha: 0.6 };
export const SCALE = { cellPx: 32, cols: 20, rows: 12, turretPx: [24, 26, 28], enemyPx: { grunt: 16, runner: 14, brute: 20 }, coreCells: 2, uiPadPx: 16 };
