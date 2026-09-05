/**
 * ui/minimap —— Canvas2D 小地图（AC2④：当前安全区、下一圈轮廓、缩圈倒计时与实体方位）。
 * 静态层（地形分区/建筑/城区/网格）离屏预渲染一次；动态层每帧绘制（单 canvas，无 DOM 开销）。
 */

import type { WorldSnapshot } from '../core/types';
import { MINIMAP_UPDATE_HZ } from '../content/render';
import type { ContentPack } from '../content';
import { hzToIntervalMs, RateLimiter } from '../perf/rate';

const SIZE = 196;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement;
  /** 重绘节流：画布内容一致，仅降低频率（同一主循环内，无独立定时器） */
  private readonly throttle = new RateLimiter(hzToIntervalMs(MINIMAP_UPDATE_HZ));

  constructor(
    container: HTMLElement,
    pack: ContentPack,
    buildings: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // —— 静态层：地形 + 城区 + 建筑 + 网格 ——
    const s = (this.staticLayer = document.createElement('canvas'));
    s.width = SIZE;
    s.height = SIZE;
    const ctx = s.getContext('2d')!;
    const k = SIZE / 1600;

    // 地形底色（深绿渐变）
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bg.addColorStop(0, '#2e4c29');
    bg.addColorStop(1, '#37582f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 城区
    for (const u of pack.map.urbanAreas) {
      const g = ctx.createRadialGradient(u.x * k, u.z * k, 0, u.x * k, u.z * k, u.radius * k);
      g.addColorStop(0, '#585850');
      g.addColorStop(1, '#45463f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(u.x * k, u.z * k, u.radius * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // 建筑（带 1px 高光，立体感）
    for (const b of buildings) {
      const x = b.minX * k;
      const z = b.minZ * k;
      const w = Math.max(1.4, (b.maxX - b.minX) * k);
      const h = Math.max(1.4, (b.maxZ - b.minZ) * k);
      ctx.fillStyle = '#7d7867';
      ctx.fillRect(x, z, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, z, w, 1);
    }

    // 网格线（每 400m）
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (i * SIZE) / 4;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
      ctx.stroke();
    }

    // 指北针
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText('N', SIZE - 14, 13);
    ctx.beginPath();
    ctx.moveTo(SIZE - 10, 15);
    ctx.lineTo(SIZE - 13, 22);
    ctx.lineTo(SIZE - 7, 22);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 按 MINIMAP_UPDATE_HZ 节流重绘。
   * @returns 本帧是否真正重绘（基准/测试观测用）
   */
  update(snap: WorldSnapshot, nowMs: number): boolean {
    if (!this.throttle.due(nowMs)) return false;
    const k = SIZE / 1600;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.staticLayer, 0, 0);

    const z = snap.zone;

    // 危险区：当前安全圈外红色渐变（evenodd 挖洞）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(z.center.x * k, z.center.z * k, Math.max(0, z.radius * k), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(215,58,38,0.22)';
    ctx.fill('evenodd');
    ctx.restore();

    // 当前安全区（亮白实线 + 内侧微光）
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(z.center.x * k, z.center.z * k, Math.max(0, z.radius * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 下一圈轮廓（白色虚线）
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(z.nextCenter.x * k, z.nextCenter.z * k, Math.max(0, z.nextRadius * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 运输机航线（含方向拖尾）
    if (snap.plane) {
      const px = snap.plane.pos.x * k;
      const pz = snap.plane.pos.z * k;
      ctx.strokeStyle = 'rgba(207,216,227,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px - snap.plane.dir.x * 14, pz - snap.plane.dir.z * 14);
      ctx.stroke();
      ctx.fillStyle = '#e8eff6';
      ctx.beginPath();
      ctx.arc(px, pz, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家箭头 + 视野扇形
    const p = snap.entities.find((e) => e.id === 'player');
    if (p) {
      ctx.save();
      ctx.translate(p.pos.x * k, p.pos.z * k);
      ctx.rotate(-p.yaw);
      // 视野扇形（±35°）
      const fov = (35 * Math.PI) / 180;
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      grad.addColorStop(0, 'rgba(120,190,255,0.35)');
      grad.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 26, -fov, fov);
      ctx.closePath();
      ctx.fill();
      // 玩家箭头
      ctx.fillStyle = '#4da3ff';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5.5, 0);
      ctx.lineTo(-3.5, 3.2);
      ctx.lineTo(-3.5, -3.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 顶部倒计时角标
    const label =
      z.mode === 'wait'
        ? `缩圈 ${Math.ceil(z.timeLeftMs / 1000)}s`
        : z.mode === 'shrink'
          ? `收缩 ${Math.ceil(z.timeLeftMs / 1000)}s`
          : '终局圈';
    ctx.fillStyle = 'rgba(8,12,16,0.62)';
    ctx.fillRect(0, 0, SIZE, 15);
    ctx.fillStyle = z.mode === 'shrink' ? '#ff9a70' : '#9fd4ff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} · 阶段 ${z.phase + 1}/${z.phaseCount}`, SIZE / 2, 11);
    ctx.textAlign = 'left';
    return true;
  }

  dispose(): void {
    this.canvas.remove();
  }
}
