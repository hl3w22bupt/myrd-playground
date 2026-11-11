// touch.js — 触屏输入：左半屏虚拟摇杆（移动）+ 右下 传球/射门 按钮 + 右半屏点按（确认）。
// 铁律：触摸只产出手势状态/意图回调，不改游戏状态 —— 状态机只经 main.js 的 primary()/动作沿走内核。
// 浏览器手势冲突由 CSS 兜底（touch-action:none + viewport 禁缩放，E-04），本文件不处理样式。
// 方向语义缺陷单 sf-bug-controls 的触屏侧锚点：stickToIntent 纯函数（Node 可断言）。

/** 摇杆位移（屏幕 dx,dy 像素）→ 世界意图（纯函数）：
 *  屏幕左推 dx<0 → moveX<0（世界 -X = 屏幕左）；上推 dy<0 → moveZ<0（世界 -Z = 远离镜头/屏幕上） */
export function stickToIntent(dx, dy, maxRadius) {
  const mag = Math.hypot(dx, dy);
  const k = mag > maxRadius ? maxRadius / mag : 1;
  return { moveX: (dx * k) / maxRadius, moveZ: (dy * k) / maxRadius };
}

export const JOY_MAX_RADIUS = 56; // 摇杆最大位移（px）

export function createTouchControls(canvas, { onConfirm, onPass, onShoot }) {
  const joystick = { activeId: null, startX: 0, startY: 0, dx: 0, dy: 0 };
  const intent = { moveX: 0, moveZ: 0 };

  function setIntent(dx, dy) {
    const it = stickToIntent(dx, dy, JOY_MAX_RADIUS);
    intent.moveX = it.moveX;
    intent.moveZ = it.moveZ;
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

  // —— 动作按钮（DOM，main.js 装配 DOM 时把 touchstart/click 接到 onPass/onShoot；
  //  cb 为空 = 该按钮由 main.js 自行接管（如 v3 射门钮的按住蓄力 pointer 协议），此处不绑 ——
  const bindButton = (id, cb) => {
    const el = document.getElementById(id);
    if (!el || typeof cb !== "function") return;
    const fire = (e) => { e.preventDefault(); e.stopPropagation(); unlockAnd(cb); };
    el.addEventListener("touchstart", fire, { passive: false });
    el.addEventListener("click", fire);
  };
  const unlockAnd = (cb) => cb?.();
  bindButton("btn-pass", onPass);
  bindButton("btn-shoot", onShoot);

  return {
    /** 当前摇杆意图（未摇动 = 零向量）；键盘 intent 与其合并后喂内核 */
    intent: () => ({ ...intent }),
    /** 摇杆可视化数据：锚点 + 当前位移（HUD 画摇杆用） */
    joystickState: () => ({ active: joystick.activeId !== null, dx: joystick.dx, dy: joystick.dy, max: JOY_MAX_RADIUS }),
  };
}
