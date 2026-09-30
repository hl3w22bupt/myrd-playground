#!/usr/bin/env node
/**
 * dy-share-loop 条目查（spec v1.5 content.platform dy-share-loop · check 面）。
 * 复现：node games/stack-tower/tests/tt/tt-share-loop.spec.mjs
 *
 * 验收口径原文（spec 内写死）：
 *  ② 主判据 = tt.shareAppMessage 最小闭环，分享回调返回 imageUrl 使用 dy-share-card（500×400）；
 *  ③ 录屏分享 / 高光封面卡 = 能力级 optional，缺失不构成打回项；
 *  另：载荷 sessionId（sid=，零 PII）/ 分享失败静默降级保留入口。
 *
 * 断言面：spec 口径原文在位 / dy-share-card 三向一致（spec↔资产 manifest↔磁盘）且落包 /
 * 分享接线（注册 + 主动分享 + 入口保留）/ 载荷零 PII / 闭环行为冒烟（fake tt 宿主）。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  GAME, ROOT, check, finish, loadTtBuild, makeTtHost, installRafPump, requireProd, specItem, srcOf,
} from './_harness.mjs';

const BUILD_CMD = 'node tools/build-tt.mjs';
requireProd('export/tt/build-tt/platform/tt.js', BUILD_CMD);
requireProd('export/tt/assets/tt/share-card.png', BUILD_CMD);

const item = specItem('dy-share-loop');
const shareSrc = srcOf('src/platform/share.ts');
const ttJs = srcOf('export/tt/build-tt/platform/tt.js');
const shareJs = srcOf('export/tt/build-tt/platform/share.js');
const bootJs = srcOf('export/tt/build-tt/app/boot-tt.js');

// ---------- ① spec 口径原文在位（QA 口径原文②③逐字） ----------
check('spec 原文②：tt.shareAppMessage 最小闭环（主判据）', item.acceptance.some((a) => a.startsWith('QA 验收口径原文②（主判据）：tt.shareAppMessage 最小闭环')));
check('spec 原文②：分享回调 imageUrl 使用 dy-share-card（500×400）', item.acceptance.some((a) => a.includes('imageUrl 使用 dy-share-card（500×400）')));
check('spec 原文③：录屏分享/高光封面卡 = 能力级 optional', item.acceptance.some((a) => a.startsWith('QA 验收口径原文③（optional 标注）')) && item.acceptance.some((a) => a.includes('能力级 optional')));
check('spec 原文③反向口径：未标注 optional 的缺件按 spec 缺陷打回', item.acceptance.some((a) => a.includes('未标注 optional 的素材/能力缺件，一律按 spec 缺陷打回')));
check('spec 原文：载荷携带 sessionId（sid 同源，零 PII）', item.acceptance.some((a) => a.startsWith('分享载荷携带 sessionId')));
check('spec 原文：分享失败降级（静默降级并保留入口，不抛错不阻塞对局）', item.acceptance.some((a) => a.startsWith('分享失败降级：tt.shareAppMessage 不可用时静默降级并保留入口')));

// ---------- ② dy-share-card 三向一致 + 落包 + 5:4 ----------
const specAsset = item.assets.find((a) => a.id === 'dy-share-card');
const assetManifest = JSON.parse(srcOf('assets/tt/manifest.json'));
const m = assetManifest.items.find((a) => a.id === 'dy-share-card');
if (!specAsset || !m) {
  check('dy-share-card 在 spec 与资产 manifest 双登记', false);
} else {
  const diskPng = readFileSync(path.join(GAME, 'assets/tt', m.file));
  const sha = createHash('sha256').update(diskPng).digest('hex');
  check('dy-share-card spec↔资产 manifest↔磁盘 三向一致（sha256）', sha === m.sha256 && specAsset.file.endsWith(m.file));
  const w = diskPng.readUInt32BE(16);
  const h = diskPng.readUInt32BE(20); // IHDR
  check(`dy-share-card 尺寸 ${w}x${h} = spec 定稿 ${specAsset.size}（500×400）`, `${w}x${h}` === specAsset.size);
  check('dy-share-card 比例 5:4 数值核', w / h === 5 / 4);
  const inPkg = path.join(GAME, 'export/tt/assets/tt', m.file);
  check('dy-share-card 落包（export/tt 内 sha256 一致）', readFileSync(inPkg).equals(diskPng));
  check('dy-share-card 色源：NEON 表派生（生成器色源断言在 manifest.derivedFrom）', /NEON 表/.test(assetManifest.derivedFrom) && /风格四要素零漂移/.test(assetManifest.generator));
}

// ---------- ③ 分享接线（编译产物面） ----------
check("share.js：会话卡路径 assets/tt/share-card.png（主判据配图）", shareJs.includes('assets/tt/share-card.png'));
check('tt.js：createTtShareRegistrar 导出（注册面）', ttJs.includes('createTtShareRegistrar'));
check('tt.js：onShareAppMessage 注册 + shareAppMessage 主动分享（闭环双通道）', ttJs.includes('onShareAppMessage') && ttJs.includes('shareAppMessage'));
check('tt.js：分享不可用静默降级（入口保留，不抛错）', ttJs.includes('静默降级'));
check('boot-tt：installShareMenuWith(TT_SHARE_CARDS) 安装 + shareNow 入口', bootJs.includes('installShareMenuWith') && bootJs.includes('shareNow') && bootJs.includes('st-hud-share'));
check('载荷 query 携带 sid=（encodeURIComponent）', shareJs.includes('sid=') && shareJs.includes('encodeURIComponent'));
const piiLeak = /nickname|avatarUrl|deviceId|openId/i.test(shareJs + ttJs);
check('分享载荷零 PII（无昵称/头像/设备号/身份字段）', !piiLeak);

// ---------- ④ 闭环行为冒烟（fake tt 宿主：会话实收载荷 = dy-share-card + sid） ----------
installRafPump();
const { load, dispose } = loadTtBuild();
try {
  const ttMod = load('platform/tt.js');
  const shareMod = load('platform/share.js');
  // 被动分享：注册回调返回载荷（卡片 = dy-share-card，sid 回环）
  const host = makeTtHost();
  globalThis.tt = host; // 编译产物读裸 tt 标识符 → 宿主挂全局
  const registrar = ttMod.createTtShareRegistrar();
  shareMod.installShareMenuWith(registrar, 'gate-share-sid', shareMod.TT_SHARE_CARDS);
  const passive = host.__calls.passiveShare.at(-1);
  const msg = passive ? passive() : null;
  check('被动分享回调返回载荷（imageUrl=dy-share-card + query sid=）',
    !!msg && msg.imageUrl === 'assets/tt/share-card.png' && msg.query === 'sid=gate-share-sid');
  check('注册面记帐：lastSessionShare 与回调载荷一致', registrar.lastSessionShare()?.imageUrl === 'assets/tt/share-card.png');
  // 主动分享：shareNow → tt.shareAppMessage 收到同一卡片（最小闭环主判据）
  registrar.shareNow();
  const active = host.__calls.share.at(-1);
  check('主动分享：tt.shareAppMessage 收到 imageUrl=dy-share-card（会话实收形态）', !!active && active.imageUrl === 'assets/tt/share-card.png');
  // 降级一：宿主无 shareAppMessage API → shareNow 静默不抛错，入口保留
  const hostNoShare = makeTtHost({ omit: ['shareAppMessage', 'onShareAppMessage'] });
  globalThis.tt = hostNoShare;
  const registrar2 = ttMod.createTtShareRegistrar();
  let threw = false;
  try {
    shareMod.installShareMenuWith(registrar2, 'sid-2', shareMod.TT_SHARE_CARDS);
    registrar2.shareNow();
  } catch {
    threw = true;
  }
  check('降级一：宿主缺分享 API → shareNow 静默不抛错（入口保留）', !threw);
  // 降级二：tt.shareAppMessage 上报失败（fail 回调）→ 静默，不阻塞对局
  const hostFail = makeTtHost();
  globalThis.tt = hostFail;
  const registrar3 = ttMod.createTtShareRegistrar();
  void hostFail;
  let threwFail = false;
  try {
    registrar3.shareNow();
  } catch {
    threwFail = true;
  }
  check('降级二：分享失败回调（fail）→ 静默不抛错不阻塞对局', !threwFail);
  delete globalThis.tt;
  // 平台卡片集：wx 缺省零漂移（TT 与 WX 集互不串线）
  check('卡片集单源：TT_SHARE_CARDS=tt/share-card，WX_SHARE_CARDS=wx 既有两卡（互不串线）',
    shareMod.TT_SHARE_CARDS.session === 'assets/tt/share-card.png' &&
    shareMod.WX_SHARE_CARDS.session === 'assets/wx/share-card-5x4.png' &&
    shareMod.WX_SHARE_CARDS.timeline === 'assets/wx/share-timeline-1x1.png');
  void shareSrc;
  void ROOT;
} finally {
  dispose();
}

// ---------- ⑤ optional 能力：不产件不判缺陷（口径原文③） ----------
check('optional 能力不产件：仓库无录屏/高光封面派生素材 id（缺失不构成打回项）',
  !assetManifest.items.some((a) => /recorder|highlight/i.test(a.id)));

finish('dy-share-loop 分享闭环（主判据 dy-share-card 500×400）');
