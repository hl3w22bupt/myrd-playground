#!/usr/bin/env node
// tools/build.mjs — line4-unblock-jam 确定性构建（零 npm 依赖 · stripTypeScriptTypes 判例承 line3/wheat-squad）
// 产物：export/web/（apphost.toml assets_dir 定死落点）= landing.html + index.html + src/**.mjs 镜像
//       + spec.json（approved 导出件直拷，零手抄）+ manifest.json（对账面：files 全量收录 landing.html）。
// 确定性：同输入逐字节一致；main.mjs 头部注入 __L4_BUILD__（gitSha/specAnchor）→ LIVE 三点对账锚。
// 壳契约（docs/deploy-shell-contract.md）：landing.html 引用一律走 api/public/assets/* 相对路径，
// 缺它 = 共享壳 GET / 回落 game-9 内置页（W-3/B-5 判例成因），guard-landing-shell 门禁拦。
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'export', 'web'); // apphost.toml assets_dir = games/line4-unblock-jam/export/web
// approved spec 导出件发现：仓内相对优先，兄弟 run 扫描兜底（line3 build 判例同构）
const SPEC_PATH = (() => {
  const local = join(ROOT, '..', '..', '.myrd', 'spec', 'line4-unblock-jam', 'design-spec.json');
  if (existsSync(local)) return local;
  let dir = ROOT;
  for (let i = 0; i < 6; i += 1) {
    dir = dirname(dir);
    if (dir === dirname(dir)) break;
    const cands = readdirSync(dir).filter((x) => x.startsWith('run-'))
      .map((n) => join(dir, n, '.myrd', 'spec', 'line4-unblock-jam', 'design-spec.json'))
      .filter((c) => existsSync(c))
      .map((c) => ({ c, at: JSON.parse(readFileSync(c, 'utf8'))?._platform?.updatedAt ?? '' }))
      .sort((a, b) => b.at.localeCompare(a.at));
    if (cands.length > 0) return cands[0].c;
  }
  throw new Error('line4 spec 导出件未找到（构建必须绑 approved 单源）');
})();

const gitSha = execSync('git rev-parse HEAD', { cwd: join(ROOT, '..', '..'), encoding: 'utf8' }).trim();
const specRow = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
if (specRow.status !== 'approved') throw new Error(`spec 非 approved（${specRow.status}）——红线：非 approved 版不作构建单源`);
const specAnchor = `${specRow._platform.id}@v${specRow._platform.version}:${specRow._platform.status}`;

rmSync(join(ROOT, 'export'), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const rewrite = (src) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.mjs$3');

// ① src/**.ts → export/web/src/**.mjs（镜像目录结构；main.ts 特注入构建锚）；
//    src/**.mjs（generated 生成件）原样镜像——运行时数值/锚单源，零手抄零变换
function walk(dir, rel = '') {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(f).isDirectory()) walk(f, r);
    else if (n.endsWith('.ts')) {
      let out = rewrite(readFileSync(f, 'utf8'));
      if (n === 'main.ts') {
        out = `const __L4_BUILD__ = { gitSha: ${JSON.stringify(gitSha)}, specAnchor: ${JSON.stringify(specAnchor)} };\n` + out;
      }
      const target = join(OUT, r.replace(/\.ts$/, '.mjs'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, out);
    } else if (n.endsWith('.mjs')) {
      const target = join(OUT, r);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(f));
    }
  }
}
walk(join(ROOT, 'src'), 'src');

// ② index.html（壳）+ landing.html（共享壳 GET / 契约面：api/public/assets/* 相对路径）
//    同源推导保证两者永不漂移（line3 判例）+ spec.json（approved 导出件直拷）
const shellHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
writeFileSync(join(OUT, 'spec.json'), JSON.stringify(specRow));
writeFileSync(join(OUT, 'index.html'), shellHtml);
writeFileSync(join(OUT, 'landing.html'), shellHtml
  .replace('src="./src/main.mjs"', 'src="api/public/assets/src/main.mjs"'));

// ③ 产物清单（确定性对账面：重跑逐字节一致；files 必含 landing.html——guard 门禁第③条）
const files = [];
(function list(dir, rel) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(f).isDirectory()) list(f, r);
    else files.push(r);
  }
})(OUT, '');
files.sort();
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ gitSha, specAnchor, files }, null, 2) + '\n');
console.log(`build: ${files.length} 文件 → export/web/ · gitSha=${gitSha.slice(0, 8)} · specAnchor=${specAnchor}`);
if (!files.includes('landing.html')) { console.error('BUILD FAIL: landing.html 未入产物清单（部署壳契约）'); process.exit(1); }
