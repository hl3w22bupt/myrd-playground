// a01-textures.mjs — 资产条目 a01（image）：贴图资产的登记/引用入口。
//   生成器本体在 spec 声明落点 src/render/textures.js（既有程序化绘制，保留为 fallback 底座）；
//   本文件负责：资产 id 命名 + 参数（颜色/文案全部取自风格卡）+ 引用失败降级平色贴图。

import * as THREE from "three";
import { safe, styleCard } from "./index.mjs";
import { cssHex } from "./palette.mjs";
import { deckPlate, hullPlate, containerWall, camo, helipadMark, sea } from "../src/render/textures.js";

const P = styleCard();

/** 兜底绘制：纯色 + 颗粒（生成器挂了也保有材质感，不出现白块） */
function flatTexture(hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = cssHex(hex);
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 贴图资产表：id → { label, make, fallbackHex }（接线点见 assets/index.mjs ASSET_TABLE） */
export const TEXTURE_ASSETS = {
  "a01/deck-plate": { label: "甲板防滑纹", make: () => deckPlate(), fallbackHex: P.hull.shadow },
  "a01/hull-plate": { label: "舰体金属板", make: () => hullPlate(), fallbackHex: P.hull.plate },
  "a01/container-green": { label: "集装箱波纹 · 军绿", make: () => containerWall(cssHex(P.container.green), "CSCL-0417"), fallbackHex: P.container.green },
  "a01/container-tan": { label: "集装箱波纹 · 土黄", make: () => containerWall(cssHex(P.container.tan), "HYUNDAI-1108"), fallbackHex: P.container.tan },
  "a01/camo": { label: "敌兵迷彩", make: () => camo(), fallbackHex: P.soldier.camoBase },
  "a01/helipad-mark": { label: "停机坪 H 标线", make: () => helipadMark(), fallbackHex: P.hull.deep },
  "a01/sea": { label: "海面波光", make: () => sea(), fallbackHex: P.sea.base },
};

/** 资产引用入口：map/geometry 一律走这里取贴图（自带降级，不破坏运行） */
export function gameTexture(id) {
  const a = TEXTURE_ASSETS[id];
  if (!a) throw new Error(`未知贴图资产 id: ${id}`);
  return safe(`a01:${id}`, a.make, () => flatTexture(a.fallbackHex));
}

/** 便捷口径：按关卡掩体 id 取集装箱贴图（军绿群 A / 土黄群 B） */
export function containerTexture(coverId) {
  return gameTexture(coverId.includes("container-b") ? "a01/container-tan" : "a01/container-green");
}
