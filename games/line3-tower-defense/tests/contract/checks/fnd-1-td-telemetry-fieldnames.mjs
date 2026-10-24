// fnd-1-td-telemetry-fieldnames — 埋点定名逐字符
// spec acceptance fnd-1：meta.telemetryFields 键集合 ≡ 源码事件名常量集合
//（含四件定名 first_tap/first_loop_complete/restart_clicked/hint_shown 逐字符），
// 双方剥注释后字符串全等。样本量=键集合全量对拍。
import { loadSpec, assert, GAME_ROOT, stripComments } from '../helpers.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = loadSpec();
const specKeys = Object.keys(spec.meta.telemetryFields ?? {});
assert(specKeys.length >= 8, `telemetryFields ${specKeys.length} < 8 键`);
const src = stripComments(readFileSync(join(GAME_ROOT, 'src', 'telemetry', 'emitter.ts'), 'utf8'));
const m = /EVENT_NAMES\s*=\s*\[([^\]]+)\]/.exec(src);
assert(m, 'emitter.ts EVENT_NAMES 数组未找到');
const srcNames = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
const sortedEq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
assert(sortedEq(specKeys, srcNames), `键集合失配:\n  spec =${JSON.stringify([...specKeys].sort())}\n  src  =${JSON.stringify([...srcNames].sort())}`);
for (const required of ['first_tap', 'first_loop_complete', 'restart_clicked', 'hint_shown']) {
  assert(srcNames.includes(required), `四件定名缺失: ${required}`);
}
for (const k of specKeys) assert(src.includes(`"${k}"`), `事件名 ${k} 逐字符缺失`);
console.log(`PASS fnd-1-td-telemetry-fieldnames 键集合全等 ${specKeys.length}/${srcNames.length} · 四件定名逐字符在位`);
