#!/usr/bin/env node
// ci/guard-landing-shell.mjs — 部署壳契约门禁（W-3/B-5 判例收口，2026-10-18）。
//
// apphost 共享壳 server/ 的 GET / 优先伺服资产里的 landing.html；缺它回落内置页
// （game-9 Godot 壳）——主入口 /gw 串到别的游戏，而资产面/LIVE 冒烟全绿（line3 B-5
// 事故成因，也是 wheat-squad W-3 八轮误诊「平台层路由串线」的真实根因）。
// 非 Godot 游戏（build/ 无 index.js+wasm/pck 三件套）必须满足：
//   ① build/landing.html 存在
//   ② 引用一律走 api/public/assets/* 相对路径（/gw 与裸根入口的相对解析都落公开资产路由）
//   ③ build/manifest.json files 含 landing.html（构建对账面同步，tools/build.mjs 步骤③）
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, '..', 'build');
const fails = [];
const fail = (m) => fails.push(m);

const landingPath = join(BUILD, 'landing.html');
if (!existsSync(landingPath)) {
  fail('build/landing.html 缺失（共享壳 GET / 将回落 game-9 内置页）');
} else {
  const html = readFileSync(landingPath, 'utf8');
  if (!/api\/public\/assets\//.test(html)) {
    fail('landing.html 未引用 api/public/assets/*（相对解析落不进公开资产路由）');
  }
  if (/\b(?:src|fetch)\s*[=(]\s*['"`]\.\//.test(html)) {
    fail('landing.html 残留裸相对路径（./xxx）——须改写为 api/public/assets/*');
  }
}

const manifestPath = join(BUILD, 'manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!(manifest.files ?? []).includes('landing.html')) {
    fail('build/manifest.json files 未含 landing.html（tools/build.mjs 步骤③对账面漏收）');
  }
}

if (fails.length > 0) {
  console.error(`LANDING-SHELL: FAIL ${fails.length} 项:\n  ${fails.join('\n  ')}`);
  process.exit(1);
}
console.log('LANDING-SHELL: PASS landing.html 在产且引用走 api/public/assets/*（部署壳契约收口）');
