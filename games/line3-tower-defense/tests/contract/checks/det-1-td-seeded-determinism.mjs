// det-1-td-seeded-determinism — 同 seed 战局逐字节一致
// spec acceptance det-1：DEFAULT_SEED 双局全 tick 状态 hash 逐字节相等 ∧ 波次编成/敌路径推进/
//                       索敌开火/掉落四表逐值一致 ∧ 零 Math.random/Date.now（源扫描为证）。
import { loadCfg, driveKernelRun, stripComments, GAME_ROOT, assert } from '../helpers.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const cfg = loadCfg();
const a = driveKernelRun(cfg, cfg.defaultSeed, { recordHashes: true });
const b = driveKernelRun(cfg, cfg.defaultSeed, { recordHashes: true });
assert(a.state.tickHashes.length > 1000, `全 tick 哈希采样过少 ${a.state.tickHashes.length}`);
assert(a.state.tickHashes.length === b.state.tickHashes.length, `双局 tick 数不等 ${a.state.tickHashes.length} vs ${b.state.tickHashes.length}`);
for (let i = 0; i < a.state.tickHashes.length; i += 1) {
  if (a.state.tickHashes[i] !== b.state.tickHashes[i]) {
    assert(false, `tick ${i} 状态哈希漂移 ${a.state.tickHashes[i]} vs ${b.state.tickHashes[i]}`);
  }
}
for (const t of ['spawnLog', 'fireLog', 'dropLog']) {
  assert(JSON.stringify(a.state[t]) === JSON.stringify(b.state[t]), `四表漂移: ${t}`);
}
const ap = a.state.enemies.map((e) => [e.id, e.spawnTick, e.endTick, e.endReason, Math.round(e.pathDistPx * 100) / 100]);
const bp = b.state.enemies.map((e) => [e.id, e.spawnTick, e.endTick, e.endReason, Math.round(e.pathDistPx * 100) / 100]);
assert(JSON.stringify(ap) === JSON.stringify(bp), '四表漂移: 敌路径推进序列');

// —— 源扫描：零 Math.random / Date.now（剥注释后，.ts 全量）——
function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) yield* walk(f);
    else if (/\.ts$/.test(n)) yield f;
  }
}
let scanned = 0;
for (const f of walk(join(GAME_ROOT, 'src'))) {
  const code = stripComments(readFileSync(f, 'utf8'));
  assert(!/Math\.random|Date\.now/.test(code), `确定性违例 ${f}（Math.random/Date.now 命中）`);
  scanned += 1;
}
console.log(`PASS det-1-td-seeded-determinism 全 tick=${a.state.tickHashes.length} 哈希逐字节等 · 四表逐值等 · src 扫描 ${scanned} 文件零 Math.random/Date.now`);
