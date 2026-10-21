#!/usr/bin/env node
// build-spec-v1_3.mjs — spec v1.3 单点修订：assets 登记集闭合（B 案裁决）
// 根因：ac-art-2 statement「清单外未登记资产 = 违例」vs 机判窄面（仅 entity 类）口径二义——
//       主策划裁决 B 案（signoff-r1-ambiguity-review.md）：statement 字面零改动，spec.assets
//       补登 4 件既有件（ui-kit-01/sub-icon/sub-sharecard-5x4/sub-shots-3）+ R1 美术特效批
//       3 件（fx-kill-burst/fx-hit-shock/fx-hud-channels，feedbackChannels 绑 A4 视觉通道）。
//       ac-11 同步扩严为逐件对账登记集（entities∪assets）——检测规则加强，零数值/条款面改动。
// 输入：.myrd/spec/wheat-squad/design-spec.json（approved v1.2 导出件，--expect-version 4）
// 输出：.myrd/spec/wheat-squad/design-spec-v1_3-payload.json
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, "../../../.myrd/spec/wheat-squad/design-spec.json"), "utf8"));
const spec = JSON.parse(JSON.stringify(base.spec ?? base));

// —— 前置锚：必须基于 approved v1.2 导出件 ——
if (spec.meta.version !== "1.2") {
  console.error(`前置不符：导出件 meta.version = ${spec.meta.version}（期望 1.2）`);
  process.exit(1);
}

// —— 零触碰守卫准备：快照五段 ——
const FROZEN = ["numeric", "entities", "levels", "world", "acceptance"];
const before = Object.fromEntries(FROZEN.map((k) => [k, JSON.stringify(spec[k])]));

// —— assets 增量（7 件，逐件如实）——
const ADD = [
  {
    id: "ui-kit-01", kind: "procedural-draw-spec",
    file: "games/wheat-squad/src/render/renderer.ts#drawHud",
    source: "games/wheat-squad/assets/manifest.json#ui-kit-01",
    license: "team-original",
    note: "B 案补登（既有件追溯登记）：UI 套件 1 件套（HUD 带/三选一卡/结算面板/按钮态），tokenSource=theme.ts",
  },
  {
    id: "sub-icon", kind: "placeholder-template",
    file: "games/wheat-squad/qa/submission/sub-icon.template.svg",
    source: "games/wheat-squad/assets/manifest.json#sub-icon",
    license: "team-original",
    note: "B 案补登（既有件追溯登记）：提审图标占位模板 512×512，正式件止步清单归主人拍板",
  },
  {
    id: "sub-sharecard-5x4", kind: "placeholder-template",
    file: "games/wheat-squad/qa/submission/sub-sharecard-5x4.template.svg",
    source: "games/wheat-squad/assets/manifest.json#sub-sharecard-5x4",
    license: "team-original",
    note: "B 案补登（既有件追溯登记）：分享卡占位模板 1000×800 (5:4)",
  },
  {
    id: "sub-shots-3", kind: "placeholder-template",
    file: "games/wheat-squad/qa/submission/sub-shots-3.template.svg",
    source: "games/wheat-squad/assets/manifest.json#sub-shots-3",
    license: "team-original",
    note: "B 案补登（既有件追溯登记）：截图三连占位模板 3×1170×2080",
  },
  {
    id: "fx-kill-burst", kind: "procedural-draw-spec",
    file: "games/wheat-squad/src/render/renderer.ts#drawEffects",
    source: "games/wheat-squad/assets/manifest.json#fx-kill-burst",
    license: "team-original",
    note: "R1 美术特效批：击杀复合反馈（feedbackChannels=flash/particles/pickup-spawn · OP-02/03）——accentRed 扩散环 hitFlashMs(90ms) + wheatGold 粒子/拾取，色值 ⊆ palette",
  },
  {
    id: "fx-hit-shock", kind: "procedural-draw-spec",
    file: "games/wheat-squad/src/render/renderer.ts#drawEffects",
    source: "games/wheat-squad/assets/manifest.json#fx-hit-shock",
    license: "team-original",
    note: "R1 美术特效批：受击复合反馈（feedbackChannels=flash-invuln/knockback · OP-05）——外圈呼吸（无敌帧 0.8s 窗口）+ 击退位移载体=实体重绘",
  },
  {
    id: "fx-hud-channels", kind: "procedural-draw-spec",
    file: "games/wheat-squad/src/render/renderer.ts#drawHud",
    source: "games/wheat-squad/assets/manifest.json#fx-hud-channels",
    license: "team-original",
    note: "R1 美术特效批：HUD 行内提示（feedbackChannels=hud-kills/hud-hp · OP-02/05）——HP 点 accentRed r5×5 + 击杀计数 inkBrown",
  },
];
const existingIds = new Set(spec.assets.map((a) => a.id));
for (const a of ADD) {
  if (existingIds.has(a.id)) { console.error(`增量冲突：${a.id} 已在 spec.assets`); process.exit(1); }
  spec.assets.push(a);
}

// —— 版本与修订说明 ——
spec.meta.version = "1.3";
spec.meta.revision_note =
  "v1.3（2026-10-14 · R1 打磨轮单点修订）：assets 登记集闭合（B 案裁决）。" +
  "①补登 4 件既有件（ui-kit-01/sub-icon/sub-sharecard-5x4/sub-shots-3）——消除 ac-art-2 " +
  "「清单外未登记资产 = 违例」statement 字面与机判窄面的判定口径二义（QA 驳回③升级项，" +
  "主策划裁决见 signoff-r1-ambiguity-review.md：B 案登记进单源，statement 字面零改动）；" +
  "②R1 美术特效批 3 件入册（fx-kill-burst/fx-hit-shock/fx-hud-channels，feedbackChannels 绑 A4 视觉通道，" +
  "任务书「视觉通道绑资产 id 供 check 复算」）；manifest 同步 v3（13 件 = 封顶）。" +
  "零改动段：numeric（逐字节冻结）/acceptance 16 条 statement/world/entities/levels；" +
  "ac-11 扩严为逐件对账登记集（检测规则加强，非放宽）。";

// —— 零触碰守卫：五段逐字节不变 ——
for (const k of FROZEN) {
  if (JSON.stringify(spec[k]) !== before[k]) {
    console.error(`零触碰守卫违例：${k} 段被改动（本修订仅允许 assets + meta.version/revision_note）`);
    process.exit(1);
  }
}
if (JSON.stringify(base.spec.numeric) !== JSON.stringify(spec.numeric)) {
  console.error("numeric 逐字节冻结违例");
  process.exit(1);
}

writeFileSync(
  join(here, "../../../.myrd/spec/wheat-squad/design-spec-v1_3-payload.json"),
  JSON.stringify({ spec }, null, 2) + "\n"
);
console.log(`v1.3 payload ok：assets ${base.spec.assets.length}→${spec.assets.length} 件（+7），五段零触碰守卫 PASS`);
