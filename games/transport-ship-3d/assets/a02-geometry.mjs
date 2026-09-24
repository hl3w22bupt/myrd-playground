// a02-geometry.mjs — 资产条目 a02（model）：几何资产的登记/引用入口。
//   拼装器本体在 spec 声明落点 src/render/geometry.js（圆角盒工厂 + 枪模/人形，保留为 fallback 底座）；
//   本文件负责：资产 id 命名 + 引用失败降级同形兜底体（保持 parts 动画接口，不破坏运行）。
//   注：舰桥/集装箱/围栏属 e-ship-map 的布景拼装（spec 实体 role 声明在 src/render/map.js）。

import * as THREE from "three";
import { safe, styleCard } from "./index.mjs";
import { buildRifle, buildSoldier } from "../src/render/geometry.js";

const P = styleCard();

function box(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15 }),
  );
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** 兜底枪模：单根圆管体块（枪口朝 -z，原点在握把，与正式枪模同口径） */
function fallbackRifle() {
  const g = new THREE.Group();
  g.add(box(0.09, 0.10, 0.62, P.rifle.dark));
  const cal = P.scale.rifle.caliber;
  const barrel = box(cal, cal, 0.30, P.rifle.mid);
  barrel.position.set(0, 0.015, -0.75);
  g.add(barrel);
  return g;
}

/** 兜底人形：单盒 + parts 指向同一网格（enemy.js 的摆动/闪白接口照常工作） */
function fallbackSoldier() {
  const g = new THREE.Group();
  const body = box(0.5, 1.7, 0.3, P.soldier.camoBase);
  body.position.y = 0.85;
  g.add(body);
  const head = box(P.soldier.headW, P.soldier.headW, P.soldier.headW, P.soldier.skin);
  head.position.y = 1.58;
  g.add(head);
  return { group: g, parts: { torso: body, head, legL: body, legR: body, armL: body, armR: body } };
}

/** 几何资产表：id → { label, make, fallback } */
export const GEOMETRY_ASSETS = {
  "a02/rifle": { label: "突击步枪 · 视图模型", make: () => buildRifle(), fallback: fallbackRifle },
  "a02/soldier": { label: "敌兵 · 圆角盒人形", make: () => buildSoldier(), fallback: fallbackSoldier },
};

/** 资产引用入口：player/enemy 一律走这里取模型（自带降级，不破坏运行） */
export function gameModel(id) {
  const a = GEOMETRY_ASSETS[id];
  if (!a) throw new Error(`未知几何资产 id: ${id}`);
  return safe(`a02:${id}`, a.make, a.fallback);
}
