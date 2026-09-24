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

// ———————— 移动端虚拟摇杆 / 固定按钮（验收口径 B 补齐）：纯几何区，零 DOM，Node 可直接断言 ————————

/** 摇杆区占屏比：屏幕左下 1/4（x ≤ vw/2 且 y ≥ vh/2）归摇杆，其余归瞄准手势 */
export const JOYSTICK_ZONE_RATIO = 0.5;
/** 摇杆行程半径（px）：拇指从中心推到底 = 满速移动 */
export const JOYSTICK_RADIUS = 56;
/** 摇杆死区（归一化占比）：防拇指静置微颤造成移动漂移 */
export const JOYSTICK_DEADZONE = 0.14;
/** 固定按钮热区下限（px）：Apple HIG 44pt —— 低于该值误触率陡增 */
export const BUTTON_HOTZONE_MIN = 44;
/** 开火按钮可视/热区边长（px）：高频主操作，大于热区下限 */
export const FIRE_BUTTON_SIZE = 64;

/** 摇杆区命中判定（纯函数）：左下 1/4 矩形（含边界）。非有限/非正尺寸一律回 false（热区判定宁可不命中） */
export function inJoystickZone(px, py, vw, vh) {
  if (![px, py, vw, vh].every(Number.isFinite)) return false;
  if (vw <= 0 || vh <= 0) return false;
  const half = vw * JOYSTICK_ZONE_RATIO;
  return px >= 0 && px <= half && py >= vh * JOYSTICK_ZONE_RATIO && py <= vh;
}

/** 摇杆向量（纯函数）：落点相对底座中心的像素位移 → 归一化移动意图。
 *  返回 {x: strafe, y: forward, mag}，|v| ≤ 1（超行程按方向截断），死区内回零、死区外线性重缩放。
 *  屏幕 y 轴向下，forward 取负 —— 推上=前进，与键盘 W 同号。非有限输入回零向量（不产 NaN 意图）。*/
export function joystickVector(originX, originY, px, py, radius = JOYSTICK_RADIUS) {
  const r = Number.isFinite(radius) && radius > 0 ? radius : JOYSTICK_RADIUS;
  if (![originX, originY, px, py].every(Number.isFinite)) return { x: 0, y: 0, mag: 0 };
  let nx = (px - originX) / r;
  let ny = -(py - originY) / r;
  const raw = Math.hypot(nx, ny);
  if (raw > 1) { nx /= raw; ny /= raw; } // 超出行程：保方向、钳模长（拇指甩出屏幕也是满速）
  const mag = Math.min(1, raw);
  if (mag <= JOYSTICK_DEADZONE) return { x: 0, y: 0, mag: 0 };
  const scaled = (mag - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
  return { x: +(nx * scaled).toFixed(6), y: +(ny * scaled).toFixed(6), mag: +scaled.toFixed(6) };
}

/** 按钮热区矩形（纯函数）：以可视中心为中心的正方形，边长钳到 ≥ min（44px 热区口径）。
 *  可视元素可以画得更小，热区必须达标 —— 命中率按热区算，不按贴图算。*/
export function hotZoneRect(centerX, centerY, size, min = BUTTON_HOTZONE_MIN) {
  const side = Math.max(Number.isFinite(size) ? size : min, Number.isFinite(min) && min > 0 ? min : BUTTON_HOTZONE_MIN);
  const half = side / 2;
  const cx = Number.isFinite(centerX) ? centerX : 0;
  const cy = Number.isFinite(centerY) ? centerY : 0;
  return { x: cx - half, y: cy - half, w: side, h: side };
}

/** 热区命中判定（纯函数）：闭区间矩形（边界也算命中，热区只放大不缩小）。非有限输入回 false */
export function inHotZone(px, py, rect) {
  if (!rect || ![px, py, rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)) return false;
  if (rect.w <= 0 || rect.h <= 0) return false;
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** 控件布局（纯函数）：给定视口，返回摇杆 + 三按钮的中心/尺寸/热区。
 *  DOM 落位与 CDP 触摸坐标都用它 —— 布局只有一份真源，测试断言与真机落指不会两头各算各的。*/
export function controlLayout(vw, vh) {
  const W = Number.isFinite(vw) && vw > 0 ? vw : 390;
  const H = Number.isFinite(vh) && vh > 0 ? vh : 844;
  const clampCenter = (c, size, span) => Math.min(Math.max(c, size / 2), Math.max(size / 2, span - size / 2));
  const place = (cx, cy, size) => {
    const x = clampCenter(cx, size, W), y = clampCenter(cy, size, H);
    return { cx: x, cy: y, size, zone: hotZoneRect(x, y, size) };
  };
  return {
    viewport: { w: W, h: H },
    joystick: {
      cx: clampCenter(JOYSTICK_RADIUS + 28, JOYSTICK_RADIUS * 2, W),
      cy: clampCenter(H - JOYSTICK_RADIUS - 28, JOYSTICK_RADIUS * 2, H),
      r: JOYSTICK_RADIUS,
    },
    fire: place(W - FIRE_BUTTON_SIZE / 2 - 24, H - FIRE_BUTTON_SIZE / 2 - 64, FIRE_BUTTON_SIZE),
    reload: place(W - FIRE_BUTTON_SIZE - 24 - 76, H - BUTTON_HOTZONE_MIN / 2 - 28, BUTTON_HOTZONE_MIN),
    pause: place(W - BUTTON_HOTZONE_MIN / 2 - 14, BUTTON_HOTZONE_MIN / 2 + 14, BUTTON_HOTZONE_MIN),
  };
}

/** 手势识别器 + 移动控件（验收口径 B）：attach 到画布，把触屏输入翻译进 inputState
 *  （yaw/pitch/tapFire + moveX/moveY 摇杆移动轴），缩放经 onZoom 上抛、暂停经 onPause 上抛。
 *  双通道输入：touchstart/move/end 为主，pointer 事件为降级（同一入口，防双触发去重）；
 *  降级通道 pointerdown 即 setPointerCapture（按住移出画布抬指不失联），capture 不可用时
 *  pointerleave/lostpointercapture 兜底收尾 —— 指针登记表零泄漏（tests/pointer-fallback.spec.mjs 机判）。*/
export function attachTouch(canvas, state, hooks = {}) {
  const onZoom = typeof hooks.onZoom === "function" ? hooks.onZoom : () => {};
  const onPause = typeof hooks.onPause === "function" ? hooks.onPause : () => {};
  let zoom = 1;
  // 瞄准手势会话态：idle | press（候选 tap/drag） | drag | pinch
  let mode = "idle";
  let pressId = -1;      // press/drag 跟踪的指针标识
  let pressX = 0, pressY = 0, pressT = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;

  // —— 指针登记表：touch / pointer 两通道都汇入这里，之后不再区分来源 ——
  const look = new Map();                     // 参与瞄准/捏合/点按的活跃指针 id → {x, y}
  const stick = { id: null, cx: 0, cy: 0 };   // 被摇杆捕获的指针（一次至多一个）
  // 防双触发去重：TouchEvent 可用的环境里，触摸类 pointer 事件一律忽略（touch 通道为主）
  const touchPrimary = typeof TouchEvent === "function" || "ontouchstart" in window;
  const isSynthetic = (e) => touchPrimary && (e.pointerType === "touch" || e.pointerType === "pen");

  const viewportSide = () => Math.min(window.innerWidth, window.innerHeight);
  const slop = () => Math.max(6, viewportSide() * TAP_SLOP_RATIO);

  function applyLook(dx, dy) {
    const k = lookSensitivity(viewportSide());   // 与桌面鼠标同标定（弧度/像素）
    state.yaw -= dx * k;                       // 与桌面 onMouseMove 同向：右滑右转
    state.pitch -= dy * k * 0.8;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
  }

  /** 摇杆意图 → inputState 移动轴（与键盘 WASD 同一字段，read() 时合并）*/
  function applyStick(v) {
    state.moveX = v.x;
    state.moveY = v.y;
  }

  // ———— 统一入口（touch 与 pointer 双通道共用）————
  function beginPointer(id, x, y, ts) {
    if (stick.id === null && inJoystickZone(x, y, window.innerWidth, window.innerHeight)) {
      stick.id = id; stick.cx = x; stick.cy = y;
      applyStick({ x: 0, y: 0, mag: 0 });
      controls?.stickActive(true);
      return;
    }
    look.set(id, { x, y });
    if (look.size >= 2) {
      // 第二指落下：无条件切捏合（作废 press/drag —— 手势冲突消除的仲裁点）
      mode = "pinch";
      const [a, b] = [...look.values()];
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartZoom = zoom;
      return;
    }
    mode = "press";
    pressId = id; pressX = x; pressY = y; pressT = ts;
  }

  function movePointer(id, x, y) {
    if (id === stick.id) {
      applyStick(joystickVector(stick.cx, stick.cy, x, y));
      controls?.stickKnob(state.moveX, state.moveY);
      return;
    }
    const prev = look.get(id);
    if (!prev) return;
    const dx = x - prev.x, dy = y - prev.y;
    prev.x = x; prev.y = y;
    if (mode === "pinch") {
      if (look.size < 2) return;
      const [a, b] = [...look.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStartDist > 0 && d > 0) {
        zoom = clampZoom(pinchStartZoom * (pinchStartDist / d)); // 张开→放大（fov 变小）
        onZoom(zoom);
      }
      return;
    }
    if (id !== pressId) return;
    if (mode === "press" && Math.hypot(x - pressX, y - pressY) > slop()) mode = "drag"; // 越阈值：点按作废
    if (mode === "drag") applyLook(dx, dy);
  }

  function endPointer(id, x, y, ts, cancelled = false) {
    if (id === stick.id) {                       // 摇杆指抬起：移动意图立即清零（不漂移）
      stick.id = null;
      applyStick({ x: 0, y: 0, mag: 0 });
      controls?.stickActive(false);
      return;
    }
    if (!look.has(id)) return;
    if (!cancelled && mode === "press" && id === pressId) {
      const dt = ts - pressT;
      const moved = Math.hypot(x - pressX, y - pressY);
      if (dt <= TAP_MAX_MS && moved <= slop()) state.tapFire = true; // 点按 → 开火（下一帧 read 消费单发）
    }
    look.delete(id);
    if (mode === "pinch") {
      // 剩单指平滑回落拖拽（重新锚定，避免抬指瞬间的位移抖动）
      if (look.size === 1) {
        const [nid, p] = [...look.entries()][0];
        mode = "drag"; pressId = nid; pressX = p.x; pressY = p.y; pressT = ts;
      } else mode = "idle";
      return;
    }
    if (id === pressId) { mode = "idle"; pressId = -1; }
    else if (look.size === 0) mode = "idle";
  }

  let controls = null; // 控件 DOM（摇杆/按钮），touch 形态才创建

  // ———— 通道①：touch 事件（主路径；preventDefault 消 300ms 延迟 + 禁合成鼠标事件）————
  const onTouchStart = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) beginPointer(t.identifier, t.clientX, t.clientY, e.timeStamp);
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) movePointer(t.identifier, t.clientX, t.clientY);
  };
  const onTouchEnd = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) endPointer(t.identifier, t.clientX, t.clientY, e.timeStamp);
  };
  const onTouchCancel = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) endPointer(t.identifier, t.clientX, t.clientY, e.timeStamp, true);
  };

  // ———— 通道②：pointer 事件（降级路径，无 TouchEvent 的环境兜底）————
  const onPointerDown = (e) => {
    if (isSynthetic(e)) return;
    // 捕获指针：按住期间移出画布，pointerup/move 仍投递到画布（抬指不失联 —— 红队复验次级观察点收口）。
    // 无该 API（旧环境）/ 指针未激活（合成事件）会抛错 → 吞掉，由 pointerleave 兜底收尾。
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* 捕获不可用 → leave 兜底 */ }
    beginPointer(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };
  const onPointerMove = (e) => { if (!isSynthetic(e)) movePointer(e.pointerId, e.clientX, e.clientY); };
  const onPointerUp = (e) => { if (!isSynthetic(e)) endPointer(e.pointerId, e.clientX, e.clientY, e.timeStamp); };
  const onPointerCancel = (e) => { if (!isSynthetic(e)) endPointer(e.pointerId, e.clientX, e.clientY, e.timeStamp, true); };
  // 抬指兜底：按住移出画布（capture 不可用的环境）/ 捕获被系统抢占释放 → 按取消收尾。
  // 泄漏后果：残留条目使下一指 look.size≥2 → 误入捏合（拖拽失灵 + 意外缩放）。
  // 正常 pointerup 后的隐式 lostpointercapture/pointerleave 在此空转早退（会话已收尾，零副作用）。
  const onPointerAbandon = (e) => {
    if (isSynthetic(e)) return;
    if (look.has(e.pointerId) || e.pointerId === stick.id) {
      endPointer(e.pointerId, e.clientX ?? 0, e.clientY ?? 0, e.timeStamp ?? 0, true);
    }
  };

  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerAbandon);
  canvas.addEventListener("lostpointercapture", onPointerAbandon);

  // ———— 控件 DOM（验收口径 B）：摇杆 + 开火/换弹/暂停固定按钮，触发与键鼠同一路径 ————
  // 开火 → state.firing（与鼠标左键同字段，按住连发）；换弹 → state.reloadQueued（与 R 键同字段）；
  // 暂停 → hooks.onPause（与 Esc/P 同一状态切换）。250ms 去重：pointerdown 与 touchstart 双触发只算一次。
  if (hooks.controls !== false && isTouchDevice()) {
    const host = hooks.host ?? document.getElementById("ui") ?? document.body;
    controls = buildControls(host, canvas, {
      fire: () => { state.firing = true; },
      fireRelease: () => { state.firing = false; },
      reload: () => { state.reloadQueued = true; },
      pause: () => onPause(),
    });
  }

  return {
    /** 缩放状态读取（HUD/调试/无头断言）*/
    get zoom() { return zoom; },
    /** 复位缩放（重开局调用）+ 清空移动意图（重开不漂移）*/
    resetZoom() {
      zoom = 1; onZoom(zoom);
      applyStick({ x: 0, y: 0, mag: 0 });
    },
    /** 控件几何（热区矩形，viewport 坐标）：无头断言 / CDP 触摸坐标唯一来源 */
    rects() {
      return controls ? controls.rects() : null;
    },
    dispose() {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchCancel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerAbandon);
      canvas.removeEventListener("lostpointercapture", onPointerAbandon);
      controls?.dispose();
      controls = null;
    },
  };
}

/** 固定按钮/摇杆 DOM 装配（内部）：落位取 controlLayout（布局唯一真源），样式与 HUD 同一张色卡。*/
function buildControls(host, canvas, handlers) {
  const layout = () => controlLayout(window.innerWidth, window.innerHeight);
  const root = document.createElement("div");
  root.id = "ts-touchctl";
  root.innerHTML = `
    <div id="ts-stick" aria-hidden="true"><i id="ts-stick-knob"></i></div>
    <button id="ts-btn-fire" type="button" aria-label="开火">FIRE</button>
    <button id="ts-btn-reload" type="button" aria-label="换弹">R</button>
    <button id="ts-btn-pause" type="button" aria-label="暂停">II</button>`;
  host.appendChild(root);

  const $ = (id) => root.querySelector(`#${id}`);
  const el = { stick: $("ts-stick"), knob: $("ts-stick-knob"), fire: $("ts-btn-fire"), reload: $("ts-btn-reload"), pause: $("ts-btn-pause") };

  // 落位：由 controlLayout 计算并直写 style（不依赖 CSS 布局，尺寸/热区与测试同一份几何）
  const place = (node, zone) => {
    node.style.width = `${zone.w}px`;
    node.style.height = `${zone.h}px`;
    node.style.left = `${zone.x}px`;
    node.style.top = `${zone.y}px`;
  };
  const applyLayout = () => {
    const L = layout();
    place(el.stick, hotZoneRect(L.joystick.cx, L.joystick.cy, L.joystick.r * 2));
    place(el.fire, L.fire.zone);
    place(el.reload, L.reload.zone);
    place(el.pause, L.pause.zone);
  };
  applyLayout();

  /** 250ms 去重：touch 与 pointer 双通道同时投递时只放行一次（对齐 hud.onStart 口径）*/
  const dedupe = (fn) => {
    let last = -Infinity;
    return () => { const now = performance.now(); if (now - last < 250) return; last = now; fn(); };
  };
  const onReload = dedupe(handlers.reload);
  const onPause = dedupe(handlers.pause);

  const bind = (node, down, up) => {
    const d = (e) => { e.preventDefault(); e.stopPropagation(); down(); };
    const u = (e) => { e.preventDefault(); up?.(); };
    node.addEventListener("touchstart", d, { passive: false });
    node.addEventListener("touchend", u, { passive: false });
    node.addEventListener("touchcancel", u, { passive: false });
    node.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; d(e); });
    node.addEventListener("pointerup", (e) => { if (e.pointerType === "mouse") return; u(e); });
    node.addEventListener("contextmenu", (e) => e.preventDefault());
  };
  // 开火：按住连发（down=true / up=false），与鼠标左键同一 inputState.firing 路径 —— 双触发天然幂等，不去重
  bind(el.fire, handlers.fire, handlers.fireRelease);
  bind(el.reload, onReload);
  bind(el.pause, onPause);

  return {
    stickActive(on) { el.stick.classList.toggle("on", on); if (!on) el.knob.style.transform = "translate(0px, 0px)"; },
    stickKnob(x, y) {
      const r = JOYSTICK_RADIUS * 0.62;
      el.knob.style.transform = `translate(${(x * r).toFixed(1)}px, ${(y * r).toFixed(1)}px)`;
    },
    /** 实时热区（getBoundingClientRect，viewport 坐标）：无头断言 / CDP 触摸坐标 */
    rects() {
      const box = (node) => {
        const b = node.getBoundingClientRect();
        return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
      };
      return { joystick: box(el.stick), fire: box(el.fire), reload: box(el.reload), pause: box(el.pause) };
    },
    relayout: applyLayout,
    dispose() { root.remove(); },
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
