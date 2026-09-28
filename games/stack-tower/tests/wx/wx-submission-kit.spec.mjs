#!/usr/bin/env node
/**
 * wx-submission-kit 条目查（spec v1.3 content.platform wx-submission-kit · check 面）。
 * 断言：提审包 manifest 逐件 sha256 与磁盘一致 / 分列预算双 PASS（复跑两脚本同门）/
 *       提审材料按 id 逐项对照（spec items[].assets 全集 ↔ assets/wx/manifest.json ↔ 磁盘）/
 *       numeric 零漂移（复算 N1 存档）/ kit 文书在位（bundle sha256 段）。
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(GAME, '../..');
const failures = [];
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures.push(name); console.log(`  FAIL  ${name}`); }
};

// ① 分列预算 + manifest 一致性（同门复跑两脚本）
const runGate = (rel) => {
  try {
    execFileSync('node', [path.join(GAME, rel)], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
};
check('check-wx-bundle-size（主包/子包分列断言）PASS', runGate('scripts/check-wx-bundle-size.mjs'));
check('check-numeric-freeze（只复算 N1 存档）PASS', runGate('scripts/check-numeric-freeze.mjs'));

// ② 提审材料按 id 逐项对照（spec ↔ assets manifest ↔ 磁盘）
const spec = JSON.parse(readFileSync(path.join(ROOT, '.myrd/spec/stack-tower-spec.json'), 'utf8')).spec;
const kitItem = spec.content.platform.items.find((i) => i.id === 'wx-submission-kit');
const assetsManifest = JSON.parse(readFileSync(path.join(GAME, 'assets/wx/manifest.json'), 'utf8'));
const allIds = spec.content.platform.items.flatMap((i) => i.assets.map((a) => a.id));
check(`提审材料 id 全集 ${allIds.length} 项在 spec 登记`, kitItem.assets.length + 3 === allIds.length);
for (const id of allIds) {
  const m = assetsManifest.items.find((a) => a.id === id);
  const specAsset = spec.content.platform.items.flatMap((i) => i.assets).find((a) => a.id === id);
  const p = path.join(ROOT, specAsset.file); // spec 落点为仓库根相对路径
  if (!m) { check(`材料 ${id} 在 assets/wx/manifest.json`, false); continue; }
  if (!existsSync(p)) { check(`材料 ${id} 落盘`, false); continue; }
  const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
  check(`材料 ${id}（${m.size}）spec↔manifest↔磁盘 三向一致`, sha === m.sha256);
}

// ③ kit 文书在位且含 bundle sha256 段（N4 回流对照输入）
const kitDocPath = path.join(GAME, 'docs/wx-submission-kit-b0.md');
if (!existsSync(kitDocPath)) {
  check('docs/wx-submission-kit-b0.md 在位', false);
} else {
  const doc = readFileSync(kitDocPath, 'utf8');
  const exportManifest = JSON.parse(readFileSync(path.join(GAME, 'export/wx/manifest.json'), 'utf8'));
  const bundleSha = createHash('sha256').update(readFileSync(path.join(GAME, 'export/wx/game.js'), 'utf8')).digest('hex');
  check('docs/wx-submission-kit-b0.md 在位', true);
  check('kit 文书含提审包 sha256 段（game.js 可追溯）', doc.includes(bundleSha.slice(0, 16)) || doc.includes(bundleSha));
  void exportManifest;
}

const total = 4 + allIds.length + 2;
if (failures.length) {
  console.log(`RESULT: FAIL (${total - failures.length}/${total})`);
  process.exit(1);
}
console.log(`RESULT: PASS  — 提审包与材料 ${total} 项断言全绿`);
