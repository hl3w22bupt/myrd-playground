/**
 * spec v1.5 建版载荷构建器（C 抖音小游戏移植轮 · 2026-09-30 · N1 一次登记成型）
 *
 * 输入：.myrd/spec/stack-tower-spec.json（v1.4 = 平台 v6 cmulzwv6c005km9lfo3zek574 approved 导出件，
 *       2026-09-30 以平台接口实查回写，与 v1.4 payload sortKeys 全等）
 * 输出：.myrd/spec/stack-tower-spec-v1.5-payload.json（POST /revisions 载荷 {spec, detail}）
 *
 * 版本映射：平台 v7 ≡ 任务书口径 spec v1.5
 *
 * 范围红线（C 轮任务书 N1）：
 *  - 变更面 = content.platform 追加 dy 三条目（dy-runtime / dy-share-loop / dy-submission-kit，
 *    wx 四条目同构：稳定 id + 落点文件 + 可执行 check + 条目 acceptance + 素材 id）+ revision_note 追加
 *    + meta.version 显式落 "1.5"（任务书要求；平台 meta 白名单若规范化丢弃该字段，以实查为准记录偏差，
 *    版本真源沿 revision_note 判例）；
 *  - world/levels/numeric 逐字节零 diff（守卫违反即拒绝产出）；entities/assets（顶层）/acceptance（顶层）
 *    同列零 diff 守卫——素材 id 全部落条目内 assets（wx B0 判例：顶层 assets 段零污染）；
 *  - numeric sha256 必须等于 v1.3 N1 存档（c3af773b…），锚不重写、不现场自算；
 *  - QA 四条验收口径原文收录条目 acceptance（顶层 acceptance 40 条零增改）：
 *    ① 好友榜条款在 dy-runtime 落死：tt 云存储「接入或显式降级且门禁输出可见」，不写「视情况」；
 *    ② 分享主判据 = tt.shareAppMessage 最小闭环 + 配图绑 dy-share-card；
 *    ③ 录屏分享/高光封面卡显式标 optional；未标注 optional 而缺失按 spec 缺陷打回；
 *    ④ N4 三份输入缺一停审（approved spec + 产物带 repo 根/黑板指针 + 机器证据）；
 *  - 落点文件一律「以 repo 根为基准的相对路径」（games/stack-tower/… 前缀，wx 条目同构）；
 *  - missions（content.retention）一字不动；scope_gate 不抢跑（留存评估顺延 ≥7 天真实样本，主策划发起）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const BASE = path.join(ROOT, '.myrd/spec/stack-tower-spec.json');
const OUT = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.5-payload.json');
const V13_ANCHOR = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt');

const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
};
const deepEq = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sha = (o) => createHash('sha256').update(JSON.stringify(sortKeys(o))).digest('hex');

const baseWrap = JSON.parse(readFileSync(BASE, 'utf8'));
const base = baseWrap.spec ?? baseWrap; // wrapped 导出件形状 {schemaVersion, spec, _platform}
const spec = structuredClone(base);
// 修改前快照（真守卫：落盘前对修改后的 spec 深比此快照，杜绝 copy 前自比恒真）
const frozenSnapshot = Object.fromEntries(
  ['world', 'levels', 'numeric', 'entities', 'assets', 'acceptance'].map((k) => [k, JSON.stringify(sortKeys(base[k]))]),
);
const retentionSnapshot = JSON.stringify(sortKeys(base.content.retention));

// —— 冻结守卫 B：numeric sha256 ≡ v1.3 N1 存档锚（只复算，不重写）——
const numericSha = sha(spec.numeric);
const anchor = readFileSync(V13_ANCHOR, 'utf8').trim();
if (numericSha !== anchor) {
  console.error(`FROZEN GUARD FAIL: numeric sha ${numericSha} ≠ v1.3 存档锚 ${anchor}`);
  process.exit(1);
}
console.log(`[guard] 六面冻结全等 ✓ sha256(numeric)=${numericSha} ≡ v1.3 锚`);
// —— 幂等守卫：禁止重复登记 ——
if ((spec.content.platform.items ?? []).some((i) => String(i.id).startsWith('dy-'))) {
  console.error('content.platform.items 已含 dy-* 条目：禁止重复登记'); process.exit(1);
}
// —— 红线守卫 C：missions 一字不动 + scope_gate 不抢跑（快照已取，登记后复比见守卫 C'）——


// —— content.platform 追加 dy 三条目（wx B0 同构）——
const ITEM = (id, title, files, check, acceptance, assets, notes) => ({ id, title, files, check, acceptance, assets, notes });

spec.content.platform.items.push(
  ITEM(
    'dy-runtime',
    'tt 运行时适配（装配体 + 生命周期 + 存储 + 系统信息 + 好友榜条款）',
    [
      'games/stack-tower/src/platform/tt.ts',
      'games/stack-tower/src/audio/bgm.ts',
      'games/stack-tower/tt/game.json',
      'games/stack-tower/tt/game.js',
      'games/stack-tower/tt/project.config.json',
      'games/stack-tower/tools/build-tt.mjs',
    ],
    'node games/stack-tower/tests/tt/tt-runtime-surface.spec.mjs',
    [
      '生命周期：tt.onShow 恢复、tt.onHide 暂停 BGM 环，调度连续性断言随 bgm-loop 冒烟同门执行（acc-a7 同口径，首触手势内完成音频解锁，不设豁免条款）',
      '存储：tt.getStorage/setStorage 与 web 存档同源（st.settings.muted + st.meta.save.v2 带 schemaVersion），键名与读写路径零分叉',
      '系统信息：tt.getSystemInfoSync 取视口与安全区，仅作表现层布局输入，禁止触碰 numeric 冻结段',
      'web 回归零行为变化：tt.ts 只实现 platform/index.ts 的 Platform 接口且不接入 browser 装配体，web 契约与四判据全量重跑零漂移',
      'QA 验收口径原文①（好友榜，落死）：tt 云存储（tt.setUserCloudStorage 写 / tt.getFriendCloudStorage 读）接入或显式降级且门禁输出可见——接入时好友分仅经 tt 云存储 API、主包零好友数据落点；显式降级时门禁输出必须打印 DY_FRIEND_RANK=degraded 与降级原因（缺 API/缺授权/非抖音容器三者之一），输出不可见即打回；本条款禁止「视情况」表述',
    ],
    [],
    '接口平台无关：tt.ts 只实现 Platform 接口（wx B0 判例同构，逻辑层零裸调用）；抖音无开放数据域独立子包机制，好友榜数据通道收敛为 tt 云存储单通道，条款在 acceptance 内落死',
  ),
  ITEM(
    'dy-share-loop',
    '分享闭环（tt.shareAppMessage 最小闭环；录屏分享/高光封面卡 optional）',
    ['games/stack-tower/src/platform/share.ts', 'games/stack-tower/tt/game.js'],
    'node games/stack-tower/tests/tt/tt-share-loop.spec.mjs',
    [
      'QA 验收口径原文②（主判据）：tt.shareAppMessage 最小闭环——分享回调返回 imageUrl 使用 dy-share-card（500×400），卡片可被会话实收；主判据不过即 N4 打回',
      'QA 验收口径原文③（optional 标注）：录屏分享（tt.getGameRecorder 系）与高光封面卡为能力级 optional——缺失不构成打回项；实现时封面素材从本局录屏帧派生并复用 NEON 色板，禁新编风格；反向口径：凡 spec 条目未标注 optional 的素材/能力缺件，一律按 spec 缺陷打回',
      '分享载荷携带 sessionId（anon_id 同源，零 PII），回环进入对局不依赖登录态',
      '分享失败降级：tt.shareAppMessage 不可用时静默降级并保留入口，不抛错不阻塞对局',
    ],
    [
      {
        id: 'dy-share-card',
        file: 'games/stack-tower/assets/tt/share-card.png',
        size: '500x400',
        expect: '会话分享卡：霓虹夜塔开局首屏派生构图（参考卡四联图面板一），NEON 色板唯一色值源，风格四要素零漂移仅规格裁切',
      },
    ],
    'QA 验收口径原文（主判据）：tt.shareAppMessage 最小闭环 + 配图绑 dy-share-card；录屏分享/高光封面卡 = optional（显式标注）',
  ),
  ITEM(
    'dy-submission-kit',
    '提审包与材料清单（N4 回流；是否提审由主人拍板）',
    [
      'games/stack-tower/export/tt/',
      'games/stack-tower/export/tt/manifest.json',
      'games/stack-tower/scripts/check-tt-bundle-size.mjs',
      'games/stack-tower/scripts/check-numeric-freeze.mjs',
      'games/stack-tower/docs/dy-submission-kit-c3.md',
    ],
    'node games/stack-tower/tests/tt/tt-submission-kit.spec.mjs',
    [
      '提审包 = export/tt/ 全量，manifest.json 逐件 sha256 与磁盘一致；包 sha256 入 docs/dy-submission-kit-c3.md',
      '提审材料按 id 逐项对照（本 items[].assets 全集 + dy-share-card）入清单；缺件即 N4 不齐',
      'QA 验收口径原文④（N4 开审三份输入缺一停审）：approved spec + 产物带 repo 根/黑板指针 + 机器证据，三份缺一即停审不判；结论仅输出 JSON（verdict/feedback/evidence）',
      '主包 ≤4MB 分列断言 PASS；numeric 零漂移（只复算 N1 存档锚，禁止现场自算）',
      '是否提审由主人拍板：包与材料做到「工具到位即可提审」，团队只交包，提审动作不代行',
    ],
    [
      { id: 'dy-store-screenshot-01', file: 'games/stack-tower/assets/tt/store-screenshot-01.png', size: '1242x2208', expect: '商店截图一：开局首屏（参考卡面板一派生）' },
      { id: 'dy-store-screenshot-02', file: 'games/stack-tower/assets/tt/store-screenshot-02.png', size: '1242x2208', expect: '商店截图二：perfect 涟漪时刻（参考卡面板三派生）' },
      { id: 'dy-store-screenshot-03', file: 'games/stack-tower/assets/tt/store-screenshot-03.png', size: '1242x2208', expect: '商店截图三：竖屏对局构图（安全区内，参考卡派生）' },
      { id: 'dy-icon', file: 'games/stack-tower/assets/tt/icon.png', size: '512x512', expect: '应用图标：塔块霓虹剪影，参考卡派生，禁新编风格' },
    ],
    '抖音开放平台 AppID 未到位前以测试占位推进结构面，真机轨与提审动作不造假数据（wx B0 判例同构）；落点一律以 repo 根为基准的相对路径',
  ),
);

// —— 编号三方自洽守卫（spec 内：条目 id ↔ 素材 id ↔ 落点路径 ↔ check）——
const items = spec.content.platform.items;
const ids = items.map((i) => i.id);
if (new Set(ids).size !== ids.length) { console.error('ID GUARD FAIL: 条目 id 重复'); process.exit(1); }
const assetIds = [];
for (const it of items) {
  if (!it.check || !it.check.startsWith('node games/stack-tower/tests/')) { console.error(`CHECK GUARD FAIL: ${it.id} check 缺失或非 repo 根相对路径`); process.exit(1); }
  if (!Array.isArray(it.files) || it.files.some((f) => !f.startsWith('games/stack-tower/'))) { console.error(`FILE GUARD FAIL: ${it.id} 落点必须以 games/stack-tower/ 开头（repo 根相对路径）`); process.exit(1); }
  for (const a of it.assets ?? []) {
    assetIds.push(a.id);
    if (!a.id.startsWith('dy-')) continue; // 既有 wx-* 条目素材不在本轮守卫范围（增量面 only）
    if (!a.file.startsWith('games/stack-tower/assets/tt/')) { console.error(`ASSET FILE GUARD FAIL: ${a.file}`); process.exit(1); }
    if (!a.size || !/^\d+x\d+$/.test(a.size)) { console.error(`ASSET SIZE GUARD FAIL: ${a.id}`); process.exit(1); }
    if (!a.expect) { console.error(`ASSET EXPECT GUARD FAIL: ${a.id} 缺 expect`); process.exit(1); }
  }
}
if (new Set(assetIds).size !== assetIds.length) { console.error('ASSET GUARD FAIL: 素材 id 重复'); process.exit(1); }
console.log(`[guard] 编号三方自洽 ✓ 条目 ${ids.length}（${ids.join(' / ')}）素材 ${assetIds.length}（${assetIds.join(' / ')}）`);

// —— 守卫 C'：missions / scope_gate 一字不动（修改后复比）——
if (JSON.stringify(sortKeys(spec.content.retention)) !== retentionSnapshot) { console.error('RED LINE FAIL: content.retention 被改动（missions 一字不动红线）'); process.exit(1); }
// —— 守卫 D：revision_note 仅追加 v1.5 段 + meta.version 显式落账 ——
const note = String(spec.meta.revision_note);
spec.meta.revision_note = `${note} ‖ v1.5（2026-09-30，C 抖音小游戏移植轮）：仅新增 content.platform.items 三条目（dy-runtime / dy-share-loop / dy-submission-kit，wx 四条目同构：稳定 id + 落点文件 + 可执行 check + 条目 acceptance + 素材 id），每条落点一律「以 repo 根为基准的相对路径」。素材 id 五项定稿（dy-share-card / dy-store-screenshot-01..03 / dy-icon）+ 能力级 optional 一项（录屏分享/高光封面卡，不新增独立素材 id）；QA 四条验收口径原文收录条目 acceptance（①好友榜 tt 云存储接入或显式降级且门禁输出可见、不写「视情况」，②tt.shareAppMessage 最小闭环配图绑 dy-share-card，③录屏分享/高光封面卡显式标 optional、未标注 optional 而缺失按 spec 缺陷打回，④N4 三份输入缺一停审、结论仅 JSON）。world/levels/numeric/entities/assets/acceptance 顶层六面与 v1.4 逐字节一致（建版守卫深比）；numeric 段 sha256 ≡ v1.3 唯一冻结锚（c3af773b6483…74957d，只复算存档）；missions/content.retention 一字不动，scope_gate 不抢跑（留存评估顺延 ≥7 天真实样本，主策划发起）。meta.version 本版起显式落 "1.5"（1.4 及以前版本标识仅存 revision_note，属本版增量登记；若平台 meta 白名单规范化丢弃该字段，以接口实查为准记录偏差，版本真源仍为 revision_note + 平台 record.version）。是否提审由主人拍板，团队只交包。`;
spec.meta.version = '1.5';
// —— 守卫 E：数字面冻结（revision_note 内 v1.5 段含锚全值须与存档一致）——
if (!spec.meta.revision_note.includes('c3af773b6483')) { console.error('GUARD E FAIL: revision_note v1.5 段缺冻结锚引用'); process.exit(1); }
// —— 冻结守卫 A'（真守卫，修改后执行）：六面与 v1.4 逐字节一致 ——
for (const k of Object.keys(frozenSnapshot)) {
  if (JSON.stringify(sortKeys(spec[k])) !== frozenSnapshot[k]) { console.error(`FROZEN GUARD FAIL: ${k} 段漂移`); process.exit(1); }
}
console.log('[guard] A\' 六面修改后深比全等 ✓ ｜ C\' retention 一字不动 ✓');

const payload = {
  spec,
  detail:
    'v1.5 建版载荷（C 抖音小游戏移植轮，一次登记成型）。变更面 = content.platform.items 追加 dy 三条目（dy-runtime / dy-share-loop / dy-submission-kit，wx B0 同构）+ meta.revision_note 追加 v1.5 段 + meta.version 显式落 "1.5"。三件套一次给全：稳定 id（条目 3 + 素材 5 + 能力 optional 1）+ 落点（一律以 repo 根为基准的相对路径，games/stack-tower/ 前缀）+ 口径（QA 四条验收口径原文收录条目 acceptance）。① 冻结面：world/levels/numeric/entities/assets/acceptance 顶层六面与 v1.4 逐字节一致（守卫深比全绿）；sha256(numeric sortKeys)=c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d ≡ v1.3 唯一冻结锚，check-numeric-freeze 只复算存档的机制不变。② 红线：零数值改动；missions/content.retention 一字不动；scope_gate 不抢跑（留存评估顺延至 ≥7 天真实样本，由主策划发起）；spec 仅经接口产生、approved 唯一。③ N2/N3 在 v1.5 approved 前不动工；N4 对抗互查三份输入缺一停审；提审包 + 材料清单回流后是否提审由主人拍板。④ B-C-001（已升级主人）：N1 不受阻即刻开工（spec 走接口不依赖 repo）；N2/N3 落盘、N4 开审硬阻塞，黑板 blockers.md 登记在案。',
};
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`[out] ${path.relative(ROOT, OUT)}`);
console.log(`[out] meta.version=${spec.meta.version} 平台映射：平台 v7 ≡ spec v1.5（parent=cmulzwv6c005km9lfo3zek574）`);
