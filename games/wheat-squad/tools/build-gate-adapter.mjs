#!/usr/bin/env node
// build-gate-adapter.mjs — 平台 contract-gate 适配视图生成器（N15，单源派生零拷贝面最小化）
//
// 背景（驳回四连）：平台门禁以 `.myrd/spec/design-spec.json` 的 **id** 解析受测游戏 slug
// （id↔games/ 目录名核对），approved 导出件的链 id 是 cuid 不可解析、verify.sh 计数歧义（冻结线不可动）
// ⇒ 本工具从盘上 approved 单源确定性派生门禁适配视图：approved 内容原样 + 注入顶层 id/slug=游戏 slug。
//
// 单源纪律：
//   - 纯导出件 .myrd/spec/wheat-squad/design-spec.json 仍是唯一真源（平台链导出，禁手改）；
//   - 本视图为「生成物」，随单源刷新而刷新（重跑本工具），漂移由契约 ac-15 机判拦截；
//   - 注入键仅 id/slug 两个，其余内容与单源逐键相等（ac-15 深比断言）。
// 用法：node tools/build-gate-adapter.mjs [--src .myrd/spec/wheat-squad/design-spec.json] [--out .myrd/spec/design-spec.json]
// 退出码：0 成功；1 参数/状态/派生失败（不吞错不降级）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(HERE, '..');            // games/wheat-squad
const REPO_ROOT = resolve(GAME_ROOT, '..', '..'); // 工作区根
const args = process.argv.slice(2);
const argOf = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const srcRel = argOf('--src') ?? '.myrd/spec/wheat-squad/design-spec.json';
const outRel = argOf('--out') ?? '.myrd/spec/design-spec.json';

const srcPath = join(REPO_ROOT, srcRel);
const outPath = join(REPO_ROOT, outRel);
const src = JSON.parse(readFileSync(srcPath, 'utf8'));
const doc = src.spec ?? src;
if (src._platform?.status !== 'approved') {
  console.error(`GATE-ADAPTER RED 单源非 approved（_platform.status=${src._platform?.status}）——只从 approved 派生`);
  process.exit(1);
}
const slug = doc.meta?.slug ?? doc.slug;
if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
  console.error(`GATE-ADAPTER RED slug 不可解析（meta.slug=${JSON.stringify(doc.meta?.slug)}）`);
  process.exit(1);
}
const gameDir = join(REPO_ROOT, 'games', slug);
if (!existsSync(gameDir)) {
  console.error(`GATE-ADAPTER RED games/${slug}/ 不存在（id↔目录名核对必败）`);
  process.exit(1);
}
if (!existsSync(join(gameDir, 'verify.sh'))) {
  console.error(`GATE-ADAPTER RED games/${slug}/verify.sh 不存在（门禁入口缺失）`);
  process.exit(1);
}
// 注入面最小化：仅顶层 id/slug 两键（其余与单源逐键相等，ac-15 深比守卫）
const adapter = { id: slug, slug, ...src };
if (outRel !== srcRel && !existsSync(srcPath)) process.exit(1);
writeFileSync(outPath, JSON.stringify(adapter, null, 2) + '\n');
console.log(`GATE-ADAPTER OK ${outRel} :: id/slug=${slug}（源 ${srcRel} · _platform v${src._platform?.version} ${src._platform?.status}）`);
