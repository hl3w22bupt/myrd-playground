#!/usr/bin/env node
// contract-check-selftest —— contract-check.mjs 的自测：用合成工程逐条验证
// 「该拦的拦下、不该拦的放行」。
//
// 为什么需要它：门禁最危险的不是「误报」，是「假阴性」—— 脚本存在、退出码 0，
// 断言却从未真正生效，绿灯照样放行一个和 spec 分家的工程。唯一可靠的证明办法是
// 注入必然缺陷，看门禁是否真的拦得下来。与 godot-game-dev 的 preflight_selftest.py
// 同一哲学：门禁自己的门禁。
//
// 用法（仓库根执行）：
//   node std-skills/webgame-prototype/scripts/contract-check-selftest.mjs
// 退出码：0 = 全部用例符合预期；1 = 有用例不符（打印差异）。
//
// 用例命名：`must_fail:<标签>` 期望退出码 1 且输出含标签；`must_pass` 期望退出码 0；
//           `must_fail_env` 期望退出码 2（输入不可用）。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.resolve(process.argv[2] ?? path.join(here, 'contract-check.mjs'));

// 合成工程的最小骨架：一个实体、两个关卡、数值、一条带 check 的验收。
const FULL_SPEC = {
  entities: [{ id: 'box', script: 'src/entities/box.js' }],
  levels: [
    { id: 'level-1', scene: 'src/levels/level-1.js', elements: [{ id: 'box-1' }, { id: 'goal-1' }] },
    { id: 'level-2', scene: 'src/levels/level-2.js', elements: [{ id: 'box-1' }] },
  ],
  numeric: { moveSpeed: 1 },
  acceptance: [{ id: 'AC1', check: 'tests/acceptance-push.check.mjs' }],
};

function makeProject(spec, mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), 'contract-check-fixture-'));
  const proj = path.join(dir, 'proj');
  mkdirSync(path.join(proj, 'src/entities'), { recursive: true });
  mkdirSync(path.join(proj, 'src/levels'), { recursive: true });
  mkdirSync(path.join(proj, 'tests'), { recursive: true });
  writeFileSync(path.join(proj, 'src/entities/box.js'), 'export const box = 1;\n');
  writeFileSync(path.join(proj, 'src/levels/level-1.js'), 'export const l1 = 1;\n');
  writeFileSync(path.join(proj, 'src/levels/level-2.js'), 'export const l2 = 1;\n');
  writeFileSync(path.join(proj, 'src/numeric.js'), 'export const numeric = { moveSpeed: 1 };\n');
  writeFileSync(path.join(proj, 'tests/acceptance-push.check.mjs'), 'console.log("ok");\n');
  const specPath = path.join(dir, 'design-spec.json');
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  if (mutate) mutate(proj);
  return { dir, specPath, proj };
}

// 极简 spec：只声明实体与关卡（无 elements/numeric/acceptance）—— 向前兼容正例。
const MINIMAL_SPEC = {
  entities: [{ id: 'player', script: 'src/entities/player.js' }],
  levels: [{ id: 'only', scene: 'src/levels/only.js' }],
};
function makeMinimalProject() {
  const dir = mkdtempSync(path.join(tmpdir(), 'contract-check-fixture-'));
  const proj = path.join(dir, 'proj');
  mkdirSync(path.join(proj, 'src/entities'), { recursive: true });
  mkdirSync(path.join(proj, 'src/levels'), { recursive: true });
  writeFileSync(path.join(proj, 'src/entities/player.js'), 'export const p = 1;\n');
  writeFileSync(path.join(proj, 'src/levels/only.js'), 'export const l = 1;\n');
  const specPath = path.join(dir, 'design-spec.json');
  writeFileSync(specPath, JSON.stringify(MINIMAL_SPEC, null, 2));
  return { dir, specPath, proj };
}

function run(specPath, proj) {
  try {
    const out = execFileSync('node', [checker, '--spec', specPath, '--project', proj], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const CASES = [
  {
    name: 'full-project-ok（must_pass）',
    build: () => makeProject(FULL_SPEC),
    expect: { code: 0 },
  },
  {
    name: 'entity-script-missing（must_fail:落点）',
    build: () => makeProject(FULL_SPEC, (p) => rmSync(path.join(p, 'src/entities/box.js'))),
    expect: { code: 1, contains: 'src/entities/box.js' },
  },
  {
    name: 'entity-id-duplicate（must_fail:重复声明）',
    build: () => makeProject({
      ...FULL_SPEC,
      entities: [{ id: 'box', script: 'src/entities/box.js' }, { id: 'box' }],
    }),
    expect: { code: 1, contains: '重复声明' },
  },
  {
    name: 'level-scene-missing（must_fail:scene=src/levels/level-2.js）',
    build: () => makeProject(FULL_SPEC, (p) => rmSync(path.join(p, 'src/levels/level-2.js'))),
    expect: { code: 1, contains: 'src/levels/level-2.js' },
  },
  {
    name: 'element-id-duplicate-in-level（must_fail:失锚）',
    build: () => makeProject({
      ...FULL_SPEC,
      levels: [{ id: 'level-1', scene: 'src/levels/level-1.js', elements: [{ id: 'box-1' }, { id: 'box-1' }] }],
    }),
    expect: { code: 1, contains: '失锚' },
  },
  {
    name: 'element-id-reused-across-levels-ok（must_pass：唯一性只限关卡内）',
    build: () => makeProject(FULL_SPEC), // box-1 同时出现在 level-1 与 level-2，属合法
    expect: { code: 0 },
  },
  {
    name: 'numeric-without-source（must_fail:src/numeric.js）',
    build: () => makeProject(FULL_SPEC, (p) => rmSync(path.join(p, 'src/numeric.js'))),
    expect: { code: 1, contains: 'src/numeric.js' },
  },
  {
    name: 'acceptance-check-file-missing（must_fail:无据可跑）',
    build: () => makeProject(FULL_SPEC, (p) => rmSync(path.join(p, 'tests/acceptance-push.check.mjs'))),
    expect: { code: 1, contains: '无据可跑' },
  },
  {
    name: 'minimal-spec-ok（must_pass：缺段跳过对应检查）',
    build: () => makeMinimalProject(),
    expect: { code: 0 },
  },
  {
    name: 'spec-file-missing（must_fail_env：输入不可用 → 2）',
    build: () => makeProject(FULL_SPEC),
    useSpecPath: (r) => path.join(r.dir, 'no-such-spec.json'),
    expect: { code: 2 },
  },
];

let failed = 0;
for (const c of CASES) {
  const fixture = c.build();
  try {
    const { code, out } = run(c.useSpecPath ? c.useSpecPath(fixture) : fixture.specPath, fixture.proj);
    const codeOk = code === c.expect.code;
    const containsOk = !c.expect.contains || out.includes(c.expect.contains);
    if (codeOk && containsOk) {
      console.log(`[ok  ] ${c.name}`);
    } else {
      failed++;
      console.log(`[FAIL] ${c.name} —— 退出码 ${code}（期望 ${c.expect.code}）` +
        (c.expect.contains && !containsOk ? `，输出缺关键字「${c.expect.contains}」` : ''));
      console.log(out.split('\n').map((l) => `       ${l}`).join('\n'));
    }
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
}

console.log(failed === 0
  ? `\ncontract-check 自测：${CASES.length}/${CASES.length} 用例符合预期`
  : `\ncontract-check 自测：${CASES.length - failed}/${CASES.length} 用例符合预期，${failed} 项不符`);
process.exit(failed === 0 ? 0 : 1);
