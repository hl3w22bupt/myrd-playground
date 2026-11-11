#!/usr/bin/env node
// controls-direction.spec.mjs — 方向键语义门禁（缺陷单 sf-bug-controls 的常驻回归锚点）。
// 缺陷：v1 线上版左右方向键反向（按左向右走）。验收标准（策划案 v2）：
//   ① 键盘 ArrowLeft/A → moveX = -1；ArrowRight/D → +1；ArrowUp/W → moveZ = -1；ArrowDown/S → +1
//   ② 内核：intent.moveX=-1 → 球员 x 递减（屏幕左）；moveZ=-1 → z 递减（屏幕上/远离镜头）
//   ③ 触屏摇杆左推（dx<0）→ moveX<0 → 球员 x 递减（与键盘同向，双端一致）
// 镜头约定：相机在 +Z 后上方看向 -Z —— 屏幕左=-X、屏幕右=+X、屏幕上=-Z、屏幕下=+Z。
import { createGame } from "../src/kernel/loop.js";
import { keyboardIntent } from "../src/render/keyboard.js";
import { stickToIntent, JOY_MAX_RADIUS } from "../src/render/touch.js";
import { SEED_DEFAULT } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— ① 键盘映射（映射表唯一真源 render/keyboard.js）——
const asSet = (codes) => new Set(codes);
ok(keyboardIntent(asSet(["ArrowLeft"])).moveX === -1, "ArrowLeft → moveX=-1（屏幕左）");
ok(keyboardIntent(asSet(["KeyA"])).moveX === -1, "KeyA → moveX=-1");
ok(keyboardIntent(asSet(["ArrowRight"])).moveX === 1, "ArrowRight → moveX=+1（屏幕右）");
ok(keyboardIntent(asSet(["KeyD"])).moveX === 1, "KeyD → moveX=+1");
ok(keyboardIntent(asSet(["ArrowUp"])).moveZ === -1, "ArrowUp → moveZ=-1（屏幕上/远离镜头）");
ok(keyboardIntent(asSet(["KeyW"])).moveZ === -1, "KeyW → moveZ=-1");
ok(keyboardIntent(asSet(["ArrowDown"])).moveZ === 1, "ArrowDown → moveZ=+1（屏幕下）");
ok(keyboardIntent(asSet(["KeyS"])).moveZ === 1, "KeyS → moveZ=+1");
const both = keyboardIntent(asSet(["ArrowLeft", "ArrowUp"]));
ok(both.moveX === -1 && both.moveZ === -1, "斜向组合（左+上）两轴同时生效");

// —— ② 内核位移符号（与屏幕方向一致：左推 x 减、上推 z 减）——
function probe(mx, mz) {
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const id = g.world.controlledId;
  const x0 = g.world.players[id].x, z0 = g.world.players[id].z;
  g.fastForward(0.25, { moveX: mx, moveZ: mz, pass: false, shoot: false });
  return { dx: g.world.players[id].x - x0, dz: g.world.players[id].z - z0 };
}
const L = probe(-1, 0), R = probe(1, 0), U = probe(0, -1), D = probe(0, 1);
ok(L.dx < -0.5, `按左 → 球员向屏幕左移动（dx=${L.dx.toFixed(2)} < 0）`);
ok(R.dx > 0.5, `按右 → 球员向屏幕右移动（dx=${R.dx.toFixed(2)} > 0）`);
ok(U.dz < -0.5, `按上 → 球员向屏幕上/远离镜头移动（dz=${U.dz.toFixed(2)} < 0）`);
ok(D.dz > 0.5, `按下 → 球员向屏幕下/朝镜头移动（dz=${D.dz.toFixed(2)} > 0）`);
ok(Math.abs(L.dx) > Math.abs(R.dx) === false && Math.abs(L.dx + R.dx) < 1e-9,
  "左右位移量对称（无偏置）");

// —— ③ 触屏摇杆映射（纯函数）+ 内核一致性 ——
const joyL = stickToIntent(-JOY_MAX_RADIUS, 0, JOY_MAX_RADIUS);
const joyR = stickToIntent(JOY_MAX_RADIUS, 0, JOY_MAX_RADIUS);
const joyU = stickToIntent(0, -JOY_MAX_RADIUS, JOY_MAX_RADIUS);
const joyD = stickToIntent(0, JOY_MAX_RADIUS, JOY_MAX_RADIUS);
ok(joyL.moveX === -1, "摇杆左推满 → moveX=-1");
ok(joyR.moveX === 1, "摇杆右推满 → moveX=+1");
ok(joyU.moveZ === -1, "摇杆上推满 → moveZ=-1");
ok(joyD.moveZ === 1, "摇杆下推满 → moveZ=+1");
const joyHalf = stickToIntent(-JOY_MAX_RADIUS * 0.4, 0, JOY_MAX_RADIUS);
ok(joyHalf.moveX < 0 && joyHalf.moveX > -1, "摇杆半程 → 模拟量（不跳变）");
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const id = g.world.controlledId;
  const x0 = g.world.players[id].x;
  g.fastForward(0.25, { ...joyL, pass: false, shoot: false });
  ok(g.world.players[id].x < x0 - 0.5, "摇杆左推 → 内核球员向屏幕左移动（双端一致）");
}
// 非法值加固（E-09）：NaN/1e9 不许污染
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.tick(1 / 60, { moveX: NaN, moveZ: 1e9, pass: "x", shoot: 42 });
  const p = g.world.players[g.world.controlledId];
  ok(Number.isFinite(p.x) && Number.isFinite(p.z), "注入 NaN/1e9/脏动作标志 → 坐标仍有限");
}

console.log(failures.length ? `CONTROLS-DIRECTION: FAIL（${failures.length}）` : "CONTROLS-DIRECTION: PASS");
process.exit(failures.length ? 1 : 0);
