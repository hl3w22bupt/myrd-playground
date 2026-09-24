// verify-reproducible.mjs — 验收口径 A「构建复现」机判门禁：
//   同一源输入连续构建两次 → 主产物 / AppHost 导出产物 sha256 逐字节一致；
//   且 SRC_SHA 源指纹与 tools/src-sha.mjs 复算一致（产物确实由当前源生成）。
// 用法：npm run game:verify（仓库根任意 cwd 均可）。任何一步不一致 → 非零退出。
// 证据行 `REPRODUCIBLE-BUILD {...}` 为单行 JSON，供归档与 CI 摘取。

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { productSourceSha, FINGERPRINT_PATHS } from "./src-sha.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, "..");
const buildScript = path.join(here, "build.mjs");

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const stamp = (p) => (readFileSync(p, "utf8").match(/<!--SRC_SHA=([0-9a-f]+)-->/) || [])[1];

function runBuild(label) {
  console.log(`[verify] 第 ${label} 次构建（node tools/build.mjs）…`);
  execFileSync(process.execPath, [buildScript], { stdio: "inherit", cwd: gameRoot });
  return {
    main: sha256(path.join(gameRoot, "index.html")),
    exportWeb: sha256(path.join(gameRoot, "export", "web", "index.html")),
    srcSha: stamp(path.join(gameRoot, "index.html")),
  };
}

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);

const build1 = runBuild("一");
const build2 = runBuild("二");

if (build1.main === build2.main) pass(`主产物两次构建 sha256 一致（${build1.main.slice(0, 16)}…）`);
else fail(`主产物两次构建不一致：#1=${build1.main} #2=${build2.main}`);

if (build1.exportWeb === build2.exportWeb) pass(`AppHost 导出产物两次构建 sha256 一致（${build1.exportWeb.slice(0, 16)}…）`);
else fail(`AppHost 导出产物两次构建不一致：#1=${build1.exportWeb} #2=${build2.exportWeb}`);

if (build1.main === build1.exportWeb) pass("主产物 ↔ AppHost 导出产物 sha256 一致（同一字符串真源）");
else fail("主产物与 AppHost 导出产物不同（部署侧会伺服另一份内容）");

const srcSha = productSourceSha(gameRoot);
if (build2.srcSha === srcSha) pass(`SRC_SHA 与源输入复算一致（${srcSha}，指纹范围 ${FINGERPRINT_PATHS.join(" + ")}）`);
else fail(`SRC_SHA 指纹不符：产物=${build2.srcSha ?? "缺失"} 源复算=${srcSha}（重新构建或排查源外输入）`);

console.log(
  "REPRODUCIBLE-BUILD " +
    JSON.stringify({
      ok: failures.length === 0,
      build1: { main: build1.main, exportWeb: build1.exportWeb },
      build2: { main: build2.main, exportWeb: build2.exportWeb },
      srcSha,
      fingerprintPaths: FINGERPRINT_PATHS,
    }),
);

if (failures.length) {
  console.error("—— 构建复现门禁 FAIL ——");
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log("REPRODUCIBLE: PASS 连续两次构建逐字节一致，产物可复现");
