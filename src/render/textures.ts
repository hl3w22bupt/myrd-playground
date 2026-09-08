/**
 * render/textures —— 程序化 Canvas 纹理（AC2①：地形/建筑具备可辨识材质纹理，非纯色占位）。
 * 不加载外部美术资产；纹理生成一次，全场景复用（零运行时成本）。
 */

import * as THREE from 'three';

/** 生成可平铺噪点纹理的公共收尾：mipmap + 各向异性，远处不发糊 */
function finish(tex: THREE.Texture, anisotropy = 4): THREE.Texture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** 地面纹理：干湿草地区块 + 草叶簇 + 碎石土斑，多层叠加（AC2① 主纹理） */
export function makeGroundTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 底色：冷暖草绿渐变
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#5f8040');
  base.addColorStop(0.5, '#547538');
  base.addColorStop(1, '#698a46');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // 干湿草地大色块（低频变化，避免平铺感）
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 70;
    const dry = Math.random() > 0.5;
    ctx.fillStyle = dry
      ? `rgba(150,138,84,${0.10 + Math.random() * 0.12})`
      : `rgba(64,96,52,${0.12 + Math.random() * 0.14})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 土路 / 裸土斑块
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(118,94,64,${0.18 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + Math.random() * 30, 8 + Math.random() * 14, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 草叶簇：短笔触带明暗方向感
  ctx.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 60 + Math.floor(Math.random() * 70);
    ctx.strokeStyle = `rgb(${shade - 26},${shade + 34},${shade - 34})`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 3);
    ctx.stroke();
  }

  // 细碎石
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 120 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 20},0.55)`;
    ctx.fillRect(x, y, 1.5 + Math.random() * 2, 1.5 + Math.random() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.repeat.set(72, 72);
  return finish(tex);
}

/** 建筑立面纹理：楼层分隔 + 双样式窗格 + 檐口 + 墙脚污渍（InstancedMesh 单纹理全楼铺满） */
export function makeBuildingTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 墙面底色 + 轻微斑驳
  ctx.fillStyle = '#9a9284';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,36,30,0.06)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 6 + Math.random() * 22, 4 + Math.random() * 12);
  }

  // 楼层分隔（10 层）
  const floors = 10;
  const fh = size / floors;
  for (let f = 0; f <= floors; f++) {
    ctx.fillStyle = 'rgba(52,48,42,0.5)';
    ctx.fillRect(0, f * fh - 2, size, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, f * fh + 2, size, 2);
  }

  // 窗户网格（每层 5 列：亮窗 / 暗窗 / 百叶窗三种状态）
  const cols = 5;
  const cw = size / cols;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.18;
      const y = f * fh + fh * 0.22;
      const w = cw * 0.64;
      const h = fh * 0.52;
      const roll = Math.random();
      if (roll > 0.78) {
        // 亮灯窗（暖光）
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#f0dda2');
        g.addColorStop(1, '#c9a95e');
        ctx.fillStyle = g;
      } else if (roll > 0.4) {
        ctx.fillStyle = '#2c3b49';
      } else {
        ctx.fillStyle = '#1f2a34';
      }
      ctx.fillRect(x, y, w, h);
      // 玻璃反光斜条
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w * 0.4, y);
      ctx.lineTo(x + w * 0.62, y);
      ctx.lineTo(x + w * 0.22, y + h);
      ctx.closePath();
      ctx.fill();
      // 窗框
      ctx.strokeStyle = '#4c463c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineWidth = 2;
      ctx.stroke();
      // 空调外机（随机点缀）
      if (Math.random() > 0.72) {
        ctx.fillStyle = '#b9b4a8';
        ctx.fillRect(x + w * 0.08, y + h - 2, w * 0.3, fh * 0.12);
        ctx.strokeStyle = 'rgba(50,46,40,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + w * 0.08, y + h - 2, w * 0.3, fh * 0.12);
      }
    }
  }

  // 顶部檐口 + 墙脚污渍（立体感）
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, size, 8);
  const grime = ctx.createLinearGradient(0, size, 0, size - 90);
  grime.addColorStop(0, 'rgba(48,42,34,0.42)');
  grime.addColorStop(1, 'rgba(48,42,34,0)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, size - 90, size, 90);

  const tex = new THREE.CanvasTexture(canvas);
  return finish(tex);
}

/** 树冠纹理：叶簇团块噪声（用于低模树冠体积感） */
export function makeFoliageTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3c6b2f';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 340; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 8;
    const l = 30 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgb(${l - 14},${l + 28},${l - 8})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 暗部斑点（底部阴影感）
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = 'rgba(18,36,14,0.25)';
    ctx.beginPath();
    ctx.arc(Math.random() * size, size * 0.55 + Math.random() * size * 0.45, 2 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return finish(tex);
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
  return finish(tex);
}

/** 天空穹顶：垂直渐变（天顶深蓝 → 地平线暖白，与雾色衔接形成远景层次） */
export function makeSkyTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#2c5b9e');
  g.addColorStop(0.42, '#7ba4cf');
  g.addColorStop(0.72, '#b7cfe3');
  g.addColorStop(1, '#dce8f0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** 云朵贴图：柔和团块（云层 sprite 用，含 alpha） */
export function makeCloudTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = size * 0.5 + (Math.random() - 0.5) * size * 0.6;
    const y = size * 0.5 + (Math.random() - 0.5) * size * 0.34;
    const r = 12 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 圆形柔光贴图（枪口火焰 / 命中粒子 / 太阳光晕通用） */
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
  tex.needsUpdate = true;
  return tex;
}
