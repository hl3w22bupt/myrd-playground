#!/usr/bin/env node
// check-assets.mjs — 资产引用完整性门禁（line4-unblock-jam · N4「引用 id↔文件存在性」断言面）
//
// 四断言组（fail-closed，任一失败 exit 1）：
//   ① spec.assets[].id ↔ assets/ 实文件存在性：锁定 spec 每件资产必须在盘，落点文件名严格
//      kebab-case 且 = <asset.id><ext>（零私建零私改）；统一契约门禁不查资产文件（29 条口径），
//      本门禁补齐资产面（2026-10-26 N4 交付包）。
//   ② manifest 覆盖性：spec 资产 id 集合 ≡ manifest.assets id 集合（逐件登记，零遗漏零私增）。
//   ③ hash 对账：实文件 sha256 ≡ manifest 登记值（防手改）。
//   ④ 确定性：临时目录重生成 → manifest 逐件 sha256 全等（acc-05「重生成 hash 不变」机判）。
//   ⑤ 色值白名单：manifest.palette ⊆ theme.ts 8 色白名单（8 色外零取色）。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE_HEX_LIST } from '../src/platform/theme.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ASSETS = join(ROOT, 'assets');
const SPEC = JSON.parse(readFileSync(join(ROOT, '..', '..', '.myrd', 'spec', 'line4-unblock-jam', 'design-spec.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));

let p = 0; const fails = [];
const t = (cond, name) => { if (cond) p += 1; else fails.push(name); };

// ① spec id ↔ 实文件存在性 + kebab-case 落点名 = <id><ext>
for (const a of SPEC.spec.assets) {
  const expectFile = join(ROOT, a.file.replace('games/line4-unblock-jam/', ''));
  const base = a.file.split('/').pop();
  const kebabOk = base.startsWith(`${a.id}.`) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id);
  t(existsSync(expectFile), `spec 资产 ${a.id} 文件缺失: ${a.file}`);
  t(kebabOk, `spec 资产 ${a.id} 落点名非 kebab-case 对 id: ${base}`);
}

// ② manifest 覆盖性（id 集合全等）
const specIds = SPEC.spec.assets.map((a) => a.id).sort();
const manIds = manifest.assets.map((a) => a.id).sort();
t(JSON.stringify(specIds) === JSON.stringify(manIds), `manifest 覆盖性: spec=[${specIds}] manifest=[${manIds}]`);

// ③ 实文件 sha256 ≡ manifest 登记值
for (const m of manifest.assets) {
  const fp = join(ROOT, m.file);
  if (!existsSync(fp)) { fails.push(`manifest 件 ${m.id} 实文件缺失: ${m.file}`); continue; }
  const sha = createHash('sha256').update(readFileSync(fp)).digest('hex');
  t(sha === m.sha256, `hash 对账 FAIL ${m.id}: 实=${sha.slice(0, 12)} 账=${String(m.sha256).slice(0, 12)}`);
}

// ④ 确定性：临时目录重生成 → 逐件 sha256 全等（wav 派生件同查）
const tmp = mkdtempSync(join(tmpdir(), 'l4-assets-'));
const r = spawnSync(process.execPath, [join(HERE, 'gen-assets.mjs'), '--out', tmp], { encoding: 'utf8' });
t(r.status === 0, `重生成失败 exit=${r.status}: ${String(r.stderr).slice(0, 200)}`);
// --out 目录即资产根：重生成侧路径需剥掉仓库口径的 assets/ 前缀
const regenPath = (rel) => join(tmp, rel.replace(/^assets\//, ''));
if (r.status === 0) {
  const man2 = JSON.parse(readFileSync(join(tmp, 'manifest.json'), 'utf8'));
  for (const m of man2.assets) {
    const sha = createHash('sha256').update(readFileSync(regenPath(m.file))).digest('hex');
    t(sha === m.sha256, `确定性 FAIL ${m.id}: 重生成=${sha.slice(0, 12)} 首跑=${String(m.sha256).slice(0, 12)}`);
  }
  for (const d of (man2.assets.find((x) => x.id === 'a06-sfx-pack').derivatives ?? [])) {
    const sha = createHash('sha256').update(readFileSync(regenPath(d.file))).digest('hex');
    t(sha === d.sha256, `确定性 FAIL 派生 ${d.file}`);
  }
}
rmSync(tmp, { recursive: true, force: true });

// ⑤ 色值白名单（8 色外零取色）
const white = new Set(PALETTE_HEX_LIST);
const off = (manifest.palette ?? []).filter((c) => !white.has(c));
t(off.length === 0, `色值白名单越界: ${off.join(',')}`);
t((manifest.palette ?? []).length === PALETTE_HEX_LIST.length, `palette 数量 ${manifest.palette.length} ≠ 白名单 ${PALETTE_HEX_LIST.length}`);

console.log(`[check-assets] PASS=${p} FAIL=${fails.length}`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length > 0 ? 1 : 0);
