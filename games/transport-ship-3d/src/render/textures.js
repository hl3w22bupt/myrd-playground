// textures.js — 程序化贴图工厂（Canvas2D）。零外部图片；同参数走键值缓存，全场景唯一实例。
// 资产接线：颜色/笔触一律取自 assets/palette.mjs（风格卡四要素），禁止本文件内另编色值；
// 资产 id 与引用入口见 assets/a01-textures.mjs（本文件保留为生成器底座 = 降级 fallback 的来源）。

import * as THREE from "three";
import { PALETTE, cssHex } from "../../assets/palette.mjs";

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

/** 全资产通用颗粒（风格卡 line.noise）*/
function noise(ctx, size, alpha = PALETTE.line.noise.alpha, step = PALETTE.line.noise.step) {
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v = Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      ctx.fillRect(x, y, step, step);
    }
  }
}

/** 甲板防滑纹（花纹钢板：斜向凸筋 + 铆钉，线条取 line.tread）*/
export const deckPlate = () => canvasTexture("deckPlate", 256, (ctx, s) => {
  const t = PALETTE.line.tread;
  ctx.fillStyle = cssHex(PALETTE.hull.shadow); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = cssHex(PALETTE.hull.deep); ctx.lineWidth = t.width;
  for (let i = -s; i < s * 2; i += t.pitch) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
  }
  ctx.fillStyle = cssHex(PALETTE.hull.rivet);
  for (let y = 16; y < s; y += t.rivetPitch) for (let x = 16; x < s; x += t.rivetPitch) {
    ctx.beginPath(); ctx.arc(x, y, t.rivetR, 0, 7); ctx.fill();
  }
  noise(ctx, s, 0.16);
});

/** 舰体金属板（横向焊缝 + 锈渍，线条取 line.weld）*/
export const hullPlate = () => canvasTexture("hullPlate", 256, (ctx, s) => {
  const w = PALETTE.line.weld;
  ctx.fillStyle = cssHex(PALETTE.hull.plate); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = cssHex(PALETTE.hull.deep); ctx.lineWidth = w.width;
  for (let y = 0; y < s; y += w.pitch) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(122,84,52,${0.05 + Math.random() * 0.09})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, Math.random() * s, 6 + Math.random() * 18, 3 + Math.random() * 8, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  noise(ctx, s, 0.12);
});

/** 集装箱波纹壁（颜色/箱号由资产条目注入，笔触取 line.rib / line.outline / line.label）*/
export const containerWall = (hex, label) =>
  canvasTexture(`container-${hex}-${label}`, 256, (ctx, s) => {
    const rib = PALETTE.line.rib, lb = PALETTE.line.label, ol = PALETTE.line.outline;
    ctx.fillStyle = hex; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = rib.shadow;
    for (let x = 8; x < s; x += rib.pitch) ctx.fillRect(x, 0, rib.width, s);
    ctx.fillStyle = rib.hi;
    for (let x = 8 + rib.width; x < s; x += rib.pitch) ctx.fillRect(x, 0, rib.hiWidth, s);
    ctx.globalAlpha = lb.alpha;
    ctx.fillStyle = "rgba(20,22,24,0.9)";
    ctx.font = `bold ${lb.px}px ${lb.font}`;
    ctx.fillText(label, 14, s * 0.5);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(0,0,0,${ol.alpha})`; ctx.lineWidth = ol.width; ctx.strokeRect(0, 0, s, s);
    noise(ctx, s, 0.1);
  });

/** 迷彩（敌兵作训服：三色斑块，色取调色板 soldier 组）*/
export const camo = () => canvasTexture("camo", 128, (ctx, s) => {
  const c = PALETTE.soldier;
  ctx.fillStyle = cssHex(c.camoBase); ctx.fillRect(0, 0, s, s);
  const blobs = [[c.camoDark, 26], [c.camoLight, 22], [c.camoShadow, 14]];
  for (const [col, n] of blobs) {
    ctx.fillStyle = cssHex(col);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 5 + Math.random() * 14, 4 + Math.random() * 9, Math.random() * 3, 0, 7);
      ctx.fill();
    }
  }
});

/** 停机坪 H 标线（圆 + H，线条取 line.pad）*/
export const helipadMark = () => canvasTexture("helipad", 256, (ctx, s) => {
  const p = PALETTE.line.pad;
  ctx.fillStyle = cssHex(PALETTE.hull.deep); ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = p.color; ctx.lineWidth = p.ring;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, 7); ctx.stroke();
  ctx.lineWidth = p.glyph;
  ctx.beginPath();
  ctx.moveTo(s * 0.32, s * 0.34); ctx.lineTo(s * 0.32, s * 0.66);
  ctx.moveTo(s * 0.68, s * 0.34); ctx.lineTo(s * 0.68, s * 0.66);
  ctx.moveTo(s * 0.32, s * 0.5); ctx.lineTo(s * 0.68, s * 0.5);
  ctx.stroke();
  noise(ctx, s, 0.14);
});

/** 海面（深蓝绿 + 波光横纹）*/
export const sea = () => canvasTexture("sea", 256, (ctx, s) => {
  ctx.fillStyle = cssHex(PALETTE.sea.base); ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 130; i++) {
    ctx.strokeStyle = `rgba(${PALETTE.sea.glitz},${0.03 + Math.random() * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * s, x = Math.random() * s, len = 12 + Math.random() * 46;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
});
