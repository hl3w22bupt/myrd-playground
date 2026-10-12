// ac-13-art-style-consistency — ac-art-4（AC-A4 · manual+auto）
// 机制面（auto）：风格卡 v1 四要素在档 + 素材走查清单在档 + palette 三方同源声明在档
// 结论面（manual）：主策划×美术互查对照风格卡逐件人判——互查回执未落 = MANUAL-PENDING
import { assert, ROOT } from './helpers.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 机制面1：风格卡 v1 四要素齐备
const cardPath = join(ROOT, '..', '..', '.myrd', 'blackboard', 'wheat-squad', 'style-card-v1.md');
assert(existsSync(cardPath), '缺风格卡 v1（.myrd/blackboard/wheat-squad/style-card-v1.md）');
const card = readFileSync(cardPath, 'utf8');
for (const el of ['要素一 · 调色板白名单', '要素二 · 光照', '要素三 · 线条', '要素四 · 比例']) {
  assert(card.includes(el), `风格卡 v1 缺四要素「${el}」`);
}

// 机制面2：素材走查清单在档（提审 README 含文案红线四条）
const readmePath = join(ROOT, 'qa', 'submission', 'README.md');
assert(existsSync(readmePath), '缺提审素材 README（走查清单载体）');
const readme = readFileSync(readmePath, 'utf8');
for (const kw of ['极限词', '开放数据域', '凭证不入库', '止步']) assert(readme.includes(kw), `素材走查清单缺红线「${kw}」`);

// 机制面3：色值单源声明（styleRef → spec numeric.palette 单源链）
assert(card.includes('numeric.palette'), '风格卡未声明 palette 单源链');

// 结论面：互查回执（N7 对抗审查产出 qa/style-consistency-check.md 后复跑转 PASS）
const receiptPath = join(ROOT, 'qa', 'style-consistency-check.md');
const pending = !existsSync(receiptPath);
console.log(pending
  ? 'PEND ac-art-4(manual) 机制面 PASS（四要素+走查清单+单源声明）· 结论面 MANUAL-PENDING（互查回执 qa/style-consistency-check.md 未落——N7 对抗审查执行）'
  : `PASS ac-art-4 机制面+互查回执全达（${'qa/style-consistency-check.md'} 在档）`);
