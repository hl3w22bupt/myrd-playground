#!/usr/bin/env node
// boundary.spec.mjs — 验收口径 C：边界对抗断言（常驻 CI）。四类边界全覆盖：
//   ① 空场景：初始无敌兵 / 零事件 / 休整期推进后首波正常生成（空场景不破坏内核推进）
//   ② 超界坐标：极端意图位移 / 直接超界坐标 / 越界出生索引 —— 围栏钳制后必在甲板内
//   ③ 极端缩放：clampZoom 对 NaN/±Infinity/0/负值/超界值 全部收敛合法区间；缩放不触碰内核
//   ④ 0/负值/非有限参数：dt、快进秒数、intent 数值、seed 回绕、零弹药开火 —— 内核不污染、不推进、不 NaN
// 覆盖内核加固点（loop.js finiteOr / dt 钳制 / fastForward 守卫）与表现层纯函数（touch.js clampZoom）。
import { createGame } from "../src/kernel/loop.js";
import { clampZoom, lookSensitivity, TOUCH_ZOOM_MIN } from "../src/render/touch.js";
import { DECK_BOUNDS, PLAYER_START, clampToDeck } from "../src/levels/level-01-deck.js";
import { PLAYER_RADIUS, WAVE_REST, WAVE_SIZE_BASE, FIXED_STEP } from "../src/numeric.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const ok = (cond, m) => (cond ? pass(m) : fail(m));
const inDeck = (x, z, r = PLAYER_RADIUS) =>
  x >= DECK_BOUNDS.minX + r - 1e-9 && x <= DECK_BOUNDS.maxX - r + 1e-9
  && z >= DECK_BOUNDS.minZ + r - 1e-9 && z <= DECK_BOUNDS.maxZ - r + 1e-9;

// ———————— ① 空场景 ————————
{
  const g = createGame({ seed: 7 });
  ok(g.world.enemies.length === 0 && g.world.wave.n === 0 && g.world.wave.state === "rest"
    && g.world.score === 0 && g.world.over === false, "空场景初始态：无敌兵/第0波/休整/零分/未结束");
  const r0 = g.fastForward(0.05);
  ok(r0.events.length === 0 && g.world.enemies.length === 0, "空场景短推进：零事件、仍无敌兵");

  // 休整期推满 → 首波正常生成（WAVE_REST 秒休整后开波，按 SPAWN_INTERVAL 逐名生成完毕）
  const g2 = createGame({ seed: 7 });
  const advance = WAVE_REST + WAVE_SIZE_BASE * 0.8 + 1; // 休整 + 逐名生成间隔（0.8s/名）+ 富余
  const r1 = g2.fastForward(advance);
  ok(g2.world.wave.n === 1 && g2.world.enemies.length === WAVE_SIZE_BASE,
    `空场景推进 ${advance}s → 首波完整生成（wave=1，敌兵=${g2.world.enemies.length}=${WAVE_SIZE_BASE}）`);
  ok(r1.events.some((e) => e.type === "waveStart"), "首波 waveStart 事件上抛");
}

// ———————— ② 超界坐标 ————————
{
  // 极端意图：单 tick 前进/侧移 1e9 米 → 围栏钳制，玩家必须在甲板内
  const g = createGame({ seed: 3 });
  g.frame(FIXED_STEP, { forward: 1e9, yaw: 0 });
  g.frame(FIXED_STEP, { strafe: -1e9, yaw: 0 });
  g.frame(FIXED_STEP, { forward: 1e9, strafe: 1e9, yaw: Math.PI / 2 });
  ok(inDeck(g.world.player.x, g.world.player.z),
    `极端意图位移（1e9 米级）→ 围栏钳制在甲板内（x=${g.world.player.x.toFixed(3)}, z=${g.world.player.z.toFixed(3)}）`);
  ok(Number.isFinite(g.world.player.x) && Number.isFinite(g.world.player.z), "围栏钳制后坐标有限（无 NaN 外溢）");

  // clampToDeck 直接对抗：四个方向的超界坐标 + 角点
  const cases = [[1e6, 1e6], [-1e6, -1e6], [1e6, -1e6], [-1e6, 1e6], [0, 0], [PLAYER_START.x, PLAYER_START.z]];
  const allClamped = cases.every(([x, z]) => {
    const c = clampToDeck(x, z, PLAYER_RADIUS);
    return inDeck(c.x, c.z) && Number.isFinite(c.x) && Number.isFinite(c.z);
  });
  ok(allClamped, `clampToDeck 对 ${cases.length} 组超界/合法坐标全部钳制入界`);

  // 持续 extreme intent 600 tick（10s）不越界、不 NaN、状态可继续推进
  const g2 = createGame({ seed: 4 });
  let escaped = false;
  for (let t = 0; t < 600 && !escaped; t++) {
    g2.frame(FIXED_STEP, { forward: 1e9, strafe: -1e9, yaw: t * 0.1, pitch: 99 });
    if (!inDeck(g2.world.player.x, g2.world.player.z)) escaped = true;
  }
  ok(!escaped && Number.isFinite(g2.world.player.pitch) && Math.abs(g2.world.player.pitch) <= 1.2,
    "600 tick 极端意图+极端俯仰 → 始终在界内且俯仰被钳制（±1.2）");

  // 波次生成的敌兵：出生索引模轮转 + 移动经 moveWithCollision 围栏钳制 → 坐标必在界内
  const g4 = createGame({ seed: 9 });
  g4.fastForward(WAVE_REST + 3, { firing: true, yaw: Math.PI }); // 首波生成并追击玩家
  ok(g4.world.enemies.length > 0 && g4.world.enemies.every((en) => inDeck(en.x, en.z, 0.4)),
    `波次生成+追击的 ${g4.world.enemies.length} 名敌兵坐标全部在甲板内（出生轮转 + 围栏钳制）`);
}

// ———————— ③ 极端缩放 ————————
{
  const cases = [
    [NaN, 1], [Infinity, 1], [-Infinity, 1],       // 非有限 → 中性默认 1
    [0, TOUCH_ZOOM_MIN], [-5, TOUCH_ZOOM_MIN],      // 0/负值 → 下限
    [1e9, 1], [2, 1], [1.0001, 1],                  // 超上限 → 1
    [0.3499, TOUCH_ZOOM_MIN], [0.35, TOUCH_ZOOM_MIN], [0.5, 0.5], [1, 1], // 合法域原样保留
  ];
  const bad = cases.filter(([input, want]) => clampZoom(input) !== want);
  ok(bad.length === 0, `clampZoom 对 ${cases.length} 组极端/合法输入全部收敛（含 NaN/±Infinity/0/负值）`
    + (bad.length ? ` 失配：${bad.map(([i]) => i).join(",")}` : ""));

  const sens = [0, -100, NaN, Infinity, 1e-9].every((s) => Number.isFinite(lookSensitivity(s)) && lookSensitivity(s) > 0);
  ok(sens, "lookSensitivity 对 0/负/NaN/Infinity/极小视口回退有限正值（不产生病态灵敏度）");

  // 缩放是纯表现层：内核状态（world / player）不携带 zoom 字段，极端缩放值无法进入内核
  const g = createGame({ seed: 21 });
  ok(!("zoom" in g.world) && !("zoom" in g.world.player) && !("zoom" in g.snapshot()),
    "缩放纯表现层口径：内核 world/player/snapshot 均无 zoom 字段（极端缩放不进内核）");
}

// ———————— ④ 0 / 负值 / 非有限参数 ————————
{
  // dt：0 / 负值 / NaN / Infinity —— 不推进、不污染累加器（后续正常帧仍精确推进）
  const g = createGame({ seed: 11 });
  g.frame(0, { forward: 1 }); ok(g.world.time === 0, "frame(0) → 零 tick、时间不动");
  g.frame(-1, { forward: 1 }); ok(g.world.time === 0, "frame(-1) → 钳制为 0、时间不动");
  g.frame(NaN, { forward: 1 }); ok(g.world.time === 0, "frame(NaN) → 回退 0、时间不动");
  g.frame(Infinity, { forward: 1 }); ok(g.world.time === 0, "frame(Infinity) → 回退 0、时间不动");
  g.frame(FIXED_STEP, { forward: 1 });
  ok(Math.abs(g.world.time - FIXED_STEP) < 1e-12, "异常 dt 之后正常帧仍精确推进一个固定子步（累加器未被污染）");

  // fastForward：0 / 负值 / NaN / Infinity
  const g2 = createGame({ seed: 12 });
  for (const s of [0, -5, NaN, -Infinity, Infinity]) g2.fastForward(s);
  ok(g2.world.time === 0 && g2.world.enemies.length === 0, "fastForward(0/-5/NaN/±Infinity) → 0 tick（内核不动）");

  // intent 非有限数值：NaN/Infinity 注入 → 内核坐标/俯仰保持有限（finiteOr 兜底）
  const g3 = createGame({ seed: 13 });
  g3.frame(FIXED_STEP, { forward: NaN, strafe: Infinity, yaw: -Infinity, pitch: NaN });
  g3.frame(FIXED_STEP, { forward: -Infinity, yaw: NaN, pitch: Infinity });
  ok(Number.isFinite(g3.world.player.x) && Number.isFinite(g3.world.player.z)
    && Number.isFinite(g3.world.player.yaw) && Number.isFinite(g3.world.player.pitch)
    && inDeck(g3.world.player.x, g3.world.player.z),
    "intent 注入 NaN/±Infinity → 内核全部字段保持有限且在界内");

  // intent 缺字段 / null / undefined 整包：归一化兜底为 EMPTY
  const g4 = createGame({ seed: 14 });
  g4.frame(FIXED_STEP, undefined);
  g4.frame(FIXED_STEP, null);
  g4.frame(FIXED_STEP, {});
  ok(g4.world.time === 3 * FIXED_STEP && Number.isFinite(g4.world.player.x), "frame(undefined/null/{}) → 归一化为空意图正常推进");

  // seed 回绕：0 / 负数 / 超uint32 / 浮点 —— 双跑仍逐字段确定
  for (const seed of [0, -1, 2 ** 32 + 7, 1.5]) {
    const snap = (s) => { const gg = createGame({ seed: s }); gg.fastForward(3, { firing: true, yaw: 1 }); return JSON.stringify(gg.snapshot()); };
    ok(snap(seed) === snap(seed), `seed=${seed}（回绕 ${(seed >>> 0) >>> 0}）双跑快照一致`);
  }

  // 0 弹药 + 0 备弹持续开火：不射出、不换弹、不异常
  const g5 = createGame({ seed: 15 });
  g5.world.player.ammo = 0; g5.world.player.reserve = 0;
  const r5 = g5.fastForward(1, { firing: true, yaw: Math.PI });
  ok(g5.world.shotsFired === 0 && !r5.events.some((e) => e.type === "reloadStart" || e.type === "shot"),
    "0 弹药 + 0 备弹持续开火 → 零射击、零换弹事件（无死循环）");

  // 全零 intent：状态冻结不漂移
  const g6 = createGame({ seed: 16 });
  const s0 = JSON.stringify(g6.snapshot());
  g6.fastForward(2, {});
  const s1 = JSON.stringify(g6.snapshot());
  ok(JSON.parse(s1).px === JSON.parse(s0).px && JSON.parse(s1).pz === JSON.parse(s0).pz,
    "全零意图 2s → 玩家位置零漂移");
}

if (failures.length) {
  console.error("—— 边界断言 FAIL ——");
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log("BOUNDARY: PASS 四类边界（空场景/超界坐标/极端缩放/0与负值）全部成立");
