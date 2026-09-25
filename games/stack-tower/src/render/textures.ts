/**
 * 程序化块面贴图（资产 a02-block-face，generator: procedural:canvas2d）。
 * 三面明度比 100 : 78 : 55（风格卡 §1 光照逻辑：顶面/正面/底面），
 * 一次生成、逐层复用；无外部图片。浏览器外（无 document）返回 null，渲染层降级为纯色矩形。
 */
import { PALETTE, BLOCK_CYCLE, shade } from './palette.js';
import type { GameImage } from './assets.js';

export interface BlockFace {
  canvas: HTMLCanvasElement;
  /** 正面色（贴图不可用时降级用） */
  fallbackColor: string;
}

const FACE_CACHE = new Map<string, BlockFace | null>();

/** tileset 贴图（assets/tileset/blocks-tower.png，3 cell ×120×28）与 cell 逻辑尺寸 */
let TILESET: GameImage | null = null;
export const TILESET_CELL_W = 120;
export const TILESET_CELL_H = 28;

/** 接线：assets/tileset 就绪后注入；传 null = 回程序化画布（引用失败不得破坏运行） */
export function setBlockTileset(img: GameImage | null): void {
  TILESET = img;
  FACE_CACHE.clear();
}

/** 从 tileset 切片为指定尺寸 canvas（暖色三循环按色值定位 cell；色值不在循环内 → 走程序化） */
function sliceTileset(hex: string, width: number, height: number): BlockFace | null {
  if (!TILESET || !TILESET.naturalWidth) return null;
  const idx = BLOCK_CYCLE.indexOf(hex);
  if (idx < 0) return null;
  const doc = (globalThis as unknown as { document?: Document }).document;
  if (!doc) return null;
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(TILESET, idx * TILESET_CELL_W, 0, TILESET_CELL_W, TILESET_CELL_H, 0, 0, canvas.width, canvas.height);
  return { canvas, fallbackColor: shade(hex, 0.78) };
}

/** 生成（带缓存）某色块面贴图：宽 = 块逻辑宽，高 = BLOCK_H；tileset 就绪 → 切片优先，否则程序化画布 */
export function blockFace(hex: string, width: number, height: number): BlockFace | null {
  const key = `${hex}|${width}x${height}`;
  if (FACE_CACHE.has(key)) return FACE_CACHE.get(key) ?? null;
  const sliced = sliceTileset(hex, width, height);
  if (sliced) {
    FACE_CACHE.set(key, sliced);
    return sliced;
  }
  const doc = (globalThis as unknown as { document?: Document }).document;
  if (!doc) return null;

  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 顶面高光带（100）：线性渐变顶部 12%
  const top = ctx.createLinearGradient(0, 0, 0, height);
  top.addColorStop(0, shade(hex, 1));
  top.addColorStop(0.12, shade(hex, 0.92));
  top.addColorStop(0.5, shade(hex, 0.78)); // 正面（78）
  top.addColorStop(1, shade(hex, 0.55)); // 底面（55）
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 切面白描边（1px，判定物，唯一高亮）
  ctx.strokeStyle = PALETTE.FACE_HIGHLIGHT;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  const face: BlockFace = { canvas, fallbackColor: shade(hex, 0.78) };
  FACE_CACHE.set(key, face);
  return face;
}
