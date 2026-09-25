/**
 * 输入意图（实体 e-input-intent）— 点击/空格/触摸 → {type:'drop'} 单一意图。
 * 职责（spec 实体表）：去抖与多点触控归一，全部收口在本文件；内核零感知输入来源。
 */
import type { InputSource } from './index.js';
import type { PlayerIntent } from '../kernel/types.js';

export const INTENT_DEBOUNCE_MS = 300;

/** DOM 输入源：pointerdown（触摸归一）+ 空格；300ms 去抖；R 键不算落块意图（归重开） */
export function createDomInput(target: Pick<HTMLElement, 'addEventListener'>): InputSource {
  const handlers = new Set<(intent: PlayerIntent) => void>();
  let lastFire = -Infinity;

  const fire = (): void => {
    const now = performance.now();
    if (now - lastFire < INTENT_DEBOUNCE_MS) return; // 去抖：连点不做连落
    lastFire = now;
    for (const h of handlers) h({ type: 'drop' });
  };

  const opts: AddEventListenerOptions = { passive: false };
  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fire();
  }, opts); // pointerdown 已归一点击/触摸/笔，多点触控不再各派一次
  window.addEventListener('keydown', (e) => {
    const isSpace = e.code === 'Space' || e.key === ' ';
    if (!isSpace) return; // r/R 归重开入口（app/main），不作为落块意图
    e.preventDefault();
    fire();
  });

  return {
    onIntent(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
