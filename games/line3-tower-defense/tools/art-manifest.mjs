// tools/art-manifest.mjs — 首批程序化可见资产生成器（零位图 · token 单源派生 · 确定性）
// 口径：可见资产 = 6 件程序化 SVG（战场面/塔三阶/敌三型/核心+HUD/引导浮层/结算面板），
// 全部由 theme.ts token 派生（零裸 hex · 零位图构造——tex-1/ac-art-1 机判面）；
// manifest 逐件带 生成器行号+sha256，重跑逐字节一致（ac-art-2 确定性机判）。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = join(HERE, '..');
const OUT = join(GAME_ROOT, 'assets', 'game-art');
const { PALETTE, DERIVE, STROKE, SCALE, mixHex, turretColor, enemyHpColor } = await import(join(GAME_ROOT, 'src', 'render', 'theme.ts'));

// 生成器行号锚（ac-art-2：generator 带 :行号）——本文件内各 build 函数定义行
const L = {};
{
  const srcLines = readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n');
  srcLines.forEach((line, i) => {
    const m = /^(?:async )?function (build\w+)/.exec(line);
    if (m) L[m[1]] = i + 1;
  });
}

const svgWrap = (inner, w = 160, h = 96) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

function buildBattlefield() {
  const w = SCALE.cols * SCALE.cellPx / 4, h = SCALE.rows * SCALE.cellPx / 4;
  let s = `<rect width="${w}" height="${h}" fill="${PALETTE.field}"/>`;
  for (let c = 0; c <= SCALE.cols; c += 4) s += `<line x1="${c / 4 * SCALE.cellPx / 4}" y1="0" x2="${c / 4 * SCALE.cellPx / 4}" y2="${h}" stroke="${PALETTE.gridLine}" stroke-width="1"/>`;
  s += `<path d="M 0 48 L 40 48 L 40 8 L 96 8 L 96 96 L 144 96 L 144 40 L 176 40" fill="none" stroke="${PALETTE.pathSand}" stroke-width="8"/>`;
  return svgWrap(s, 320, 192);
}

function buildTurretSheet() {
  let s = '';
  [1, 2, 3].forEach((lv, i) => {
    const x = 24 + i * 48, size = 24 + i * 2;
    s += `<rect x="${x - size / 2}" y="${48 - size / 2}" width="${size}" height="${size}" fill="${turretColor(lv)}" stroke="${PALETTE.bgDeep}" stroke-width="${STROKE.widthPx}"/>`;
    s += `<text x="${x}" y="${88}" fill="${PALETTE.textCream}" font-size="10" text-anchor="middle">Lv${lv} ★${'★'.repeat(0)}${'✦'.repeat(lv)}</text>`;
  });
  return svgWrap(s);
}

function buildEnemySheet() {
  const kinds = [['grunt', PALETTE.field], ['runner', PALETTE.field], ['brute', PALETTE.field]];
  let s = '';
  kinds.forEach(([k, base], i) => {
    const size = [16, 14, 20][i];
    const x = 24 + i * 48;
    s += `<rect x="${x - size / 2}" y="${48 - size / 2}" width="${size}" height="${size}" fill="${enemyHpColor(1)}" stroke="${PALETTE.bgDeep}" stroke-width="${STROKE.widthPx}"/>`;
    s += `<rect x="${x - size / 2}" y="${48 + size / 2 + 4}" width="${size}" height="3" fill="${enemyHpColor(0.4)}"/>`;
    s += `<text x="${x}" y="${88}" fill="${PALETTE.textCream}" font-size="10" text-anchor="middle">${k}</text>`;
  });
  void base_fix;
  return svgWrap(s);
}
const base_fix = undefined;

function buildCoreHud() {
  let s = `<rect x="112" y="24" width="${SCALE.coreCells * SCALE.cellPx / 2}" height="${SCALE.coreCells * SCALE.cellPx / 2}" fill="${PALETTE.coreCoral}" stroke="${PALETTE.bgDeep}" stroke-width="${STROKE.widthPx}"/>`;
  s += `<text x="16" y="24" fill="${PALETTE.textCream}" font-size="12">核心 10 · 军费 120 · 波次 1/8</text>`;
  return svgWrap(s);
}

function buildGuidance() {
  let s = `<rect width="160" height="96" fill="${mixHex(PALETTE.bgDeep, PALETTE.bgDeep, 0)}" opacity="0.82"/>`;
  s += `<text x="80" y="44" fill="${PALETTE.textCream}" font-size="11" text-anchor="middle">点击空地，放置第一座炮塔</text>`;
  s += `<line x1="8" y1="72" x2="152" y2="72" stroke="${PALETTE.textCream}" stroke-width="2" stroke-dasharray="6 4" opacity="0.6"/>`;
  return svgWrap(s);
}

function buildSettlement() {
  let s = `<rect x="20" y="10" width="120" height="76" fill="${PALETTE.bgDeep}" stroke="${PALETTE.textCream}" stroke-width="${STROKE.widthPx}"/>`;
  s += `<text x="80" y="40" fill="${PALETTE.textCream}" font-size="14" text-anchor="middle">守住啦</text>`;
  s += `<text x="80" y="58" fill="${PALETTE.textCream}" font-size="10" text-anchor="middle">核心 10 · 军费 260</text>`;
  s += `<rect x="44" y="66" width="72" height="14" fill="${mixHex(PALETTE.turretGreen, PALETTE.textCream, DERIVE.turretLevelMix[1])}"/>`;
  return svgWrap(s);
}

mkdirSync(OUT, { recursive: true });
const built = [
  ['battlefield-preview', buildBattlefield],
  ['turret-lv-sheet', buildTurretSheet],
  ['enemy-kind-sheet', buildEnemySheet],
  ['core-hud-sample', buildCoreHud],
  ['guidance-overlay', buildGuidance],
  ['settlement-panel', buildSettlement],
];
const assets = built.map(([id, fn]) => {
  const svg = fn();
  const file = `${id}.svg`;
  writeFileSync(join(OUT, file), svg);
  const sha256 = createHash('sha256').update(svg).digest('hex');
  return { id, file, sha256, generator: `tools/art-manifest.mjs:${L[fn.name] ?? 0}`, note: '程序化 SVG（theme token 派生 · 零位图）' };
});
const manifest = {
  generatedBy: 'tools/art-manifest.mjs',
  deterministic: '同输入逐字节一致（重生成 hash 不变 = ac-art-2 机判）',
  cap: 13,
  assets,
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`art-manifest: ${assets.length} 件生成（≤13 封顶）· manifest 写盘`);
