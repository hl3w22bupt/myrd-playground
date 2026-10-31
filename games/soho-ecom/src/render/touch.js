// touch.js — 触屏输入：单指拖动轨道偏移（氛围 viewer 交互）+ 右侧点按确认（开始/继续/重开）。
// 铁律：触摸只产出手势状态/意图回调，不改游戏状态 —— 状态机只经 main.js 的 primary() 走内核。
// 浏览器手势冲突由 CSS 兜底（canvas touch-action:none + viewport 禁缩放，E-04）；面板区 pan-y 可滚。

export function createTouchControls(canvas, { onConfirm }) {
  const drag = { activeId: null, lastX: 0, lastY: 0 };
  const offset = { x: 0, y: 0 }; // 轨道偏移（弧度/高度），钳幅防甩出房间
  let tapStart = null;

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); // 阻止合成鼠标事件与手势
    for (const t of e.changedTouches) {
      if (drag.activeId === null) {
        drag.activeId = t.identifier;
        drag.lastX = t.clientX;
        drag.lastY = t.clientY;
        tapStart = { x: t.clientX, y: t.clientY, time: Date.now() };
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== drag.activeId) continue;
      const dx = t.clientX - drag.lastX;
      const dy = t.clientY - drag.lastY;
      drag.lastX = t.clientX;
      drag.lastY = t.clientY;
      offset.x = Math.max(-0.9, Math.min(0.9, offset.x + dx * 0.004));
      offset.y = Math.max(-0.5, Math.min(0.5, offset.y + dy * 0.004));
      tapStart = null; // 拖过就不算点按
    }
  }, { passive: false });

  const release = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== drag.activeId) continue;
      drag.activeId = null;
      // 位移小 + 时长短 = 点按确认（开始/继续/重开）
      if (tapStart && Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) < 14 && Date.now() - tapStart.time < 350) {
        onConfirm?.();
      }
      tapStart = null;
    }
  };
  canvas.addEventListener("touchend", release);
  canvas.addEventListener("touchcancel", release);

  return {
    /** 轨道偏移（scene.orbitCamera 消费；未拖拽时缓慢回正） */
    dragOffset: () => ({ ...offset }),
    relax: (k) => {
      offset.x *= k;
      offset.y *= k;
    },
  };
}
