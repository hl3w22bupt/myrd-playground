// run-all.mjs — 验收门禁聚合器：按序跑全部 *.spec.mjs / *.contract.mjs / qa-audit / 构建复现门禁，
// 任一失败 → 汇总后非零退出（CI 常驻入口：npm run game:test）。
// 新增门禁文件自动纳入（目录扫描），无需回来改清单 —— 防清单与目录漂移。

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, "..");
const repoRoot = path.resolve(gameRoot, "..", "..");

// 顺序即语义：先构建复现（产物就绪且可复现），再单文件契约，再内核确定性，再数值/波次，最后 QA 审计兜底。
const GATES = [
  { name: "构建复现（两次构建哈希一致）", script: "tools/verify-reproducible.mjs" },
  ...readdirSync(here)
    .filter((f) => /\.(spec|contract)\.mjs$/.test(f) || f === "qa-audit.mjs")
    .sort()
    .map((f) => ({ name: f, script: path.join("tests", f) })),
];

const results = [];
for (const gate of GATES) {
  const full = path.join(gameRoot, gate.script);
  process.stdout.write(`\n===== ${gate.name}（node ${path.relative(repoRoot, full)}）=====\n`);
  const r = spawnSync(process.execPath, [full], { stdio: "inherit", cwd: gameRoot });
  results.push({ name: gate.name, ok: r.status === 0 });
}

console.log("\n===== 门禁汇总 =====");
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`GAME-GATES: FAIL（${failed.length}/${results.length} 未过：${failed.map((f) => f.name).join("、")}）`);
  process.exit(1);
}
console.log(`GAME-GATES: PASS（${results.length}/${results.length} 全过）`);
