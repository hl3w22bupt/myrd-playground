#!/usr/bin/env node
// tools/build.mjs — wheat-squad 确定性构建（零 npm 依赖 · stripTypeScriptTypes 判例承 g2-blocks build-dy）
//
// 产物：build/（index.html + main.mjs + src/**.mjs 镜像 + spec.json）——AppHost assets_dir 面。
// 确定性：同输入逐字节一致（同 seed/同 strip 语义）；spec.json = 平台回读导出件直拷（零手抄）。
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'build');
const ONE = process.env.G2WS_REPO_ONE_ROOT
  || (() => { // 一号仓发现（兄弟 run 扫描，updatedAt 最新优先——repo-one.mjs 判例同构）
    let dir = ROOT;
    for (let i = 0; i < 6; i += 1) {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
      const cands = readdirSync(dir).filter((x) => x.startsWith('run-'))
        .map((n) => join(dir, n, '.myrd', 'spec', 'wheat-squad', 'design-spec.json'))
        .filter((c) => existsSync(c))
        .map((c) => ({ c, at: JSON.parse(readFileSync(c, 'utf8'))?._platform?.updatedAt ?? '' }))
        .sort((a, b) => b.at.localeCompare(a.at));
      if (cands.length > 0) return dirname(cands[0].c.slice(0, cands[0].c.lastIndexOf('.myrd')));
    }
    throw new Error('未找到 wheat-squad spec 导出件：请设 G2WS_REPO_ONE_ROOT');
  })();
const SPEC_PATH = join(ONE, '.myrd', 'spec', 'wheat-squad', 'design-spec.json');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const rewrite = (src) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.mjs$3')
  .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.mjs$3');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = walk(join(ROOT, 'src')).filter((p) => p.endsWith('.ts'));
for (const f of srcFiles) {
  const rel = f.slice(ROOT.length + 1); // src/...
  const dst = join(OUT, rel.replace(/\.ts$/, '.mjs'));
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, rewrite(readFileSync(f, 'utf8')));
}

// 入口：main.mjs（spec 内联注入 = spec.json fetch 双保险；零外部依赖静态可服）
const spec = readFileSync(SPEC_PATH, 'utf8');
writeFileSync(join(OUT, 'spec.json'), spec);
const specInline = JSON.stringify(JSON.parse(spec));
writeFileSync(join(OUT, 'main.mjs'), `// wheat-squad 入口（tools/build.mjs 生成；勿手改）
globalThis.__G2WS_SPEC = ${specInline};
import('./src/main.mjs');
`);
writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>麦浪小队</title>
<style>
  html,body{margin:0;height:100%;background:#F5EDD8;display:flex;align-items:center;justify-content:center;touch-action:none}
  canvas{max-width:100vw;max-height:100vh;touch-action:none}
</style>
</head>
<body>
<canvas id="stage" width="390" height="640"></canvas>
<script type="module" src="./main.mjs"></script>
</body>
</html>
`);

const files = walk(OUT).map((f) => f.slice(OUT.length + 1)).sort();
console.log('BUILD OK: build/ ' + files.length + ' 文件（spec 内联 + src 镜像 + index）');
