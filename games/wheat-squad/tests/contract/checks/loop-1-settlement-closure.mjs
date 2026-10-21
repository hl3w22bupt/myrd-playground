// checks/loop-1-settlement-closure.mjs — acceptance check 薄壳（spawn 冒烟实体件，exit 全透传；生成器同上）
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'smoke.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
