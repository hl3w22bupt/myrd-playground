/**
 * render/textures —— 程序化 Canvas 纹理（AC2①：地形/建筑具备可辨识材质纹理，非纯色占位）。
 * 不加载外部美术资产；纹理生成一次，全场景复用。
 */

import * as THREE from 'three';

/** 地面纹理：草地噪点 + 深色斑块，可平铺 */
export function makeGroundTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5c7a3e';
  ctx.fillRect(0, 0, size, size);

  // 噪点草叶
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 70 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${shade - 24},${shade + 30},${shade - 30})`;
    ctx.fillRect(x, y, 2, 3);
  }
  // 土壤斑块
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 16;
    ctx.fillStyle = `rgba(122,96,60,${0.12 + Math.random() * 0.14})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 建筑纹理：窗格 + 墙面分层 */
export function makeBuildingTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // 墙面
  ctx.fillStyle = '#8d8578';
  ctx.fillRect(0, 0, size, size);
  // 砖缝
  ctx.strokeStyle = 'rgba(60,55,48,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  // 窗户网格
  for (let y = 12; y < size - 12; y += 48) {
    for (let x = 14; x < size - 14; x += 52) {
      const lit = Math.random();
      ctx.fillStyle = lit > 0.72 ? '#d8c98a' : lit > 0.4 ? '#31404e' : '#26313c';
      ctx.fillRect(x, y, 30, 26);
      ctx.strokeStyle = '#4a453c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 30, 26);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 降落伞伞面：放射条纹 */
export function makeCanopyTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8563e';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#e6dcc8';
  for (let i = 0; i < 8; i += 2) {
    ctx.fillRect((i * size) / 8, 0, size / 8, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 圆形柔光贴图（枪口火焰 / 命中粒子通用） */
export function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.4, 'rgba(255,180,80,0.7)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
