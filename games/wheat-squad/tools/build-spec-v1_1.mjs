#!/usr/bin/env node
// build-spec-v1_1.mjs — spec v1.1 单点修订：e-settlement 符号锚修正
// 根因：v1.0 将 e-settlement 锚声明为 settlement.ts#settlementFacts，实符 settlementFacts 由 sim.ts 导出，
//       settlement.ts 的对外导出面 = buildSettlement（契约门禁 #符号锚机判暴露——反馈接入协议预演：
//       自查发现 → revision 标 diff → 旧版 superseded → 程序/契约按 approved 对齐）。
// 输入：.myrd/spec/wheat-squad/design-spec.json（approved v1.0 导出件）
// 输出：.myrd/spec/wheat-squad/design-spec-v1_1-payload.json
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, "../../../.myrd/spec/wheat-squad/design-spec.json"), "utf8"));
const spec = JSON.parse(JSON.stringify(base.spec ?? base));
spec.meta.version = "1.1";
const OLD = "games/wheat-squad/src/settlement.ts#settlementFacts";
const NEW = "games/wheat-squad/src/settlement.ts#buildSettlement";
const e = spec.entities.find((x) => x.id === "e-settlement");
if (!e || e.script !== OLD) { console.error(`前置不符：e-settlement.script = ${e?.script}（期望 ${OLD}）`); process.exit(1); }
e.script = NEW;
spec.meta.revision_note =
  "v1.1（2026-10-12 · 单点修订）：e-settlement 符号锚修正 settlement.ts#settlementFacts → #buildSettlement" +
  "（v1.0 锚点笔误——settlementFacts 实由 sim.ts 导出，settlement.ts 对外面 = buildSettlement；统一契约门禁 #符号锚机判暴露，零数值/条款面改动）。" +
  "本修订即 meta.feedbackProtocol 的首次实际执行：自查发现 → revision 标 diff → 链上旧版 superseded → 契约与程序按 approved 对齐。";
writeFileSync(join(here, "../../../.myrd/spec/wheat-squad/design-spec-v1_1-payload.json"), JSON.stringify({ spec }, null, 2) + "\n");
console.log(`v1.1 payload ok：e-settlement → ${NEW}`);
