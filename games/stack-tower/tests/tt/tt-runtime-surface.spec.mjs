#!/usr/bin/env node
/**
 * dy-runtime 条目查（spec v1.5 content.platform dy-runtime · check 面）。
 * 复现：node games/stack-tower/tests/tt/tt-runtime-surface.spec.mjs
 *
 * 断言面：
 *  ① dy-* 编号核对（三件套）：spec 条目 id 全集 + 落点 files 逐字在盘（repo 根相对路径）
 *  ② tt/ 骨架：竖屏 + 无开放数据域 + AppID 占位策略 + game.js 入口链
 *  ③ 装配体编译产物面：createTtPlatform / 生命周期 / 输入 / 时钟 / 系统信息与安全区 /
 *    存储同源键（常量单源，零字面重抄）/ BGM 环 / 好友榜云存储 / 零 kernel 触碰
 *  ④ API 冒烟 · devtools 档（本机可跑）：fake tt 宿主行为冒烟（装配/首触解锁/静音持久/好友榜降级可见）
 *  ⑤ API 冒烟 · 真机档：AppID/工具未到位 → 显式 blocked（不执行、不造假数据）
 *  ⑥ UTC+8 seed 边界（tt 存储同源路径）：挑战日翻日 + meta 存档同键读写
 *  ⑦ BGM 调度连续性（tt sink，随本门同门执行——dy-runtime 验收口径原文）
 *  ⑧ 埋点合规巡检（只读，零调优建议）
 */
import {
  ROOT, check, finish, loadTtBuild, makeTtHost, installRafPump, requireProd, specItem, srcOf,
} from './_harness.mjs';
import { existsSync } from 'node:fs';

const BUILD_CMD = 'node tools/build-tt.mjs';
requireProd('export/tt/build-tt/platform/tt.js', BUILD_CMD);

// ---------- ① dy-* 编号核对（三件套） ----------
const ids = ['dy-runtime', 'dy-share-loop', 'dy-submission-kit'];
check('spec dy 条目 id 全集（3 条，编号无漂移）', ids.every((id) => specItem(id)));
const runtimeItem = specItem('dy-runtime');
for (const f of runtimeItem.files) {
  const rel = f.replace(/^games\/stack-tower\//, ''); // spec 落点 = repo 根相对 → 工程根相对
  const atRepoRoot = `${ROOT}/${f}`;
  check(`落点在盘（repo 根相对逐字）：${f}`, srcOf(rel).length > 0 && existsSync(atRepoRoot));
}

// ---------- ② tt/ 骨架 ----------
const gameJson = JSON.parse(srcOf('tt/game.json'));
check('deviceOrientation=portrait', gameJson.deviceOrientation === 'portrait');
check('无 openDataContext（抖音无开放数据域独立子包机制，好友榜收敛 tt 云存储）', !('openDataContext' in gameJson));
const pc = JSON.parse(srcOf('tt/project.config.json'));
check('AppID 占位在位（长度 ≥8，非空号）', typeof pc.appid === 'string' && pc.appid.length >= 8);
check('compileType=game', pc.compileType === 'game');
check('AppID 占位策略留痕（占位 + 真机/提审不执行不造假）', /占位/.test(pc.description || '') && /不执行/.test(pc.description || ''));
check("game.js → require('./build-tt/app/boot-tt.js')", srcOf('tt/game.js').includes("require('./build-tt/app/boot-tt.js')"));
check('boot-tt 产物落包', srcOf('export/tt/build-tt/app/boot-tt.js').length > 0);

// ---------- ③ 装配体编译产物面 ----------
const ttJs = srcOf('export/tt/build-tt/platform/tt.js');
const bootJs = srcOf('export/tt/build-tt/app/boot-tt.js');
check('exports.createTtPlatform（装配体导出）', ttJs.includes('createTtPlatform'));
check('生命周期：tt.onShow 恢复 / tt.onHide 暂停（BGM 环接线）', ttJs.includes('onShow') && ttJs.includes('onHide') && ttJs.includes('resume') && ttJs.includes('pause'));
check('输入：tt.onTouchStart → 意图（首触解锁先行）', ttJs.includes('onTouchStart') && ttJs.includes('unlock'));
check('时钟：requestAnimationFrame 帧链', ttJs.includes('requestAnimationFrame'));
check('系统信息：getSystemInfoSync + safeArea（仅表现层布局输入）', ttJs.includes('getSystemInfoSync') && ttJs.includes('safeArea'));
check('存储桥：tt getStorageSync/setStorageSync 读写路径', ttJs.includes('getStorageSync') && ttJs.includes('setStorageSync'));
check('存储键常量单源（MUTED_STORAGE_KEY / META_SAVE_KEY import，零字面重抄）',
  ttJs.includes('MUTED_STORAGE_KEY') && ttJs.includes('META_SAVE_KEY') && !ttJs.includes("'st.settings.muted'") && !ttJs.includes('"st.meta.save.v2"'));
check('键名常量与 web 同源逐字相等（st.settings.muted / st.meta.save.v2）',
  srcOf('export/tt/build-tt/audio/audio-manager.js').includes("'st.settings.muted'") &&
  srcOf('export/tt/build-tt/meta/save.js').includes("'st.meta.save.v2'") &&
  srcOf('export/tt/build-tt/meta/save.js').includes('schemaVersion'));
check('BGM 环：createInnerAudioContext(loop) + obeyMuteSwitch', ttJs.includes('createInnerAudioContext') && ttJs.includes('obeyMuteSwitch'));
check('好友榜：setUserCloudStorage 写 / getFriendCloudStorage 读（tt 云存储单通道）', ttJs.includes('setUserCloudStorage') && ttJs.includes('getFriendCloudStorage'));
check('好友榜降级三因（missing-api / auth-denied / no-tt-container）+ 门禁可见行 DY_FRIEND_RANK',
  ['missing-api', 'auth-denied', 'no-tt-container'].every((r) => ttJs.includes(r)) && ttJs.includes('DY_FRIEND_RANK='));
check('分享面：onShareAppMessage 注册 + shareAppMessage 主动（不可用静默降级）', ttJs.includes('onShareAppMessage') && ttJs.includes('shareAppMessage'));
check('零 kernel 触碰（系统信息/安全区不进 numeric 冻结段）', !ttJs.includes('kernel') && !ttJs.includes('numeric'));
check('boot-tt：DOM shim + 视口上报 + HUD 直绘 + 分享入口', ['getElementById', 'setViewport', 'installShareMenuWith', 'st-hud-share'].every((k) => bootJs.includes(k)));

// ---------- ④⑤ API 冒烟双档（devtools 档机跑 / 真机档显式 blocked） ----------
console.log('[tier] devtools=machine-run（本门执行，fake tt 宿主行为冒烟）');
console.log('[tier] device=blocked —— AppID + 类目/资质 + 真机工具未到位，不执行、不造假数据（spec dy-submission-kit.notes 口径）');
check('真机档政策在位（AppID 占位 + 不执行不造假）', /占位/.test(pc.description) && /不造假数据/.test(pc.description));

installRafPump();
const { load, dispose } = loadTtBuild();
try {
  const ttMod = load('platform/tt.js');
  const host = makeTtHost();
  // 好友榜：缺 API 宿主（无云存储 API）→ 显式降级原因 missing-api
  const rankNoApi = ttMod.resolveDyFriendRank(makeTtHost({ omit: ['setUserCloudStorage', 'getFriendCloudStorage'] }));
  const lineNoApi = ttMod.describeDyFriendRank(rankNoApi);
  console.log(`[gate] ${lineNoApi}`);
  check('好友榜降级·缺 API：DY_FRIEND_RANK=degraded reason=missing-api（门禁输出可见）', lineNoApi === 'DY_FRIEND_RANK=degraded reason=missing-api');
  // 好友榜：非抖音容器（Node 门禁 / null 注入）→ no-tt-container
  const lineNoHost = ttMod.describeDyFriendRank(ttMod.resolveDyFriendRank(null));
  console.log(`[gate] ${lineNoHost}`);
  check('好友榜降级·非抖音容器：reason=no-tt-container（门禁输出可见）', lineNoHost === 'DY_FRIEND_RANK=degraded reason=no-tt-container');
  // 好友榜：接入档（云存储 API 在位）→ cloud；读取行零好友身份数据、零存储落点
  const rankCloud = ttMod.resolveDyFriendRank(host);
  const lineCloud = ttMod.describeDyFriendRank(rankCloud);
  console.log(`[gate] ${lineCloud}`);
  check('好友榜接入档：mode=cloud（API 在位）', rankCloud.mode === 'cloud' && lineCloud === 'DY_FRIEND_RANK=cloud');
  let friendRows = null;
  rankCloud.readFriendScores((rows) => { friendRows = rows; });
  check('好友榜读取：tt 云存储单通道返回分数行（降序）', Array.isArray(friendRows) && friendRows[0].score === 72 && friendRows[1].score === 45);
  const before = host.__store.size;
  rankCloud.readFriendScores(() => {});
  check('主包零好友数据落点（读取不写任何存储键）', host.__store.size === before);

  // 装配行为冒烟：装配体面 + 首触解锁 + 生命周期（编译产物读裸 tt 标识符 → 宿主挂全局）
  globalThis.tt = host;
  const handles = ttMod.createTtPlatform({ canvas: host.createCanvas(), sessionId: 'gate-sid', ttGlobal: host });
  check('装配面：platform / bgm / setPaused / safeArea / friendRank 五柄齐备',
    !!handles.platform && !!handles.bgm && typeof handles.setPaused === 'function' && !!handles.safeArea && !!handles.friendRank);
  check('安全区只读暴露（top=44，表现层布局输入）', handles.safeArea?.top === 44);
  let intents = 0;
  const offIntent = handles.platform.input.onIntent((i) => { intents += 1; if (i.type !== 'drop') throw new Error('bad intent'); });
  let frames = 0;
  const offFrame = handles.platform.clock.onNextFrame(() => { frames += 1; });
  globalThis.__rafPump(16);
  check('帧链与意图链可达（pump 一帧 → 帧回调 1 次）', frames === 1);
  host.__onTouch?.({ touches: [{ x: 10, y: 10 }] });
  check('首触手势内完成音频解锁 + BGM 起播（acc-a7 同口径）', handles.bgm.stats().unlocked === true && handles.bgm.stats().started === true);
  check('首触同手势产生落块意图（与 web pointerdown 同口径，解锁不吞首次操作）', intents === 1);
  host.__onTouch?.({ touches: [{ x: 20, y: 20 }] });
  check('后续触摸 → drop 意图（输入链稳定）', intents === 2);
  handles.platform.audioManager.toggleMute();
  check('静音持久：st.settings.muted=1 写入 tt 存储（同源键）', host.__store.get('st.settings.muted') === '1');
  handles.platform.audioManager.toggleMute();
  check('静音复位：st.settings.muted=0（读写路径同桥）', host.__store.get('st.settings.muted') === '0');
  handles.setPaused(true);
  globalThis.__rafPump(32);
  check('onHide 语义：暂停后帧回调静默（帧数不再增长）', frames === 1);
  handles.setPaused(false);
  offIntent();
  offFrame();

  // ⑦ BGM 调度连续性（tt sink 同门）：预约 + 零缝隙违例（时钟注入，零真实时间依赖）
  const bgmMod = load('audio/bgm.js');
  const bgmSink = ttMod.createTtBgmSink(() => false);
  let bgmNow = 0;
  const bgm = bgmMod.createBgmLoop({ sink: bgmSink, now: () => bgmNow, mutedProvider: () => false });
  bgm.start();
  bgm.unlock();
  for (; bgmNow <= 30000; bgmNow += 16) bgm.tick(bgmNow);
  const stats = bgm.stats();
  check('BGM 环调度：loopsScheduled ≥ 2（提前预约下一圈）', stats.loopsScheduled >= 2);
  check('BGM 环连续性：gapViolations = 0（缝隙 ≤ 预算）', stats.gapViolations === 0);
  check('BGM 环出口：InnerAudioContext loop + obeyMuteSwitch（跟随系统静音键）', bgmSink.context.loop === true && bgmSink.context.obeyMuteSwitch === true);

  // ⑥ UTC+8 seed 边界（tt 存储同源路径）：daily.js 派生 + meta 存档同键读写
  const daily = load('meta/daily.js');
  check('UTC 23:30 vs UTC+8 00:30 归入不同挑战日（任务书原文用例）',
    daily.challengeDateOf('2026-09-29T23:30:00.000Z') === '2026-09-30' && daily.challengeDateOf('2026-09-29T16:30:00.000Z') === '2026-09-30');
  check('翻日边界：UTC 15:59:59 前一日 / 16:00:00 翻日（TZ_OFFSET=480）',
    daily.challengeDateOf('2026-09-29T15:59:59.000Z') === '2026-09-29' && daily.challengeDateOf('2026-09-29T16:00:00.000Z') === '2026-09-30' && daily.TZ_OFFSET_MINUTES === 480);
  const save = load('meta/save.js');
  const storage = { getItem: (k) => (host.__store.has(k) ? host.__store.get(k) : null), setItem: (k, v) => { host.__store.set(k, v); } };
  save.migrateV13(storage, '2026-09-29T15:59:59.000Z');
  const metaAtBefore = save.loadMetaSave(storage, '2026-09-29T15:59:59.000Z');
  save.saveMetaSave(storage, metaAtBefore, '2026-09-29T15:59:59.000Z');
  const sameKeyAcrossBoundary = host.__store.has('st.meta.save.v2');
  const metaAtAfter = save.loadMetaSave(storage, '2026-09-29T16:00:00.000Z');
  check('meta 存档：st.meta.save.v2 落 tt 存储 + schemaVersion=2（键名与 web 同源零分叉）',
    sameKeyAcrossBoundary && JSON.parse(host.__store.get('st.meta.save.v2')).schemaVersion === '2');
  check('跨翻日边界：同键读写连续（挑战日翻日不改存档键）', metaAtAfter.schemaVersion === metaAtBefore.schemaVersion && daily.challengeDateOf('2026-09-29T16:00:00.000Z') !== daily.challengeDateOf('2026-09-29T15:59:59.000Z'));
  const seeded = daily.createDailyChallenge('2026-09-30T16:00:00.000Z');
  check('当日挑战 seed 确定性（同输入同 seed，零 Math.random）', seeded.seed === daily.createDailyChallenge('2026-09-30T16:00:00.000Z').seed && Number.isFinite(seeded.seed));

  // ⑧ 埋点合规巡检（只读，零调优建议）
  const ttSrc = srcOf('src/platform/tt.ts');
  const bootSrc = srcOf('src/app/boot-tt.ts');
  const piiFree = (s) => !/nickname|avatarUrl|deviceId|openId/i.test(s);
  const noNet = (s) => !/XMLHttpRequest|fetch\(|tt\.request|uploadFile|connectSocket/i.test(s);
  check('巡检：tt 装配体零网络调用面（tt.request/uploadFile/connectSocket/fetch 均无）', noNet(ttSrc));
  check('巡检：tt 入口零网络调用面', noNet(bootSrc));
  check('巡检：tt 面 Zero PII（无昵称/头像/设备号/身份字段）', piiFree(ttSrc) && piiFree(bootSrc));
  check('巡检：会话埋点仍由共享组装根承载（session_start/session_end 原位，未在 tt 面重抄）',
    srcOf('export/tt/build-tt/app/main.js').includes('session_start') && srcOf('export/tt/build-tt/app/main.js').includes('session_end') && !ttSrc.includes('session_start'));
  console.log('[audit] 埋点合规巡检 = 只读核对（三行），零调优建议输出');
} finally {
  delete globalThis.tt; // 宿主卸载（门禁进程零 tt 残留）
  dispose();
}

finish('dy-runtime 运行时表面');
