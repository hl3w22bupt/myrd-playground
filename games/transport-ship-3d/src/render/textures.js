// textures.js — 程序化贴图工厂（Canvas2D）。零外部图片；同参数走键值缓存，全场景唯一实例。
// 风格卡见 .myrd/blackboard/assets.md：冷灰舰体 / 军绿+土黄集装箱 / 暖橙警示。

import * as THREE from "three";

const cache = new Map();

/** 键值缓存工厂（对标样本 rr(key, factory) 口径）*/
function cached(key, factory) {
  let v = cache.get(key);
  if (!v) { v = factory(); cache.set(key, v); }
  return v;
}

function canvasTexture(key, size, draw) {
  return cached(key, () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  });
}

function noise(ctx, size, alpha, step) {
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v = Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      ctx.fillRect(x, y, step, step);
    }
  }
}

/** 甲板防滑纹（花纹钢板：斜向凸筋 + 铆钉）*/
export const deckPlate = () => canvasTexture("deckPlate", 256, (ctx, s) => {
  ctx.fillStyle = "#59616b"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#4a525b"; ctx.lineWidth = 6;
  for (let i = -s; i < s * 2; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
  }
  ctx.fillStyle = "#6c757f";
  for (let y = 16; y < s; y += 48) for (let x = 16; x < s; x += 48) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  }
  noise(ctx, s, 0.16, 4);
});

/** 舰体金属板（横向焊缝 + 锈渍）*/
export const hullPlate = () => canvasTexture("hullPlate", 256, (ctx, s) => {
  ctx.fillStyle = "#69737f"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#57606b"; ctx.lineWidth = 3;
  for (let y = 0; y < s; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(122,84,52,${0.05 + Math.random() * 0.09})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, Math.random() * s, 6 + Math.random() * 18, 3 + Math.random() * 8, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  noise(ctx, s, 0.12, 4);
});

/** 集装箱波纹壁（color 主色 + 竖向波筋 + 编号喷字）*/
export const containerWall = (hex, label) =>
  canvasTexture(`container-${hex}-${label}`, 256, (ctx, s) => {
    ctx.fillStyle = hex; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let x = 8; x < s; x += 24) ctx.fillRect(x, 0, 9, s);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    for (let x = 17; x < s; x += 24) ctx.fillRect(x, 0, 3, s);
    ctx.fillStyle = "rgba(20,22,24,0.55)";
    ctx.font = "bold 34px 'DIN Alternate','Arial Narrow',sans-serif";
    ctx.fillText(label, 14, s * 0.5);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 10; ctx.strokeRect(0, 0, s, s);
    noise(ctx, s, 0.1, 4);
  });

/** 迷彩（敌兵作训服：三色斑块）*/
export const camo = () => canvasTexture("camo", 128, (ctx, s) => {
  ctx.fillStyle = "#5c6247"; ctx.fillRect(0, 0, s, s);
  const blobs = [["#454b36", 26], ["#6d6a4e", 22], ["#33382a", 14]];
  for (const [col, n] of blobs) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 5 + Math.random() * 14, 4 + Math.random() * 9, Math.random() * 3, 0, 7);
      ctx.fill();
    }
  }
});

/** 停机坪 H 标线（圆 + H）*/
export const helipadMark = () => canvasTexture("helipad", 256, (ctx, s) => {
  ctx.fillStyle = "#4d555e"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#d8d2c4"; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, 7); ctx.stroke();
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(s * 0.32, s * 0.34); ctx.lineTo(s * 0.32, s * 0.66);
  ctx.moveTo(s * 0.68, s * 0.34); ctx.lineTo(s * 0.68, s * 0.66);
  ctx.moveTo(s * 0.32, s * 0.5); ctx.lineTo(s * 0.68, s * 0.5);
  ctx.stroke();
  noise(ctx, s, 0.14, 4);
});

/** 海面（深蓝绿 + 波光横纹）*/
export const sea = () => canvasTexture("sea", 256, (ctx, s) => {
  ctx.fillStyle = "#17303a"; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 130; i++) {
    ctx.strokeStyle = `rgba(150,200,210,${0.03 + Math.random() * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * s, x = Math.random() * s, len = 12 + Math.random() * 46;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
});
