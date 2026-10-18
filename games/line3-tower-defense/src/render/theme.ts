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

// —— 派生色函数（唯一允许的色值生成方式：白名单两色按常量比例混合；新增色相=违例）——
// spec: numeric.palette.deriveRule · ac-art-1 派生规则声明面

/** 十六进制 → [r,g,b]（输入必须为本文件白名单 token 值；大小写规范化大写） */
function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 两色按 t 比例混合（t=0 → a；t=1 → b），输出大写 #RRGGBB */
export function mixHex(a: string, b: string, t: number): string {
  const ca = toRgb(a), cb = toRgb(b);
  const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t).toString(16).padStart(2, "0").toUpperCase();
  return "#" + ch(0) + ch(1) + ch(2);
}

/** 炮塔三阶色（Lv1..3 = turret-green × text-cream 0/20/40%） */
export function turretColor(level: number): string {
  const t = DERIVE.turretLevelMix[Math.min(DERIVE.turretLevelMix.length, Math.max(1, level)) - 1];
  return mixHex(PALETTE.turretGreen, PALETTE.textCream, t);
}

/** 敌血带色（满血/残血 = enemy-berry × bg-deep 0/30%） */
export function enemyHpColor(ratio: number): string {
  const t = ratio > 0.5 ? DERIVE.enemyHpMix[0] : DERIVE.enemyHpMix[1];
  return mixHex(PALETTE.enemyBerry, PALETTE.bgDeep, t);
}

/** 命中反馈混白（hitFlash 进度 → 目标本色与 text-cream 混合） */
export function flashMix(base: string, progress: number): string {
  return mixHex(base, DERIVE.flashMixWith, Math.max(0, Math.min(1, progress)));
}

/** HUD 文案字号（风格卡④：HUD 16px / 面板 12px） */
export const FONT = { hud: 16, panel: 12 } as const;

/** 逻辑面尺寸（战场 640×384；view/输入换算统一出口） */
export const FIELD_W = SCALE.cols * SCALE.cellPx;
export const FIELD_H = SCALE.rows * SCALE.cellPx;
