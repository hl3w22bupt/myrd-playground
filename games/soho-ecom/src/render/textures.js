// textures.js — 程序化贴图（零外部资源）：地板木纹 / 纸箱 / 城市夜景窗 / 泛光光斑。
// 色板单一来源（.myrd/style-card.md 的镜像），风格方向：低饱和清新 · 深夜蓝黑 + 暖光点缀。
import * as THREE from "three";

export const PALETTE = Object.freeze({
  bg: 0x0b1016,
  fog: 0x0e141c,
  wall: 0x223140,
  floor: 0x7a5c42,
  accentCyan: 0x6ccae0,
  accentOrange: 0xffb057,
  settleGreen: 0x7fd8a0,
  brokeRed: 0xe8746a,
});

/** 离屏 canvas 工具：所有贴图同一条产线 */
function paintCanvas(size, draw) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 地板：暖木板条 + 缝隙暗线 + 轻噪点（低明度，让主光决定观感） */
export function floorTexture(repeat = 6) {
  const tex = paintCanvas(256, (ctx, s) => {
    ctx.fillStyle = "#7d6248";
    ctx.fillRect(0, 0, s, s);
    const plank = s / 4;
    for (let i = 0; i < 4; i++) {
      const y = i * plank;
      const tone = 0.92 + (i % 2) * 0.1;
      ctx.fillStyle = `rgb(${Math.round(138 * tone)}, ${Math.round(108 * tone)}, ${Math.round(80 * tone)})`;
      ctx.fillRect(0, y + 1, s, plank - 2);
      // 木纹细线
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        const gy = y + 6 + g * (plank / 6);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(s * 0.3, gy - 2, s * 0.6, gy + 2, s, gy);
        ctx.stroke();
      }
      // 板缝
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, y, s, 2);
    }
    // 噪点
    for (let n = 0; n < 900; n++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** 纸箱：牛皮纸底 + 胶带十字 + 印刷线（库存箱） */
export function boxTexture() {
  return paintCanvas(128, (ctx, s) => {
    ctx.fillStyle = "#a87c4f";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#96683f";
    ctx.fillRect(0, 0, s, s * 0.5);
    ctx.fillStyle = "rgba(230,220,200,0.85)";
    ctx.fillRect(s * 0.44, 0, s * 0.12, s); // 竖胶带
    ctx.fillRect(0, s * 0.44, s, s * 0.12); // 横胶带
    ctx.strokeStyle = "rgba(60,40,20,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.fillStyle = "rgba(60,40,20,0.55)";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("FRAGILE", 14, s - 16);
  });
}

/** 城市夜景窗：深蓝渐变 + 随机亮窗 + 月亮（Bloom 喂食点） */
export function cityWindowTexture() {
  return paintCanvas(256, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, "#101a2e");
    grad.addColorStop(0.7, "#1b2b45");
    grad.addColorStop(1, "#243a52");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    // 月亮
    ctx.fillStyle = "#e8f0f8";
    ctx.beginPath();
    ctx.arc(s * 0.78, s * 0.18, 12, 0, Math.PI * 2);
    ctx.fill();
    // 楼群剪影 + 亮窗
    let x = 0;
    while (x < s) {
      const w = 18 + Math.random() * 26;
      const h = 50 + Math.random() * 110;
      ctx.fillStyle = "#131f30";
      ctx.fillRect(x, s - h, w, h);
      for (let wy = s - h + 6; wy < s - 8; wy += 12) {
        for (let wx = x + 4; wx < x + w - 6; wx += 10) {
          if (Math.random() < 0.4) {
            ctx.fillStyle = Math.random() < 0.8 ? "rgba(255,196,110,0.9)" : "rgba(140,220,240,0.9)";
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
      x += w + 4;
    }
  });
}

/** 泛光光斑（径向渐变 sprite，粒子/灯光晕共用） */
export function glowTexture() {
  return paintCanvas(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}
