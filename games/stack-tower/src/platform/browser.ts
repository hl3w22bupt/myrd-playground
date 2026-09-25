/**
 * 浏览器平台装配体（tech-plan §2 表格「浏览器实现」列）。
 * 输入归一在 platform/input.ts（实体 e-input-intent）；时钟：requestAnimationFrame +
 * performance.now；音频：WebAudio 程序化合成。
 * 内核零改动 —— 新平台 = 新增一份装配体。
 */
import type { Platform } from './index.js';
import { createDomInput } from './input.js';
import { createWebAudioSink } from '../audio/sfx.js';

export function createBrowserPlatform(canvas: HTMLCanvasElement): Platform {
  // —— 时钟 ——
  const frameHandlers = new Set<(nowMs: number) => void>();
  let running = true;
  const loop = (now: number): void => {
    if (!running) return;
    for (const h of frameHandlers) h(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // —— 画布：DPR 归一（逻辑坐标 480×720 不随 DPR 变化） ——
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const logicalWidth = canvas.clientWidth || 480;
  const logicalHeight = canvas.clientHeight || 720;
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    input: createDomInput(canvas),
    clock: {
      onNextFrame(handler) {
        frameHandlers.add(handler);
        return () => frameHandlers.delete(handler);
      },
      now: () => performance.now(),
    },
    audio: createWebAudioSink(),
    canvas: {
      logicalWidth,
      logicalHeight,
      context2d: () => {
        if (!ctx) throw new Error('Canvas2D 上下文不可用');
        return ctx;
      },
    },
  };
}
