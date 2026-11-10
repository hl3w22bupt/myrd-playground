#!/usr/bin/env node
// preflight.mjs — three.js 游戏工程静态前置一致性检查（零依赖 Node，秒级）。
// 用法：node preflight.mjs <工程目录>
// FAIL（退出码 1）必须先修再进玩法开发；WARNING 只提示不拦截。
// 口径与 SKILL.md §7 一致：依赖钉版 / 内核纯度 / 状态机 / 输入双端 / 画质配方 / 单文件产物。

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const failures = [];
const warnings = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);
const ok = (cond, m) => (cond ? pass(m) : fail(m));

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const jsFiles = (dir) => {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d).sort()) {
      const full = path.join(d, name);
      statSync(full).isDirectory() ? walk(full) : out.push(full);
    }
  };
  walk(dir);
  return out;
};

console.log(`\n===== preflight：${path.basename(root)} =====`);

// ———————— P1 依赖钉版与构建脚本 ————————
{
  const pkgRaw = read(path.join(root, "package.json"));
  if (!pkgRaw) fail("package.json 不存在");
  else {
    const pkg = JSON.parse(pkgRaw);
    ok(pkg.private === true, "P1 package.json private=true");
    const dev = pkg.devDependencies || {};
    for (const dep of ["three", "esbuild"]) {
      const v = dev[dep];
      if (!v) fail(`P1 devDependencies.${dep} 缺失（构建关键依赖必须显式声明，见 error-signatures E-03）`);
      else if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`P1 devDependencies.${dep}="${v}" 未精确钉版（禁止 ^ ~）`);
      else pass(`P1 devDependencies.${dep}=${v} 精确钉版`);
    }
    ok((pkg.scripts?.build || "") === "node tools/build.mjs", "P1 scripts.build = node tools/build.mjs");
    ok(existsSync(path.join(root, "package-lock.json")), "P1 package-lock.json 已提交（新检出可复现）");
  }
}

// ———————— P2 数值唯一来源 ————————
{
  const hasNumeric = existsSync(path.join(root, "src", "numeric.js"));
  ok(hasNumeric, "P2 src/numeric.js 存在（数值唯一来源）");
  if (hasNumeric) {
    const kernelImports = jsFiles(path.join(root, "src", "kernel"))
      .some((f) => read(f).includes("numeric.js"));
    if (!kernelImports) warn("P2 内核未引用 numeric.js —— 数值可能散落（魔数应收口）");
    else pass("P2 内核引用 numeric.js");
  }
}

// ———————— P3 内核纯度（确定性内核禁入清单）———————
{
  const kernelDir = path.join(root, "src", "kernel");
  if (!existsSync(kernelDir)) fail("P3 src/kernel/ 不存在（kernel/render 分离是架构铁律）");
  else {
    const banned = ["three", "document", "window", "Math.random", "Date.now", "performance.now", "requestAnimationFrame"];
    let dirty = 0;
    for (const f of jsFiles(kernelDir)) {
      const code = read(f).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const b of banned) {
        if (new RegExp(`\\b${b.replace(".", "\\.")}\\b`).test(code)) {
          fail(`P3 ${path.relative(root, f)} 引用了内核禁项 "${b}"（零 three/零 DOM/零系统随机时钟，见 E-05）`);
          dirty++;
        }
      }
    }
    if (!dirty) pass(`P3 内核纯度：${jsFiles(kernelDir).length} 个文件零 three/零 DOM/零系统随机时钟`);
  }
}

// ———————— P4 显式状态机 ————————
{
  const loop = read(path.join(root, "src", "kernel", "loop.js"));
  if (!loop) fail("P4 src/kernel/loop.js 不存在");
  else {
    const states = ["title", "playing", "paused", "gameover"];
    const missing = states.filter((s) => !loop.includes(`"${s}"`) && !loop.includes(`'${s}'`));
    ok(missing.length === 0, missing.length ? `P4 状态机缺状态声明：${missing.join("/")}` : "P4 四态状态机声明齐全（title/playing/paused/gameover）");
    ok(/restart|reset/i.test(loop), "P4 状态机含 restart/reset（重开必须整 world 重建，见 E-10）");
  }
}

// ———————— P5 输入双端一致 ————————
{
  const touch = read(path.join(root, "src", "render", "touch.js"));
  const main = read(path.join(root, "src", "main.js"));
  const template = read(path.join(root, "index.template.html"));
  const hasKeyboard = /keydown|keyup/.test(main);
  const hasTouch = existsSync(path.join(root, "src", "render", "touch.js")) && /touchstart/.test(touch + main);
  if (hasKeyboard && !hasTouch) {
    const exempt = existsSync(path.join(root, ".myrd", "touch-exempt"));
    if (exempt) warn("P5 有键盘无触摸（.myrd/touch-exempt 显式豁免——spec 未声明移动 Web 才允许）");
    else fail("P5 有键鼠输入但无 touch 实现（双端一致是硬要求，见 E-04；确不适用则建 .myrd/touch-exempt 声明）");
  } else if (hasTouch) pass("P5 键鼠与触摸输入并存");
  ok(/touch-action\s*:\s*none/.test(template), "P5 index.template.html 声明 touch-action:none（手势冲突兜底）");
  ok(/maximum-scale=1/.test(template), "P5 viewport 禁缩放（maximum-scale=1）");
}

// ———————— P6 画质配方（warning 级：新手最容易漏的四件套）———————
{
  const renderCode = jsFiles(path.join(root, "src", "render")).map((f) => read(f)).join("\n");
  const recipe = [
    ["UnrealBloomPass", "后期辉光"],
    ["ACESFilmicToneMapping", "电影感色调映射"],
    ["FogExp2", "指数雾"],
    ["PCFSoftShadowMap", "软阴影"],
    ["Math.min(window.devicePixelRatio", "pixelRatio 上限"],
  ];
  for (const [sig, label] of recipe) {
    if (!renderCode.includes(sig)) warn(`P6 画质配方缺「${label}」（${sig}）—— 四件套见 references/rendering-quality-recipe.md`);
  }
  if (!/OutputPass/.test(renderCode) && /EffectComposer/.test(renderCode)) warn("P6 用了 EffectComposer 但没有 OutputPass —— 画面会发灰（E-01）");
  if (/UnrealBloomPass/.test(renderCode) && /ACESFilmicToneMapping/.test(renderCode) && /FogExp2/.test(renderCode) && /PCFSoftShadowMap/.test(renderCode)) pass("P6 画质四件套齐全");
}

// ———————— P7 单文件产物契约 ————————
{
  const built = path.join(root, "index.html");
  if (!existsSync(built)) warn("P7 index.html 尚未构建（node tools/build.mjs）");
  else {
    const html = read(built);
    const externals = [...html.matchAll(/(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    ok(externals.length === 0, externals.length ? `P7 产物含外部资源引用：${externals.slice(0, 3).join(", ")}` : "P7 产物零外链（单文件契约）");
    ok(!html.includes("importmap"), "P7 产物无 importmap（依赖全内联，见 E-02）");
  }
}

// ———————— P8 工具链齐备 ————————
for (const rel of ["tools/build.mjs", "tools/src-sha.mjs", "tools/verify-reproducible.mjs", "tests/run-all.mjs", "index.template.html"]) {
  ok(existsSync(path.join(root, rel)), `P8 ${rel} 存在`);
}

// ———————— 汇总 ————————
console.log("\n===== preflight 汇总 =====");
for (const w of warnings) console.log(`  WARN  ${w}`);
if (failures.length) {
  console.error(`PREFLIGHT: FAIL（${failures.length} 项 FAIL / ${warnings.length} 项 WARN）—— 先修再进玩法开发`);
  process.exit(1);
}
console.log(`PREFLIGHT: PASS（${warnings.length} 项 WARN）`);
