// ux-data.ts — GENERATED（tools/gen-ux-data.mjs · 勿手改；链 v8 改版后重跑）
// 真源: 平台 GameDesignSpec 导出件 id=cmv0aoxtt004gm9vigjmn09bh v8 (draft) @ /Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmv09tbrg003vm9vijx5bdv8j/.myrd/spec/g2-blocks/design-spec-v13-batch-draft.json
// numeric 锚(链 v8 全量): sha256(sortKeys)=6719edd27d7e121ac90be2ddca4b8ab127fdda269532bf4693c6afd805e9a739
// UX 组锚(nearMiss+settlement): sha256(sortKeys)=ce456278720700c1a45708c09b370c14b0fa7dc58819a2c403aaa7c494617c46

/** 链 v8 UX 冻结面（near-miss 反馈 + 结算页 IA；生成时快照；漂移由 ac-31/32 契约件机判） */
export const NUMERIC_UX = {
  "nearMiss": {
    "note": "near-miss 反馈冻结面（链 v8 定死）。数值承自链 v7 numeric.uxProposal 提案值零调参平移；判定口径三要素（行列同权 / 末态计数 / 弱反馈频控）为本版修补①落点。触发面 = 局中每手「消除结算后同逻辑帧末态」+ 炉冷结算两时点；零粒子、不震屏为硬约束。",
    "predicate": {
      "axisParity": "row-col-equal",
      "axisParityNote": "行列同权：行方向与列方向的「一步可成消」候选同等参与候选行归并（不分行列加权、不因候选来自列方向而降权）；候选行 = 候选交换两格所在行 y 的并集。",
      "chainDelta": 1,
      "fillCountBasis": "post-clear-same-frame-endstate",
      "fillCountBasisNote": "填充计数取消除结算后同逻辑帧末态：候选检索与「无可消除」判定一律取本手消除结算 + 重力补手完成后的同逻辑帧末态棋盘，禁取中级联/动画中间态。",
      "minChain": 2,
      "movesDelta": 1,
      "settlementRules": "炉冷结算三择一：P1 连击差一（runMaxChain = chainTarget − chainDelta 且 < chainTarget）/ P2 首消差一步（firstClearAt − firstClearWithinMoves ∈ [1..movesDelta]）/ P3 剩手惜败（handsLeft ≤ 1 且 runMaxChain ≥ minChain）；命中序 P1→P2→P3 取首中。",
      "sources": {
        "chainTarget": "levels[].goal.chainTarget（game.goals() 现读，null 则 P1 不评估）",
        "firstClearWithinMoves": "levels[].goal.firstClearWithinMoves（game.goals() 现读，null 则 P2 不评估）",
        "handsLeft": "game.movesLeft()",
        "oneAwayScan": "kernel/deadlock probeSwapCreatesMatch 现成探针原语复用（只读，禁改内核）",
        "runMaxChain": "当局 combo chain 峰值（表现层只读累计，零内核改动）"
      },
      "tieBreak": "cell-index-asc"
    },
    "sfx": {
      "durationScale": 0.5,
      "note": "near-miss = 三档音效第二档变体（用途表见 e-sfx-usage）；听感归人工 rubric，契约只测「变体参数查表 + 与命中同帧发起」（ac-25 语义沿用）。",
      "tail": "descending",
      "tier": 2
    },
    "strongFeedback": {
      "inVersion": false,
      "reservedProposal": {
        "capPer5s": 3,
        "note": "预留提案：本版无实现、无验收、无通道（修补②落点）"
      }
    },
    "telemetry": {
      "onCap": "nm_capped",
      "onTrigger": "nm_triggered"
    },
    "trigger": [
      "per-move-settle-endstate",
      "cool-settlement"
    ],
    "weakFeedback": {
      "bannerHoldMs": 2400,
      "capBasis": "展示计数（超限命中只记遥测 nm_capped，不展示不排程）",
      "edgeHighlight": "transient-not-latched",
      "globalPerRun": 3,
      "particles": "none",
      "perRowPerRun": 1,
      "pulseMs": 600,
      "screenShake": "none"
    }
  },
  "settlement": {
    "enterAnimMs": 240,
    "inputSeal": "cooled-existing",
    "measureBasis": {
      "deviceTier": "lowest-tier-baseline",
      "note": "冷/热启动与机型档口径细则在 ac-32.measurement（acceptance 文本），本组只冻结触达与时序数值。"
    },
    "note": "结算页信息架构冻结面（链 v8 定死）。数值承自链 v7 numeric.uxProposal.settlement 提案值零调参平移；三层 IA = 结果层 → 归因层 → 行动层；出现期间玩法输入维持 cooled 既有封印（零输入语义改动）。",
    "showDelayMs": 400,
    "slotOrder": [
      "P0-result",
      "P1-result",
      "P2-result",
      "P3-attribution-action"
    ],
    "touchTargetMinPx": 48,
    "touchTargetNote": "触达高度 ≥48dp（css px @1x 基准换算；最低机型档为测量基准，见 ac-32.measurement）。"
  }
}         ;

/** 生成时 UX 组锚（供漂移守卫比对） */
export const ANCHOR_UX = 'ce456278720700c1a45708c09b370c14b0fa7dc58819a2c403aaa7c494617c46';

/** 链 v8 读取口（运行时统一走本件；approved 基座 numeric() 仍由 spec-data.ts 单源） */
export function numericUx()                    {
  return NUMERIC_UX;
}


//# sourceURL=generated/ux-data.ts