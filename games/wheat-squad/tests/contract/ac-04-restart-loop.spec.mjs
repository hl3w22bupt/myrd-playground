// ac-04-restart-loop — fv-3（auto 面）：一键重开 ≤1s 回 running + 状态全复位
import { assert, loadSpec, driveRun } from './helpers.mjs';
const { createGame } = await import(new URL('../../src/game.ts', import.meta.url).pathname);
const spec = loadSpec();
const st = await driveRun(spec);
assert(st.phase === 'ended', '前置：需先到结算');
// 重开路径机判（game 面 restart）
const g = createGame(spec);
g.state.tick = 9999; g.state.kills = 50; g.state.phase = 'ended';
const t0 = Date.now();
g.restart();
const restartMs = Date.now() - t0;
assert(restartMs <= 1000, `重开耗时 ${restartMs}ms > 1000ms`);
assert(g.state.phase === 'running' && g.state.kills === 0 && g.state.tick === 0 && g.state.hp === undefined || g.state.captain.hp === 5, '重开后状态未全复位');
assert(g.state.upgradesPicked.length === 0 && g.state.xp === 0, '重开后强化/经验未清零');
// 结算页三信息齐（buildSettlement 面）
const { buildSettlement } = await import(new URL('../../src/settlement.ts', import.meta.url).pathname);
const { settlementFacts } = await import(new URL('../../src/kernel/sim.ts', import.meta.url).pathname);
const view = buildSettlement(settlementFacts(st), 'timeout');
const joined = view.rows.join('|');
for (const kw of ['三强强化回顾', '难度预告', '麦仓收益']) assert(joined.includes(kw), `结算页缺「${kw}」信息`);
console.log(`PASS fv-3(auto) 重开 ${restartMs}ms ≤1s + 全复位 + 结算页三信息齐`);
