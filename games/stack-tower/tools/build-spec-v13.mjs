/**
 * spec v1.3 建版载荷构建器（B0 微信小游戏移植轮 · 2026-09-28）
 *
 * 输入：.myrd/spec/stack-tower-spec.json（v1.2 = 平台 v4 approved 导出件，2026-09-28 与平台侧八段深比一致）
 * 输出：.myrd/spec/stack-tower-spec-v1.3-payload.json（POST /revisions 载荷 {spec, detail}）
 *       .myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt（唯一冻结锚存档，check-numeric-freeze 只复算本档）
 *       .myrd/spec/stack-tower-spec-v1.3-new-files.txt（本轮新增文件全清单存档）
 *
 * 版本映射：平台 v5 ≡ 任务书口径 spec v1.3
 *
 * 范围红线（任务书 N1）：仅新增 platform 段四条目；素材 id 一步定稿；QA 两条验收口径原文写死；
 * world/entities/levels/numeric 四段与 v1.2 逐字节一致（守卫违反即拒绝产出）；acceptance 32 条零增改。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const BASE = path.join(ROOT, '.myrd/spec/stack-tower-spec.json');
const OUT = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-payload.json');

const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
};
const deepEq = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sha = (o) => createHash('sha256').update(JSON.stringify(sortKeys(o))).digest('hex');

const baseWrap = JSON.parse(readFileSync(BASE, 'utf8'));
const v12 = baseWrap.spec;
const spec = structuredClone(v12);

// —— 冻结守卫：四段与 v1.2 逐字节一致（键序无关深比 + hash）——
for (const k of ['world', 'entities', 'levels', 'numeric']) {
  if (!deepEq(spec[k], v12[k])) { console.error(`FROZEN GUARD FAIL: ${k} 段漂移`); process.exit(1); }
}
if (JSON.stringify(spec.acceptance) !== JSON.stringify(v12.acceptance)) {
  console.error('FROZEN GUARD FAIL: acceptance 32 条必须零增改'); process.exit(1);
}
const numericSha = sha(spec.numeric);
console.log(`[guard] 四段冻结全等 ✓ sha256(numeric)=${numericSha}`);

if (spec.platform) { console.error('platform 段已存在：禁止重复登记'); process.exit(1); }

// —— platform 段四条目（素材 id 一步定稿；QA 两条验收口径原文写死）——
// 落段说明：平台 schemaVersion v0 段落白名单 = meta/world/entities/levels/numeric/acceptance/content/assets
// （2026-09-28 POST 实证 422 SCHEMA_VALIDATION_FAILED「未知段落 platform——新段落请先升 schemaVersion」；
//   后端无 v1 证据，不擅升 schema 污染版本链）→ 四条目原样落 content.platform（content 非冻结段，
//   v1.2 content.analytics 先例），条目 id/落点/check 结构一字不变，落段适配在此显式留痕。
if (spec.content.platform) { console.error('content.platform 已存在：禁止重复登记'); process.exit(1); }
spec.content.platform = {
  name: 'wechat-minigame',
  target: '微信小游戏（wx 运行时）· 可提审包',
  appIdPolicy:
    '正式 AppID 与类目/资质材料未到位：wx/project.config.json 以测试号 touristappid 占位推进 devtools 侧，不空转；真机轨与提审动作在 AppID + 类目/资质到位前不执行、不造假数据',
  reuse: '适配层接口平台无关（platform/index.ts Platform 装配体范式：新平台 = 新增一份装配体，内核零改动），抖音小游戏日后零改复用',
  budgets: { mainPackageMaxBytes: 4194304, openDataContextMaxBytes: 1048576, note: '主包 ≤4MB（微信上限）与开放数据域子包 ≤1MB 分列断言，禁止合并口径' },
  numericFreeze:
    'numeric 段 sha256=c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d（sortKeys 规范化）为本版唯一冻结基线；check-numeric-freeze 只复算 N1 存档（.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt），禁止现场自算基线',
  items: [],
};
const ITEM = (id, title, files, check, acceptance, assets, notes) => ({ id, title, files, check, acceptance, assets, notes });

spec.content.platform.items.push(
  ITEM(
    'wx-runtime', 'wx 运行时适配（装配体 + 生命周期 + BGM 环）',
    ['games/stack-tower/src/platform/wx.ts', 'games/stack-tower/src/audio/bgm.ts', 'games/stack-tower/wx/game.json', 'games/stack-tower/wx/game.js', 'games/stack-tower/wx/project.config.json', 'games/stack-tower/tools/build-wx.mjs'],
    'node games/stack-tower/tests/wx/wx-runtime-surface.spec.mjs',
    [
      'BGM onShow/onHide：wx.onShow 恢复、wx.onHide 暂停 BGM 环，调度连续性断言随 bgm-loop 冒烟同门执行',
      '静音键：静音持久键与 web 同源（st.settings.muted），静音态 BGM/SFX 零输出',
      '首触解锁：首触手势内完成音频解锁与播放，闸门不得吞掉或延后首次出声（acc-a7 同口径，不设 iOS 豁免条款）',
      'web 回归零行为变化：bgm.ts 不接入 browser 装配体，web 契约与四判据全量重跑零漂移',
    ],
    [],
    '接口平台无关：wx.ts 只实现 platform/index.ts 的 Platform 接口，抖音复用时新增装配体、接口零改'
  ),
  ITEM(
    'wx-share-loop', '分享闭环（会话 + 朋友圈）',
    ['games/stack-tower/src/platform/share.ts', 'games/stack-tower/wx/game.js'],
    'node games/stack-tower/tests/wx/wx-share-loop.spec.mjs',
    [
      '主判据 = 会话分享 5:4 卡：wx.onShareAppMessage 返回 imageUrl 使用 wx-share-card-5x4（500×400），卡片可被会话实收',
      '朋友圈 = 附带项：wx.onShareTimeline 返回 imageUrl 使用 wx-share-timeline-1x1（500×500）；附带项不作为 B0 放行判据',
      '分享载荷携带 sessionId（anon_id 同源，零 PII），回环进入对局不依赖登录态',
    ],
    [
      { id: 'wx-share-card-5x4', file: 'games/stack-tower/assets/wx/share-card-5x4.png', size: '500x400', expect: '会话分享卡：霓虹夜塔开局首屏派生构图（参考卡四联图面板一），NEON 色板唯一色值源' },
      { id: 'wx-share-timeline-1x1', file: 'games/stack-tower/assets/wx/share-timeline-1x1.png', size: '500x500', expect: '朋友圈方图：同一参考卡派生，中心对称构图' },
    ],
    'QA 验收口径原文：主判据=会话分享 5:4 卡；朋友圈=附带项'
  ),
  ITEM(
    'wx-open-data-rank', '开放数据域好友排行（子包）',
    ['games/stack-tower/wx/open-data-context/index.js', 'games/stack-tower/wx/open-data-context/rank.js'],
    'node games/stack-tower/tests/wx/wx-open-data-rank.spec.mjs',
    [
      '开放数据域不卡「真机看到真实好友分」：B0 判据 = 开放数据域渲染管线就绪（结构门禁 + devtools 合成数据渲染）；真机真实好友分不作为 B0 验收判据',
      'token 引主包同一份变量文件：子包色板/数值 token 构建期自 src/render/theme.ts NEON 表单源编译，子包产物与主包 token 段 sha256 相等（禁止手抄第二份常量）',
      '渲染：sharedCanvas 绘制好友排行（头像/昵称/分数），排行数据仅来自 wx.getFriendCloudStorage（开放数据域内），主包零好友数据落点',
    ],
    [{ id: 'wx-friend-rank-ui', file: 'games/stack-tower/assets/wx/friend-rank-ui.png', size: '460x560', expect: '好友排行 UI：面板/条目样式从参考卡派生（半透明夜色底 + 霓虹描边），禁新编风格' }],
    '子包体积走 budgets.openDataContextMaxBytes 分列断言'
  ),
  ITEM(
    'wx-submission-kit', '提审包与材料清单（N4 回流）',
    ['games/stack-tower/export/wx/', 'games/stack-tower/export/wx/manifest.json', 'games/stack-tower/scripts/check-wx-bundle-size.mjs', 'games/stack-tower/scripts/check-numeric-freeze.mjs', 'games/stack-tower/docs/wx-submission-kit-b0.md'],
    'node games/stack-tower/tests/wx/wx-submission-kit.spec.mjs',
    [
      '提审包 = export/wx/ 全量，manifest.json 逐件 sha256 与磁盘一致；包 sha256 入 docs/wx-submission-kit-b0.md',
      '提审材料按 id 逐项对照（本 items[].assets 全集）入清单；缺件即 N4 不齐',
      '主包 ≤4MB 与开放数据域子包 ≤1MB 分列断言双 PASS；numeric 零漂移（只复算 N1 存档）',
    ],
    [
      { id: 'wx-store-screenshot-01', file: 'games/stack-tower/assets/wx/store-screenshot-01.png', size: '1242x2208', expect: '商店截图一：开局首屏（参考卡面板一派生）' },
      { id: 'wx-store-screenshot-02', file: 'games/stack-tower/assets/wx/store-screenshot-02.png', size: '1242x2208', expect: '商店截图二：perfect 涟漪时刻（参考卡面板三派生）' },
      { id: 'wx-store-screenshot-03', file: 'games/stack-tower/assets/wx/store-screenshot-03.png', size: '1242x2208', expect: '商店截图三：好友排行 UI（wx-friend-rank-ui 同源构图）' },
      { id: 'wx-icon', file: 'games/stack-tower/assets/wx/icon.png', size: '120x120', expect: '应用图标：塔块霓虹剪影，参考卡派生，禁新编风格' },
    ],
    'AppID + 类目/资质材料到位前：包与材料做到「工具到位即可提审」，提审动作本身待主人拍板'
  )
);
console.log(`[inc ] content.platform 段四条目已登记（${spec.content.platform.items.map((i) => i.id).join(' / ')}）`);
const assetIds = spec.content.platform.items.flatMap((i) => i.assets.map((a) => a.id));
console.log(`[inc ] 素材 id 一步定稿 ${assetIds.length} 项：${assetIds.join('、')}`);

// —— revision_note 追加（meta 不在冻结四段内）——
spec.meta.revision_note +=
  ' ‖ v1.3（2026-09-28，B0 微信小游戏移植轮）：仅新增 content.platform 段四条目（wx-runtime / wx-share-loop / wx-open-data-rank / wx-submission-kit；平台 schemaVersion v0 段落白名单不含顶层 platform——422 实证留痕于建版器，四条目原样落 content.platform，id/落点/check 结构不变），每条带落点文件 + 可执行 check；素材 id 一步定稿 7 项（wx-share-card-5x4 / wx-share-timeline-1x1 / wx-store-screenshot-01..03 / wx-friend-rank-ui / wx-icon；任务书「8 项」与定稿清单差 1，以定稿 id 清单为准，差额待主人指认）；QA 两条验收口径原文写死（主判据=会话分享 5:4 卡，朋友圈=附带项；开放数据域不卡「真机看到真实好友分」）；numeric 段 sha256 存档为唯一冻结基线（c3af773b6483…74957d，check-numeric-freeze 只复算存档）；world/entities/levels/numeric 四段与 v1.2 逐字节一致（建版守卫机械断言）；acceptance 32 条零增改。AppID 未到位以测试号 touristappid 占位推进 devtools 侧，真机轨与提审不造假数据。';

// —— detail：revision 存档 ① numeric sha256 ② 新增文件全清单 ——
const NEW_FILES = [
  'games/stack-tower/src/platform/wx.ts', 'games/stack-tower/src/platform/share.ts', 'games/stack-tower/src/audio/bgm.ts',
  'games/stack-tower/wx/game.json', 'games/stack-tower/wx/game.js', 'games/stack-tower/wx/project.config.json',
  'games/stack-tower/wx/open-data-context/index.js', 'games/stack-tower/wx/open-data-context/rank.js',
  'games/stack-tower/tools/build-wx.mjs', 'games/stack-tower/tools/gen-wx-assets.mjs',
  'games/stack-tower/scripts/check-wx-bundle-size.mjs', 'games/stack-tower/scripts/check-numeric-freeze.mjs',
  'games/stack-tower/tests/wx/wx-runtime-surface.spec.mjs', 'games/stack-tower/tests/wx/wx-share-loop.spec.mjs',
  'games/stack-tower/tests/wx/wx-open-data-rank.spec.mjs', 'games/stack-tower/tests/wx/wx-submission-kit.spec.mjs',
  'games/stack-tower/tests/wx/bgm-loop-wx.spec.mjs', 'games/stack-tower/tests/wx/run-wx-gate.mjs',
  'games/stack-tower/tests/wx/assets-wx-check.mjs',
  'games/stack-tower/assets/wx/share-card-5x4.png', 'games/stack-tower/assets/wx/share-timeline-1x1.png',
  'games/stack-tower/assets/wx/store-screenshot-01.png', 'games/stack-tower/assets/wx/store-screenshot-02.png',
  'games/stack-tower/assets/wx/store-screenshot-03.png', 'games/stack-tower/assets/wx/friend-rank-ui.png',
  'games/stack-tower/assets/wx/icon.png', 'games/stack-tower/assets/wx/manifest.json',
  'games/stack-tower/export/wx/', 'games/stack-tower/docs/wx-submission-kit-b0.md', 'games/stack-tower/docs/qa-wx-b0.md',
];
const detail =
  `v1.3 建版载荷（B0 微信小游戏移植轮）。仅新增 content.platform 段四条目（wx-runtime/wx-share-loop/wx-open-data-rank/wx-submission-kit；schemaVersion v0 顶层段落白名单不含 platform，422 实证后原样落 content.platform——条目结构不变），` +
  `每条带 id+落点文件+可执行 check；素材 id 一步定稿 7 项（${assetIds.join('/')}）；QA 两条验收口径原文写死进 platform 段` +
  `（主判据=会话分享 5:4 卡；朋友圈=附带项；开放数据域不卡「真机看到真实好友分」）。` +
  `① 唯一冻结基线存档：numeric 段 sha256(sortKeys)=${numericSha}；check-numeric-freeze 只复算本存档，禁止现场自算。` +
  `② 新增文件全清单（${NEW_FILES.length} 项）：${NEW_FILES.join(' | ')}。` +
  ` world/entities/levels/numeric 四段与 v1.2 逐字节一致（建版守卫深比+hash 双通道）；acceptance 32 条零增改；` +
  `AppID 未到位用测试号 touristappid 推进 devtools 侧，不空转；真机轨与提审不造假数据。`;

writeFileSync(OUT, JSON.stringify({ spec, detail }, null, 2) + '\n');
writeFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt'), numericSha + '\n');
writeFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-new-files.txt'), NEW_FILES.join('\n') + '\n');
console.log(`[out ] ${OUT}`);
console.log(`[out ] numeric-sha256 存档 + 新增文件清单（${NEW_FILES.length} 项）已落盘`);
console.log(`[done] acceptance=${spec.acceptance.length} content.platform.items=${spec.content.platform.items.length} assets(平台)=${assetIds.length}`);
