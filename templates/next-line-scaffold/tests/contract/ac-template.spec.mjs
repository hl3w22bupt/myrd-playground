// ac-template.spec.mjs — 契约模板（新线脚手架空壳 · 预置件①）
//
// 用法（新线开工时复制改名）：每个 acceptance 条款一份 <ac-id>.spec.mjs，default run()
// 返回 {pass, detail}；断言失败 = assert 抛错（红）。条款 id 与 spec acceptance 段一致，
// 由契约 runner 按 spec 驱动装载（判例承自 g2-blocks contract-check.mjs：spec 有而件缺 = 红）。
import assert from 'node:assert/strict';

export default function run() {
  // 空壳自证：本模板自身真实执行（防「零断言装绿」）
  const checks = [];
  checks.push(['模板可执行', true]);
  for (const [name, ok] of checks) assert.ok(ok, `空壳契约模板断言失败: ${name}`);
  return {
    pass: true,
    detail: `ac-template 空壳模板 PASS（${checks.length} 断言 · 新线开工时复制改名并接入 spec acceptance 段）`,
  };
}
