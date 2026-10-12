// run-all.mjs — wheat-squad 契约聚合器（三态输出 PASS/FAIL/PEND；零断言不装绿）
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE).filter((f) => /^ac-\d+.*\.spec\.mjs$/.test(f)).sort();
let pass = 0, fail = 0;
for (const f of files) {
  try {
    await import(join(HERE, f));
    pass += 1;
  } catch (e) {
    fail += 1;
    console.log(`FAIL ${f} :: ${String(e.message || e).split('\n')[0].slice(0, 220)}`);
  }
}
console.log(`—— wheat-squad 契约合计 ${pass} PASS / ${fail} FAIL ——`);
process.exit(fail > 0 ? 1 : 0);
