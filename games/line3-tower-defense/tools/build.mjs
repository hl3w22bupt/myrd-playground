#!/usr/bin/env node
// tools/build.mjs — line3-tower-defense 确定性构建（零 npm 依赖 · stripTypeScriptTypes 判例承 wheat-squad）
// 产物：build/（landing.html + index.html + main.mjs + src/**.mjs 镜像 + spec.json）——AppHost assets_dir 面。
// 确定性：同输入逐字节一致；spec.json = approved 导出件直拷（零手抄）；
//         main.mjs 头部注入 __L3_BUILD__（gitSha/specAnchor）→ LIVE 三点对账锚。
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'build');
// approved spec 导出件发现：本仓相对优先，兄弟 run 扫描兜底（wheat-squad build 判例同构）
const SPEC_PATH = (() => {
  const local = join(ROOT, '..', '..', '.myrd', 'spec', 'line3-tower-defense', 'design-spec.json');
  if (existsSync(local)) return local;
  let dir = ROOT;
  for (let i = 0; i < 6; i += 1) {
    dir = dirname(dir);
    if (dir === dirname(dir)) break;
    const cands = readdirSync(dir).filter((x) => x.startsWith('run-'))
      .map((n) => join(dir, n, '.myrd', 'spec', 'line3-tower-defense', 'design-spec.json'))
      .filter((c) => existsSync(c))
      .map((c) => ({ c, at: JSON.parse(readFileSync(c, 'utf8'))?._platform?.updatedAt ?? '' }))
      .sort((a, b) => b.at.localeCompare(a.at));
    if (cands.length > 0) return cands[0].c;
  }
  throw new Error('line3 spec 导出件未找到（实现轮构建必须绑 approved 单源）');
})();

const gitSha = execSync('git rev-parse HEAD', { cwd: join(ROOT, '..', '..'), encoding: 'utf8' }).trim();
const specRow = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
const specAnchor = `${specRow._platform.id}@v${specRow._platform.version}:${specRow._platform.status}`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const rewrite = (src) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.mjs$3');

// ① src/**.ts → build/**.mjs（镜像目录结构；main.ts 特注入构建锚）
function walk(dir, rel = '') {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(f).isDirectory()) walk(f, r);
    else if (n.endsWith('.ts')) {
      let out = rewrite(readFileSync(f, 'utf8'));
      if (n === 'main.ts') {
        out = `const __L3_BUILD__ = { gitSha: ${JSON.stringify(gitSha)}, specAnchor: ${JSON.stringify(specAnchor)} };\n` + out;
      }
      const target = join(OUT, r.replace(/\.ts$/, '.mjs'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, out);
    }
  }
}
walk(join(ROOT, 'src'), 'src');

// ② index.html（壳 + spec.json 预载注入）+ landing.html（apphost 共享壳 server/ 的 GET / 契约面：
//    引用一律走 api/public/assets/* 相对路径，wheat-squad 判例同构——缺它即回落 game-9 内置壳）
//    + spec.json（approved 导出件直拷 → 运行时 __L3_SPEC__ 单源装配）
const shellHtml = readFileSync(join(ROOT, 'index.html'), 'utf8')
  .replace('<script type="module" src="./src/main.mjs"></script>',
`<script>
  window.__L3_SPEC__ = fetch('./spec.json').then(function (r) { return r.json(); });
</script>
<script type="module" src="./src/main.mjs"></script>`);
writeFileSync(join(OUT, 'spec.json'), JSON.stringify(specRow));
writeFileSync(join(OUT, 'index.html'), shellHtml);
writeFileSync(join(OUT, 'landing.html'), shellHtml
  .replace("fetch('./spec.json')", "fetch('api/public/assets/spec.json')")
  .replace('src="./src/main.mjs"', 'src="api/public/assets/src/main.mjs"'));

// ③ 产物清单（确定性对账面：重跑逐字节一致）
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
console.log(`build: ${files.length} 文件 → build/ · gitSha=${gitSha.slice(0, 8)} · specAnchor=${specAnchor}`);
