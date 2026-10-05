#!/usr/bin/env node
// scripts/contract-check.mjs — 平台 game-contract routine 入口（薄壳代理 · 检查逻辑零复制）
//
// 背景（2026-10-05 routine 驳回修复）：
//   .myrd/routines.yaml 的 game-contract 以工作区根为 cwd 执行
//     node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .
//   本工作区布局 = 平台工作区 + 兄弟游戏仓库（g2-blocks / g2-blocks-wx worktree），
//   契约检查器单源在游戏仓库 → 本件只做「参数面映射 + 子进程透传」，不复制任何检查逻辑：
//
//   --spec     routine 保留位 `.myrd/spec/design-spec.json` 不存在时，映射到
//              `.myrd/spec/g2-blocks/design-spec.json`（一游戏一文件落点偏差，
//              已披露于黑板 blockers.md「落点偏差披露」）。
//   --project  显式游戏仓库目录 > env G2_REPO > 兄弟目录自动发现。
//              自动发现判据 = 同时含 `scripts/contract-check.mjs` 与 `src/kernel/spec-source.ts`
//              （游戏仓库特征，天然排除平台工作区自身，防自引用）；多候选时
//              「含 export/wx/game.json 者优先」（当前交付线 = wx 提审轮）。
//   透传       以 G2_SPEC_PATH 注入游戏仓库检查器（src/kernel/spec-source.ts 原生尊重该
//              变量），stdio/exit code 全透传 —— 游戏仓库侧有红即红，不装绿。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const specArg = flag('--spec') ?? '.myrd/spec/design-spec.json';
const projectArg = flag('--project');
// --only <id> 原样透传（acceptance.check 字面引用形态）
const extra = [];
{
  const i = argv.indexOf('--only');
  if (i >= 0 && argv[i + 1]) extra.push('--only', argv[i + 1]);
}

const fail = (msg) => {
  console.error(`RED  [contract-check 入口] ${msg}`);
  process.exit(1);
};

// ① 解析 spec 导出件：保留位优先，缺失时映射 g2 子目录落点
const candidates = [resolve(specArg), resolve('.myrd/spec/g2-blocks/design-spec.json')];
const specPath = candidates.find((p) => existsSync(p));
if (!specPath) fail(`spec 导出件不存在，尝试过：\n  ${candidates.join('\n  ')}`);
let specJson;
try {
  specJson = JSON.parse(readFileSync(specPath, 'utf8'));
} catch (e) {
  fail(`spec 导出件不可解析（${specPath}）：${e.message}`);
}
if (!specJson?.spec?.acceptance?.length) {
  fail(`spec 导出件缺 spec.acceptance（${specPath}）——拒绝把非 spec 文件喂进检查链`);
}

// ② 定位游戏仓库（显式 > env > 自动发现）
const isGameRepo = (d) =>
  existsSync(join(d, 'scripts', 'contract-check.mjs')) &&
  existsSync(join(d, 'src', 'kernel', 'spec-source.ts'));
let repo = null;
if (projectArg && projectArg !== '.') {
  const p = resolve(projectArg);
  if (isGameRepo(p)) repo = p;
  else fail(`--project ${p} 不是游戏仓库（缺 scripts/contract-check.mjs 或 src/kernel/spec-source.ts）`);
}
if (!repo && process.env.G2_REPO) {
  const p = resolve(process.env.G2_REPO);
  if (isGameRepo(p)) repo = p;
}
if (!repo) {
  const wsRoot = process.cwd();
  const searchRoots = [dirname(wsRoot), wsRoot];
  const found = [];
  for (const root of searchRoots) {
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name);
    } catch {
      /* 不可读目录跳过 */
    }
    for (const n of entries) {
      const d = join(root, n);
      if (isGameRepo(d)) found.push(d);
    }
  }
  // 交付线优先：wx 提审轮交付面（export/wx/game.json 在盘者）排前；其余保序稳定
  found.sort(
    (a, b) =>
      Number(existsSync(join(b, 'export', 'wx', 'game.json'))) -
      Number(existsSync(join(a, 'export', 'wx', 'game.json'))),
  );
  repo = found[0] ?? null;
  if (found.length > 1) {
    console.log(`# [入口] 发现 ${found.length} 个游戏仓库候选，选定：${repo}`);
    console.log(`# [入口] 其余候选（可用 --project / G2_REPO 显式指定）：${found.slice(1).join(' , ')}`);
  }
}
if (!repo) {
  fail(
    '未发现游戏仓库契约检查器（需同时含 scripts/contract-check.mjs 与 src/kernel/spec-source.ts）。' +
      '可用 --project <repoDir> 或环境变量 G2_REPO 显式指定。',
  );
}

// ③ 透传执行：spec 以 G2_SPEC_PATH 注入，cwd=游戏仓库，exit code 原样返回
console.log(`# [入口] spec = ${specPath}`);
console.log(`# [入口] repo = ${repo}`);
console.log(`# [入口] $ node scripts/contract-check.mjs ${extra.join(' ')}`.trimEnd());
try {
  execFileSync(process.execPath, [join(repo, 'scripts', 'contract-check.mjs'), ...extra], {
    cwd: repo,
    stdio: 'inherit',
    env: { ...process.env, G2_SPEC_PATH: specPath },
  });
  process.exit(0);
} catch (e) {
  process.exit(e.status ?? 1);
}
