// run-all 占位 — 逐件对账 runner 实现轮交付（wheat-squad run-all 判例平移）
// 本占位 fail-closed：15 条 check 薄壳均为 PENDING-IMPLEMENTATION，此时不可判绿
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = join(dirname(fileURLToPath(import.meta.url)), "checks");
const files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
console.error(`PENDING-IMPLEMENTATION: ${files.length} 条 check 薄壳均为占位（spec approved 后实现轮转真），runner 此时不可判绿`);
process.exit(1);
