#!/usr/bin/env node
/**
 * numeric 冻结零漂移复算（B0 · spec v1.3 content.platform wx-runtime/wx-submission-kit check 面）。
 *
 * 红线（spec v1.3 content.platform.numericFreeze）：**只复算 N1 存档 sha256，禁止现场自算基线**——
 * 期望值唯一来源 = `.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt`（2026-09-28 N1 建版时存档）；
 * 本脚本不得从任何其他来源推导「应该是什么」。三向对账：
 *   存档（唯一期望） ↔ 现行 approved 导出件 numeric 段 ↔ v1.2 建版载荷 numeric 段（存档来源可追溯）
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(GAME, '../..');
const ARCHIVE = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt');
const CURRENT = path.join(ROOT, '.myrd/spec/stack-tower-spec.json');
const V12 = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.2-payload.json');

const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
};
const sha = (o) => createHash('sha256').update(JSON.stringify(sortKeys(o))).digest('hex');

if (!existsSync(ARCHIVE)) {
  console.log('RESULT: FAIL (0/3) — N1 存档缺失（.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt）；无存档即无冻结，禁止现场自算基线');
  process.exit(1);
}
const archive = readFileSync(ARCHIVE, 'utf8').trim();
const currentSpec = JSON.parse(readFileSync(CURRENT, 'utf8')).spec;
const v12Spec = JSON.parse(readFileSync(V12, 'utf8')).spec;
const current = sha(currentSpec.numeric);
const v12 = sha(v12Spec.numeric);

const checks = [
  ['存档可解析（64 hex）', /^[0-9a-f]{64}$/.test(archive)],
  ['现行导出件 numeric ≡ 存档', current === archive],
  ['v1.2 载荷 numeric ≡ 存档（存档来源可追溯）', v12 === archive],
];
console.log(`[freeze] 存档   = ${archive}`);
console.log(`[freeze] 现行   = ${current}`);
console.log(`[freeze] v1.2   = ${v12}`);
checks.forEach(([name, ok]) => console.log(`[freeze] ${ok ? 'PASS' : 'FAIL'}  ${name}`));
if (checks.every((c) => c[1])) {
  console.log('RESULT: PASS');
} else {
  console.log(`RESULT: FAIL (${checks.filter((c) => !c[1]).length}/${checks.length}) — numeric 漂移即回退，禁止就地改基线`);
  process.exit(1);
}
