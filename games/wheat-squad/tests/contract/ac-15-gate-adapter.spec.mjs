// ac-15-gate-adapter — N15：平台 contract-gate 适配视图守卫（防「生成物」与 approved 单源漂移）
// 背景：平台门禁以 .myrd/spec/design-spec.json 的顶层 id 解析受测游戏（id↔games/ 目录名）。
// 该路径现为生成视图（approved 单源 + 注入 id/slug 两键）——本件机判：①视图存在且可解析；
// ②id/slug 与单源 meta.slug 同源一致；③除注入两键外与纯导出件逐键深等（键序无关）；
// ④games/<id>/verify.sh 门禁入口在盘。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { assert, loadSpec, ROOT } from './helpers.mjs';

const doc = loadSpec(); // 单源（六段文档）
const slug = doc.meta?.slug;
assert(slug === 'wheat-squad', `单源 meta.slug 异常: ${slug}`);

const adapterPath = join(ROOT, '..', '..', '.myrd', 'spec', 'design-spec.json');
assert(existsSync(adapterPath), '适配视图缺失（.myrd/spec/design-spec.json）——平台门禁 id 解析面断供');
const adapter = JSON.parse(readFileSync(adapterPath, 'utf8'));
assert(adapter.id === slug, `适配视图 id=${JSON.stringify(adapter.id)} ≠ 单源 slug=${slug}`);
assert(adapter.slug === slug, `适配视图 slug=${JSON.stringify(adapter.slug)} ≠ 单源 slug=${slug}`);

// 深比（键序无关，注入键剔除后必须与单源全等）：单源 = .myrd/spec/wheat-squad/design-spec.json 的 spec 层
const pure = JSON.parse(readFileSync(join(ROOT, '..', '..', '.myrd', 'spec', 'wheat-squad', 'design-spec.json'), 'utf8'));
const stable = (v) => (v === null || typeof v !== 'object'
  ? JSON.stringify(v)
  : Array.isArray(v)
    ? '[' + v.map(stable).join(',') + ']'
    : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}');
const { id: _id, slug: _slug, ...rest } = adapter;
assert(stable(rest) === stable(pure), '适配视图与 approved 单源漂移（剔除注入键后不深等）——重跑 tools/build-gate-adapter.mjs');
assert(pure._platform?.status === 'approved' && adapter._platform?.status === 'approved', '两侧 _platform.status 必须 approved');

// 门禁入口在盘（id↔目录名↔入口三点闭合）
assert(existsSync(join(ROOT, 'verify.sh')), 'games/wheat-squad/verify.sh 缺失（受测游戏门禁入口断供）');
console.log(`PASS ac-15 门禁适配视图守卫（id/slug=${slug} 单源同源 · 剔注入键深等 · 入口在盘）`);
