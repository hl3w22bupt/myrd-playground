// products.js — 选品目录（M1 内核与渲染共享的同一份真源，替代模板 level-01 的关卡布局职责）。
// P0「兼职试水」阶段单位经济恒为 ¥15/单（spec.stageCurve P0：unitEconomics "¥15/单"），
// 商品之间只差需求节奏（选品即「接多少需求量」的决策），不新增价格/成本参数 —— 防止绕开 M0 锚 #1。
// 需求基数：循环 A 手算 30 单/日 workload 保留为公式层基线；调参 v1（spec.tune.demandBand，验收 §2-T1
// 候选3）把实装带宽对齐资本带宽 S*≈5 件/日（T+14 资金占用 14×40S 的增长天花板）：合计 11/日 ≈ 原 32/日 ×1/3，
// 消除「日均错失 ~25 件」的数字噪音与 18 天零出单死窗。
export const PRODUCTS = Object.freeze([
  {
    id: "led-light",
    name: "LED 氛围灯带",
    tag: "爆款潜力 · 需求最猛",
    baseDemand: 5,
    icon: "led",       // 渲染层 SVG 图标键（禁 emoji）
  },
  {
    id: "pet-feeder",
    name: "宠物自动喂食器",
    tag: "稳定出单",
    baseDemand: 3,
    icon: "pet",
  },
  {
    id: "yoga-band",
    name: "瑜伽弹力带",
    tag: "长尾匀速",
    baseDemand: 2,
    icon: "yoga",
  },
  {
    id: "phone-stand",
    name: "手机懒人支架",
    tag: "垫场小单",
    baseDemand: 1,
    icon: "stand",
  },
]);

export const PRODUCT_BY_ID = Object.freeze(
  Object.fromEntries(PRODUCTS.map((p) => [p.id, p])),
);
