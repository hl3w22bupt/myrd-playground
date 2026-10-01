#!/usr/bin/env node
// contract-check —— webgame 原型工程与策划案（design-spec.json）的一致性门禁。
//
// 为什么需要它：原型的最高频死法不是「跑不起来」，是「实现和 spec 悄悄分家」——
// 实体落点改了名、关卡元素编号漂移、acceptance 写了 check 却没有可跑的检查文件。
// 这些偏差零构建也能过、浏览器里也看不出，只有机器逐条断言才拦得住。
// 断言口径与 webgame-prototype SKILL.md「§3 一致性契约」一一对应，
// 缺一段 spec 就跳过对应检查（向前兼容）。
//
// 用法（仓库根执行）：
//   node std-skills/webgame-prototype/scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .
//
// 参数：
//   --spec     design-spec.json 路径（approved 版导出件，契约测试输入）
//   --project  工程根目录（默认 .）；spec 内的 script/scene/check 均相对它解析
//
// 退出码：0 = 契约全部成立；
//         1 = 有契约违约（逐条打印 [FAIL] 与期望落点）；
//         2 = 输入不可用（spec 缺失 / 非法 JSON / 缺参数）—— 环境问题，不算工程违约。

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const args = { project: '.' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--spec') args.spec = argv[++i];
    else if (argv[i] === '--project') args.project = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const say = (tag, msg) => console.log(`[${tag}] ${msg}`);

if (!args.spec) {
  console.error('contract-check: 缺少 --spec 参数（design-spec.json 导出件路径）');
  process.exit(2);
}

const specPath = path.resolve(args.spec);
const projectDir = path.resolve(args.project);

if (!existsSync(specPath)) {
  console.error(`contract-check: spec 文件不存在：${specPath}（先从 approved 版策划案导出）`);
  process.exit(2);
}

let spec;
try {
  spec = JSON.parse(readFileSync(specPath, 'utf8'));
} catch (err) {
  console.error(`contract-check: spec 不是合法 JSON：${err.message}`);
  process.exit(2);
}

if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
  console.error(`contract-check: 工程目录不存在：${projectDir}`);
  process.exit(2);
}

// ---------- 契约断言 ----------
const failures = [];
const okCount = { n: 0 };
function check(ok, label, detail) {
  if (ok) {
    okCount.n++;
    say('ok', label);
  } else {
    failures.push(label);
    say('FAIL', `${label} —— ${detail}`);
  }
}

const rel = (p) => path.resolve(projectDir, String(p));
const fileExists = (p) => existsSync(rel(p)) && statSync(rel(p)).isFile();

// C1 实体落点：spec.entities[].script 必须存在，entity.id 全局唯一
if (Array.isArray(spec.entities)) {
  const seen = new Set();
  for (const entity of spec.entities) {
    const id = entity?.id;
    check(typeof id === 'string' && id.length > 0,
      `entity.id 有效（${id ?? '<缺>'}）`, 'spec.entities[] 每项必须有非空 id');
    if (typeof id === 'string' && id.length > 0) {
      check(!seen.has(id), `entity.id 唯一（${id}）`, `id「${id}」在 spec.entities 中重复声明`);
      seen.add(id);
    }
    if (typeof entity?.script === 'string' && entity.script.length > 0) {
      check(fileExists(entity.script),
        `entity 落点存在（${id} → ${entity.script}）`,
        `声明了 script=${entity.script}，但 ${rel(entity.script)} 不存在`);
    }
  }
}

// C2 关卡落点：spec.levels[].scene 必须存在，level.id 全局唯一
if (Array.isArray(spec.levels)) {
  const seen = new Set();
  for (const level of spec.levels) {
    const id = level?.id;
    check(typeof id === 'string' && id.length > 0,
      `level.id 有效（${id ?? '<缺>'}）`, 'spec.levels[] 每项必须有非空 id');
    if (typeof id === 'string' && id.length > 0) {
      check(!seen.has(id), `level.id 唯一（${id}）`, `id「${id}」在 spec.levels 中重复声明`);
      seen.add(id);
    }
    if (typeof level?.scene === 'string' && level.scene.length > 0) {
      check(fileExists(level.scene),
        `level 落点存在（${id} → ${level.scene}）`,
        `声明了 scene=${level.scene}，但 ${rel(level.scene)} 不存在`);
    }
  }
}

// C3 关卡元素编号：`<level.id>/<element.id>` 关卡内唯一 —— 这是关卡可视化编辑页
// 「编号 + 字段 + 期望值」精确落点修改的前提（D5）；编号漂移会让已落账的期望值失锚。
if (Array.isArray(spec.levels)) {
  for (const level of spec.levels) {
    if (!Array.isArray(level?.elements)) continue;
    const seen = new Set();
    for (const element of level.elements) {
      const eid = element?.id;
      check(typeof eid === 'string' && eid.length > 0,
        `element.id 有效（${level.id ?? '<level 缺 id>'}/${eid ?? '<缺>'}）`,
        `关卡「${level.id}」有元素缺非空 id`);
      if (typeof eid === 'string' && eid.length > 0) {
        check(!seen.has(eid),
          `element.id 关卡内唯一（${level.id}/${eid}）`,
          `编号「${level.id}/${eid}」重复 —— 关卡可视化编辑的精确落点会失锚`);
        seen.add(eid);
      }
    }
  }
}

// C4 数值唯一来源：spec.numeric 非空 → src/numeric.js 必须存在（运行时只从这里读数值）
if (spec.numeric != null && Object.keys(spec.numeric).length > 0) {
  check(fileExists('src/numeric.js'),
    'numeric 唯一来源存在（spec.numeric → src/numeric.js）',
    'spec.numeric 有声明，但 src/numeric.js 不存在 —— 数值将散落成魔数');
}

// C5 验收可跑：acceptance 配了 check 的项，检查文件必须存在（落点见 SKILL.md §1 tests/）
const acceptances = spec.acceptance ?? spec.acceptanceCriteria;
if (Array.isArray(acceptances)) {
  for (const item of acceptances) {
    if (typeof item?.check !== 'string' || item.check.length === 0) continue;
    const label = item.id ?? item.title ?? item.check;
    check(fileExists(item.check),
      `验收检查文件存在（${label} → ${item.check}）`,
      `acceptance「${label}」声明了 check=${item.check}，但 ${rel(item.check)} 不存在 —— 验收将无据可跑`);
  }
}

// ---------- 汇总 ----------
const checked = okCount.n + failures.length;
if (failures.length > 0) {
  console.error(`\ncontract-check: FAIL ${failures.length}/${checked} 项契约违约：`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('contract-check: 实现与 spec 已分家，改 spec 与改工程必须同一次提交内对齐（SKILL.md §3）');
  process.exit(1);
}
console.log(`\ncontract-check: PASS ${checked} 项契约全部成立（${path.relative(process.cwd(), specPath)} ↔ ${path.relative(process.cwd(), projectDir)}）`);
process.exit(0);
