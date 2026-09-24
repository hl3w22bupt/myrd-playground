#!/usr/bin/env node
// qa-audit.mjs — ac-6：QA 互查审计（独立于实现侧的机判断言，七道关）：
//   ① 内核纯净性：kernel/ 禁 three / DOM / Math.random / Date.now（确定性红线）
//   ② 数值双向一致：spec.numeric ↔ src/numeric.js 逐键逐值（数值唯一来源红线）
//   ③ HUD 骨架一致：模板 DOM id ↔ hud.js 引用 id
//   ④ 产物同步：index.html 的 SRC_SHA 与源输入（src/ + assets/ + index.template.html + tools/build.mjs + 本算法文件）重算一致
//   ⑤ 关卡元素编号：spec.levels[].elements ↔ level-01-deck.js 双向集合相等（私加/漏实现都打回）
//   ⑥ AppHost 导出同步：export/web/index.html（apphost.toml assets_dir 指向的部署产物）↔ 主产物 index.html 逐字节一致
//   ⑦ 移动控件热区（验收口径 B）：44px 热区下限 / 摇杆区矩形 / 死区归零 / 满行程钳 1 / 极端视口钳制（DOM 实测归 touchcheck 的 CDP 关）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productSourceSha, FINGERPRINT_PATHS } from "../tools/src-sha.mjs";

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(gameRoot, "..", "..");
const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);

// —— ① 内核纯净性 ——
{
  const kernelDir = path.join(gameRoot, "src/kernel");
  const banned = [
    [/from\s+["']three["']|import\s*\(\s*["']three["']/, "three 引入内核"],
    [/document\.|window\.|getElementById|requestAnimationFrame/, "DOM 依赖"],
    [/Math\.random/, "Math.random（禁：用 kernel/rng）"],
    [/Date\.now|new Date\(/, "时钟依赖（禁：时间由步进注入）"],
    [/performance\.now/, "时钟依赖（禁）"],
  ];
  let files = 0, hits = [];
  (function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        files++;
        const src = readFileSync(full, "utf8");
        for (const [re, label] of banned) if (re.test(src)) hits.push(`${path.relative(gameRoot, full)} → ${label}`);
      }
    }
  })(kernelDir);
  if (files > 0 && hits.length === 0) pass(`内核纯净（${files} 个文件：零 three / 零 DOM / 零随机 / 零时钟）`);
  else fail(`内核纯净性破坏：${hits.join("; ") || "未扫描到文件"}`);
}

// —— ② 数值双向一致 ——
{
  const specPath = path.join(repoRoot, ".myrd/spec/design-spec.json");
  if (!existsSync(specPath)) { fail("找不到 .myrd/spec/design-spec.json（spec 导出件缺失）"); }
  else {
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    if (spec.meta?.status !== "approved" && spec.meta?.approval?.approved !== true) fail("spec 导出件不是 approved 版");
    else pass(`spec 导出件为 approved 版（v${spec.meta.version}，平台 ${spec.meta.approval?.platformSpecId ?? "n/a"}）`);
    const codeSrc = readFileSync(path.join(gameRoot, "src/numeric.js"), "utf8");
    const codeKeys = [...codeSrc.matchAll(/^export const ([A-Z0-9_]+) = ([0-9][0-9.eE+-]*);(?:|\s*\/\/.*)$/gm)].map((m) => [m[1], Number(m[2])]);
    const specKeys = Object.entries(spec.numeric ?? {});
    const missingInCode = specKeys.filter(([k]) => !codeKeys.some(([c]) => c === k));
    const missingInSpec = codeKeys.filter(([k]) => !specKeys.some(([s]) => s === k));
    const valueMismatch = codeKeys.filter(([k, v]) => specKeys.some(([s, sv]) => s === k && sv !== v));
    if (missingInCode.length === 0) pass(`spec.numeric 的 ${specKeys.length} 键全部在 numeric.js 有镜像`);
    else fail(`spec.numeric 缺镜像：${missingInCode.map(([k]) => k).join(",")}`);
    if (missingInSpec.length === 0) pass("numeric.js 无 spec 之外的私加数值键");
    else fail(`numeric.js 私加键（未入策划案）：${missingInSpec.map(([k]) => k).join(",")}`);
    if (valueMismatch.length === 0) pass("数值逐键比对无偏差");
    else fail(`数值偏差：${valueMismatch.map(([k, v]) => `${k} 代码=${v}`).join("; ")}`);
  }
}

// —— ③ HUD 骨架一致 ——
{
  const hud = readFileSync(path.join(gameRoot, "src/render/hud.js"), "utf8");
  const tpl = readFileSync(path.join(gameRoot, "index.template.html"), "utf8");
  // HUD 的 DOM id 声明在 hud.js 自注入的 innerHTML 里（#ui 容器在 index 模板）
  const refs = [...hud.matchAll(/EL\(\s*["']([a-z-]+)["']\s*\)/g)].map((m) => m[1]);
  const declared = hud + tpl; // id 可声明于 innerHTML 模板或静态骨架
  const missing = [...new Set(refs)].filter((id) => !declared.includes(`id="${id}"`));
  if (refs.length > 0 && missing.length === 0) pass(`HUD 引用的 ${new Set(refs).size} 个 DOM id 全部有声明（innerHTML/静态骨架）`);
  else fail(`HUD 引用了模板不存在的 id：${missing.join(", ") || "未检出引用"}`);
}

// —— ④ 产物同步（SRC_SHA）—— 算法与范围唯一真源 = tools/src-sha.mjs（构建器与审计共用，防两头各算各的）
{
  const htmlPath = path.join(gameRoot, "index.html");
  if (!existsSync(htmlPath)) fail("缺少 index.html（先 node tools/build.mjs）");
  else {
    const stamp = (readFileSync(htmlPath, "utf8").match(/<!--SRC_SHA=([0-9a-f]+)-->/) || [])[1];
    const sha = productSourceSha(gameRoot);
    if (stamp === sha) pass(`产物与源输入同步（SRC_SHA=${sha}，指纹范围 ${FINGERPRINT_PATHS.join(" + ")}）`);
    else fail(`产物过期：SRC_SHA=${stamp ?? "缺失"}，当前源指纹=${sha}（重新执行 node tools/build.mjs）`);
  }
}

// —— ⑤ 关卡元素编号双向对应 —— spec.elements ↔ 关卡数据必须集合相等（防实现侧私加/漏实现编号）
{
  const specPath = path.join(repoRoot, ".myrd/spec/design-spec.json");
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const lvl = spec.levels?.find((l) => l.id === "lvl-01-deck");
  const levelSrc = readFileSync(path.join(gameRoot, "src/levels/level-01-deck.js"), "utf8");
  const codeIds = [...new Set([...levelSrc.matchAll(/"?(lvl-01-deck\/[a-z0-9-]+)"?/g)].map((m) => m[1]))];
  const specIds = [...new Set((lvl?.elements ?? []).map((e) => e.id))];
  const notInSpec = codeIds.filter((id) => !specIds.includes(id)); // 实现 → spec 方向（防私加编号）
  const notInCode = specIds.filter((id) => !codeIds.includes(id)); // spec → 实现方向（防漏实现）
  if (specIds.length > 0 && notInSpec.length === 0 && notInCode.length === 0) {
    pass(`关卡元素编号双向集合相等（${specIds.length} 个，spec ↔ 代码一一对应）`);
  } else {
    if (notInSpec.length > 0) fail(`实现侧私加编号（spec 未声明）：${notInSpec.join(", ")} —— 走 spec revisions 登记或实现收敛`);
    if (notInCode.length > 0) fail(`spec 元素编号未落地：${notInCode.join(", ") || "spec 无元素"}`);
  }
}

// —— ⑥ AppHost 导出同步 —— 部署产物（assets_dir）必须与主产物同一份，手改/漏拷贝都会在部署侧放大
{
  const exportPath = path.join(gameRoot, "export", "web", "index.html");
  const mainPath = path.join(gameRoot, "index.html");
  if (!existsSync(exportPath)) fail("缺少 export/web/index.html（apphost.toml assets_dir 指向的目录为空，先 node tools/build.mjs）");
  else if (readFileSync(exportPath).equals(readFileSync(mainPath))) pass("AppHost 导出拷贝与主产物逐字节一致（export/web/index.html ↔ index.html）");
  else fail("AppHost 导出拷贝与主产物不一致（部署侧会伺服旧页面）：重新 node tools/build.mjs，勿手改 export/");
}

// —— ⑦ 移动控件热区（验收口径 B）—— 纯几何机判（零依赖，CI 常驻）：
//   摇杆区/行程/死区、按钮热区 ≥44px（Apple HIG）、布局在视口内钳制 —— 热区只放大不缩小，宁可不命中不可误触。
//   DOM 实测（getBoundingClientRect）由 tools/touchcheck.mjs 的 CDP 关口覆盖，本关管「几何定义本身没被改坏」。
{
  const touchSrc = path.join(gameRoot, "src/render/touch.js");
  if (!existsSync(touchSrc)) fail("缺少 src/render/touch.js（验收口径 B 触屏层）");
  else {
    const m = await import(`file://${touchSrc}`);
    const bad = [];
    // 常量口径：热区下限 44px、开火 64px、摇杆区半屏、死区 ∈ (0,0.5)
    if (m.BUTTON_HOTZONE_MIN !== 44) bad.push(`BUTTON_HOTZONE_MIN=${m.BUTTON_HOTZONE_MIN}（应为 44，Apple HIG）`);
    if ((m.FIRE_BUTTON_SIZE ?? 0) < 44) bad.push(`FIRE_BUTTON_SIZE=${m.FIRE_BUTTON_SIZE} 低于热区下限`);
    if (m.JOYSTICK_ZONE_RATIO !== 0.5) bad.push(`JOYSTICK_ZONE_RATIO=${m.JOYSTICK_ZONE_RATIO}（应为 0.5 左下 1/4 屏）`);
    if (!(m.JOYSTICK_DEADZONE > 0 && m.JOYSTICK_DEADZONE < 0.5)) bad.push(`JOYSTICK_DEADZONE=${m.JOYSTICK_DEADZONE} 越合法域`);
    // 热区命中：闭区间含边界；非有限/零尺寸安全回退 false
    if (!m.inHotZone(0, 0, { x: 0, y: 0, w: 44, h: 44 })) bad.push("inHotZone 边界点未命中（热区应闭区间）");
    if (m.inHotZone(NaN, 0, { x: 0, y: 0, w: 44, h: 44 }) || m.inHotZone(0, 0, null)) bad.push("inHotZone 非有限输入未安全回退");
    // 摇杆向量：死区归零、满行程钳 1、非有限回零（不产 NaN 意图）。屏幕系 y 向下：推上（py<cy）= 前进（y:+1）
    const zero = m.joystickVector(0, 0, 3, 0, 56);
    if (zero.mag !== 0) bad.push("摇杆死区未归零（拇指微颤会漂移）");
    const full = m.joystickVector(0, 0, 0, -560, 56);
    if (Math.abs(full.mag - 1) > 1e-9 || Math.abs(full.y - 1) > 1e-9) bad.push("摇杆满行程未钳 1 或方向错误（推上应前进 y:+1）");
    const nan = m.joystickVector(NaN, 0, 0, 0);
    if (!(nan.mag === 0 && nan.x === 0 && nan.y === 0)) bad.push("摇杆非有限输入未回零向量");
    // 布局钳制：常规视口下热区整体在视口内且 ≥44px；退化视口（短边 < 热区下限）物理上不可能两全，
    // 口径取「热区 ≥44px 优先」，只断言坐标有限、未落到负半轴
    for (const [vw, vh] of [[320, 480], [390, 844], [768, 1024], [1, 1], [Number.NaN, 844]]) {
      const L = m.controlLayout(vw, vh);
      const degenerate = Math.min(L.viewport.w, L.viewport.h) < m.BUTTON_HOTZONE_MIN;
      for (const k of ["fire", "reload", "pause"]) {
        const z = L[k].zone;
        if (z.w < 44 || z.h < 44) { bad.push(`controlLayout(${vw}×${vh}) ${k} 热区 ${z.w}×${z.h} <44px`); continue; }
        if (![z.x, z.y, z.w, z.h].every(Number.isFinite)) { bad.push(`controlLayout(${vw}×${vh}) ${k} 热区坐标非有限`); continue; }
        if (degenerate) {
          if (z.x < -1e-6 || z.y < -1e-6) bad.push(`controlLayout(${vw}×${vh}) ${k} 退化视口热区落负半轴`);
        } else if (z.x + z.w > L.viewport.w + 1e-6 || z.y + z.h > L.viewport.h + 1e-6) {
          bad.push(`controlLayout(${vw}×${vh}) ${k} 热区越出视口`);
        }
      }
      if (!(L.joystick.r > 0)) bad.push(`controlLayout(${vw}×${vh}) 摇杆半径非法`);
    }
    if (bad.length === 0) pass("移动控件热区口径成立（44px 下限 / 摇杆区矩形 / 死区归零 / 满行程钳 1 / 极端视口钳制 5 组）");
    else fail(`移动控件热区口径被改坏：${bad.join("; ")}`);
  }
}

if (failures.length) { console.error("—— QA 审计 FAIL ——"); for (const f of failures) console.error(`  FAIL  ${f}`); process.exit(1); }
console.log("QA-AUDIT: PASS 七道互查关全过");
