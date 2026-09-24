// index.mjs — 工程资产层注册表：spec.assets[] 声明的资产 id → 落点/生成器/接线点，统一在此登记。
//
// 职责：
//   ① 资产台账：文件名与 spec 资产 id 对应（a01-textures / a02-geometry / a03-sfx），程序按编号接资产；
//   ② safe()：所有资产引用的统一降级入口 —— 引用失败不得破坏运行，退回「既有程序化绘制」兜底；
//   ③ 不持有任何二进制：本工程零外部资源（风格卡红线），资产 = 运行时程序化生成的模块。

import { PALETTE } from "./palette.mjs";

/** 资产台账（与 .myrd/spec/design-spec.json 的 assets 段、黑板 assets.md 清单一一对应） */
export const ASSET_TABLE = [
  {
    id: "a01-textures", kind: "image", entry: "./a01-textures.mjs",
    spec: "games/transport-ship-3d/src/render/textures.js",
    wiring: ["src/render/map.js（甲板/舷墙/集装箱/停机坪/海面）", "src/render/geometry.js（迷彩）"],
    items: ["甲板防滑纹", "舰体金属", "集装箱波纹×2 色", "迷彩", "海面", "停机坪 H 标线"],
  },
  {
    id: "a02-geometry", kind: "model", entry: "./a02-geometry.mjs",
    spec: "games/transport-ship-3d/src/render/geometry.js",
    wiring: ["src/render/player.js（枪模）", "src/render/enemy.js（人形）", "src/render/map.js（舰桥/集装箱/围栏拼装）"],
    items: ["圆角盒工厂", "枪模", "人形", "围栏"],
  },
  {
    id: "a03-sfx", kind: "sfx", entry: "./a03-sfx.mjs",
    spec: "games/transport-ship-3d/src/render/audio.js",
    wiring: ["src/render/audio.js（事件 → 音色参数表）"],
    items: ["射击", "命中", "爆头", "换弹", "受伤", "波次开始", "击杀"],
  },
  {
    id: "a04-style-card", kind: "doc", entry: "./palette.mjs",
    spec: ".myrd/blackboard/assets.md",
    wiring: ["全部资产消费方（调色板/光照/线条/比例四要素唯一真源）"],
    items: ["调色板", "光照", "线条", "比例"],
  },
];

/** 资产安全引用：生成失败 → 降级 fallback（既有程序化绘制/平色材质/静音），绝不抛出到渲染主流程。 */
export function safe(label, make, fallback) {
  try {
    const v = make();
    if (v === undefined || v === null) throw new Error("生成器返回空值");
    return v;
  } catch (err) {
    // 一次性告警：资产降级是可玩但劣化，必须让美术/在控制台看见，但不中断游戏
    if (!safe._warned) safe._warned = new Set();
    if (!safe._warned.has(label)) {
      safe._warned.add(label);
      console.warn(`[assets] ${label} 生成失败，降级 fallback：${err?.message ?? err}`);
    }
    try { return fallback(); } catch (err2) {
      console.warn(`[assets] ${label} fallback 也失败：${err2?.message ?? err2}`);
      return null;
    }
  }
}

/** 风格卡只读访问（消费方禁止解构后另存副本 —— 取色必须每次走 PALETTE，避免局部漂移） */
export function styleCard() { return PALETTE; }

/** 台账查询（供审计/调试：window.__game.assets 可读） */
export function assetManifest() {
  return ASSET_TABLE.map((a) => ({ id: a.id, kind: a.kind, spec: a.spec, wiring: a.wiring, items: a.items }));
}
