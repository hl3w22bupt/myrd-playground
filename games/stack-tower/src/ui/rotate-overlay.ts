/**
 * 横屏遮罩（实体 e-rotate-overlay，M2.1）— 判定纯函数 + DOM 遮罩（可注入，Node 可测）。
 * 契约（spec v3 content.mobile.rotateOverlay / acc-m4 / acc-m3）：
 *  - 判定 = 视口宽高比：isLandscapeViewport(w,h) ⇔ w/h > ROTATE_ASPECT_RATIO(=1)；
 *  - 激活即暂停：遮罩激活期间内核 tick 不推进、输入意图被忽略（main 消费 active 状态）；
 *  - 恢复竖屏自动解除；文案「请竖屏游玩」。
 */

/** 宽高比判定（纯函数）：横屏（w > h）即 true；正方形不算横屏 */
export function isLandscapeViewport(width: number, height: number, ratio = 1): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return width / height > ratio;
}

export interface RotateOverlayHandle {
  /** 以最新视口尺寸驱动遮罩；返回是否激活 */
  setViewport(width: number, height: number): boolean;
  /** 当前是否激活（激活 = 暂停） */
  isActive(): boolean;
  /** 状态变化回调（main 用它挂起/恢复内核） */
  onChange(handler: (active: boolean) => void): () => void;
  /** 挂 DOM（宿主缺失时为无操作，headless 安全） */
  mount(host: HTMLElement | null): void;
  dispose(): void;
}

/** 遮罩控制器：DOM 可注入（测试传 null 也能跑通状态机） */
export function createRotateOverlay(ratio = 1): RotateOverlayHandle {
  let active = false;
  let host: HTMLElement | null = null;
  let el: HTMLElement | null = null;
  const handlers = new Set<(active: boolean) => void>();

  function setActive(next: boolean): boolean {
    if (next === active) return active;
    active = next;
    if (el) el.style.display = active ? 'flex' : 'none';
    for (const h of handlers) h(active);
    return active;
  }

  return {
    setViewport(width, height) {
      return setActive(isLandscapeViewport(width, height, ratio));
    },
    isActive: () => active,
    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    mount(target) {
      host = target;
      if (!host) return;
      if (!el) {
        el = document.createElement('div');
        el.id = 'st-rotate-overlay';
        el.textContent = '请竖屏游玩';
        el.className = 'st-rotate-overlay';
        el.style.display = 'none';
      }
      host.appendChild(el);
    },
    dispose() {
      handlers.clear();
      el?.remove();
      el = null;
    },
  };
}
