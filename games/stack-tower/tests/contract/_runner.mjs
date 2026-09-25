/**
 * 契约测试三态 runner（stack-tower）
 *
 * 三态显式输出（禁止第四种静默）：
 *   RESULT: PASS          —— 全部断言成立，exit 0
 *   RESULT: FAIL  (k/n)   —— 产物可达但有断言失败，exit 1（附每条失败原因）
 *   RESULT: not-runnable  —— 实现产物未落盘（build/ 缺失或模块缺导出），exit 0（附缺因）
 *
 * 产物约定：契约只认构建产物 build/kernel/*.js（由 `npm run build` 从 src/ 产出）。
 * not-runnable ≠ 通过：QA 预审三态中单列，不计绿。
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CONTRACT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const GAME_DIR = path.resolve(CONTRACT_DIR, '..', '..');
export const REPO_ROOT = path.resolve(GAME_DIR, '..', '..');
// 基线（M2.1 起独立路径，终结与糖果线 design-spec.json 的撞车）：approved 平台版导出件
export const SPEC_PATH = path.join(REPO_ROOT, '.myrd', 'spec', 'stack-tower-spec.json');
export const SPEC_PATH_LEGACY = path.join(REPO_ROOT, '.myrd', 'spec', 'design-spec.json');

/** 读取当前基线 spec（QA 与契约测试的共同输入）。不可达 → 抛错（显式失败，不静默）。 */
export function loadSpec() {
  const p = existsSync(SPEC_PATH) ? SPEC_PATH : SPEC_PATH_LEGACY;
  if (!existsSync(p)) {
    throw new Error(`spec 基线不可达: ${SPEC_PATH}（先由平台 approved 版导出）`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** 规范化 JSON：键序无关深比（平台入库会对对象键做归一化排序，总闸语义 = 结构+数值等价） */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** 尝试动态加载构建产物；不可达返回 { ok:false, reason }。 */
export async function loadBuildModule(relPath) {
  const abs = path.join(GAME_DIR, relPath);
  if (!existsSync(abs)) {
    return { ok: false, reason: `构建产物缺失: ${relPath}（先在 games/stack-tower 下执行 npm run build）` };
  }
  try {
    const mod = await import(abs + `?t=${process.env.CONTRACT_CACHE_BUST ?? ''}`);
    return { ok: true, mod };
  } catch (e) {
    return { ok: false, reason: `构建产物加载失败: ${relPath} — ${e.message}` };
  }
}

/**
 * 运行一条契约。
 * @param def {{ id:string, levelId:string, elementId:string, statement:string,
 *             needs: string[],            // 依赖的构建产物相对路径（build/ 下）
 *             checks: {name:string, fn:(mods:Record<string,object>)=>Promise<void>|void}[] }}
 */
export async function runContract(def) {
  const header = `[contract] ${def.id} · ${def.levelId}/${def.elementId}`;
  console.log(header);

  // spec 基线核对：命令必须与 approved spec 的 acceptance[].check 逐字对齐
  let specAligned = false;
  try {
    const spec = loadSpec();
    // 直接执行契约文件时 process.argv[1] 即该文件绝对路径；run-all 子进程同样成立
    const selfAbs = process.argv[1] ? path.resolve(process.argv[1]) : '';
    const cmd = `node games/stack-tower/tests/contract/${path.basename(selfAbs || 'unknown.spec.mjs')}`;
    specAligned = spec.spec.acceptance.some((a) => a.check === cmd && a.id === def.id);
    if (!specAligned) {
      console.log(`RESULT: FAIL (0/${def.checks.length}) — 命令或 id 未在 spec 基线 acceptance 中登记: ${cmd}`);
      process.exitCode = 1;
      return;
    }
  } catch (e) {
    console.log(`RESULT: not-runnable — ${e.message}`);
    process.exitCode = 0;
    return;
  }

  // 产物可达性：任一 needs 缺失 → 整条 not-runnable
  const mods = {};
  for (const rel of def.needs) {
    const r = await loadBuildModule(rel);
    if (!r.ok) {
      console.log(`RESULT: not-runnable — ${r.reason}`);
      process.exitCode = 0;
      return;
    }
    mods[rel] = r.mod;
  }

  let pass = 0;
  const failures = [];
  for (const c of def.checks) {
    const report = {};
    try {
      await c.fn(mods, report);
      if (report.notRunnable) {
        console.log(`RESULT: not-runnable — ${report.notRunnable}`);
        process.exitCode = 0;
        return;
      }
      if (report.evidence) console.log(`        [evidence] ${report.evidence}`);
      pass += 1;
      console.log(`  ok    ${c.name}`);
    } catch (e) {
      failures.push(`  FAIL  ${c.name}\n        ↳ ${e.message}`);
    }
  }
  const total = def.checks.length;
  if (failures.length === 0) {
    console.log(`RESULT: PASS (${pass}/${total})`);
    process.exitCode = 0;
  } else {
    for (const f of failures) console.log(f);
    console.log(`RESULT: FAIL (${pass}/${total})`);
    process.exitCode = 1;
  }
}

/** 断言工具（零依赖，node:assert 语义包装） */
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
export function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}
export function assertApproxEq(actual, expected, eps, msg) {
  if (!(Math.abs(actual - expected) <= eps)) {
    throw new Error(`${msg} — 期望 ≈${expected}(±${eps})，实际 ${actual}`);
  }
}
export function assertInRange(actual, lo, hi, msg) {
  if (!(actual >= lo && actual <= hi)) {
    throw new Error(`${msg} — 要求 ∈[${lo},${hi}]，实际 ${actual}`);
  }
}
