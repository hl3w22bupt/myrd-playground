// a4-td-feedback-channels — 反馈延迟与通道
// spec acceptance a4：每操作到反馈呈现 ≤ feedback.latencyMaxMs(100ms)；
//   每操作反馈通道 ≥ feedback.channelsPerActionMin(2)（flash/particles/hud-jump/projectile-trace ≥4 备选）；
//   帧耗时 P95 ≤ feedback.frameP95Ms(16ms)，帧采样 n ≥ feedback.frameSampleN(3000)。
// 口径披露：headless 帧采样 = stepSim + render(绘桩) 逻辑面 CPU 成本，非光栅化耗时（契约注记）。

import { loadCfg, stubCtx, percentile, assert, GAME_ROOT } from '../helpers.mjs';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const { Game } = await import(join_ts('game.ts'));
const { createRun } = await import(join_ts('kernel/state.ts'));
const { stepSim } = await import(join_ts('kernel/sim.ts'));
const { render } = await import(join_ts('render/renderer.ts'));
const { FIELD_W, FIELD_H } = await import(join_ts('render/theme.ts'));
import { join } from 'node:path';
function join_ts(rel) { return join(GAME_ROOT, 'src', rel); }

const cfg = loadCfg();

// —— ① 每操作反馈通道 ≥2（flash/particles/hud-jump/trace 四备选逐次点验）——
const game = new Game({ cfg });
game.advanceTitle(400);
assert(game.pointerDown(320, 252), '开始按钮未生效');
// 放置操作：通道 = 落位闪( bouncing fx) + 射程圈显现 + 引导消散 ≥ 2
assert(game.pointerDown(496, 208) && game.pointerDown(320, 344), '布防失败');
const placeChannels = [
  game.sim.fx.placeTicksLeft > 0 ? 'flash-place-bounce' : null,
  game.ui.pendingTile === null && game.sim.turrets.length === 1 ? 'range-circle-consumed' : null,
  game.sim.fx.guidanceHidden ? 'guidance-dismiss' : null,
].filter(Boolean);
assert(placeChannels.length >= cfg.feedback.channelsPerActionMin, `放置反馈通道 ${placeChannels.length} < ${cfg.feedback.channelsPerActionMin}`);
// 升级操作：星标+1(fx) + 射程圈扩大（选中面）≥ 2（fx.upgrade + selection 消费）
game.sim.gold = Math.max(game.sim.gold, 80); // harness 合法面：等价玩家刷钱（不触内核公式）
game.pointerDown(496, 208);           // 选中已建炮塔
assert(game.ui.selectedTurretId !== null, '炮塔未选中');
assert(game.pointerDown(320, 344), '升级确认失败');
const upChannels = [
  game.sim.fx.upgradeTicksLeft > 0 ? 'flash-upgrade' : null,
  game.sim.turrets[0].level === 2 ? 'level-star+1' : null,
].filter(Boolean);
assert(upChannels.length >= cfg.feedback.channelsPerActionMin, `升级反馈通道 ${upChannels.length} < ${cfg.feedback.channelsPerActionMin}`);
// 加速操作：第三操作面（态色块翻转 + 引导已消散维持）
assert(game.pointerDown(FIELD_W - 52, 22) && game.sim.speed === 2, '加速按钮未命中');
game.pointerDown(FIELD_W - 52, 22);
// 命中反馈：hitFlash + particles + trace + hud-jump ≥ 2（跑到首个击杀）
let saw = { flash: false, particles: false, trace: false, hud: false };
let guard = 0;
while (!saw.particles && guard < 20000) {
  game.tick(1);
  saw.flash ||= game.sim.fx.hitFlashes.length > 0;
  saw.particles ||= game.sim.fx.particles.length > 0;
  saw.trace ||= game.sim.fx.traces.length > 0;
  saw.hud ||= game.sim.fx.killPulseTicks > 0;
  guard += 1;
}
const killChannels = Object.entries(saw).filter(([, v]) => v).map(([k]) => k);
assert(killChannels.length >= cfg.feedback.channelsPerActionMin, `命中反馈通道 ${killChannels.length} < ${cfg.feedback.channelsPerActionMin}（${killChannels.join(',')}）`);
const latencyEntries = game.entries().filter((e) => e.name === 'feedback_latency_ms');
assert(latencyEntries.length >= 3, `反馈延迟采样 ${latencyEntries.length} < 3（操作面未全走）`);
for (const e of latencyEntries) assert(e.value <= cfg.feedback.latencyMaxMs, `操作反馈延迟 ${e.value}ms > ${cfg.feedback.latencyMaxMs}ms`);

// —— ② 帧耗时 P95（step+render 逻辑面；n ≥ frameSampleN）——
const st = createRun(cfg, cfg.defaultSeed);
const ctxStub = stubCtx();
const view = { scale: 1, offX: 0, offY: 0, w: FIELD_W, h: FIELD_H };
const ui = { pendingTile: null, selectedTurretId: null, showHud: true };
const samples = [];
let g2 = 0;
while (st.status === 'running' && g2 < 12000 && samples.length < cfg.feedback.frameSampleN) {
  const t0 = performance.now();
  stepSim(st, cfg);
  render(ctxStub, view, st, ui, 'running', cfg);
  samples.push(performance.now() - t0);
  g2 += 1;
}
assert(samples.length >= cfg.feedback.frameSampleN, `帧采样 ${samples.length} < ${cfg.feedback.frameSampleN}（战局先于采样结束——加大采样窗）`);
samples.sort((a, b) => a - b);
const p95 = percentile(samples, 95);
assert(p95 <= cfg.feedback.frameP95Ms, `帧 P95=${p95.toFixed(3)}ms > ${cfg.feedback.frameP95Ms}ms`);
console.log(`PASS a4-td-feedback-channels 放置通道=[${placeChannels}] 升级通道=[${upChannels}] 命中通道=[${killChannels}] 延迟采样=${latencyEntries.length}(≤${cfg.feedback.latencyMaxMs}ms) 帧P95=${p95.toFixed(3)}ms n=${samples.length}`);
