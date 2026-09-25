/**
 * 程序化块面贴图（资产 a02-block-face，generator: procedural:canvas2d）。
 * 三面明度比 100 : 78 : 55（风格卡 §1 光照逻辑：顶面/正面/底面），
 * 一次生成、逐层复用；无外部图片。浏览器外（无 document）返回 null，渲染层降级为纯色矩形。
 */
import { PALETTE, shade } from './palette.js';
const FACE_CACHE = new Map();
/** 生成（带缓存）某色块面贴图：宽 = 块逻辑宽，高 = BLOCK_H */
export function blockFace(hex, width, height) {
    const key = `${hex}|${width}x${height}`;
    if (FACE_CACHE.has(key))
        return FACE_CACHE.get(key) ?? null;
    const doc = globalThis.document;
    if (!doc)
        return null;
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
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
    const face = { canvas, fallbackColor: shade(hex, 0.78) };
    FACE_CACHE.set(key, face);
    return face;
}
