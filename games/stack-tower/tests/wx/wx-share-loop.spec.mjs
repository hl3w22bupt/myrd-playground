#!/usr/bin/env node
/**
 * wx-share-loop 条目查（spec v1.3 content.platform wx-share-loop · check 面）。
 * 验收口径原文（spec 内写死）：主判据 = 会话分享 5:4 卡；朋友圈 = 附带项。
 * 断言：spec 口径原文在位 / 双卡素材与 manifest 尺寸 sha256 一致且落包 / 分享注册接线 /
 *       载荷 sessionId（sid=）零 PII / 分享面资源路径与包内实际一致。
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(GAME, '../..');
const P = (...s) => path.join(GAME, 'export/wx', ...s);
const failures = [];
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures.push(name); console.log(`  FAIL  ${name}`); }
};

const spec = JSON.parse(readFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec.json'), 'utf8')).spec;
const shareItem = spec.content.platform.items.find((i) => i.id === 'wx-share-loop');
const assetManifest = JSON.parse(readFileSync(path.join(GAME, 'assets/wx/manifest.json'), 'utf8'));

// ① spec 验收口径原文（主判据 / 附带项）
check('spec 原文：主判据 = 会话分享 5:4 卡', shareItem.acceptance.some((a) => a.startsWith('主判据 = 会话分享 5:4 卡')));
check('spec 原文：朋友圈 = 附带项（不作放行判据）', shareItem.acceptance.some((a) => a.startsWith('朋友圈 = 附带项')));
// ② 双卡素材：尺寸定稿 + sha256 + 落包
for (const id of ['wx-share-card-5x4', 'wx-share-timeline-1x1']) {
  const m = assetManifest.items.find((a) => a.id === id);
  const inPkg = P('assets/wx', m.file);
  if (!m || !existsSync(inPkg)) { check(`${id} 落包`, false); continue; }
  const buf = readFileSync(inPkg);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // IHDR
  const sha = createHash('sha256').update(buf).digest('hex');
  check(`${id} 落包且 sha256 一致`, sha === m.sha256);
  check(`${id} 尺寸 ${w}x${h} = 定稿 ${m.size}`, `${w}x${h}` === m.size);
}
// ③ 分享面接线（编译产物）
const shareJs = readFileSync(P('build-wx/platform/share.js'), 'utf8');
const wxJs = readFileSync(P('build-wx/platform/wx.js'), 'utf8');
check('share.js：会话卡路径 assets/wx/share-card-5x4.png（5:4）', shareJs.includes('assets/wx/share-card-5x4.png'));
check('share.js：朋友圈路径 assets/wx/share-timeline-1x1.png（1:1）', shareJs.includes('assets/wx/share-timeline-1x1.png'));
check('wx.ts：分享注册面导出（createWxShareRegistrar → onShareAppMessage）', wxJs.includes('createWxShareRegistrar') && wxJs.includes('onShareAppMessage'));
check('boot-wx：installShareMenu(createWxShareRegistrar) 安装', readFileSync(P('build-wx/app/boot-wx.js'), 'utf8').includes('installShareMenu'));
// ④ 载荷零 PII：sid= 会话 id，无昵称/头像/设备号字段
check('载荷 query 携带 sid=（encodeURIComponent）', shareJs.includes('sid=') && shareJs.includes('encodeURIComponent'));
const piiLeak = /nickname|avatarUrl|deviceId|openId/i.test(shareJs);
check('分享载荷零 PII（无 nickname/avatar/deviceId/openId）', !piiLeak);
// ⑤ 卡片宽高比 5:4 数值核（500/400）
check('会话卡 5:4 比例（500×400）', (() => {
  const m = assetManifest.items.find((a) => a.id === 'wx-share-card-5x4');
  const [w, h] = m.size.split('x').map(Number);
  return w / h === 5 / 4;
})());

if (failures.length) {
  console.log(`RESULT: FAIL (${12 - failures.length}/12)`);
  process.exit(1);
}
console.log('RESULT: PASS  — 分享闭环 12 项断言全绿（主判据面 5:4 卡就绪）');
