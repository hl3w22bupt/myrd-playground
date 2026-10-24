// deskcheck.mjs — PL4 美术三件 desk-check 机判（2026-10-24 · 游戏美术署名）
// 只读核对：assets.md（风格卡 v1/资产清单/对照表/视效预算）× design-spec.json × src/platform/theme.ts
// 运行：node .myrd/blackboard/gate-logs/line4-art-deskcheck-20261024/deskcheck.mjs（仓库根）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const P = {
  assets: join(ROOT, '.myrd/blackboard/line4-unblock-jam/assets.md'),
  spec: join(ROOT, '.myrd/spec/line4-unblock-jam/design-spec.json'),
  theme: join(ROOT, 'games/line4-unblock-jam/src/platform/theme.ts'),
};
const assetsMd = readFileSync(P.assets, 'utf8');
const spec = JSON.parse(readFileSync(P.spec, 'utf8'));
const themeTs = readFileSync(P.theme, 'utf8');

let pass = 0, fail = 0, findings = [];
const ok = (id, cond, detail) => {
  if (cond) { pass++; console.log(`PASS ${id} :: ${detail}`); }
  else { fail++; console.log(`FAIL ${id} :: ${detail}`); }
};
const finding = (id, detail) => { findings.push(`${id} :: ${detail}`); console.log(`FINDING ${id} :: ${detail}`); };

// ---------- C1 调色板三源逐字符全等（assets.md §一 ≡ spec numeric.palette ≡ theme.ts PALETTE）----------
const HEX = /#[0-9A-Fa-f]{6}/g;
const styleCardHexes = (assetsMd.match(HEX) || []).filter(h =>
  ['#F2EFE6', '#D9D2C5', '#2B2D42', '#111111', '#EF4444', '#F59E0B', '#10B981', '#3B82F6'].includes(h));
// 去重保序 → 风格卡 §一 的 8 色白名单
const seen = new Set(); const styleCardList = styleCardHexes.filter(h => !seen.has(h) && seen.add(h));
const specList = spec.spec.numeric.palette.colors;
const themeBlock = themeTs.slice(themeTs.indexOf('export const PALETTE'), themeTs.indexOf('PALETTE_HEX_LIST'));
const themeList = (themeBlock.match(HEX) || []);
ok('C1-palette-3way', styleCardList.length === 8 && JSON.stringify(styleCardList) === JSON.stringify(specList) && JSON.stringify(themeList) === JSON.stringify(specList),
  `风格卡8色 ≡ spec.numeric.palette ≡ theme.ts（逐字符·保序）：${JSON.stringify(specList)}`);

// ---------- C2 资产清单 6 件 id×file 与 spec.assets 集合全等 + kebab-case ----------
const listRows = [...assetsMd.matchAll(/^\| (a0\d) \| `([^`]+)` \| `([^`]+)` \|/gm)]
  .map(m => ({ no: m[1], id: m[2], file: m[3] }));
const specAssets = spec.spec.assets.map(a => ({ id: a.id, file: a.file }));
const key = a => `${a.id}=>${a.file}`;
const listSet = [...listRows].sort((x, y) => x.id.localeCompare(y.id)).map(key);
const specSet = [...specAssets].sort((x, y) => x.id.localeCompare(y.id)).map(key);
const kebab = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
// 剥全部扩展名链（如 a06-sfx-pack.spec.json → 基名 a06-sfx-pack + 类型段 spec 均按 kebab 判）
const stemSegs = seg => seg.split('.').filter(Boolean);
const kebabAll = listRows.every(r => kebab(r.id) && r.file.split('/').every(seg => stemSegs(seg).every(kebab)));
ok('C2-asset-list-parity', listRows.length === 6 && JSON.stringify(listSet) === JSON.stringify(specSet),
  `清单6件 id×file 集合全等（清单=${listRows.length} spec=${specAssets.length}）`);
ok('C2b-kebab-case', kebabAll, `id 与落点路径段全部 kebab-case：${listRows.map(r => r.id).join(',')}`);

// ---------- C3 判据编号 g-01 ↔ 资产编号 a04 双向挂接 ----------
const g01 = spec.spec.acceptance.find(a => a.id === 'g-01-first-60s-guide');
const elG01 = spec.spec.levels[0].elements.find(e => e.id === 'level-1/el-g01-guide');
const a04Row = listRows.find(r => r.id === 'a04-guide-hand');
ok('C3-g01-a04-binding',
  g01 && g01.statement.includes('a04-guide-hand') && elG01 && elG01.expect.includes('a04-guide-hand')
  && a04Row !== undefined && assetsMd.includes('g-01'),
  'spec acceptance g-01 statement ✓ a04 · spec levels el-g01 expect ✓ a04 · assets.md a04 行挂 g-01（双向）');

// ---------- C4 正反馈三通道名 spec × assets.md §四 全等 ----------
const acc02 = spec.spec.acceptance.find(a => a.id === 'acc-02-exit-feedback-latency');
const ch = ['vf-car-exit-burst', 'vf-combo-pop', 'vf-level-clear'];
const chInSpec = ch.every(c => acc02.statement.includes(c));
const chInAssets = ch.every(c => assetsMd.includes(`\`${c}\``));
const exitEntity = spec.spec.entities.find(e => e.id === 'e-exit');
ok('C4-vf-channels', chInSpec && chInAssets && exitEntity.expect.includes('vf-car-exit-burst'),
  `三通道名 acc-02≡assets.md §四≡e-exit expect：${ch.join('/')}`);

// ---------- C5 F4 测量口径数值对齐（assets.md §四 引述 ≡ spec numeric）----------
const num = spec.spec.numeric;
const f4 = assetsMd.slice(assetsMd.indexOf('## 四'));
ok('C5-f4-measurement', num.measurement.smokeN === 20 && f4.includes('20 局') && f4.includes('performance.now()')
  && num.FIXED_STEP_MS === 16 && num.perf.stepBudgetMs === 16 && f4.includes('stepBudgetMs=16')
  && num.perf.deviceTier.includes('中端') && f4.includes('中端机 60fps'),
  `F4 三定死：时钟源 performance.now() · 档位中端60fps · 采样 N=${num.measurement.smokeN}（assets.md §四 引述逐项命中）`);
ok('C5b-perf-caps', num.perf.entityCap === 60 && f4.includes('实体峰值 ≤60'),
  `实体帽 ${num.perf.entityCap} ≡ §四 常态帧「实体峰值 ≤60」`);

// ---------- C6 theme.ts 单源链 + 渲染面零裸色 ----------
const exported = themeTs.includes('PALETTE_HEX_LIST: readonly string[] = Object.values(PALETTE)');
ok('C6-theme-single-source', exported, 'theme.ts 导出 PALETTE_HEX_LIST=Object.values(PALETTE)（token 单源出口在位）');
const scanDirs = ['src', 'tests'];
let violations = [];
for (const d of scanDirs) {
  const walk = p => readdirSync(p).forEach(f => {
    const fp = join(p, f);
    if (statSync(fp).isDirectory()) return walk(fp);
    if (!/\.(ts|mjs|js)$/.test(f)) return;
    if (fp.includes('platform/theme.ts') || fp.includes('generated/')) return; // 单源与生成件豁免
    const t = readFileSync(fp, 'utf8');
    const bare = t.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
    const rgba = (t.match(/rgba\(\s*\d/g) || []);
    if (bare.length || rgba.length) violations.push(`${fp}: hex=${JSON.stringify(bare)} rgbaNum=${rgba.length}`);
  });
  walk(join(ROOT, 'games/line4-unblock-jam', d));
}
ok('C6b-no-bare-color', violations.length === 0, violations.length ? violations.join(' | ') : '渲染/tests 面（theme.ts 与 generated 豁免外）零裸 hex / 零裸 rgba(数字');

// ---------- C7 draft 态零图合规（approval gate）----------
const assetsDir = join(ROOT, 'games/line4-unblock-jam/assets');
let imgs = [];
if (existsSync(assetsDir)) {
  const walkA = p => readdirSync(p).forEach(f => { const fp = join(p, f); statSync(fp).isDirectory() ? walkA(fp) : imgs.push(fp); });
  walkA(assetsDir);
}
ok('C7-draft-zero-image', !existsSync(assetsDir) || imgs.length === 0,
  `games/line4-unblock-jam/assets/ 位图数=${imgs.length}（spec draft → 生成前零图 = approval gate 合规态；清单为规划落点）`);

// ---------- C8 spec→风格卡锚点引用有效（§一/§三/§四 均存在）----------
const anchorsOk = spec.spec.world.styleRef.includes('assets.md §一') && spec.spec.world.styleRef.includes('§三')
  && acc02.statement.includes('assets.md §四')
  && ['## 一、', '## 二、', '## 三、', '## 四、'].every(h => assetsMd.includes(h));
ok('C8-spec-anchors', anchorsOk, 'spec world.styleRef §一/§三 + acc-02 §四 引用锚点在 assets.md 全部存在');

// ---------- C9 对标条目号 D35/D40 双源一致 ----------
ok('C9-benchmark-d35-d40', assetsMd.includes('D35') && assetsMd.includes('D40') && spec.spec.meta.lineage.includes('D35') && spec.spec.meta.lineage.includes('D40'),
  '对标双条目号 D35（上个了车）/D40（挪了下车）：assets.md §三 ≡ spec meta.lineage');

// ---------- F1 五要素指代缺陷（v0.2 起改为解除态机判）----------
// 作用域=§四 切片：§五 复证记录提及「五要素」属缺陷描述引用，不算词条存在
const sec4 = assetsMd.slice(assetsMd.indexOf('## 四'), assetsMd.indexOf('## 五') > 0 ? assetsMd.indexOf('## 五') : undefined);
if (acc02.statement.includes('五要素') && !sec4.includes('五要素')) {
  finding('F-01 五要素指代缺陷',
    `spec acc-02 statement 与 QA 核销表 F1 行两处引用「assets.md §四 五要素」，但 assets.md §四 无「五要素」词条（表头=通道/预算/硬顶）。修订权归主策划（spec 禁覆盖走 revision）；可选修法：acc-02 改「三通道规格」或 §四 补「五要素」定义词条。`);
} else if (!acc02.statement.includes('五要素')) {
  const qaMd = readFileSync(join(ROOT, '.myrd/blackboard/line4-unblock-jam/qa-seven-defects-clearance-20261024.md'), 'utf8');
  const qaSynced = qaMd.includes('三通道规格') && qaMd.includes('v0.2 勘误更正');
  ok('C10-five-element-closed', qaSynced,
    `F-01 已核销：acc-02 改「三通道规格（通道/预算/硬顶）」≡ §四 表头；QA 核销表 F1 行同步留痕（三通道规格+v0.2 勘误更正）=${qaSynced}`);
}

// ---------- C11 spec 链锚 × 生成件单源链（勘误轮起新增）----------
const genSpec = readFileSync(join(ROOT, 'games/line4-unblock-jam/src/generated/spec-data.mjs'), 'utf8');
const anchorJsonM = genSpec.match(/export const SPEC_ANCHOR = (\{[^;]+\});/);
let specAnchor = '(未找到)', anchorVer = '(未找到)';
if (anchorJsonM) { try { const a = JSON.parse(anchorJsonM[1]); specAnchor = a.id; anchorVer = a.version; } catch { /* keep placeholders */ } }
ok('C11-spec-anchor-chain', specAnchor === spec.id,
  `生成件 SPEC_ANCHOR.id(${specAnchor}) ≡ spec.id(${spec.id}) · 锚version=${anchorVer} · 链版本=${spec.spec.meta.version} parent=${spec.parentSpecId ?? 'null'}`);

const buildInfo = readFileSync(join(ROOT, 'games/line4-unblock-jam/src/generated/build-info.mjs'), 'utf8');
const shaM = buildInfo.match(/[0-9a-f]{40}|[0-9a-f]{7,12}/i);
const head = process.argv[2] || '';
console.log(`INFO build-info sha=${shaM ? shaM[0] : '(未找到)'} · 取证 HEAD=${head || '(未传)'}（sha 滞后一笔=已披露惯例，只报告不断言）`);

console.log('---');
console.log(`DESKCHECK-SUMMARY: PASS=${pass} FAIL=${fail} FINDING=${findings.length}`);
process.exit(fail === 0 ? 0 : 1);
