#!/usr/bin/env node
// pointer-fallback.spec.mjs — 验收口径 B：pointer 降级通道健壮性对抗断言（常驻 CI，零依赖 Node 直跑）。
// 红队复验次级观察点收口：pointer 降级通道若无「按住移出画布」的抬指兜底，
//   look 指针登记表会泄漏残留条目 —— 多指针（笔/触控板等 pointerId 各异）场景下，
//   下一次落指 look.size≥2 → 误入捏合模式（拖拽失灵 + 意外缩放）。
// 机判四组对抗：
//   ① pointerleave 兜底：按住移出画布（无 setPointerCapture 的旧环境）→ 会话必须收尾，
//      随后单指拖拽仍走 drag 通路（yaw 再偏转、zoom 恒 1 —— 不得误入捏合）。
//   ② setPointerCapture 接线：pointerdown 必须尝试捕获该指针（移出画布时 pointerup 仍投递到画布）。
//   ③ 捕获不可用不致命：setPointerCapture 抛异常（合成指针未激活等）时降级通道照常工作。
//   ④ lostpointercapture 兜底：捕获被系统抢占/释放后残留会话必须收尾（正常 pointerup 后的
//      隐式释放事件不得产生副作用 —— 空转早退）。
// 纯 DOM-stub 实现：不依赖浏览器，CI 无 Chrome 环境也可常驻运行。
import { attachTouch } from "../src/render/touch.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const ok = (cond, m) => (cond ? pass(m) : fail(m));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ———— DOM stub：仅实现 attachTouch 消费面 ————
function makeCanvasStub({ withCapture = true, captureThrows = false } = {}) {
  const listeners = new Map();
  const captureCalls = [];
  const canvas = {
    style: {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, ev) { for (const fn of [...(listeners.get(type) ?? [])]) fn(ev); },
  };
  if (withCapture) {
    canvas.setPointerCapture = (id) => {
      if (captureThrows) throw new Error("NotFoundError: 指针未激活");
      captureCalls.push(id);
    };
    canvas.releasePointerCapture = () => {};
  }
  return { canvas, listeners, captureCalls };
}

const makeState = () => ({ yaw: 0, pitch: 0, firing: false, reloadQueued: false, tapFire: false, moveX: 0, moveY: 0 });
const ev = (id, x, y, type = "mouse") => ({
  pointerId: id, pointerType: type, clientX: x, clientY: y,
  timeStamp: performance.now(), preventDefault() {}, stopPropagation() {},
});
// Node 环境自证：无 TouchEvent / window stub 无 ontouchstart → touch 主通道不存在，pointer 降级通道即唯一通路
globalThis.window = { innerWidth: 390, innerHeight: 844 };
const touchAbsent = typeof TouchEvent === "undefined" && !("ontouchstart" in globalThis.window);
if (!touchAbsent) { console.error("  FAIL  环境自证失败：本 spec 必须运行在无 TouchEvent 的 Node 环境"); process.exit(1); }
pass("环境自证：无 TouchEvent → pointer 降级通道为唯一通路（断言前提成立）");

// ———— ① pointerleave 兜底（无 setPointerCapture 的旧环境）————
{
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  const { canvas, captureCalls } = makeCanvasStub({ withCapture: false });
  const state = makeState();
  const ctl = attachTouch(canvas, state, { controls: false });

  canvas.dispatch("pointerdown", ev(7, 100, 300));
  canvas.dispatch("pointermove", ev(7, 300, 300)); // 越 slop → drag：yaw -= 200k
  const yawAfterDrag1 = state.yaw;
  ok(yawAfterDrag1 < -0.5, "降级通道基础拖拽可用（单指 drag 偏航）", `yaw=${yawAfterDrag1.toFixed(4)}`);

  canvas.dispatch("pointerleave", ev(7, -40, -40)); // 按住移出画布（旧环境：pointerup 丢失）
  const zoomBefore2 = ctl.zoom;
  canvas.dispatch("pointerdown", ev(9, 100, 300));  // 新指针落指（pointerId 各异）
  canvas.dispatch("pointermove", ev(9, 300, 300));
  const yawDelta2 = state.yaw - yawAfterDrag1;
  ok(near(ctl.zoom, 1) && near(zoomBefore2, 1),
    "①a 残留会话已收尾：下一指走 drag 通路不误入捏合（zoom 恒 1）", `zoom=${ctl.zoom}`);
  ok(yawDelta2 < -0.5 && near(yawDelta2, yawAfterDrag1),
    "①b 下一指拖拽偏航与首指同量级（会话干净，无幽灵指针劫持）",
    `yawDelta2=${yawDelta2.toFixed(4)} vs first=${yawAfterDrag1.toFixed(4)}`);
  canvas.dispatch("pointerup", ev(9, 300, 300));

  // pointercancel 同口径收尾（既有行为回归保护）
  canvas.dispatch("pointerdown", ev(13, 100, 300));
  canvas.dispatch("pointercancel", ev(13, 120, 300));
  canvas.dispatch("pointerdown", ev(14, 100, 300));
  canvas.dispatch("pointermove", ev(14, 220, 300));
  ok(near(ctl.zoom, 1) && state.yaw < yawAfterDrag1 + yawDelta2 - 0.3,
    "①c pointercancel 会话收尾不泄漏（cancel 后新指仍为单指 drag）", `zoom=${ctl.zoom}`);
  canvas.dispatch("pointerup", ev(14, 220, 300));
  ctl.dispose();
  ok(captureCalls.length === 0, "①d 无 setPointerCapture 环境零捕获调用（try/catch 可选链不炸）",
    `calls=${captureCalls.length}`);
}

// ———— ② setPointerCapture 接线（红队观察点本体：捕获必须在 down 时尝试）————
{
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  const { canvas, captureCalls } = makeCanvasStub({ withCapture: true });
  const state = makeState();
  const ctl = attachTouch(canvas, state, { controls: false });
  canvas.dispatch("pointerdown", ev(5, 120, 300));
  ok(captureCalls.includes(5), "② pointerdown 即尝试 setPointerCapture（移出画布抬指不失联）",
    `captureCalls=${JSON.stringify(captureCalls)}`);
  canvas.dispatch("pointerup", ev(5, 160, 300));
  ctl.dispose();
}

// ———— ③ 捕获不可用不致命（合成指针/未激活时 setPointerCapture 抛异常）————
{
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  const { canvas } = makeCanvasStub({ withCapture: true, captureThrows: true });
  const state = makeState();
  const ctl = attachTouch(canvas, state, { controls: false });
  let threw = false;
  try {
    canvas.dispatch("pointerdown", ev(21, 100, 300));
    canvas.dispatch("pointermove", ev(21, 200, 300));
    canvas.dispatch("pointerup", ev(21, 200, 300));
  } catch { threw = true; }
  ok(!threw && state.yaw < -0.5, "③ setPointerCapture 抛异常被吞：降级通道照常拖拽", `yaw=${state.yaw.toFixed(4)}`);
  ctl.dispose();
}

// ———— ④ lostpointercapture 兜底 + 正常 pointerup 后的隐式释放零副作用 ————
{
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  const { canvas } = makeCanvasStub({ withCapture: true });
  const state = makeState();
  const ctl = attachTouch(canvas, state, { controls: false });

  canvas.dispatch("pointerdown", ev(31, 100, 300));
  canvas.dispatch("pointermove", ev(31, 140, 300));
  canvas.dispatch("lostpointercapture", ev(31, 200, 300)); // 捕获被抢/元素失焦 → 必须收尾
  canvas.dispatch("pointerdown", ev(32, 100, 300));
  canvas.dispatch("pointermove", ev(32, 300, 300));
  ok(near(ctl.zoom, 1) && state.yaw < -0.8,
    "④a lostpointercapture 残留会话收尾：新指单指 drag 正常（zoom 恒 1）",
    `zoom=${ctl.zoom} yaw=${state.yaw.toFixed(4)}`);
  canvas.dispatch("pointerup", ev(32, 300, 300));

  // 正常路径：pointerup 后隐式 lostpointercapture + pointerleave 必须空转早退（不得重复消费 tap/清错状态）
  const yawStable = state.yaw;
  const tapsBefore = state.tapFire;
  canvas.dispatch("pointerdown", ev(33, 150, 300));
  canvas.dispatch("pointerup", ev(33, 151, 300));            // 点按（< slop）：tapFire 下一帧消费
  canvas.dispatch("lostpointercapture", ev(33, 151, 300));   // 隐式释放（晚于 pointerup）
  canvas.dispatch("pointerleave", ev(33, 151, 300));         // 移出画布（捕获已释放）
  ok(state.tapFire === true && near(state.yaw, yawStable),
    "④b 正常点按后的隐式释放事件零副作用（tap 保留、yaw 不动）",
    `tapFire=${state.tapFire} yaw=${state.yaw.toFixed(4)}`);
  ok(tapsBefore === false, "④c 点按前 tapFire 为 false（断言有效前提）");
  ctl.dispose();
  canvas.dispatch("pointermove", ev(33, 999, 999)); // dispose 后监听应全卸载 → 零消费
  ok(near(state.yaw, yawStable),
    "④d dispose 后监听全卸载（含 pointerleave/lostpointercapture），残留事件零影响",
    `yaw=${state.yaw.toFixed(4)} 期望=${yawStable.toFixed(4)}`);
}

// ———— 汇总 ————
if (failures.length) {
  console.error(`POINTER-FALLBACK: FAIL（${failures.length} 项未过）`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log("POINTER-FALLBACK: PASS pointer 降级通道四组对抗全过（leave/capture/异常/隐式释放）");
