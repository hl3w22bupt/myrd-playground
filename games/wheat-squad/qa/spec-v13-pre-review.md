# QA 只读预审 — spec v1.3 draft（链 v5 `cmv7hekf3000mjofivl4ebhdf`）

> 预审人：游戏 QA（主策划工作室代行节点，产物独立落盘）· 日期：2026-10-14
> **声明：依据 draft 预审，未拍板——本预审不构成 approve，不作为契约依据（契约输入仍以 approved 版为准）**
> 基线：链 v4 approved（meta v1.2，已随入链置 superseded——预期态，中间窗口无 approved 属平台版本链语义）

## 一、修订面机判（draft v5 ↔ approved v4 逐段对账，API 实查）

| 段 | 核对 | 结果 |
|---|---|---|
| numeric / entities / levels / world / acceptance | 深等（逐段 JSON.stringify 全等） | **EQUAL ×5** ✓ |
| assets | 2→9 件；增量 = ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3（B 案补登）+ fx-kill-burst / fx-hit-shock / fx-hud-channels（特效批）；既有 2 件逐字节零改动 | **EQUAL + 7 增量** ✓ |
| meta | version 1.2→1.3 + revision_note（diff 摘要在案） | ✓ |
| schema | 每件 assets 元素 kind/file/source/license 全齐（probe 判例必填集） | ✓ |
| 版本链 | v5 draft `cmv7hekf3000mjofivl4ebhdf` · parent=v4 · v4 状态回查 = superseded（平台语义，非事故） | ✓ |

## 二、裁决依据核对（本轮为何修订）

- 二义事实：ac-art-2 statement「清单外未登记资产 = 违例」全量字面 vs 机判窄面（仅 entity 类）——QA 驳回③升级项，主策划 2026-10-14 裁决 **B 案**（`signoff-r1-ambiguity-review.md`）：statement 字面零改动 + spec.assets 补登 + ac-11 扩严逐件对账。
- **红线核对**：零数值改动（numeric 冻结）· 零判据阈值改动（acceptance 16 条 statement 字面零变化）· 零好玩判据放宽 ✓——符合「实测不达只打回实现、不放宽好玩判据阈值」。
- 特效批依据：任务书美术轨「视觉通道绑资产 id 供 check 复算」——fx 三件 feedbackChannels 覆盖实现面通道全集，ac-05 面4 机判绿（`通道 flash/particles/pickup-spawn/hud-kills 全绑 fx 件`，EXIT=0 实跑）。

## 三、先红后绿链路核对（契约先行判例）

1. manifest v3（+3 fx 件）落盘 → ac-11 扩严面4 → **RED-EXIT=1**（`清单件「ui-kit-01」未登记（既非 spec entities 亦非 spec.assets）`——对 v1.2 口径红，预期正确）
2. v1.3 入链 + approve 后：登记集闭合 → ac-11 面4 转绿（预期）
3. 顺序契约：**approve 前不部署**（v1.2 预审同款窗口纪律）

## 四、预审结论

**APPROVE-READY**（附两项披露）：① 链上中间窗口无 approved（v4 superseded → v5 draft），契约输入以 approve 后回查实况为准；② fx 复合绑定 = 3 件覆盖 6 通道（封顶 13 约束下的设计取舍，style-card §R1.2 在档）。approve 后立即重导出（--expect-version 5）+ 门禁适配视图再生成 + verify.sh 全量复跑。
