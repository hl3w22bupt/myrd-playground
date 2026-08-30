/**
 * ui/minimap —— Canvas2D 小地图（AC2④：显示当前安全区、下一圈轮廓与实体方位）。
 * 静态层（地形分区/建筑/城区）离屏预渲染一次，动态层每帧绘制。
 */

import type { WorldSnapshot } from '../core/types';
import type { ContentPack } from '../content';

const SIZE = 190;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement;

  constructor(container: HTMLElement, pack: ContentPack, buildings: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // —— 静态层 ——
    const s = (this.staticLayer = document.createElement('canvas'));
    s.width = SIZE;
    s.height = SIZE;
    const ctx = s.getContext('2d')!;
    const k = SIZE / 1600;
    ctx.fillStyle = '#31502c';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // 城区
    ctx.fillStyle = '#4a4a42';
    for (const u of pack.map.urbanAreas) {
      ctx.beginPath();
      ctx.arc(u.x * k, u.z * k, u.radius * k, 0, Math.PI * 2);
      ctx.fill();
    }
    // 建筑
    ctx.fillStyle = '#75705f';
    for (const b of buildings) {
      ctx.fillRect(b.minX * k, b.minZ * k, Math.max(1, (b.maxX - b.minX) * k), Math.max(1, (b.maxZ - b.minZ) * k));
    }
  }

  update(snap: WorldSnapshot): void {
    const k = SIZE / 1600;
    this.ctx.clearRect(0, 0, SIZE, SIZE);
    this.ctx.drawImage(this.staticLayer, 0, 0);

    // 安全区
    const z = snap.zone;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(z.center.x * k, z.center.z * k, Math.max(0, z.radius * k), 0, Math.PI * 2);
    this.ctx.stroke();

    // 下一圈轮廓
    this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.arc(z.nextCenter.x * k, z.nextCenter.z * k, Math.max(0, z.nextRadius * k), 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 运输机航线
    if (snap.plane) {
      this.ctx.fillStyle = '#cfd8e3';
      this.ctx.beginPath();
      this.ctx.arc(snap.plane.pos.x * k, snap.plane.pos.z * k, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 玩家箭头
    const p = snap.entities.find((e) => e.id === 'player');
    if (p) {
      this.ctx.save();
      this.ctx.translate(p.pos.x * k, p.pos.z * k);
      this.ctx.rotate(-p.yaw);
      this.ctx.fillStyle = '#4da3ff';
      this.ctx.beginPath();
      this.ctx.moveTo(5, 0);
      this.ctx.lineTo(-3.5, 3);
      this.ctx.lineTo(-3.5, -3);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  dispose(): void {
    this.canvas.remove();
  }
}
