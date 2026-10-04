#!/usr/bin/env node
/**
 * meta 四件套查表器（B1 N2 美术线 · spec v1.4 content.retention items[].assets 4 id）。
 * 复现：node games/stack-tower/tests/meta/assets-meta-check.mjs
 *
 * 断言：
 *  ① id 三向一致：manifest ↔ 磁盘 ↔ spec v1.4 assets（meta 四 id 集合相等）；
 *  ② 逐件 sha256：manifest ≡ 磁盘字节；PNG 签名（89504e47）；尺寸 ≡ manifest ≡ spec size；
 *  ③ 透明底：四角像素 alpha=0（mini PNG 解码，filter 0）；
 *  ④ NEON 派生色命中：图内至少 1 像素 RGB 精确等于 theme.ts NEON 表色值（零新编风格）；
 *  ⑤ 9-slice：面板类 slice=24 登记在案；
 *  ⑥–⑨ §接线段（N2 收口）：build 产物存在 → META 清单窄口径 3 键（mission-panel deferred 不接线）
 *     → 装载三态（无加载器空 / 失败全 null 不抛错）→ 每日挑战卡令牌 fallback ↔ 9-slice ↔ 角标三态
 *     → 徽章 applyBadgeSkin 注入面（theme.ts 唯一色源派生，零私设色值）。
 * 三态输出（与契约 runner 同口径）：RESULT: PASS / FAIL。
 */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = join(GAME, '..', '..');
const META_DIR = join(GAME, 'assets', 'meta');
const checks = [];
const ok = (name, cond, extra = '') => {
  checks.push([name, cond]);
  console.log(`[check] ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};

// ---------- mini PNG 解码（8-bit RGBA，filter 0 逐行；仅本查表器产出的编码形态） ----------
function decodePng(buf) {
  ok('PNG 签名 89504e47', buf.subarray(0, 4).toString('hex') === '89504e47');
  let off = 8;
  let w = 0;
  let h = 0;
  let idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ok('IHDR 8-bit RGBA', data[8] === 8 && data[9] === 6);
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (w * 4 + 1)];
    if (filter !== 0) { ok(`filter type 行 ${y}`, false, '非 0 filter（超出 mini 解码范围）'); return null; }
    raw.copy(px, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  }
  return { w, h, px };
}

const pixel = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return [img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3]];
};

// ---------- 色源：theme.ts NEON 表 ----------
const THEME = readFileSync(join(GAME, 'src', 'render', 'theme.ts'), 'utf8');
const NEON = [...THEME.matchAll(/:\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1].toLowerCase().slice(1));
ok('theme.ts NEON 表解析 ≥8 色', NEON.length >= 8, `${NEON.length} 色`);

// ---------- spec v1.4 meta 四 id ----------
const spec = JSON.parse(readFileSync(join(ROOT, '.myrd', 'spec', 'stack-tower-spec.json'), 'utf8')).spec;
const SPEC_IDS = ['daily-challenge-card', 'mission-panel', 'streak-badge', 'icon-badge'];
const specMeta = spec.assets.filter((a) => SPEC_IDS.includes(a.id));
ok('spec v1.4 assets 含 meta 四 id', specMeta.length === 4, specMeta.map((a) => a.id).join(','));

const manifest = JSON.parse(readFileSync(join(META_DIR, 'manifest.json'), 'utf8'));
ok('manifest items=4', manifest.items.length === 4);
ok('manifest derivedFrom 参考卡', /霓虹夜塔参考卡/.test(manifest.derivedFrom));

for (const item of manifest.items) {
  const p = join(META_DIR, item.file);
  if (!existsSync(p)) { ok(`磁盘存在 ${item.file}`, false); continue; }
  const buf = readFileSync(p);
  ok(`sha256 ≡ manifest  ${item.id}`, createHash('sha256').update(buf).digest('hex') === item.sha256);
  const img = decodePng(buf);
  if (!img) continue;
  ok(`尺寸 ${item.id} = ${item.size}`, `${img.w}x${img.h}` === item.size);
  const specItem = specMeta.find((a) => a.id === item.id);
  ok(`spec size 一致 ${item.id}`, specItem?.size === item.size, `spec=${specItem?.size}`);
  // 透明底：四角 alpha=0
  const corners = [pixel(img, 0, 0), pixel(img, img.w - 1, 0), pixel(img, 0, img.h - 1), pixel(img, img.w - 1, img.h - 1)];
  ok(`透明底四角 ${item.id}`, corners.every((c) => c[3] === 0), corners.map((c) => `a${c[3]}`).join('/'));
  // NEON 派生色命中：存在 ≥1 像素 RGB 精确等于 NEON 表色
  const set = new Set(NEON);
  let hit = false;
  for (let i = 0; i < img.px.length && !hit; i += 4) {
    if (img.px[i + 3] === 255) {
      hit = set.has([img.px[i], img.px[i + 1], img.px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
    }
  }
  ok(`NEON 派生色命中 ${item.id}`, hit);
  // 9-slice 登记
  if (item.kind === 'ui-panel') ok(`9-slice slice=24 ${item.id}`, item.slice === 24);
}

// ---------- §接线段（B1 N2 收口 · 美术线）：窄口径 3 件接线（scope_gate=narrow；mission-panel deferred 不接线） ----------
// 前置：build 产物（与契约 runner 同口径；缺失 → 先在 games/stack-tower 下执行 npm run build）
const BUILD_FILES = ['build/render/assets.js', 'build/ui/meta-badge.js', 'build/ui/meta-daily-card.js'];
ok(
  'build 产物存在（先 npm run build）',
  BUILD_FILES.every((f) => existsSync(join(GAME, f))),
  BUILD_FILES.filter((f) => !existsSync(join(GAME, f))).join(',') || '3/3',
);

if (checks.every(([, c]) => c)) {
  const [buildAssets, buildBadge, buildCard] = await Promise.all([
    import(join(GAME, 'build', 'render', 'assets.js')),
    import(join(GAME, 'build', 'ui', 'meta-badge.js')),
    import(join(GAME, 'build', 'ui', 'meta-daily-card.js')),
  ]);

  // ⑥ 清单接线：独立 META 清单 = 窄口径 3 键；核心 9 项清单契约不被触碰
  const WIRED = { dailyChallengeCard: 'daily-challenge-card.png', streakBadge: 'streak-badge.png', iconBadge: 'icon-badge.png' };
  const wiredKeys = Object.keys(buildAssets.META_ASSET_MANIFEST ?? {});
  ok('META 清单键集 = 窄口径 3 键', JSON.stringify(wiredKeys.slice().sort()) === JSON.stringify(Object.keys(WIRED).sort()), wiredKeys.join(','));
  ok('mission-panel 不接线（missions-deferred 预留）', !('missionPanel' in (buildAssets.META_ASSET_MANIFEST ?? {})));
  ok(
    'META 清单路径 ↔ manifest.json 逐件对应',
    Object.entries(WIRED).every(([k, f]) => manifest.items.some((it) => it.file === f) && buildAssets.META_ASSET_MANIFEST[k] === `assets/meta/${f}`),
  );
  ok('核心 9 项清单契约未动', Object.keys(buildAssets.ASSET_MANIFEST ?? {}).length === 9);

  // ⑦ 装载三态：无加载器 → 空（headless）；失败加载器 → 全 null 且不抛错
  const headless = await buildAssets.loadMetaAssets();
  ok('loadMetaAssets 无加载器 → 空清单', headless && Object.keys(headless).length === 0);
  const failLoaded = await buildAssets.loadMetaAssets(async () => {
    throw new Error('404（注入失败路径）');
  });
  ok('loadMetaAssets 失败加载器 → 全 null 不抛错', failLoaded && Object.values(failLoaded).every((v) => v === null));

  // ⑧ 每日挑战卡：令牌 fallback ↔ 9-slice 即插即换 ↔ 领取角标三态
  const stubDoc = { createElement: () => ({ style: {}, textContent: '', className: '', appendChild: () => {} }) };
  const mounted = [];
  const card = buildCard.createDailyCard(stubDoc, { appendChild: (n) => mounted.push(n) });
  ok('卡挂载一次 + 初始零占位（display:none）', mounted.length === 1 && card.el.style.display === 'none');
  const hudHex = THEME.match(/UI_PANEL_HUD:\s*'(#[0-9a-fA-F]{6})'/)?.[1]?.toLowerCase() ?? '';
  const hudAlpha = Math.round(Number(THEME.match(/UI_PANEL_HUD_ALPHA:\s*([\d.]+)/)?.[1] ?? 0) * 255)
    .toString(16)
    .padStart(2, '0');
  ok('卡 fallback 底色 = theme 令牌派生（零私设色值）', card.el.style.background === `${hudHex}${hudAlpha}`, card.el.style.background);
  card.update('2026-09-29', false);
  ok('卡 update → 显示 + 挑战日文案', card.el.style.display === 'block' && card.el.textContent === '每日挑战 2026-09-29', card.el.textContent);
  card.update('2026-09-29', true);
  ok('卡已领取未皮肤化 → 令牌 ✓ 字形 fallback', card.el.textContent.endsWith('✓'), card.el.textContent);
  card.applyCardSkin('assets/meta/daily-challenge-card.png');
  ok('卡 9-slice 皮肤：border-image slice 24 + url', /url\("assets\/meta\/daily-challenge-card\.png"\) 24 fill \/ 24px/.test(card.el.style.borderImage), card.el.style.borderImage);
  card.applyIconSkin('assets/meta/icon-badge.png');
  card.update('2026-09-29', true);
  ok(
    '领取角标皮肤化 → icon-badge 图让位 ✓ 字形',
    card.el.style.backgroundImage.includes('assets/meta/icon-badge.png') && !card.el.textContent.endsWith('✓'),
    `${card.el.style.backgroundImage} | "${card.el.textContent}"`,
  );

  // ⑨ 连胜徽章即插即换钩子（acc-b4 令牌占位之上的资产注入面）
  const badgeEl = buildBadge.createStreakBadge(stubDoc, { appendChild: () => {} });
  badgeEl.applyBadgeSkin('assets/meta/streak-badge.png');
  ok('徽章 applyBadgeSkin → url 背景', badgeEl.el.style.background.includes('assets/meta/streak-badge.png'), badgeEl.el.style.background);
}

// ---------- 汇总 ----------
const fail = checks.filter(([, c]) => !c).length;
if (fail > 0) {
  console.log(`RESULT: FAIL (${fail}/${checks.length}) — meta 资产查表有失败项`);
  process.exit(1);
}
console.log(`RESULT: PASS (${checks.length}/${checks.length}) — meta 四件套查表全绿`);
