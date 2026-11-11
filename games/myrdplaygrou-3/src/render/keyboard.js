// keyboard.js — 键盘意图映射（纯函数，Node 可直接断言 —— 方向键语义的唯一真源）。
// 镜头约定：相机在 +Z 后上方看向 -Z（竖屏长轴 = 进攻方向）。
//   屏幕左  = 世界 -X；屏幕右 = 世界 +X；屏幕上（远离镜头）= 世界 -Z；屏幕下（朝镜头）= +Z。
// 缺陷单 sf-bug-controls（左右反向：按左向右走）的修复锚点：本文件 + tests/controls-direction.spec.mjs。
// 任何方向映射改动必须先改这里与 spec 的「方向键验收标准」，再让对应测试转绿。

/** 由按下键集合产出移动意图：ArrowLeft/A → moveX=-1（屏幕左），ArrowUp/W → moveZ=-1（屏幕上） */
export function keyboardIntent(pressed) {
  const has = (code) => pressed.has ? pressed.has(code) : pressed[code] === true;
  return {
    moveX: (has("KeyD") || has("ArrowRight") ? 1 : 0) - (has("KeyA") || has("ArrowLeft") ? 1 : 0),
    moveZ: (has("KeyS") || has("ArrowDown") ? 1 : 0) - (has("KeyW") || has("ArrowUp") ? 1 : 0),
  };
}

/** 移动键集合（main.js keydown 过滤用） */
export const MOVE_KEYS = Object.freeze([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);
