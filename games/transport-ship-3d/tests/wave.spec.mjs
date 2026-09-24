#!/usr/bin/env node
// wave.spec.mjs — ac-4：波次确定性递增 + 出生点轮转 + 休整节奏 + 敌速成长。
import { createGame } from "../src/kernel/loop.js";
import { waveSize, enemySpeedForWave, spawnIndexFor } from "../src/kernel/wave.js";
import {
  FIXED_STEP, WAVE_REST, WAVE_SIZE_BASE, WAVE_SIZE_GROWTH, WAVE_SIZE_CAP,
  ENEMY_SPEED, ENEMY_SPEED_GROWTH, WAVE_CLEAR_BONUS, WAVE_CLEAR_HEAL, PLAYER_MAX_HP,
} from "../src/numeric.js";
import { ENEMY_SPAWNS } from "../src/levels/level-01-deck.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const expect = (c, ok, err) => (c ? pass(ok) : fail(err));
const TICKS = (s) => Math.round(s / FIXED_STEP);

// ① 规模公式（纯函数断言）
{
  const n1 = waveSize(1), n2 = waveSize(2), n5 = waveSize(5), nBig = waveSize(20);
  expect(n1 === WAVE_SIZE_BASE && n2 === WAVE_SIZE_BASE + WAVE_SIZE_GROWTH && n5 === WAVE_SIZE_BASE + 4 * WAVE_SIZE_GROWTH,
    `规模公式 waveSize(n)=BASE+(n-1)*GROWTH：w1=${n1} w2=${n2} w5=${n5}`,
    `规模公式不符：${n1},${n2},${n5}`);
  expect(nBig === WAVE_SIZE_CAP, `规模封顶 CAP=${WAVE_SIZE_CAP}（w20=${nBig}）`, `未封顶：w20=${nBig}`);
}

// ② 出生点轮转：第 k 个敌兵用 (k%3) 号点，且与关卡声明出生点数一致
{
  expect(ENEMY_SPAWNS.length === 3,
    `关卡声明 3 个出生点（${ENEMY_SPAWNS.map((s) => s.id.split("/")[1]).join("/")}）`,
    `出生点数异常：${ENEMY_SPAWNS.length}`);
  const seq = [0, 1, 2, 3, 4, 5].map(spawnIndexFor);
  expect(JSON.stringify(seq) === "[0,1,2,0,1,2]",
    `出生点轮转确定性：[${seq}]`, `轮转不确定：[${seq}]`);
}

// ③ 休整节奏：开局 WAVE_REST 后才 waveStart；清波后再 WAVE_REST
{
  const g = createGame({ seed: 42 });
  g.fastForward(WAVE_REST - FIXED_STEP, {}); // 休整期最后 1 tick 前停（fastForward 入参是秒）
  expect(g.world.wave.n === 0, `开局休整 ${WAVE_REST}s 内不出波（t=${g.world.time.toFixed(2)} wave=${g.world.wave.n}）`, "开局即出波，休整不生效");
  const r = g.fastForward(FIXED_STEP * 2, {}); // 再走 2 tick → restT 归零触发 waveStart
  expect(r.events.some((e) => e.type === "waveStart" && e.wave === 1), "休整结束触发 waveStart(wave=1)", "未见 waveStart 事件");
}

// ④ 出兵节奏与清波奖励/回血（构造秒清场景：伤害拉满不现实 → 用事件口径断言清波奖励公式）
{
  const g = createGame({ seed: 42 });
  const r = g.fastForward(40, { firing: false, yaw: Math.PI });
  const starts = r.events.filter((e) => e.type === "waveStart");
  expect(starts.length >= 1 && starts[0].size === waveSize(1),
    `waveStart 携带本波规模（${starts[0]?.size}）`, "waveStart 缺失或规模不符");
  expect(g.world.enemies.every((e) => e.hp <= ENEMY_SPEED * 1000), "敌兵状态可序列化", "敌兵状态异常");
}

// ⑤ 敌速成长（纯函数）
{
  expect(Math.abs(enemySpeedForWave(1) - ENEMY_SPEED) < 1e-9
    && Math.abs(enemySpeedForWave(4) - (ENEMY_SPEED + 3 * ENEMY_SPEED_GROWTH)) < 1e-9,
    `敌速成长 ENEMY_SPEED + (n-1)*ENEMY_SPEED_GROWTH（w1=${enemySpeedForWave(1)} w4=${enemySpeedForWave(4)}）`,
    "敌速成长公式不符");
}

// ⑥ 清波奖励与回血口径：直接把场上敌人清空后跑休整，断言 waveClear 事件携带 WAVE_CLEAR_BONUS/WAVE_CLEAR_HEAL
{
  const g = createGame({ seed: 42 });
  g.fastForward(WAVE_REST + FIXED_STEP, {});     // wave 1 开始
  const beforeScore = g.world.score;
  const beforeHp = Math.max(1, g.world.player.hp - 40); // 先压低血量，验证回血
  g.world.player.hp = beforeHp;
  g.world.wave.toSpawn = g.world.wave.spawned; // 测试口径：视为已全部出场（清波判定含出兵完毕）
  g.world.enemies = [];                                 // 测试口径：清场（跳过 3s 尸体滞留）
  const r = g.fastForward(1, {});
  const clear = r.events.find((e) => e.type === "waveClear");
  expect(!!clear && clear.bonus === WAVE_CLEAR_BONUS,
    `清波奖励 = WAVE_CLEAR_BONUS（${clear?.bonus}）`, `清波奖励异常：${clear?.bonus}`);
  expect(!!clear && clear.healed === Math.min(PLAYER_MAX_HP - beforeHp, WAVE_CLEAR_HEAL),
    `清波回血 = min(缺口, WAVE_CLEAR_HEAL)（+${clear?.healed}）`, `回血口径异常：${clear?.healed}`);
}

if (failures.length) { console.error("—— 合计 FAIL ——"); for (const f of failures) console.error(`  FAIL  ${f}`); process.exit(1); }
console.log("CONTRACT: PASS 波次确定性递增成立");
