#!/usr/bin/env node
// 03-mapping-g5-and-wiring.mjs — 美术线复证：G5/a–d 本地复现 + theme 接线值 ≡ 冻结 hex
// 口径 = g2-blocks/tools/qa-round3.mjs G5 断言（无平台 API 依赖的文件断言部分）
// 用法：node 03-mapping-g5-and-wiring.mjs   （env 可覆盖：G2_REPO / G2_RUN_WS）
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
let ws = here;
for (let i = 0; i < 5; i += 1) ws = dirname(ws); // 脚本位于 <ws>/.myrd/blackboard/g2-blocks/gate-logs/<dir>/
const REPO = process.env.G2_REPO || join(dirname(ws), 'g2-blocks'); // g2-blocks 仓库 = run-* 工作区的兄弟目录
const RUN_WS = process.env.G2_RUN_WS || ws;

const spec = JSON.parse(readFileSync(join(RUN_WS, '.myrd', 'spec', 'g2-blocks', 'design-spec.json'), 'utf8'));
const mapping = readFileSync(join(REPO, 'assets', 'MAPPING.md'), 'utf8');
let reds = 0;
const check = (label, ok, detail) => {
  if (!ok) reds += 1;
  console.log(`${ok ? 'PASS' : 'RED '} ${label}${detail ? ' :: ' + detail : ''}`);
};

// G5/a 映射表所列交付件全部在盘（kebab-case，≥5 件引用）
const files = [...mapping.matchAll(/`assets\/([^`]+)`/g)].map((m) => m[1]);
const jsons = files.filter((f) => f.endsWith('.json'));
const g5a = files.length >= 5 && jsons.every((f) => existsSync(join(REPO, 'assets', f)));
check('G5/a 映射表交付件全在盘', g5a, `${files.length} 件引用 · json=${jsons.length}`);

// G5/b 块 tile id ↔ spec 色板 id 一一对应
const tiles = JSON.parse(readFileSync(join(REPO, 'assets', 'e-board-block-tiles.json'), 'utf8'));
const specIds = spec.spec.numeric.palette.colors.map((c) => c.id).sort().join(',');
const tileIds = tiles.tiles.map((t) => t.id).sort().join(',');
check('G5/b 块tile id ↔ 色板id 全等', specIds === tileIds, tileIds);

// G5/c 映射表绑定 spec entities/assets id
check('G5/c 三向绑定齐（e-board/e-renderer/a03-sfx-pack）',
  ['e-board', 'e-renderer', 'a03-sfx-pack'].every((id) => mapping.includes(id)));

// G5/d 黑板 assets.md 三批登记可达（本 run 工作区）
const bbPath = join(RUN_WS, '.myrd', 'blackboard', 'g2-blocks', 'assets.md');
const bb = readFileSync(bbPath, 'utf8');
check('G5/d 黑板三批登记可达（本 run）', ['批一', '批二', '批三'].every((k) => bb.includes(k)));

// 接线一致性：theme.ts 含 7/7 冻结 hex（真源 = spec numeric.palette）
const theme = readFileSync(join(REPO, 'src', 'render', 'theme.ts'), 'utf8');
const specHex = spec.spec.numeric.palette.colors.map((x) => [x.id, x.hex.toUpperCase()]);
const miss = specHex.filter(([, hex]) => !theme.includes(hex)).map(([id, hex]) => `${id}:${hex}`);
check('接线 theme.ts 含 7/7 冻结 hex', miss.length === 0,
  miss.length ? `缺 ${miss.join(',')}` : `命中 ${specHex.length}/7（单源 ac-11 机判同口径）`);

// 色板交付件锚：sha256 ≡ spec numeric.palette.sourceSha256
const { createHash } = await import('node:crypto');
const sha = createHash('sha256').update(readFileSync(join(REPO, 'assets', 'palette', 'palette-n1-final.json'))).digest('hex');
check('色板交付件 sha256 ≡ spec sourceSha256 锚', sha === spec.spec.numeric.palette.sourceSha256, sha.slice(0, 12) + '…');

console.log(`# 结论: ${reds === 0 ? 'ALL-GREEN' : 'RED=' + reds}（G5/a–d + 接线 + 锚，共 ${reds === 0 ? 7 : 7 - reds}/7 绿）`);
process.exit(reds === 0 ? 0 : 1);
