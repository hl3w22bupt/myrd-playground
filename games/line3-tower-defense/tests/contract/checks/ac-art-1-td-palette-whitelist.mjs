// ac-art-1-td-palette-whitelist — 色值白名单
// spec acceptance ac-art-1：src+tools 全仓 hex 字面量扫描，仅 numeric.palette.whitelist 8 色
//（+#include 派生规则声明面）零违例。样本量=全仓扫描。
import { loadSpec, assert, GAME_ROOT } from '../helpers.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const spec = loadSpec();
const whitelist = new Set(Object.values(spec.numeric.palette.whitelist).map((v) => v.toUpperCase()));
function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) yield* walk(f);
    else if (/\.(ts|mjs|json)$/.test(n) && !/\-audit\.mjs$/.test(n)) yield f;
  }
}
let files = 0;
const violations = [];
for (const dir of ['src', 'tools']) {
  for (const f of walk(join(GAME_ROOT, dir))) {
    const text = readFileSync(f, 'utf8');
    const hexes = text.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    for (const h of hexes) {
      if (!whitelist.has(h.toUpperCase())) violations.push(`${f}: ${h}`);
    }
    files += 1;
  }
}
assert(files >= 10, `扫描面过小 ${files} 文件`);
assert(violations.length === 0, `白名单外色值违例 ${violations.length} 处:\n  ${violations.join('\n  ')}`);
console.log(`PASS ac-art-1-td-palette-whitelist src+tools ${files} 文件 hex 扫描零违例（白名单 ${whitelist.size} 色 + 派生声明面）`);
