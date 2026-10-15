#!/usr/bin/env node
// export-approved-spec.mjs — 从平台策划案链导出指定版本到「一游戏一文件」导出件
//
// 用法：
//   PLATFORM_API_URL=… MYRD_TOKEN=… \
//   node tools/export-approved-spec.mjs --chain <chainOrSpecId> --out .myrd/spec/wheat-squad/design-spec.json [--expect-version N]
//
// 行为：
//   1. GET /api/v1/game-design-specs/<id>（Bearer + token cookie，凭据只从环境读，不落盘）
//   2. 校验 status === "approved"（红线：契约测试与实现只认 approved；--expect-version 可选锚版本）
//   3. 写出 { schemaVersion, spec, _platform } 三键导出件（与 N4 判例同形）
// 退出码：0 成功；1 参数/网络/状态校验失败（不吞错不降级）
const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const chainId = argOf("--chain");
const outPath = argOf("--out");
const expectVersion = argOf("--expect-version");
if (!chainId || !outPath) {
  console.error("用法: node tools/export-approved-spec.mjs --chain <id> --out <path> [--expect-version N]");
  process.exit(1);
}
const base = process.env.PLATFORM_API_URL;
const token = process.env.MYRD_TOKEN;
if (!base || !token) {
  console.error("缺少 PLATFORM_API_URL / MYRD_TOKEN 环境变量（凭据不入库，仅运行期读取）");
  process.exit(1);
}
const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/game-design-specs/${chainId}`, {
  headers: { Authorization: `Bearer ${token}`, Cookie: `token=${token}` },
});
if (!res.ok) {
  console.error(`GET spec 失败: HTTP ${res.status}`);
  process.exit(1);
}
const payload = await res.json();
const rec = payload?.data?.spec;
if (!rec?.spec) {
  console.error("响应形状异常：缺少 data.spec.spec 六段");
  process.exit(1);
}
if (rec.status !== "approved") {
  console.error(`SPEC_NOT_APPROVED — 链上 status=${rec.status}（version ${rec.version}）；契约与实现只认 approved`);
  process.exit(1);
}
if (expectVersion && String(rec.version) !== String(expectVersion)) {
  console.error(`版本锚不符：链上 version=${rec.version}，期望 ${expectVersion}`);
  process.exit(1);
}
const exported = {
  schemaVersion: rec.schemaVersion ?? "v0",
  spec: rec.spec,
  _platform: {
    id: rec.id,
    version: rec.version,
    status: rec.status,
    parentSpecId: rec.parentSpecId ?? null,
    projectId: rec.projectId,
    title: rec.title,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  },
};
const { writeFileSync, mkdirSync } = await import("node:fs");
const { dirname } = await import("node:path");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(exported, null, 2) + "\n");
console.log(`EXPORTED ${rec.title} v${rec.version} (${rec.status}) -> ${outPath}`);
console.log(`_platform.updatedAt=${rec.updatedAt}`);
