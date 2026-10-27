// feel-data.ts — GENERATED（tools/gen-feel-pack.mjs · 勿手改；链 v4 numeric.feel/daily 快照）
// 真源: 链 v4 草案 id=cmut5fkyf00cbic7qudea13g6 v4 (draft) · 漂移由 ac-22..28 契约机判
// feel 锚: sha256(sortKeys)=77439768399158228b0739d701cff419da49b99414f0832035eefb50f84e459e

/** 核心手感冻结表（V1.2 六项；取值一律经本件，渲染层零第二份） */
export const FEEL = {
  "combo": {
    "boundaryRule": "same-as-sfx",
    "tiers": [
      {
        "maxChain": 1,
        "minChain": 1,
        "tier": 1,
        "visual": "count"
      },
      {
        "maxChain": 3,
        "minChain": 2,
        "tier": 2,
        "visual": "emphasize"
      },
      {
        "maxChain": null,
        "minChain": 4,
        "tier": 3,
        "visual": "blaze"
      }
    ]
  },
  "hardDrop": {
    "amplitudeCellRatio": 0.02,
    "curve": "damped-sine",
    "decayTauMs": 60,
    "durationMs": 180,
    "frames": 12,
    "oscillationHz": 13,
    "thresholdCells": 4,
    "trigger": "settle-frame"
  },
  "landSquash": {
    "durationMs": 120,
    "easing": "ease-out-quad",
    "frames": 8,
    "scaleX": 1.12,
    "scaleY": 0.84,
    "trigger": "gravity-land-frame"
  },
  "logicFps": 62.5,
  "note": "核心手感 6 项冻结表（链 v4 校准）。「帧」=逻辑帧（=1000/FIXED_STEP_MS）；即时性阈值只约束契约层（T3 注入时钟），真机不做帧级断言；观感/听感不进契约（美术校样 F-01..F-07 + 人工 rubric）。",
  "particles": {
    "frames": 27,
    "gravityCellPerS2": 22,
    "lifeMs": 420,
    "overflowPolicy": "drop-new",
    "perClearBase": 8,
    "perExtraBlock": 2,
    "poolSize": 120,
    "sameScreenHardCap": 120,
    "speedCellPerS": 6
  },
  "restart": {
    "budgetMs": 500,
    "deviceLayer": "v1.1-same-machine-same-conditions-multi-run-median",
    "entry": "button+keyboard-same-source",
    "scope": "contract-layer-injected-clock",
    "transitionFrames": 9
  },
  "sfx": {
    "resourceModel": "three-independent-voices+var-param",
    "tierBoundaries": [
      {
        "maxChain": 1,
        "minChain": 1,
        "tier": 1
      },
      {
        "maxChain": 3,
        "minChain": 2,
        "tier": 2
      },
      {
        "maxChain": null,
        "minChain": 4,
        "tier": 3
      }
    ],
    "trigger": "same-logic-frame-as-clear"
  }
}         ;

/** daily-challenge 最小闭环冻结表 */
export const DAILY = {
  "entryHook": "hud-entry+badge",
  "note": "daily-challenge 最小闭环（链 v4）：种子 = 本地时区日期码（seedBasis 口径）纯函数派生（src/kernel/datetime.ts dailySeed）；进度跨本地零点重置；streak 窗口 = streakTrack。时钟倒拨语义（backdatePolicy）属主人裁决项，本版不声明（A 轮升级条款 Q1 维持挂账）。",
  "resetPolicy": "local-midnight",
  "seedBasis": "YYYYMMDD",
  "storageKey": "daily",
  "streakTrack": 30,
  "timezone": "local"
}         ;

/** 生成件锚（漂移守卫比对面） */
export const FEEL_ANCHOR_SHA256 = '77439768399158228b0739d701cff419da49b99414f0832035eefb50f84e459e';

/** 生成来源（双基线披露：approved 契约输入 = spec-data v1.1；本件 = 链 v4 draft 面） */
export const FEEL_SOURCE = { id: 'cmut5fkyf00cbic7qudea13g6', version: 4, status: 'draft', numericAnchor: '1720df8ec6ac0d00b7cad6725892b80e368019d72941fc0063643ea9d7d0eb5c' }         ;



//# sourceURL=generated/feel-data.ts