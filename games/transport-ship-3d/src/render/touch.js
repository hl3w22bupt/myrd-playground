// touch.js — 触屏手势适配（验收口径 B）：单指拖拽=瞄准 / 双指捏合=缩放 / 短按点按=开火。
// 手势冲突消除：三态互斥（press → drag / pinch；进入 pinch 即作废 drag 与 tap），
// touchstart/touchmove 全程 preventDefault（禁浏览器滚动/双击缩放/长按菜单 —— 消除 300ms 点击延迟的根）。
// 双端一致：拖拽灵敏度按视口短边归一（同一手势比例 → 同一转角），与桌面鼠标灵敏度同量级标定。
// 纯函数区（clampZoom / 常量 / 灵敏度）零 DOM 依赖，Node 可直接导入做边界断言（tests/boundary.spec.mjs）。

/** 捏合缩放下限：fov = WORLD_FOV × zoom，zoom 越小看得越近（0.35 ≈ 2.9°视场放大到 ~27°）*/
export const TOUCH_ZOOM_MIN = 0.35;
/** 点按判定上限时长（ms）：超过按拖拽处理，不作开火 */
export const TAP_MAX_MS = 220;
/** 点按位移判定的视口占比：短边 1.6%（≈ iPhone 390px 短边 6px）内视为点按 */
export const TAP_SLOP_RATIO = 0.016;

/** 缩放钳制（纯函数）：非有限值回默认 1（对抗 NaN/Infinity），越界取边界 */
export function clampZoom(f) {
  if (!Number.isFinite(f)) return 1;
  return Math.min(1, Math.max(TOUCH_ZOOM_MIN, f));
}

/** 拖拽灵敏度（纯函数，弧度/像素）：按视口短边归一 —— 短边扫满 ≈ 转 2.4rad（137°），与桌面鼠标 0.0022/px 同量级 */
export function lookSensitivity(viewportSide) {
  const side = Number.isFinite(viewportSide) && viewportSide > 0 ? viewportSide : 800;
  return 2.4 / side;
}

/** 手势识别器：attach 到画布，把三类手势翻译进 inputState（yaw/pitch/tapFire），缩放经 onZoom 上抛 */
export function attachTouch(canvas, state, hooks = {}) {
  const onZoom = typeof hooks.onZoom === "function" ? hooks.onZoom : () => {};
  let zoom = 1;
  // 会话态：idle | press（候选 tap/drag） | drag | pinch
  let mode = "idle";
  let pressId = -1;      // press/drag 跟踪的触摸标识
  let pressX = 0, pressY = 0, pressT = 0;
  let lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;

  const viewportSide = () => Math.min(window.innerWidth, window.innerHeight);
  const slop = () => Math.max(6, viewportSide() * TAP_SLOP_RATIO);
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  function applyLook(dx, dy) {
    const k = lookSensitivity(viewportSide());
    state.yaw -= dx * k;                       // 与桌面 onMouseMove 同向：右滑右转
    state.pitch -= dy * k * 0.8;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
  }

  const onTouchStart = (e) => {
    e.preventDefault(); // 消 300ms 延迟 + 禁合成鼠标事件（防双端双触发）
    const touches = e.touches;
    if (touches.length >= 2) {
      // 第二指落下：无条件切捏合（作废 press/drag —— 手势冲突消除的仲裁点）
      mode = "pinch";
      pinchStartDist = dist(touches);
      pinchStartZoom = zoom;
      return;
    }
    const t = touches[0];
    mode = "press";
    pressId = t.identifier;
    pressX = lastX = t.clientX; pressY = lastY = t.clientY;
    pressT = e.timeStamp;
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const touches = e.touches;
    if (mode === "pinch") {
      if (touches.length < 2) return;
      const d = dist(touches);
      if (pinchStartDist > 0 && d > 0) {
        zoom = clampZoom(pinchStartZoom * (pinchStartDist / d)); // 张开→放大（fov 变小）
        onZoom(zoom);
      }
      return;
    }
    const t = touches[0];
    if (!t || t.identifier !== pressId) return;
    const dx = t.clientX - lastX, dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;
    if (mode === "press") {
      const moved = Math.hypot(t.clientX - pressX, t.clientY - pressY);
      if (moved > slop()) mode = "drag"; // 越过位移阈值：点按作废，升级为拖拽
    }
    if (mode === "drag") applyLook(dx, dy);
  };

  const onTouchEnd = (e) => {
    e.preventDefault();
    const remaining = e.touches.length;
    if (mode === "pinch") {
      if (remaining < 2) mode = remaining === 1 ? "drag" : "idle"; // 剩单指平滑回落拖拽，不抖动
      return;
    }
    if (mode === "press") {
      const dt = e.timeStamp - pressT;
      const moved = Math.hypot((e.changedTouches[0]?.clientX ?? pressX) - pressX, (e.changedTouches[0]?.clientY ?? pressY) - pressY);
      if (dt <= TAP_MAX_MS && moved <= slop()) state.tapFire = true; // 点按 → 开火（下一帧 read 消费单发）
    }
    if (remaining === 0) mode = "idle";
    else if (remaining === 1 && e.changedTouches[0]?.identifier === pressId) mode = "idle"; // 拖拽指抬起
  };

  const onTouchCancel = () => { mode = "idle"; };

  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });

  return {
    /** 缩放状态读取（HUD/调试/无头断言）*/
    get zoom() { return zoom; },
    /** 复位缩放（重开局调用）*/
    resetZoom() { zoom = 1; onZoom(zoom); },
    dispose() {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchCancel);
    },
  };
}

/** 触屏形态检测：主指针为粗指针（手机/平板）→ 触屏优先。以 pointer 媒体查询为准（触屏笔记本
    主指针仍是鼠标 → 保持桌面 pointerLock 形态）；查询不可用时回退 maxTouchPoints。*/
export function isTouchDevice() {
  try {
    if (typeof matchMedia === "function") return matchMedia("(pointer: coarse)").matches;
  } catch { /* 回退判定 */ }
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0;
}
