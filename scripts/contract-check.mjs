#!/usr/bin/env node
// contract-check.mjs（run 工作区根派发壳）→ g2-blocks 独立游戏仓 scripts/contract-check.mjs
//
// 为什么存在：例行程序（.myrd/routines.yaml · game-contract）约定 cwd=本仓根、
//   命令形态 `node scripts/contract-check.mjs --spec {{specPath}} --project {{projectDir}}`；
//   而 g2-blocks（熔炉方块）是本工作区的同级独立仓（../g2-blocks），契约入口在其仓内
//   （驳回 run 事故：MODULE_NOT_FOUND <run根>/scripts/contract-check.mjs）。
// 本壳零逻辑复制：只做 ①游戏仓定位 ②--spec → G2_SPEC_PATH 翻译 ③其余参数逐字透传
//   ④退出码传播。所有替换/回退显式打 `[dispatch]` 日志，不静默改语义。
// 规格真源口径：run 仓固化导出件 .myrd/spec/g2-blocks/design-spec.json
//   （v1.1 approved · numeric 锚 302e63367f3dea63…，与 g2 仓内默认解析同锚同内容）。
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ---- ① 定位游戏仓：env G2_REPO_ROOT → 同级 g2-blocks/ ----
function locateGameRepo() {
  const envRoot = process.env.G2_REPO_ROOT;
  if (envRoot && existsSync(join(envRoot, 'scripts', 'contract-check.mjs'))) return envRoot;
  const sibling = join(RUN_ROOT, '..', 'g2-blocks');
  if (existsSync(join(sibling, 'scripts', 'contract-check.mjs'))) return sibling;
  return null;
}

// ---- ② 参数解析：--spec/--project 归我翻译，其余（--only …）原样透传 ----
const argv = process.argv.slice(2);
const passthrough = [];
let specArg = null;
let projectArg = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--spec') { specArg = argv[i + 1]; i += 1; continue; }
  if (argv[i] === '--project') { projectArg = argv[i + 1]; i += 1; continue; }
  passthrough.push(argv[i]);
}

const gameRepo = locateGameRepo();
if (!gameRepo) {
  console.error('[dispatch] RED 未定位到 g2-blocks 游戏仓（设 G2_REPO_ROOT 或确认同级 ../g2-blocks 在盘）');
  process.exit(2);
}

// ---- ③ --spec 翻译：给定的不存在 → 回退本仓固化导出件（显式日志）；都没有 → 交给子进程自解析 ----
const childEnv = { ...process.env };
if (specArg) {
  const given = isAbsolute(specArg) ? specArg : resolve(RUN_ROOT, specArg);
  if (existsSync(given)) {
    childEnv.G2_SPEC_PATH = given;
    console.log(`[dispatch] --spec → G2_SPEC_PATH=${given}`);
  } else {
    const fallback = join(RUN_ROOT, '.myrd', 'spec', 'g2-blocks', 'design-spec.json');
    if (existsSync(fallback)) {
      childEnv.G2_SPEC_PATH = fallback;
      console.log(`[dispatch] --spec ${specArg} 不存在 → 回退本仓固化导出件 ${fallback}（g2-blocks spec 导出件，显式回退非静默）`);
    } else {
      console.log(`[dispatch] --spec ${specArg} 不存在且本仓无固化导出件 → 不设 G2_SPEC_PATH，由契约入口自解析`);
    }
  }
}
if (projectArg && projectArg !== '.') {
  console.log(`[dispatch] --project ${projectArg}：游戏工程=独立仓 ${gameRepo}（壳内固定 cwd，projectDir 参数仅记录）`);
}

// ---- ④ 派发：stdio 直通 + 退出码传播（不吞错不降级） ----
console.log(`[dispatch] → node scripts/contract-check.mjs ${passthrough.join(' ')} (cwd=${gameRepo})`);
const r = spawnSync(process.execPath, ['scripts/contract-check.mjs', ...passthrough], {
  cwd: gameRepo, env: childEnv, stdio: 'inherit',
});
process.exit(r.status ?? 1);
