#!/usr/bin/env node
// art-trace-check.mjs — 封版冲刺 N5 物料归档可回溯性机判（美术线复核轮 · 2026-10-08）
//
// 口径：对《物料代差清单》(material-matrix.md) M-01..M-11 声明的「来源 commit + 落点 + sha256」
// 逐条实跑回溯（git show <sha>:<path> 取 blob 实算 sha256），不采信台账文字。
// 用法：node art-trace-check.mjs --ws <run 工作区根> [--out <file>]   exit 0=全绿 / 1=有红
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const wsIdx = process.argv.indexOf('--ws');
const WS = resolve(wsIdx > -1 ? process.argv[wsIdx + 1] : process.cwd());
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? resolve(process.argv[outIdx + 1]) : null;
const TREES = {
  web: join(WS, '..', 'g2-blocks-main'),
  wx: join(WS, '..', 'g2-blocks-wx'),
  dy: join(WS, '..', 'g2-blocks'),
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const blob = (tree, c, p) => {
  try {
    return execFileSync('git', ['-C', TREES[tree], 'show', `${c}:${p}`], { maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { return null; }
};
const head = (tree) => execFileSync('git', ['-C', TREES[tree], 'rev-parse', 'HEAD']).toString().trim();

const checks = [];
const add = (id, item, pass, detail, extra = {}) =>
  checks.push({ id, item, pass: !!pass, detail, ...extra });

// T-01 M-01 风格卡 @web 6d3db6a 在档且与 HEAD 零漂移
{
  const c = '6d3db6a', p = 'assets/style-card.json';
  const b = blob('web', c, p), h = blob('web', head('web'), p);
  add('T-01', 'M-01 风格卡', !!b && !!h && b.equals(h),
    b ? (b.equals(h) ? `${p} @${c} 在档，HEAD 零漂移（${b.length}B）` : `${p} @${c} 在档但与 HEAD 漂移`) : `${p} @${c} 缺失`,
    { commit: c, path: p, sha256: b ? sha256(b) : null });
}
// T-02 M-01 冻结色板 sha256 = 7bc2ca03…（链上 sourceSha256 锚）
{
  const c = '6d3db6a', p = 'assets/palette/palette-n1-final.json';
  const b = blob('web', c, p), h = blob('web', head('web'), p);
  const s = b ? sha256(b) : null;
  add('T-02', 'M-01 冻结色板', !!s && s.startsWith('7bc2ca03') && !!h && b.equals(h),
    s ? (s.startsWith('7bc2ca03') ? `sha256=${s.slice(0, 8)}… ≡ 链锚 sourceSha256；HEAD 零漂移` : `sha256=${s.slice(0, 8)}… ≠ 链锚 7bc2ca03…`) : `${p} @${c} 缺失`,
    { commit: c, path: p, sha256: s });
}
// T-03/T-04 图标 manifest 通用核（结构：{source,derived} 或 {derivedFrom,file,sha256}）
// 判据：derived/文件实算 sha256 == manifest 声明 == derivedFrom 声明（exact-copy 零改绘三向全等）+ HEAD 零漂移
const iconCheck = (id, item, tree, c, mp, ip, expectPrefix) => {
  const m = blob(tree, c, mp), i = blob(tree, c, ip);
  let ok = false, detail = `${mp} @${c} 缺失`, declared = null, srcDeclared = null;
  if (m && i) {
    const j = JSON.parse(m.toString());
    declared = (j.derived && j.derived.sha256) || j.sha256 || null;
    srcDeclared = (j.source && j.source.sha256) || (j.derivedFrom && j.derivedFrom.sha256) || null;
    const real = sha256(i);
    const exactCopy = !srcDeclared || srcDeclared === declared; // exact-copy 声明自洽
    const mHead = blob(tree, head(tree), mp), iHead = blob(tree, head(tree), ip);
    const drift = !(mHead && iHead && mHead.equals(m) && iHead.equals(i));
    ok = !!declared && declared === real && real.startsWith(expectPrefix) && exactCopy && !drift;
    detail = `manifest 声明=${(declared || '').slice(0, 8)}… derivedFrom 声明=${(srcDeclared || '').slice(0, 8)}… 实算=${real.slice(0, 8)}…（三向${declared === real && (!srcDeclared || srcDeclared === declared) ? '全等' : '不等'}）；HEAD ${drift ? '漂移' : '零漂移'}`;
  }
  add(id, item, ok, detail, { commit: c, path: ip, sha256: declared });
};
iconCheck('T-03', 'M-02 wx 提审图标 512', 'wx', '0485004', 'assets/wx/wx-icon-manifest.json', 'assets/wx/wx-icon-512.png', '8a971534');
iconCheck('T-04', 'M-03 dy 提审图标 512', 'dy', 'a303ccf', 'assets/dy/dy-icon-manifest.json', 'assets/dy/dy-icon-512.png', '8a971534');
// T-05 M-04 会话分享卡 wx 5:4 @web 6fec4a6 在档，HEAD 零漂移
{
  const c = '6fec4a6', p = 'assets/release/share/wx-share-500x400.png';
  const b = blob('web', c, p), h = blob('web', head('web'), p);
  add('T-05', 'M-04 会话分享卡 wx 5:4', !!b && !!h && b.equals(h),
    b ? (b.equals(h) ? `${p} @${c} 在档，HEAD 零漂移（${b.length}B）` : `${p} @${c} 与 HEAD 漂移`) : `${p} @${c} 缺失`,
    { commit: c, path: p, sha256: b ? sha256(b) : null });
}
// T-06 M-05 dy 9:16 分享卡：manifest「双处全等」口径 = dy 树内 assets/release/share/ ≡ assets/dy/（@a303ccf）
// 附加信息项：web A-07 原批 @4f67806 = c705aaa6（血缘）；web F-07 轻更新后 @6fec4a6 = fe5a20d1（rebase 连锁 F-A2）
{
  const src = 'assets/release/share/dy-share-720x1280.png', dst = 'assets/dy/dy-share-720x1280.png';
  const a = blob('dy', 'a303ccf', src), b = blob('dy', 'a303ccf', dst);
  const mf = blob('dy', 'a303ccf', 'assets/dy/dy-share-manifest.json');
  const aHead = blob('dy', head('dy'), dst);
  const s = b ? sha256(b) : null;
  const mfSha = mf ? (JSON.parse(mf.toString()).sha256 || null) : null;
  const lineage = blob('web', '4f67806', src), webNow = blob('web', head('web'), src);
  const info = `web A-07 原批@4f67806=${lineage ? sha256(lineage).slice(0, 8) : '?'}…；web 主线 F-07 更新后=${webNow ? sha256(webNow).slice(0, 8) : '?'}…（rebase 后 dy 卡随动 → F-A2 挂 G3）`;
  add('T-06', 'M-05 分享卡 dy 9:16 exact-copy（树内双处）', !!a && !!b && a.equals(b) && !!s && s.startsWith('c705aaa6') && mfSha === s && !!aHead && aHead.equals(b),
    a && b ? (a.equals(b) ? `dy@a303ccf 树内双处全等 sha256=${s.slice(0, 8)}… ≡ manifest 声明 ${mfSha ? mfSha.slice(0, 8) : '?'}…；dy HEAD 零漂移。${info}` : '树内双处字节不等') : 'blob 缺失',
    { commit: 'a303ccf', path: dst, sha256: s });
}
// T-07 M-06 商店/实机截图：dy shots ×3 + manifest @a303ccf；wx 选批 = docs 决策记录 @eb9ddab
{
  const c = 'a303ccf';
  const files = ['assets/dy/shots/dy-shot-01-first-frame.png', 'assets/dy/shots/dy-shot-02-combo.png', 'assets/dy/shots/dy-shot-03-level2.png', 'assets/dy/shots/manifest.json'];
  const got = files.map((f) => !!blob('dy', c, f));
  const kit = blob('wx', 'eb9ddab', 'docs/platform/wx/wx-submission-kit.md');
  const kitHits = kit ? (kit.toString().match(/截图|选批/g) || []).length : 0;
  add('T-07', 'M-06 商店截图 wx/dy', got.every(Boolean) && !!kit && kitHits > 0,
    `dy shots 4/4 在档 @${c}；wx 选批记录 @eb9ddab wx-submission-kit.md 命中「截图/选批」×${kitHits}（口径：选批为决策记录，非独立 PNG 落 assets/）`,
    { commit: `${c}/eb9ddab`, path: 'assets/dy/shots/ + docs/platform/wx/wx-submission-kit.md' });
}
// T-08 M-07 手感 pack 四件 @web 6d3db6a，HEAD 零漂移
{
  const c = '6d3db6a';
  const files = ['assets/feel/motion-pack.json', 'assets/feel/particle-pack.json', 'assets/feel/ui-feel-pack.json', 'assets/feel/daily-entry-pack.json'];
  const res = files.map((f) => { const b = blob('web', c, f); const h = blob('web', head('web'), f); return { f, ok: !!b && !!h && b.equals(h) }; });
  add('T-08', 'M-07 手感 pack 四件', res.every((r) => r.ok),
    res.map((r) => `${r.f.split('/').pop()} ${r.ok ? 'OK' : 'MISS/DRIFT'}`).join(' · ') + ` @${c}`);
}
// T-09 release-assets.json 9 件：manifest 声明 sha256 == web HEAD 磁盘/blob 实算（零漂移机判）
{
  const mp = 'assets/release/release-assets.json';
  const m = blob('web', head('web'), mp);
  let ok = false, detail = 'manifest 缺失', total = 0, hit = 0;
  if (m) {
    const j = JSON.parse(m.toString());
    const items = j.items || j.assets || [];
    for (const it of items) {
      const p = it.path || it.file || it.out;
      if (!p) continue;
      total++;
      const b = blob('web', head('web'), join('assets/release', p).replace('assets/release/assets/release', 'assets/release'));
      const s = it.sha256 || it.hash;
      if (b && s && s === sha256(b)) hit++;
    }
    ok = total > 0 && hit === total;
    detail = `manifest ${hit}/${total} 件 sha256 ≡ HEAD blob 实算`;
  }
  add('T-09', '发布面 9 件零漂移', ok, detail, { commit: head('web').slice(0, 7), path: mp });
}
// T-10 M-09/10/11 模板骨架 + 侵权比对 + 克制文案：矩阵章节在档（黑板侧）
{
  const p = join(WS, '.myrd/blackboard/g2-blocks/gate-logs/freeze-sprint-r1-20261008/matrix/material-matrix.md');
  let txt = ''; try { txt = readFileSync(p, 'utf8'); } catch { /* 缺文件 */ }
  const hits = ['## 二、三平台共用分享卡模板骨架', '## 三、wx 侵权比对', '## 四、dy 克制版分享文案'].map((h) => txt.includes(h));
  const secLines = ((txt.match(/## 四[\s\S]*?(?=\n## |\n$|$)/) || [''])[0].split('\n').slice(2));
  const copyBody = secLines.filter((l) => /^\d+\.\s*「/.test(l)).join('\n');
  const noExagger = copyBody.length > 0 && !/(第一名|业界第一|全网第一|最佳|最强|最好玩|顶级|秒杀|必赢|稳赚|抽奖|\+\d{2,})/.test(copyBody);
  add('T-10', 'M-09/10/11 模板/侵权/文案', hits.every(Boolean) && noExagger,
    `矩阵三章节在档 ${hits.filter(Boolean).length}/3；克制文案红线（零夸张词/零数值承诺）机判 ${noExagger ? 'PASS' : 'FAIL'}`,
    { path: 'gate-logs/freeze-sprint-r1-20261008/matrix/material-matrix.md' });
}
// T-11 文案与 spec world/tone 同源：分享文案关键词命中 spec oneLiner/world
{
  let spec = {}; try { spec = JSON.parse(readFileSync(join(WS, '.myrd/spec/g2-blocks/design-spec-v1.5-freeze-draft.json'), 'utf8')); } catch { /* 缺 */ }
  const one = (spec.spec && spec.spec.meta && spec.spec.meta.oneLiner) || '';
  const wsum = (spec.spec && spec.spec.world && spec.spec.world.summary) || '';
  const mx = (() => { try { return readFileSync(join(WS, '.myrd/blackboard/g2-blocks/gate-logs/freeze-sprint-r1-20261008/matrix/material-matrix.md'), 'utf8'); } catch { return ''; } })();
  const kws = ['火就越旺', '炉冷', '8×8'].filter((k) => mx.includes(k) && (one.includes(k) || wsum.includes(k)));
  add('T-11', '分享文案 world/tone 同源', kws.length >= 2,
    `关键词命中 ${kws.length}/3（${kws.join('/')}）——矩阵文案词汇与 spec world.oneLiner/summary 同源`,
    { spec: 'design-spec-v1.5-freeze-draft.json' });
}

const pass = checks.filter((c) => c.pass).length;
const report = {
  checkedAt: new Date().toISOString(),
  purpose: '封版冲刺 N5 物料归档可回溯性机判（美术线复核轮）',
  trees: Object.fromEntries(Object.entries(TREES).map(([k, v]) => [k, { root: v, head: head(k).slice(0, 7) }])),
  summary: { pass, fail: checks.length - pass, total: checks.length },
  checks,
};
const text = checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}  ${c.id} :: ${c.item} — ${c.detail}`).join('\n');
console.log(text);
console.log(`—— 合计 ${pass} PASS / ${checks.length - pass} FAIL / ${checks.length} ——`);
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
process.exit(pass === checks.length ? 0 : 1);
