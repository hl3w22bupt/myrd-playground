/**
 * spec v1.4 建版载荷构建器（B1 上头循环轮 · 2026-09-29 · 一次登记成型）
 *
 * 输入：.myrd/spec/stack-tower-spec.json（v1.3 = 平台 v5 approved 导出件）
 * 输出：.myrd/spec/stack-tower-spec-v1.4-payload.json（POST /revisions 载荷 {spec, detail}）
 *       .myrd/spec/stack-tower-spec-v1.4-new-files.txt（本轮新增文件全清单存档）
 *
 * 版本映射：平台 v6 ≡ 任务书口径 spec v1.4
 *
 * 范围红线（任务书 N1 + 三锁定决策）：
 *  - 变更面 = content.retention 新段（scope_gate + items 每条 id+落点+可执行 check + 双附录 + N0 摘要）
 *    + assets 追加 4 项 meta 四件套 + acceptance 追加 8 条 acc-b1..b8 + revision_note 追加；
 *  - numeric/world/entities/levels 四段与 v1.3 逐字节一致（守卫违反即拒绝产出）；
 *  - numeric sha256 必须等于 v1.3 N1 存档（c3af773b…），锚不重写、不现场自算；
 *  - scope_gate 窄口径落死（N0 样本量 0）：仅 daily-challenge + streak-display，missions 顺延下一轮；
 *  - 时区 = UTC+8：seed 输入 = UTC+8 日期字符串 YYYY-MM-DD，UTC 23:30 vs 该时区 00:30 边界进契约。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const BASE = path.join(ROOT, '.myrd/spec/stack-tower-spec.json');
const OUT = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.4-payload.json');
const V13_ANCHOR = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt');

const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
};
const deepEq = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sha = (o) => createHash('sha256').update(JSON.stringify(sortKeys(o))).digest('hex');

const baseWrap = JSON.parse(readFileSync(BASE, 'utf8'));
const v13 = baseWrap.spec;
const spec = structuredClone(v13);

// —— 冻结守卫 A：四段与 v1.3 逐字节一致（键序无关深比）——
for (const k of ['world', 'entities', 'levels', 'numeric']) {
  if (!deepEq(spec[k], v13[k])) { console.error(`FROZEN GUARD FAIL: ${k} 段漂移`); process.exit(1); }
}
// —— 冻结守卫 B：numeric sha256 ≡ v1.3 N1 存档（锚只复算，禁止现场自算基线）——
const numericSha = sha(spec.numeric);
const anchor = readFileSync(V13_ANCHOR, 'utf8').trim();
if (numericSha !== anchor) {
  console.error(`FROZEN GUARD FAIL: numeric sha ${numericSha} ≠ v1.3 存档锚 ${anchor}`);
  process.exit(1);
}
console.log(`[guard] 四段冻结全等 ✓ sha256(numeric)=${numericSha} ≡ v1.3 锚`);
// —— 幂等守卫：禁止重复登记 ——
if (spec.content.retention) { console.error('content.retention 已存在：禁止重复登记'); process.exit(1); }
if (spec.acceptance.some((a) => String(a.id).startsWith('acc-b'))) {
  console.error('acceptance 已含 acc-b* 条目：禁止重复登记'); process.exit(1);
}

// —— content.retention 新段（scope_gate + items + saveSchema + appendices）——
const ITEM = (id, title, files, check, acceptance, assets, notes) => ({ id, title, files, check, acceptance, assets, notes });

spec.content.retention = {
  name: 'b1-mental-loop',
  target: 'B1 上头循环（meta 留存层）· PWA 先行，wx 包零变更（B0 提审包 sha256=7ee13ab7…8225f 基线保持）',
  timezone: 'UTC+8：每日挑战 seed 输入 = UTC+8 日期字符串 YYYY-MM-DD；「UTC 23:30 vs 该时区 00:30」边界用例进契约测试（acc-b3）',
  numericFreeze:
    'numeric 段 sha256=c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d（sortKeys 规范化）沿用 v1.3 唯一冻结基线，本版逐字节未动；SW 缓存版本递增走工具侧 META_CACHE_EPOCH 叠加（gen-sw.mjs），PRECACHE_REVISION 维持 1 为 v1 基线历史值，不回填 numeric',
  scopeGate: {
    decision: 'narrow',
    rule: 'N0 三门槛（85% 会话完成率 / 3 局人均 / 20% 重开率）全部达标且样本充足 → 三钩子全量；未达标或样本不足 → 仅 daily-challenge + streak-display，missions 顺延下一轮（主策划已锁定决策，执行期不再讨论）',
    n0Evidence: '.myrd/blackboard/n0-data-audit-b1.md',
    n0Summary:
      '2026-09-29 N0 实证：三门槛实测样本量均为 0（客户端 sink no-op + 服务端无采集端点 + 无事件持久化，采集通道未建成），不足以决策全量 → 按锁定决策走窄口径',
    decidedBy: '主策划（2026-09-29）',
    hooksInScope: ['daily-challenge', 'streak-display'],
    hooksDeferred: ['missions'],
  },
  items: [],
};

spec.content.retention.items.push(
  ITEM(
    'daily-challenge', '每日挑战（UTC+8 日期 seed → 确定性开局）',
    ['games/stack-tower/src/meta/seed.ts', 'games/stack-tower/src/meta/daily.ts', 'games/stack-tower/src/meta/save.ts'],
    'node games/stack-tower/tests/contract/b1-acc-b2-daily-seed.spec.mjs；node games/stack-tower/tests/contract/b1-acc-b3-daily-utc-boundary.spec.mjs',
    [
      'seed 确定性：同 UTC+8 日期字符串 → 同 seed → 同挑战开局（逐字节复现）；跨日 seed 必变；全链路禁 Math.random（字符串哈希 → sfc32）',
      '时区边界：UTC 23:30 与该时区 00:30 必须归入不同挑战日（acc-b3 用例原文）；日期字符串只由注入时钟派生，内核零 Date.now',
      '挑战完成判定复用既有 targetLayers 口径（numeric 冻结不动），奖励标记写入 st.meta.save.v2',
    ],
    [{ id: 'daily-challenge-card', file: 'games/stack-tower/assets/meta/daily-challenge-card.png', size: '360x160', expect: '每日挑战面板卡：9-slice 四角 24px 安全区，NEON 色板唯一色值源，透明底' }],
    'UI 先以主题令牌占位（theme token），N2 资产过检后即插即换；资产缺失走程序化 fallback 不抛错'
  ),
  ITEM(
    'streak-display', '连胜展示（连胜计数 + HUD 徽章）',
    ['games/stack-tower/src/meta/streak.ts', 'games/stack-tower/src/ui/hud.ts'],
    'node games/stack-tower/tests/contract/b1-acc-b4-streak.spec.mjs',
    [
      '连胜口径：达成 targetLayers(level) 即连胜 +1；game-over（keepWidth<36）连胜清零；重开不清零（连胜跨局累计）',
      '展示：HUD 徽章显示当前连胜数，零连胜不渲染（零占位）；徽章样式走主题令牌，streak-badge 资产即插即换',
      '连胜数据持久于 st.meta.save.v2（schemaVersion 迁移见 save-migration 条目）',
    ],
    [{ id: 'streak-badge', file: 'games/stack-tower/assets/meta/streak-badge.png', size: '96x96', expect: '连胜徽章：火焰/星轨隐喻从参考卡派生，透明底，单色高亮可被主题重着色' }],
    '「连胜好不好玩」不归机器判定：展示口径以本条 acceptance 为限，玩法激励强度留主人试玩终裁'
  ),
  ITEM(
    'missions-deferred', '连击任务（顺延预留 · 本轮不实现）',
    ['.myrd/spec/stack-tower-spec-v1.4-payload.json'],
    'node games/stack-tower/tests/contract/b1-acc-b1-scope-gate.spec.mjs',
    [
      'scope_gate=窄口径：missions 不进 B1 实现；本条目仅登记附录 A mission JSON schema 定稿，防下一轮漂移',
      '附录 A 硬约束：任务 id 必填且全局去重；契约双向断言（去重 id 缺失即 FAIL）',
      'mission-panel 资产 id 预留登记（N2 可先行产出，两种范围通用）；运行时校验器/任务面板/发奖顺延下一轮',
    ],
    [{ id: 'mission-panel', file: 'games/stack-tower/assets/meta/mission-panel.png', size: '360x200', expect: '连击任务面板：条目行高 48px 9-slice，NEON 派生，透明底（本轮预留，下一轮接线）' }],
    '顺延依据：N0 样本量 0，任务验收口径无法实证；提前落死 schema 地基，下一轮只做运行时'
  ),
  ITEM(
    'save-migration', '存档迁移（v1.3 玩家零损 → st.meta.save.v2）',
    ['games/stack-tower/src/meta/save.ts', 'games/stack-tower/tests/fixtures/save-v13-fixture.json'],
    'node games/stack-tower/tests/contract/b1-acc-b5-save-migration.spec.mjs',
    [
      '迁移输入 = 真实 v1.3 存档 fixture（非空断言：st.settings.muted + st.telemetry.anonId 两键缺一即 FAIL）',
      '零损语义：既有两键迁移前后逐字节一致；新段 st.meta.save.v2 带 schemaVersion="2" 与 createdAt/updatedAt',
      '迁移幂等：对已迁移存档重复执行零变化；损坏 JSON 走安全降级（保留既有键，meta 段重建），绝不抛错阻断游戏',
    ],
    [],
    'v1.3 存档 schema 现状（N0 实证）：仅 muted + anonId 两键、无版本号——本轮迁移 = 新增 meta 段 + 既有键零触碰'
  ),
  ITEM(
    'telemetry-meta', 'meta 埋点三类（断网队列 + 补报 + 去重）',
    ['games/stack-tower/src/telemetry/meta.ts'],
    'node games/stack-tower/tests/contract/b1-acc-b6-telemetry-meta.spec.mjs',
    [
      '事件族枚举封闭（附录 B）：{daily_challenge_start, daily_challenge_result, streak_update} + missions 族预留 {mission_progress, mission_reward}（本轮不发，枚举登记即封）',
      '断网队列：离线/发送失败事件持久队列（localStorage st.meta.telemetry.queue），恢复后按序补报；队列容量上限 200，满则丢最旧（丢旧不丢新）',
      '去重：每事件必带 dedupe_id（UUID，缺失即违契约）；发送器对同 dedupe_id 幂等（重复补报不产生重复计数）',
      '白名单双向断言：附录 B 白名单外的可选字段发送前丢弃；白名单内字段类型不符即整条拒发（acc-e1 六核心事件枚举封闭不扩，双枚举并存互不越界）',
      '上报端点未建（N0 实证）：sender 注入式设计，默认 no-op 发送器 + 队列照常工作，端点建成即插零改',
    ],
    [{ id: 'icon-badge', file: 'games/stack-tower/assets/meta/icon-badge.png', size: '64x64', expect: '奖励角标图标：meta 层通用角标（挑战完成/任务奖励共用），透明底，NEON 派生' }],
    '埋点口径 = 下一轮 missions 验收地基：本轮只保证采集面合规，业务值不在本轮判定（沿用 v1.2 analytics.note 口径）'
  ),
  ITEM(
    'idempotent-claim', '挑战奖励幂等领取（可注入崩溃点）',
    ['games/stack-tower/src/meta/claim.ts'],
    'node games/stack-tower/tests/contract/b1-acc-b7-idempotent-claim.spec.mjs',
    [
      '幂等语义：同挑战日重复领取只发一次（claimed 旗标写入与奖励发放同事务序）；崩溃注入点在「旗标落盘前」中断 → 重启后允许重领一次且仅一次',
      '崩溃注入：claim(persist) 支持注入 persist 抛错，断言中断后状态可恢复、无半发状态',
      '跨日隔离：昨日 claimed 不影响今日首次领取（日期键隔离）',
    ],
    [],
    'mission 发奖幂等随 missions 顺延；本条目把幂等机制先落在 daily-challenge 奖励上，机制与契约同构，下一轮直接复用'
  ),
  ITEM(
    'sw-cache-bump', 'SW 缓存版本递增 + index network-first',
    ['games/stack-tower/tools/gen-sw.mjs', 'games/stack-tower/sw.js'],
    'node games/stack-tower/tests/contract/b1-acc-b8-sw-version.spec.mjs',
    [
      'CACHE 名 = st-precache-v{PRECACHE_REVISION + META_CACHE_EPOCH} = st-precache-v2（B1 起工具侧递增，numeric 冻结不触碰）',
      'index.html 改 network-first（网络超时/失败回退缓存副本）；其余静态资源维持 cache-first + 网络回填',
      'install precache 清单含 B1 新增产物（build/meta/*、build/telemetry/meta.js、assets/meta/*）；activate 清理旧版本缓存',
    ],
    [],
    'N0 矛盾点处置拍板（主策划 2026-09-29）：PRECACHE_REVISION 位于冻结段不可动，版本递增改由工具侧 META_CACHE_EPOCH 承担，口径随本条目落死'
  )
);
console.log(`[inc ] content.retention 段已登记（scope_gate=narrow，items=${spec.content.retention.items.length} 条：${spec.content.retention.items.map((i) => i.id).join(' / ')}）`);

// —— 双附录（锁定决策③：mission JSON schema + 埋点可选字段白名单）——
spec.content.retention.appendices = {
  missionJsonSchema: {
    title: '附录 A · mission JSON schema（v1.4 定稿，运行时顺延下一轮）',
    schemaVersion: '1',
    requiredFields: [
      { field: 'id', type: 'string', constraint: '必填，全局唯一去重（重复 id 即校验失败）；本约束随 acc-b1 契约双向断言' },
      { field: 'title', type: 'string', constraint: '必填，非空展示名' },
      { field: 'goal', type: 'object', constraint: '必填，{type: enum(combo_count|perfect_streak|layers), target: number>0}' },
      { field: 'reward', type: 'object', constraint: '必填，{kind: enum(icon-badge|none), amount: number>=0}' },
    ],
    optionalFields: [
      { field: 'description', type: 'string', constraint: '可选，展示文案' },
      { field: 'window', type: 'object', constraint: '可选，{from: YYYY-MM-DD, to: YYYY-MM-DD}（UTC+8 日期）' },
    ],
    note: '校验器运行时实现随 missions 顺延；schema 先行落死，下一轮实现只认本附录，不得现场改 schema',
  },
  telemetryOptionalFieldWhitelist: {
    title: '附录 B · meta 埋点事件族与可选字段白名单（v1.4 定稿）',
    dualEnumNote:
      'acc-e1 六核心事件（session_start/session_end/block_place/perfect_hit/game_over/restart）枚举封闭不扩；meta 层新增独立事件族（下表），双枚举并存互不越界——核心事件不带 dedupe_id，meta 事件必带',
    dedupeRule: '每条 meta 事件必带 dedupe_id（UUID v4）；发送器对同 dedupe_id 幂等；缺失 dedupe_id 即违契约（acc-b6 拒发）',
    events: [
      { event: 'daily_challenge_start', optional: ['challengeDate'], required: ['dedupe_id'] },
      { event: 'daily_challenge_result', optional: ['challengeDate', 'layers', 'claimed'], required: ['dedupe_id'] },
      { event: 'streak_update', optional: ['streak', 'reason'], required: ['dedupe_id'] },
      { event: 'mission_progress', optional: ['missionId', 'progress'], required: ['dedupe_id'] },
      { event: 'mission_reward', optional: ['missionId', 'rewardKind', 'rewardAmount'], required: ['dedupe_id'] },
    ],
    bidirectionalAssert: '契约双向断言（acc-b6）：① 白名单外可选字段发送前丢弃；② 白名单内字段存在则类型必须匹配，不匹配整条拒发；③ required 字段缺失拒发',
    queuePolicy: '断网/发送失败 → localStorage st.meta.telemetry.queue 持久队列，恢复按序补报；上限 200 条，满丢最旧；上报端点未建（N0 实证），sender 注入式默认 no-op',
  },
};
console.log('[inc ] 双附录已登记（附录 A mission schema / 附录 B 埋点白名单）');

// —— assets 追加 4 项（meta 四件套，id 用任务书原名）——
const META_ASSETS = [
  { id: 'daily-challenge-card', file: 'games/stack-tower/assets/meta/daily-challenge-card.png', generator: 'generated:pnglib-meta', kind: 'ui-panel', license: '仓库内自产，无第三方素材', source: 'generated', size: '360x160', note: '9-slice 四角 24px；NEON 色板唯一色值源；透明底' },
  { id: 'mission-panel', file: 'games/stack-tower/assets/meta/mission-panel.png', generator: 'generated:pnglib-meta', kind: 'ui-panel', license: '仓库内自产，无第三方素材', source: 'generated', size: '360x200', note: '条目行高 48px 9-slice；本轮预留（missions 顺延），N2 可先行产出' },
  { id: 'streak-badge', file: 'games/stack-tower/assets/meta/streak-badge.png', generator: 'generated:pnglib-meta', kind: 'icon', license: '仓库内自产，无第三方素材', source: 'generated', size: '96x96', note: '透明底，单色高亮可被主题重着色' },
  { id: 'icon-badge', file: 'games/stack-tower/assets/meta/icon-badge.png', generator: 'generated:pnglib-meta', kind: 'icon', license: '仓库内自产，无第三方素材', source: 'generated', size: '64x64', note: 'meta 层通用奖励角标，透明底' },
];
for (const a of META_ASSETS) {
  if (spec.assets.some((x) => x.id === a.id)) { console.error(`asset id 冲突：${a.id}`); process.exit(1); }
  spec.assets.push(a);
}
console.log(`[inc ] assets 追加 ${META_ASSETS.length} 项（${META_ASSETS.map((a) => a.id).join(' / ')}）`);

// —— acceptance 追加 8 条（acc-b1..b8，check 指向 B1 契约文件）——
const ACC = (id, statement, check) => ({ id, statement, check });
spec.acceptance.push(
  ACC('acc-b1', 'scope_gate 判定落死（B1）：spec.content.retention.scopeGate.decision="narrow"；hooksInScope=[daily-challenge,streak-display]；missions 顺延（items 含 missions-deferred）；附录 A mission schema 含「id 必填全局去重」硬约束且随本契约断言；N0 证据档案 .myrd/blackboard/n0-data-audit-b1.md 存在且含三行对照表。', 'node games/stack-tower/tests/contract/b1-acc-b1-scope-gate.spec.mjs'),
  ACC('acc-b2', '每日挑战 seed 确定性（B1）：同 UTC+8 日期字符串 → 同 seed 同挑战开局（逐 tick 复现）；跨日 seed 必变；seed 链路 = 日期字符串 → 确定性哈希 → sfc32，全链路禁 Math.random。', 'node games/stack-tower/tests/contract/b1-acc-b2-daily-seed.spec.mjs'),
  ACC('acc-b3', '每日挑战 UTC+8 时区边界（B1）：UTC 23:30 与该时区（UTC+8）00:30 归入不同挑战日；日期字符串只由注入时钟派生；challengeDate 形如 YYYY-MM-DD。', 'node games/stack-tower/tests/contract/b1-acc-b3-daily-utc-boundary.spec.mjs'),
  ACC('acc-b4', '连胜展示（B1）：达成 targetLayers 连胜 +1；game-over 清零；重开不清零；HUD 徽章渲染当前连胜，零连胜不渲染；连胜持久于 st.meta.save.v2。', 'node games/stack-tower/tests/contract/b1-acc-b4-streak.spec.mjs'),
  ACC('acc-b5', '存档迁移零损（B1）：真实 v1.3 fixture（muted + anonId 两键）非空断言；迁移后既有两键逐字节一致；st.meta.save.v2 带 schemaVersion="2"；重复迁移幂等；损坏 JSON 安全降级不抛错。', 'node games/stack-tower/tests/contract/b1-acc-b5-save-migration.spec.mjs'),
  ACC('acc-b6', 'meta 埋点三类（B1）：事件族枚举封闭（附录 B 五事件，missions 族登记即封）；dedupe_id 必填；断网队列持久 + 恢复按序补报 + 同 dedupe_id 幂等；白名单双向断言（白名单外丢弃 + 类型不符拒发 + required 缺失拒发）；acc-e1 核心六事件枚举不受影响。', 'node games/stack-tower/tests/contract/b1-acc-b6-telemetry-meta.spec.mjs'),
  ACC('acc-b7', '挑战奖励幂等领取（B1）：同挑战日重复领取只发一次；persist 抛错（可注入崩溃点）中断后重启允许重领且仅一次；跨日隔离（昨日 claimed 不影响今日）。', 'node games/stack-tower/tests/contract/b1-acc-b7-idempotent-claim.spec.mjs'),
  ACC('acc-b8', 'SW 版本递增 + index network-first（B1）：CACHE=st-precache-v2（PRECACHE_REVISION 1 + META_CACHE_EPOCH 1，numeric 冻结不动）；index.html network-first（失败回退缓存）；precache 清单含 B1 新增产物；activate 清理旧缓存。', 'node games/stack-tower/tests/contract/b1-acc-b8-sw-version.spec.mjs')
);
console.log(`[inc ] acceptance 追加 8 条（acc-b1..b8，总 ${spec.acceptance.length} 条）`);

// —— revision_note 追加（meta 不在冻结段）——
spec.meta.revision_note +=
  ' ‖ v1.4（2026-09-29，B1 上头循环轮）：仅新增 content.retention 段（scope_gate 窄口径落死 + items 七条各带 id+落点+可执行 check + saveSchema 语义 + 双附录）+ assets 追加 4 项 meta 四件套（daily-challenge-card / mission-panel / streak-badge / icon-badge）+ acceptance 追加 8 条 acc-b1..b8。scope_gate：N0 三门槛（85%/3局/20%）实测样本量 0（采集通道未建成），不足以决策全量 → 仅 daily-challenge + streak-display，missions 顺延下一轮（附录 A mission JSON schema 先行定稿，id 必填全局去重）。时区 = UTC+8，seed 输入 = UTC+8 日期字符串，UTC 23:30 vs 该时区 00:30 边界进契约（acc-b3）。numeric/world/entities/levels 四段与 v1.3 逐字节一致（建版守卫深比 + sha256≡v1.3 存档锚双通道）；SW 缓存版本递增走工具侧 META_CACHE_EPOCH（CACHE=st-precache-v2），PRECACHE_REVISION 维持 1 冻结；index.html 改 network-first。埋点：meta 独立事件族五事件枚举封闭 + dedupe_id 必填 + 断网队列/补报/白名单双向断言，acc-e1 核心六事件不动。wx 包零变更（B0 提审包 sha256=7ee13ab7…8225f 基线保持）。';

// —— detail：revision 存档 ① N0 摘要 ② 新增文件全清单 ——
const NEW_FILES = [
  'games/stack-tower/src/meta/seed.ts', 'games/stack-tower/src/meta/daily.ts', 'games/stack-tower/src/meta/save.ts',
  'games/stack-tower/src/meta/streak.ts', 'games/stack-tower/src/meta/claim.ts',
  'games/stack-tower/src/telemetry/meta.ts',
  'games/stack-tower/tests/fixtures/save-v13-fixture.json',
  'games/stack-tower/tests/contract/b1-acc-b1-scope-gate.spec.mjs', 'games/stack-tower/tests/contract/b1-acc-b2-daily-seed.spec.mjs',
  'games/stack-tower/tests/contract/b1-acc-b3-daily-utc-boundary.spec.mjs', 'games/stack-tower/tests/contract/b1-acc-b4-streak.spec.mjs',
  'games/stack-tower/tests/contract/b1-acc-b5-save-migration.spec.mjs', 'games/stack-tower/tests/contract/b1-acc-b6-telemetry-meta.spec.mjs',
  'games/stack-tower/tests/contract/b1-acc-b7-idempotent-claim.spec.mjs', 'games/stack-tower/tests/contract/b1-acc-b8-sw-version.spec.mjs',
  'games/stack-tower/assets/meta/daily-challenge-card.png', 'games/stack-tower/assets/meta/mission-panel.png',
  'games/stack-tower/assets/meta/streak-badge.png', 'games/stack-tower/assets/meta/icon-badge.png',
  'games/stack-tower/assets/meta/manifest.json', 'games/stack-tower/tools/gen-meta-assets.mjs',
  'games/stack-tower/tests/meta/assets-meta-check.mjs',
  '.myrd/blackboard/n0-data-audit-b1.md',
];
const detail =
  `v1.4 建版载荷（B1 上头循环轮，一次登记成型）。变更面 = content.retention 新段（scope_gate + items 七条 + 双附录 + N0 摘要）+ assets 追加 4 项 + acceptance 追加 8 条 acc-b1..b8。` +
  `scope_gate（锁定决策①落死）：N0 三门槛（85% 会话完成率 / 3 局人均 / 20% 重开率，原文见 v1.2 content.analytics.targets）实测样本量 0（sink no-op + 服务端无端点 + 无事件持久化），不足以决策全量 → 仅 daily-challenge + streak-display，missions 顺延（items.missions-deferred 预留，附录 A schema 定稿，去重 id 必填）。` +
  `时区（锁定决策②）：UTC+8，seed 输入 = UTC+8 日期字符串 YYYY-MM-DD，「UTC 23:30 vs 该时区 00:30」边界进契约 acc-b3。埋点（锁定决策③）：附录 B 五事件枚举封闭 + 可选字段白名单双向断言 + dedupe_id 必填。` +
  `① N0 摘要（登记）：三门槛实测样本量均为 0，SW cache-first 且 index 在 precache（旧壳滞留风险），存档仅 muted+anonId 两键无版本号；证据 .myrd/blackboard/n0-data-audit-b1.md。` +
  `② numeric 冻结：sha256(sortKeys)=${numericSha} ≡ v1.3 存档锚（c3af773b…74957d），check-numeric-freeze 只复算存档的机制不变；SW 缓存版本递增由工具侧 META_CACHE_EPOCH 承担（st-precache-v2），PRECACHE_REVISION 维持 1 冻结。` +
  `③ 新增文件全清单（${NEW_FILES.length} 项）：${NEW_FILES.join(' | ')}。` +
  ` world/entities/levels/numeric 四段与 v1.3 逐字节一致（建版守卫深比 + 存档锚双通道）；既有 acceptance 32 条零增改；wx 包零变更（export/wx/ sha256=7ee13ab7…8225f 基线保持，N4 以 git diff 留证）。`;

writeFileSync(OUT, JSON.stringify({ spec, detail }, null, 2) + '\n');
writeFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.4-new-files.txt'), NEW_FILES.join('\n') + '\n');
console.log(`[out ] ${OUT}`);
console.log(`[out ] 新增文件清单（${NEW_FILES.length} 项）已落盘（numeric 锚沿用 v1.3 存档，不重写）`);
console.log(`[done] acceptance=${spec.acceptance.length} content.retention.items=${spec.content.retention.items.length} assets=${spec.assets.length}`);

