// textures.js — 程序化贴图：离屏 canvas 绘制 → CanvasTexture（零外部贴图文件）。
// 配色收口到本文件的调色板，HUD（index.template.html CSS 变量）与场景同源。
import * as THREE from "three";

export const PALETTE = Object.freeze({
  bg: 0x0a1014,
  fog: 0x0a1014,
  grid: "rgba(96, 202, 224, 0.22)",
  groundBase: "#10151b",
  accentCyan: 0x60cae0,
  accentOrange: 0xffb057,
  player: 0xe8f4f6,
});

/** 地板：暗底 + 网格线（ RepeatWrapping 平铺） */
export function groundTexture(repeat = 8) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = PALETTE.groundBase;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = PALETTE.grid;
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  g.strokeStyle = "rgba(96, 202, 224, 0.45)";
  g.lineWidth = 4;
  g.strokeRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; // 忘了这行贴图会发白
  return t;
}

/** 径向光斑：喂 Bloom 的发光贴图/装饰 sprite */
export function glowTexture(color = "rgba(96, 202, 224, 1)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
