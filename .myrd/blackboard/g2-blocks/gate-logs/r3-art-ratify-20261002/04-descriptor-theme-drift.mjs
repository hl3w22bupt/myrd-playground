#!/usr/bin/env node
// 04-descriptor-theme-drift.mjs — 美术线自检：交付描述件 ↔ 运行时 theme 单源 漂移检查
// 口径：assets/*.json（美术五件）中每个 hex 字面量与 alpha 数值必须出现在 src/render/theme.ts
//      （codegen 生成面）——改描述件不重跑 tools/gen-theme.mjs 必红；反向（theme 派生值）不做全等断言。
// 附加：theme.ts 零 rgba(/rgb( 字面量（withAlpha helper 为唯一 rgba 入口，QA F3 修后口径）；
//      spec numeric.palette 冻结 hex 7/7 在 theme.ts（色板锚不漂）。
// 用法：node 04-descriptor-theme-drift.mjs   （env 可覆盖：G2_REPO / G2_RUN_WS）
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
let ws = here;
for (let i = 0; i < 5; i += 1) ws = dirname(ws); // <ws>/.myrd/blackboard/g2-blocks/gate-logs/<dir>/
const REPO = process.env.G2_REPO || join(dirname(ws), 'g2-blocks');
const RUN_WS = process.env.G2_RUN_WS || ws;

const theme = readFileSync(join(REPO, 'src', 'render', 'theme.ts'), 'utf8');
const themeLower = theme.toLowerCase();
let reds = 0;
const check = (label, ok, detail) => {
  if (!ok) reds += 1;
  console.log(`${ok ? 'PASS' : 'RED '} ${label}${detail ? ' :: ' + detail : ''}`);
};

// ① 五件描述件的 hex / alpha 全量接线断言
const deliverables = ['style-card.json', 'e-board-block-tiles.json', 'e-renderer-ui-tokens.json',
  'e-renderer-backdrop.json', 'a03-sfx-plan.json'];
const hexRe = /^#[0-9a-fA-F]{6}$/;
let hexTotal = 0;
let alphaTotal = 0;
const misses = [];
for (const f of deliverables) {
  const data = JSON.parse(readFileSync(join(REPO, 'assets', f), 'utf8'));
  let fHex = 0;
  let fAlpha = 0;
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && hexRe.test(v)) {
          fHex += 1;
          if (!themeLower.includes(v.toLowerCase())) misses.push(`${f}:${k}=${v}`);
        } else if (/^alpha/i.test(k) && typeof v === 'number') {
          fAlpha += 1;
          if (!theme.includes(`: ${v},`) && !theme.includes(`: ${v} }`) && !theme.includes(`: ${v}\n`)) {
            misses.push(`${f}:${k}=${v}`);
          }
        } else if (v && typeof v === 'object') walk(v);
      }
    }
  };
  walk(data);
  hexTotal += fHex;
  alphaTotal += fAlpha;
  console.log(`  · ${f} hex=${fHex} alpha=${fAlpha}`);
}
check('① 描述件 hex/alpha 全量接线 theme.ts', misses.length === 0,
  `hex=${hexTotal} alpha=${alphaTotal}${misses.length ? ' 缺:' + misses.join(' | ') : ' 全命中'}`);

// ② theme.ts 零 rgba/rgb 数值字面量（真违规 = rgba( 后紧跟数字；helper 签名 rgba() 与模板 rgba(${…} 不算）
const rgbaLits = theme.match(/rgba?\(\s*[\d.]/g) || [];
check('② theme.ts 零 rgba/rgb 数值字面量', rgbaLits.length === 0 && theme.includes('withAlpha'),
  rgbaLits.length ? rgbaLits.join(' | ') : '仅 withAlpha helper（唯一 rgba 入口在位）');

// ③ spec 冻结色板 7/7 在 theme.ts
const spec = JSON.parse(readFileSync(join(RUN_WS, '.myrd', 'spec', 'g2-blocks', 'design-spec.json'), 'utf8'));
const specHex = spec.spec.numeric.palette.colors.map((x) => [x.id, x.hex.toUpperCase()]);
const missSpec = specHex.filter(([, hex]) => !theme.includes(hex)).map(([id, hex]) => `${id}:${hex}`);
check('③ spec 冻结 hex 7/7 在 theme.ts', missSpec.length === 0,
  missSpec.length ? `缺 ${missSpec.join(',')}` : `命中 ${specHex.length}/7`);

console.log(`# 结论: ${reds === 0 ? 'ALL-GREEN' : 'RED=' + reds}（描述件 ${deliverables.length} 件 · hex ${hexTotal} · alpha ${alphaTotal} 全接线）`);
process.exit(reds === 0 ? 0 : 1);
