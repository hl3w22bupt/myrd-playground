#!/usr/bin/env node
/**
 * dy-submission-kit 条目查（spec v1.5 content.platform dy-submission-kit · check 面）。
 * 复现：node games/stack-tower/tests/tt/tt-submission-kit.spec.mjs
 *
 * 验收口径原文（spec 内写死）：
 *  · 提审包 = export/tt/ 全量，manifest.json 逐件 sha256 与磁盘一致；包 sha256 入 docs/dy-submission-kit-c3.md
 *  · 提审材料按 id 逐项对照（本 items[].assets 全集 + dy-share-card）入清单；缺件即 N4 不齐
 *  · 主包 ≤4MB 分列断言 PASS；numeric 零漂移（只复算 N1 存档锚，禁止现场自算）
 *  · QA 口径④：N4 三份输入缺一停审（approved spec + 产物带 repo 根/黑板指针 + 机器证据）
 *  · 是否提审由主人拍板：团队只交包，提审动作不代行
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { GAME, ROOT, check, finish, requireProd, specItem, srcOf } from './_harness.mjs';

const BUILD_CMD = 'node tools/build-tt.mjs';
requireProd('export/tt/manifest.json', BUILD_CMD);

// ---------- ① 分列预算 + numeric 冻结（同门复跑两脚本，双 PASS） ----------
const runGate = (rel) => {
  try {
    execFileSync('node', [path.join(GAME, rel)], { encoding: 'utf8', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
};
check('check-tt-bundle-size（主包/子包分列断言）PASS', runGate('scripts/check-tt-bundle-size.mjs'));
check('check-numeric-freeze（只复算 N1 存档，禁现场自算）PASS', runGate('scripts/check-numeric-freeze.mjs'));

// ---------- ② 包 manifest 逐件 sha256 独立复算 + 关键件在位 ----------
const exportManifest = JSON.parse(srcOf('export/tt/manifest.json'));
let drift = 0;
for (const f of exportManifest.files) {
  const p = path.join(GAME, 'export/tt', f.path);
  if (!existsSync(p)) { drift += 1; continue; }
  const disk = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (disk !== f.sha256) drift += 1;
}
check(`包 manifest 逐件 sha256 与磁盘一致（${exportManifest.files.length} 件，漂移 ${drift}）`, drift === 0);
for (const rel of ['game.json', 'project.config.json', 'game.js', 'build-tt/app/boot-tt.js', 'build-tt/platform/tt.js', 'assets/tt/share-card.png', 'assets/bgm/neon-loop.m4a']) {
  check(`包内关键件在位：${rel}`, existsSync(path.join(GAME, 'export/tt', rel)));
}
check('商店截图不入包（提审材料留仓库——wx B0 判例同构）',
  !exportManifest.files.some((f) => /store-screenshot/.test(f.path)));

// ---------- ③ numeric 逐字节零漂移（独立复算，期望唯一来源 = N1 存档锚） ----------
const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
};
const archiveText = readFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt'), 'utf8').trim();
const specRaw = JSON.parse(readFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec.json'), 'utf8'));
const currentNumericSha = createHash('sha256').update(JSON.stringify(sortKeys(specRaw.spec.numeric))).digest('hex');
check('numeric 逐字节零漂移：现行 approved 导出件 numeric ≡ N1 存档锚', currentNumericSha === archiveText);
check('numeric 冻结锚形态合法（64 hex，唯一存档来源）', /^[0-9a-f]{64}$/.test(archiveText));

// ---------- ④ 提审材料按 id 逐项对照（spec ↔ 资产 manifest ↔ 磁盘，含尺寸） ----------
const kitItem = specItem('dy-submission-kit');
const assetManifest = JSON.parse(srcOf('assets/tt/manifest.json'));
const specDyAssets = specRaw.spec.content.platform.items
  .flatMap((i) => i.assets)
  .filter((a) => a.id.startsWith('dy-'));
const allIds = specDyAssets.map((a) => a.id).sort();
check(`dy 材料 id 全集 ${allIds.length} 项在 spec 登记（dy-share-card + 01..03 + dy-icon）`,
  JSON.stringify(allIds) === JSON.stringify(['dy-icon', 'dy-share-card', 'dy-store-screenshot-01', 'dy-store-screenshot-02', 'dy-store-screenshot-03']));
check('dy-submission-kit 条目资产 = 4 件（截图 3 + 图标；share-card 归 dy-share-loop）', kitItem.assets.length === 4);
for (const specAsset of specDyAssets) {
  const m = assetManifest.items.find((a) => a.id === specAsset.id);
  const p = path.join(ROOT, specAsset.file); // spec 落点 = repo 根相对路径
  if (!m) { check(`材料 ${specAsset.id} 在 assets/tt/manifest.json`, false); continue; }
  if (!existsSync(p)) { check(`材料 ${specAsset.id} 落盘（${specAsset.file}）`, false); continue; }
  const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
  check(`材料 ${specAsset.id}（${specAsset.size}）spec↔manifest↔磁盘 三向一致`, sha === m.sha256 && m.size === specAsset.size);
}
check('dy 编号三方对齐（spec 条目 id ↔ 资产 id ↔ 接线面）',
  ['dy-runtime', 'dy-share-loop', 'dy-submission-kit'].every((id) => specRaw.spec.content.platform.items.some((i) => i.id === id)) &&
  assetManifest.items.every((a) => a.id.startsWith('dy-')));

// ---------- ⑤ kit 文书在位且含包指纹（N4 回流对照输入） ----------
const kitDocPath = path.join(GAME, 'docs/dy-submission-kit-c3.md');
if (!existsSync(kitDocPath)) {
  check('docs/dy-submission-kit-c3.md 在位', false);
} else {
  const doc = readFileSync(kitDocPath, 'utf8');
  const gameJsSha = createHash('sha256').update(readFileSync(path.join(GAME, 'export/tt/game.js'), 'utf8')).digest('hex');
  check('docs/dy-submission-kit-c3.md 在位', true);
  check('kit 文书含提审包指纹（export/tt/game.js sha256 可追溯）', doc.includes(gameJsSha));
  check('kit 文书含「是否提审由主人拍板」声明（团队只交包，提审动作不代行）', doc.includes('是否提审由主人拍板'));
  check('kit 文书含 optional 能力声明（录屏分享/高光封面卡，缺失不构成打回项）', doc.includes('optional'));
  check('kit 文书含 N4 三份输入口径（approved spec + repo 根/黑板指针 + 机器证据）', doc.includes('三份输入') && doc.includes('机器证据'));
  check('kit 文书含 QA 四条验收口径对照（①好友榜②主判据③optional④停审）', ['①', '②', '③', '④'].every((k) => doc.includes(k)));
  check('kit 文书含材料清单（5 id 逐项，含 sha256）', specDyAssets.every((a) => doc.includes(a.id)));
  // 防漂移（QA 驳回①回流）：文书材料 sha256 必须 ≡ assets/tt/manifest.json（磁盘真源）——
  // 仅断 id 在文拦不住「素材覆写后文书仍留初版 sha」的失真（N4 三向核对输入必须逐件相等）
  const staleShas = assetManifest.items.filter((a) => !doc.includes(a.sha256));
  check(`kit 文书材料 sha256 ≡ assets/tt/manifest.json（${assetManifest.items.length} 件逐件相等${staleShas.length ? `，漂移：${staleShas.map((s) => s.id).join(',')}` : ''}）`, staleShas.length === 0);
  // 防漂移（QA 驳回①回流）：文书主包体积必须 ≡ export/tt/manifest.json sizes.mainBytes
  const mainBytesStr = exportManifest.sizes.mainBytes.toLocaleString('en-US');
  check(`kit 文书主包体积 ≡ export/tt/manifest.json（${exportManifest.sizes.mainBytes}B）`, doc.includes(mainBytesStr) && !/300,401/.test(doc));
  check('kit 文书带 repo 根/黑板指针（N4 产物定位输入）', doc.includes('repo 根') && doc.includes('.myrd/blackboard'));
}

finish('dy-submission-kit 提审包与材料清单');
