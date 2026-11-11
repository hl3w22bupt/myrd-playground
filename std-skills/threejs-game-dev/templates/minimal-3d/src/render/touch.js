// touch.js — 触屏输入：左半屏虚拟摇杆（移动）+ 右半屏点按（确认）。
// 铁律：触摸只产出手势状态/意图回调，不改游戏状态 —— 状态机只经 main.js 的 primary() 走内核。
// 浏览器手势冲突由 CSS 兜底（touch-action:none + viewport 禁缩放，E-04），本文件不处理样式。

export function createTouchControls(canvas, { onConfirm }) {
  const joystick = { activeId: null, startX: 0, startY: 0, dx: 0, dy: 0 };
  const MAX_RADIUS = 56; // 摇杆最大位移（px）
  const intent = { moveX: 0, moveZ: 0 };

  function setIntent(dx, dy) {
    const mag = Math.hypot(dx, dy);
    const k = mag > MAX_RADIUS ? MAX_RADIUS / mag : 1;
    // 屏幕向量 → 世界意图：屏幕上推 = -Z（远离相机），左推 = -X
    intent.moveX = (dx * k) / MAX_RADIUS;
    intent.moveZ = (dy * k) / MAX_RADIUS;
  }

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); // 阻止合成鼠标事件与手势
    for (const t of e.changedTouches) {
      if (t.clientX < canvas.clientWidth * 0.45 && joystick.activeId === null) {
        joystick.activeId = t.identifier;
        joystick.startX = t.clientX;
        joystick.startY = t.clientY;
        joystick.dx = 0; joystick.dy = 0;
      } else if (t.clientX >= canvas.clientWidth * 0.45) {
        onConfirm?.(); // 右半屏点按 = 确认（开始/继续/重开）
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.activeId) {
        joystick.dx = t.clientX - joystick.startX;
        joystick.dy = t.clientY - joystick.startY;
        setIntent(joystick.dx, joystick.dy);
      }
    }
  }, { passive: false });

  const release = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.activeId) {
        joystick.activeId = null;
        intent.moveX = 0; intent.moveZ = 0;
      }
    }
  };
  canvas.addEventListener("touchend", release);
  canvas.addEventListener("touchcancel", release);

  return {
    /** 当前摇杆意图（未摇动 = 零向量）；键盘 intent 与其合并后喂内核 */
    intent: () => ({ ...intent }),
    /** 摇杆可视化数据（调试面板/展示用）：锚点 + 当前位移 */
    joystickState: () => ({ active: joystick.activeId !== null, dx: joystick.dx, dy: joystick.dy, max: MAX_RADIUS }),
  };
}
