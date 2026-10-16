#!/usr/bin/env node
// tools/build.mjs — wheat-squad 确定性构建（零 npm 依赖 · stripTypeScriptTypes 判例承 g2-blocks build-dy）
//
// 产物：build/（index.html + main.mjs + src/**.mjs 镜像 + spec.json）——AppHost assets_dir 面。
// 确定性：同输入逐字节一致（同 seed/同 strip 语义）；spec.json = 平台回读导出件直拷（零手抄）。
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { execSync } from 'node:child_process';
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
      // ONE = 「含 .myrd 的那一层目录」= slice 本身（归一尾斜杠）；不能再套 dirname ——
      // dirname 会多上一级落到项目级（deploy-r7 轮实证 ENOENT：resolve 到
      // <project>/.myrd/... 而非 <project>/run-<id>/.myrd/...），见 blackboard 台账
      if (cands.length > 0) return cands[0].c.slice(0, cands[0].c.lastIndexOf('.myrd')).replace(/\/+$/, '');
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
// 构建指纹注入（R1 复测收口轮 · 任务书「构建 sha 注入基建」）：
//   __G2WS_BUILD = { gitSha, specAnchor } —— 只含确定性字段（HEAD 全长 sha + spec 链锚），零时间戳，
//   同输入重建逐字节一致（确定性纪律不破）；部署物可自证「构建自哪个 commit」= sha 对账闭环面。
//   fail-closed：git 不可得即退出非零，绝不产无指纹产物；G2WS_BUILD_SHA env 覆写必须 ≡ 真实 HEAD（防伪锚）。
const spec = readFileSync(SPEC_PATH, 'utf8');
writeFileSync(join(OUT, 'spec.json'), spec);
const specInline = JSON.stringify(JSON.parse(spec));
const gitSha = (() => {
  let real;
  try {
    real = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    console.error('BUILD SHA 不可得：git rev-parse HEAD 失败（fail-closed，不产无指纹产物）');
    process.exit(1);
  }
  const envSha = process.env.G2WS_BUILD_SHA;
  if (envSha && envSha !== real) {
    console.error(`构建指纹防伪拦截：G2WS_BUILD_SHA(${envSha}) ≠ 真实 HEAD(${real})——覆写必须与被构建 commit 全等`);
    process.exit(1);
  }
  return real;
})();
const specDoc = JSON.parse(spec);
const specAnchor = `${specDoc._platform?.id ?? 'unknown'}@v${specDoc._platform?.version ?? '?'}:${specDoc._platform?.status ?? '?'}`;
writeFileSync(join(OUT, 'main.mjs'), `// wheat-squad 入口（tools/build.mjs 生成；勿手改）
globalThis.__G2WS_BUILD = ${JSON.stringify({ gitSha, specAnchor })};
globalThis.__G2WS_SPEC = ${specInline};
import('./src/main.mjs');
`);
console.log(`BUILD FINGERPRINT: gitSha=${gitSha} specAnchor=${specAnchor}`);
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

// landing.html = AppHost 网关适配版落地页（W-3 串线收口）：共享壳 server 优先伺服
// 清单里的 landing.html。与 index.html 的唯一差异：入口脚本走 api/public/assets/main.mjs
// 相对路径 —— 网关子路径（/apps/<slug>/gw）下裸 ./main.mjs 会解析到 /apps/* 而 404；
// main.mjs 内部的 ./src/** import 按模块 URL 解析，天然落在 api/public/assets/src/*。
// index.html 保留 standalone 形态（本地直开 / 静态托管 / iframe 预览用）。
writeFileSync(join(OUT, 'landing.html'), `<!doctype html>
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
<script type="module" src="api/public/assets/main.mjs"></script>
</body>
</html>
`);

const files = walk(OUT).map((f) => f.slice(OUT.length + 1)).sort();
console.log('BUILD OK: build/ ' + files.length + ' 文件（spec 内联 + src 镜像 + index + landing）');
