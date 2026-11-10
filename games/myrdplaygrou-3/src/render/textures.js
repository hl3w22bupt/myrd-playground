// textures.js — 程序化贴图：离屏 canvas 绘制 → CanvasTexture（零外部贴图文件）。
// 配色收口到本文件的调色板（风格卡 palette 镜像：#3498db / #2ecc71 / #f39c12 扁平明快），
// HUD（index.template.html CSS 变量）与场景同源。
import * as THREE from "three";
import { FIELD_HALF_W, FIELD_HALF_L, GOAL_WIDTH } from "../numeric.js";

export const PALETTE = Object.freeze({
  // 全部 CSS 字符串：canvas 2D fillStyle/strokeStyle 只认字符串（数字会被静默忽略 → 透明黑贴图）；
  // three 的 new Color(str) 同样接受，单一真源两处安全。
  bg: "#dff2fb",           // 亮天（扁平明快：白天球场）
  fog: "#dff2fb",
  primary: "#3498db",      // 主色：球员球衣 / UI 主按钮
  grass: "#2ecc71",        // 辅色：场地草绿
  grassDark: "#27b463",    // 草地条纹深绿
  accent: "#f39c12",       // 强调：金币 / 守门员 / CTA
  line: "#ffffff",         // 场地白线
  ball: "#f5f5f5",         // 足球白
  playerSkin: "#f0c8a0",   // 头部肤色
});

/** 草地条纹（细密横条，扁平色块无渐变） */
function grassStripes(g, w, h) {
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, 0, w, h);
  g.fillStyle = PALETTE.grassDark;
  const stripe = h / 14;
  for (let i = 0; i < 14; i += 2) g.fillRect(0, i * stripe, w, stripe);
}

/** 场地贴图：整场单贴（1024×1638 ≈ 20:32 比例），白线边线/中线/中圈/禁区 —— 不 repeat */
export function fieldTexture() {
  const w = 1024;
  const h = Math.round((w * FIELD_HALF_L * 2) / (FIELD_HALF_W * 2));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  grassStripes(g, w, h);

  const W = (FIELD_HALF_W * 2) / w;   // 米 → 像素 换算系数
  const lw = 6;
  g.strokeStyle = PALETTE.line;
  g.lineWidth = lw;
  // 边线 + 中线 + 中圈 + 中点
  g.strokeRect(lw, lw, w - lw * 2, h - lw * 2);
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 1.8 / W * 1, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 4, 0, Math.PI * 2); g.fill();
  // 禁区（两端对称，宽 GOAL_WIDTH + 4m、深 5m）
  const boxW = (GOAL_WIDTH + 4) / W;
  for (const top of [true, false]) {
    const y = top ? lw : h - 5 / W - lw;
    g.strokeRect(w / 2 - boxW / 2, y, boxW, 5 / W);
    // 点球点
    g.beginPath();
    g.arc(w / 2, top ? 8 / W : h - 8 / W, 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; // 忘了这行贴图会发白
  t.anisotropy = 4;
  return t;
}

/** 训练桩条纹（橙白螺旋条） */
export function postTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = PALETTE.line;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = PALETTE.accent;
  for (let y = 0; y < 128; y += 32) {
    g.beginPath();
    g.moveTo(0, y); g.lineTo(64, y + 16); g.lineTo(64, y + 32); g.lineTo(0, y + 16);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 足球贴图：白底 + 黑五边形斑（近似经典外观） */
export function ballTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = PALETTE.ball;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#2b3438";
  const spots = [[128, 40], [52, 92], [204, 92], [90, 168], [166, 168], [128, 232]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = x + Math.cos(a) * 26, py = y + Math.sin(a) * 26;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 径向光斑：喂 Bloom 的发光贴图/装饰 sprite */
export function glowTexture(color = "rgba(243, 156, 18, 1)") {
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
