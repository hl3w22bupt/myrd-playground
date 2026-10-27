// web/render.ts — 可玩面渲染（line4-unblock-jam · 表现层）
//
// 风格卡 v1 冻结面（assets.md §一）：极简色块俯视、零光照零渐变、唯一立体暗示=12% 投影 offset2；
// 渲染层只读 src/platform/theme.ts token（单源），色值零手抄。
// 视效预算（assets.md §四 · acc-02 三通道）：burst 粒子 ≤12/生命 480ms/同屏硬顶 24（超限丢弃记数）；
// combo-pop 文字 1 次绘制上浮 240ms/每局 ≤10；level-clear 静态色块；常态帧绘制调用 ≤8。
import { PALETTE, SHADOW_ALPHA, SHADOW_OFFSET_PX, RADIUS_CAR_PX, GRID_LINE_PX, GRID_CELL_PX } from '../platform/theme.ts';
import { occupancy, type Lot } from '../entities/lot.ts';
import type { Game } from './game.ts';

const CELL = GRID_CELL_PX; // 48 设计基准（等比缩放由 view.scale 承担）
const BURST_LIFE_MS = 480;
const BURST_MAX_ONSCREEN = 24;
const POP_LIFE_MS = 240;

export interface View { ox: number; oy: number; scale: number; }

interface Particle { x: number; y: number; vx: number; vy: number; born: number; color: string; }
interface Pop { x: number; y: number; born: number; text: string; }

export interface Fx {
  particles: Particle[];
  pops: Pop[];
  dropped: number;            // 同屏硬顶丢弃计数（遥测面）
  exitFlash: number;          // 出口高亮切换时间戳（performance.now）
  popsThisLevel: number;
}

export function createFx(): Fx { return { particles: [], pops: [], dropped: 0, exitFlash: 0, popsThisLevel: 0 }; }

/** vf-car-exit-burst：≤12 个单色矩形，1 帧内发射（同帧判定→同帧调用） */
export function spawnBurst(fx: Fx, x: number, y: number, now: number): void {
  for (let i = 0; i < 12; i += 1) {
    if (fx.particles.length >= BURST_MAX_ONSCREEN) { fx.dropped += 1; break; }
    const a = (Math.PI * 2 * i) / 12;
    fx.particles.push({ x, y, vx: Math.cos(a) * 0.09, vy: Math.sin(a) * 0.09, born: now, color: PALETTE.carCool });
  }
  fx.exitFlash = now;
}

/** vf-combo-pop：每局 ≤10，超限丢弃 */
export function spawnPop(fx: Fx, x: number, y: number, text: string, now: number): void {
  if (fx.popsThisLevel >= 10) return;
  fx.popsThisLevel += 1;
  fx.pops.push({ x, y, born: now, text });
}

export function resetLevelFx(fx: Fx): void { fx.popsThisLevel = 0; }

/** 常态帧绘制（调用次数：clear≈1 + 网格 1 + 障碍/车 ≤2 + 出口 1 + 特效 ≤2 = ≤8） */
export function draw(ctx: CanvasRenderingContext2D, g: Game, view: View, fx: Fx, now: number, showGuide: boolean): void {
  const { ox, oy, scale } = view;
  const s = CELL * scale;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); // ① 地面底

  // ② 网格线（单路径 1 次描）
  ctx.strokeStyle = PALETTE.gridLine;
  ctx.lineWidth = GRID_LINE_PX;
  ctx.beginPath();
  for (let i = 0; i <= g.lot.size; i += 1) {
    ctx.moveTo(ox + i * s, oy); ctx.lineTo(ox + i * s, oy + g.lot.size * s);
    ctx.moveTo(ox, oy + i * s); ctx.lineTo(ox + g.lot.size * s, oy + i * s);
  }
  ctx.stroke();

  // ③ 出口门（2 格宽高亮条；驶出反馈=绿闪，红轮警示=红）
  const gateFlash = now - fx.exitFlash < BURST_LIFE_MS;
  ctx.fillStyle = gateFlash ? PALETTE.carCool : g.red ? PALETTE.target : PALETTE.carCool;
  ctx.fillRect(ox + g.lot.size * s, oy + g.lot.exit.row * s, 6 * scale, s * 2);

  // ④ 障碍 + ⑤ 车（含投影：唯一立体暗示）
  const grid = occupancy(g.lot);
  ctx.fillStyle = PALETTE.gridLine;
  for (let r = 0; r < g.lot.size; r += 1) for (let c = 0; c < g.lot.size; c += 1) {
    if (grid[r][c] === 'obstacle') roundRect(ctx, ox + c * s + 3, oy + r * s + 3, s - 6, s - 6, 4), ctx.fill();
  }
  for (const car of g.lot.cars) {
    const w = (car.orient === 'h' ? car.len : 1) * s, h = (car.orient === 'v' ? car.len : 1) * s;
    const x = ox + car.col * s, y = oy + car.row * s;
    ctx.fillStyle = PALETTE.shadow;
    ctx.globalAlpha = SHADOW_ALPHA;
    roundRect(ctx, x + SHADOW_OFFSET_PX, y + SHADOW_OFFSET_PX, w - 2, h - 2, RADIUS_CAR_PX); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE[car.color === 'red' ? 'target' : car.color === 'orange' ? 'carWarm' : car.color === 'green' ? 'carCool' : 'carAlt'];
    roundRect(ctx, x, y, w - 2, h - 2, RADIUS_CAR_PX); ctx.fill();
  }

  // ⑥ 粒子（burst 生命 480ms 后出屏裁剪）
  fx.particles = fx.particles.filter((p) => now - p.born < BURST_LIFE_MS);
  ctx.fillStyle = PALETTE.carCool;
  for (const p of fx.particles) ctx.fillRect(ox + p.x * s + p.x * p.vx * now * 0.06, oy + p.y * s + p.y * p.vy * now * 0.06, 4, 4);

  // ⑦ combo-pop（上浮 240ms · 文字 1 次绘制）
  fx.pops = fx.pops.filter((p) => now - p.born < POP_LIFE_MS);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `${Math.round(16 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (const p of fx.pops) {
    const k = (now - p.born) / POP_LIFE_MS;
    ctx.globalAlpha = 1 - k;
    ctx.fillText(p.text, ox + p.x * s, oy + p.y * s - k * 24);
  }
  ctx.globalAlpha = 1;

  // ⑧ g-01 引导层（判据挂 a04-guide-hand 语义：滑动箭头 + 手指，程序化直绘）
  if (showGuide) drawGuide(ctx, g, view);
}

function drawGuide(ctx: CanvasRenderingContext2D, g: Game, view: View): void {
  const t = g.lot.cars.find((c) => c.color === 'red');
  if (!t) return;
  const s = CELL * view.scale;
  const x = view.ox + t.col * s, y = view.oy + t.row * s + s / 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + s * 2 + 10, y); ctx.lineTo(x + s * 2 + 54, y);
  ctx.moveTo(x + s * 2 + 54, y); ctx.lineTo(x + s * 2 + 42, y - 10);
  ctx.moveTo(x + s * 2 + 54, y); ctx.lineTo(x + s * 2 + 42, y + 10);
  ctx.stroke();
  ctx.fillStyle = PALETTE.carAlt;
  ctx.font = `${Math.round(13 * view.scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('拖动让路 →', view.ox, view.oy - 8);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
