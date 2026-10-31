// verify-reproducible.mjs — 构建复现门禁：连续两次构建逐字节比对，且与磁盘产物一致。
// 口径 A（transport-ship-3d 实战教训）：新检出 npm install && npm run build 必须产出逐字节一致的结果。
// 用法：node tools/verify-reproducible.mjs（建议在 tests/run-all.mjs 第一环跑）
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// 磁盘产物先挪走：复现验证必须从零构建，不许拿旧产物充数
const prodPath = path.join(root, "index.html");
const existing = (() => { try { return readFileSync(prodPath); } catch { return null; } })();
const tmp = mkdtempSync(path.join(os.tmpdir(), "ts3d-verify-"));
if (existing) copyFileSync(prodPath, path.join(tmp, "index.html"));
rmSync(prodPath, { force: true });

const hashes = [];
try {
  for (let i = 1; i <= 2; i++) {
    const r = spawnSync(process.execPath, [path.join(root, "tools", "build.mjs")], { cwd: root, encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`REPRODUCIBLE: FAIL 第 ${i} 次构建失败\n${r.stdout || ""}${r.stderr || ""}`);
      process.exit(1);
    }
    hashes.push(sha(readFileSync(prodPath)));
    console.log(`  build#${i} = ${hashes[i - 1]}`);
  }
} finally {
  if (existing) writeFileSync(prodPath, existing); // 还原磁盘产物
  else rmSync(prodPath, { force: true });
}

if (hashes[0] !== hashes[1]) {
  console.error(`REPRODUCIBLE: FAIL 两次构建哈希不一致（${hashes[0]} vs ${hashes[1]}）—— 查非确定性构建输入`);
  process.exit(1);
}
if (existing && sha(existing) !== hashes[0]) {
  console.error("REPRODUCIBLE: FAIL 磁盘 index.html 与重新构建不一致 —— 源码已改但产物未重建（勿手改产物）");
  process.exit(1);
}
console.log(`REPRODUCIBLE: PASS（两次构建逐字节一致${existing ? "，与磁盘产物一致" : ""}）`);
