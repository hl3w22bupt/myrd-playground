// input-semantics.spec.mjs — 验收口径：输入语义正确性（2026-09-25 A/D 镜像事故回归，常驻 CI）。
//
// 事故：内核 strafe 基取了 (cos yaw, −sin yaw)，而渲染层相机（ry=π+yaw）的屏幕右向量是
// (−cos yaw, sin yaw) —— 恰好反号。数据层完全合法（无头测试全绿），渲染到屏幕后 A/D 整体
// 镜像：按 A 向屏幕右、按 D 向屏幕左。本测试把「意图轴 → 世界位移 → 屏幕方向」这条跨层
// 链路钉成断言：strafe=+1 的位移必须与屏幕右同向、forward=+1 的位移必须与视线同向，任何
// yaw 下都成立；摇杆与键盘共用同一 strafe 轴（joystickVector 右推 = +1），一处约定两层生效。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createGame } from "../src/kernel/loop.js";
import { FIXED_STEP } from "../src/numeric.js";
import { joystickVector } from "../src/render/touch.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, "..");

/** 渲染层相机约定（render/player.js apply()）：camera.rotation.y = π + yaw（YXZ）。
 *  由此视线 = (sin yaw, cos yaw)、屏幕右 = (−cos yaw, sin yaw)（xz 平面）。 */
const viewDir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const screenRight = (yaw) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });
const dot = (a, b) => a.x * b.x + a.z * b.z;

/** 跑 N 帧单轴意图，返回玩家位移（世界 xz）。 */
function probe(intent) {
  const g = createGame({ seed: 7 });
  const before = g.state ? null : null;
  const p0 = g.world.player;
  const sx = p0.x, sz = p0.z;
  for (let i = 0; i < 12; i++) g.frame(FIXED_STEP, intent);
  const p1 = g.world.player;
  void before;
  return { x: p1.x - sx, z: p1.z - sz };
}

const YAWS = [0, Math.PI / 2, Math.PI, (4 * Math.PI) / 3, -Math.PI / 6, 2.5];

// 源码金丝雀：屏幕基向量的解析式依赖渲染层这行相机位姿，若被改动，本文件的约定必须同步重推。
const playerSrc = readFileSync(path.join(gameRoot, "src", "render", "player.js"), "utf8");
assert.ok(
  /camera\.rotation\.y = Math\.PI \+ p\.yaw/.test(playerSrc),
  "render/player.js 相机位姿约定已变更（camera.rotation.y = π + yaw）——input-semantics 的屏幕基向量推导需同步更新",
);

for (const yaw of YAWS) {
  const tag = (name) => `yaw=${yaw.toFixed(3)} ${name}`;

  // ① forward=+1（W）位移与视线同向
  const df = probe({ forward: 1, strafe: 0, yaw });
  assert.ok(dot(df, viewDir(yaw)) > 0, `${tag()}W 位移应沿视线方向（前进语义）`);

  // ② strafe=+1（D / 摇杆右推）位移与屏幕右同向 —— A/D 镜像事故的回归断言
  const ds = probe({ forward: 0, strafe: 1, yaw });
  assert.ok(dot(ds, screenRight(yaw)) > 0, `${tag()}D 位移应指向屏幕右（跨层 strafe 基约定）`);

  // ③ strafe=−1（A / 摇杆左推）位移与屏幕右反向（即屏幕左）
  const da = probe({ forward: 0, strafe: -1, yaw });
  assert.ok(dot(da, screenRight(yaw)) < 0, `${tag()}A 位移应指向屏幕左`);

  // ④ 双轴正交：strafe 位移不携带视线分量（侧移不窜前后）
  assert.ok(Math.abs(dot(ds, viewDir(yaw))) < 1e-6, `${tag()}strafe 位移应垂直于视线`);
}

// ⑤ 摇杆与键盘同轴：右推 x>0（同 D）、左推 x<0（同 A）——双端同向的前提
const right = joystickVector(100, 100, 100 + 40, 100);
const left = joystickVector(100, 100, 100 - 40, 100);
assert.ok(right.x > 0, "摇杆右推应产生 +x strafe 意图（与 D 同号）");
assert.ok(left.x < 0, "摇杆左推应产生 −x strafe 意图（与 A 同号）");

console.log("INPUT_SEMANTICS: PASS");
