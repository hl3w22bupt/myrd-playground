// textures.js — 程序化贴图：离屏 canvas 绘制 → CanvasTexture（零外部贴图文件）。
// 配色唯一来源 = PALETTE（风格卡 football-flat-bright 的代码镜像：#3498db / #2ecc71 / #f39c12）。
// HUD（index.template.html CSS 变量）与场景同源，全工程不出现第二个色值。
import * as THREE from "three";
import { PITCH_HALF_X, PITCH_HALF_Z, GOAL_HALF_WIDTH } from "../numeric.js";

export const PALETTE = Object.freeze({
  bg: 0xcfe8f2,            // 白昼天光（扁平明快，非夜场）
  fog: 0xcfe8f2,
  pitchBase: "#2ecc71",    // 草绿（场地大面）
  pitchStripe: "#29b863",  // 草纹条带（同色深一档）
  line: "#ffffff",         // 标线纯白
  board: "#1b2a38",        // 边界挡板深蓝黑
  home: "#3498db",         // 主队蓝
  away: "#f39c12",         // 客队橙
  gk: "#1e8449",           // 双方门将深绿（风格卡门将变体）
  shortsHome: "#ffffff",
  shortsAway: "#ffffff",
  skin: "#e8b48c",
  hair: "#2c3a46",
  shoes: "#233240",
  accent: "#f39c12",       // 受控球员指示环
  accentLight: "#7fdfff",  // 点缀灯光（仅灯光，不作大面色块）
  goalFrame: "#f5f7fa",
});

/** 球场贴图：草纹条带 + 白色标线（中圈/中线/禁区/门线）—— 一张 canvas，内核几何同一真源 */
export function pitchTexture() {
  const W = 1024;
  const H = Math.round((W * (PITCH_HALF_Z * 2 + 4)) / (PITCH_HALF_X * 2 + 4));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const px = (x) => ((x + PITCH_HALF_X + 2) / (PITCH_HALF_X * 2 + 4)) * W;
  const pz = (z) => ((z + PITCH_HALF_Z + 2) / (PITCH_HALF_Z * 2 + 4)) * H;

  // 草底 + 横向条带（8 条，扁平明快无噪点）
  g.fillStyle = PALETTE.pitchBase;
  g.fillRect(0, 0, W, H);
  g.fillStyle = PALETTE.pitchStripe;
  const stripes = 8;
  for (let i = 0; i < stripes; i += 2) {
    g.fillRect(0, (i / stripes) * H, W, H / stripes);
  }

  // 标线（统一 6px 等宽纯白）
  g.strokeStyle = PALETTE.line;
  g.lineWidth = 6;
  g.strokeRect(px(-PITCH_HALF_X), pz(-PITCH_HALF_Z), px(PITCH_HALF_X) - px(-PITCH_HALF_X), pz(PITCH_HALF_Z) - pz(-PITCH_HALF_Z));
  // 中线 + 中圈
  g.beginPath(); g.moveTo(px(-PITCH_HALF_X), pz(0)); g.lineTo(px(PITCH_HALF_X), pz(0)); g.stroke();
  g.beginPath(); g.arc(px(0), pz(0), (px(3.2) - px(0)), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(px(0), pz(0), 0.4, 0, Math.PI * 2); g.fillStyle = PALETTE.line; g.fill();
  // 禁区（两侧）
  const boxW = px(6.5) - px(-6.5);
  const boxH = pz(-PITCH_HALF_Z + 7) - pz(-PITCH_HALF_Z);
  g.strokeRect(px(-6.5), pz(-PITCH_HALF_Z), boxW, boxH);
  g.strokeRect(px(-6.5), pz(PITCH_HALF_Z - 7), boxW, boxH);
  // 小禁区 + 点球点
  const smallH = pz(-PITCH_HALF_Z + 3) - pz(-PITCH_HALF_Z);
  g.strokeRect(px(-GOAL_HALF_WIDTH - 0.5), pz(-PITCH_HALF_Z), pz(1) - pz(0) * 2, smallH);
  g.strokeRect(px(-GOAL_HALF_WIDTH - 0.5), pz(PITCH_HALF_Z - 3), pz(1) - pz(0) * 2, smallH);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; // 忘了这行贴图会发白
  t.anisotropy = 4;
  return t;
}

/** 背号贴图：白字号码（球员背后），带圆形底衬 —— 每号一张小 canvas */
export function numberTexture(num, fg = "#ffffff", bg = "rgba(0,0,0,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (bg !== "rgba(0,0,0,0)") {
    g.fillStyle = bg;
    g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = fg;
  g.font = "bold 92px 'Arial Black', 'Arial', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 足球贴图：白底 + 五边黑斑（平面近似，滚动时自带旋转读感） */
export function ballTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f5f7fa";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#233240";
  const spots = [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]];
  for (const [x, y] of spots) {
    g.beginPath();
    g.arc(x, y, 26, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 球网贴图：透明底 + 白色方格网眼（IP-2 · 球门无网证据），RepeatWrapping 按面尺寸铺 */
export function netTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 3;
  const cell = 16;
  g.beginPath();
  for (let i = 0; i <= 64; i += cell) {
    g.moveTo(i, 0); g.lineTo(i, 64);
    g.moveTo(0, i); g.lineTo(64, i);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 径向光斑：受控球员指示环发光贴图（喂 Bloom） */
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
