// src-sha.mjs — 产物源指纹的唯一算法（tools/build.mjs 写入 SRC_SHA，tests/qa-audit.mjs ④ 复算比对）。
// 指纹范围 = 「实际决定产物内容」的全部输入，不止 src/（驳回点③）：
//   src/                    游戏源码（esbuild 入口及其依赖）
//   assets/                 资产登记层（a01-textures / a02-geometry / a03-sfx / palette / index，被 src 内联引用）
//   index.template.html     产物模板（CSS 风格卡 + DOM 骨架）
//   tools/build.mjs         构建器本身（打包方式决定产物）
//   tools/src-sha.mjs       本文件（算法定义）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const FINGERPRINT_PATHS = ["src", "assets", "index.template.html", "tools/build.mjs", "tools/src-sha.mjs"];

/** 递归收集 gameRoot 下 FINGERPRINT_PATHS 的全部文件，按相对路径排序后 sha256，取 16 位hex。 */
export function productSourceSha(gameRoot) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  for (const rel of FINGERPRINT_PATHS) {
    const full = path.join(gameRoot, rel);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
  const h = createHash("sha256");
  for (const f of files.sort()) {
    h.update(path.relative(gameRoot, f).replaceAll("\\", "/"));
    h.update("\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}
