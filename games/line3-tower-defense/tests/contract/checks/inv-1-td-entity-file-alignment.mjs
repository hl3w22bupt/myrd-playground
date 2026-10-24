// inv-1-td-entity-file-alignment — 实体-文件对账
// spec acceptance inv-1：spec.entities[].script 落点文件逐条在盘且 docs/inventory.md 登记行
// 一一对应（id/路径/一句职责）。样本量=entities 12 条全量。
// 口径（QA-N2 预核登记项）：inventory 用工程相对路径，spec 用仓根相对路径——
// 归一化 = 剥「games/line3-tower-defense/」前缀后比对（双向零改动）。
import { loadSpec, assert, GAME_ROOT, WS_ROOT } from '../helpers.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const spec = loadSpec();
const invText = readFileSync(join(GAME_ROOT, 'docs', 'inventory.md'), 'utf8');
const PREFIX = 'games/line3-tower-defense/';
const usedRows = new Set();
for (const e of spec.entities) {
  assert(typeof e.script === 'string' && e.script.length > 0, `实体 ${e.id} 缺 script 落点`);
  assert(existsSync(join(WS_ROOT, e.script)), `实体 ${e.id} 落点悬空: ${e.script}`);
  const rel = e.script.startsWith(PREFIX) ? e.script.slice(PREFIX.length) : e.script;
  const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\|\\s*`' + esc + '`\\s*\\|');
  const m = re.exec(invText);
  assert(m, `inventory 缺登记行: ${rel}（实体 ${e.id}）`);
  assert(!usedRows.has(rel), `inventory 登记行一对多: ${rel}`);
  usedRows.add(rel);
}
assert(spec.entities.length === 12, `entities ${spec.entities.length} ≠ 12（全量口径）`);
console.log(`PASS inv-1-td-entity-file-alignment entities 12/12 落点在盘 ∧ inventory 一一对应（归一化口径）`);
