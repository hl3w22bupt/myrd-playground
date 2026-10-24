// spec-data.ts — GENERATED（tools/gen-spec-data.mjs · 勿手改；spec 改版后 npm run gen 重跑）
// 真源: 平台 GameDesignSpec 导出件 id=cmv1q9k690045m94obp29ysre v9 (approved)
// numeric 锚: sha256(sortKeys)=6719edd27d7e121ac90be2ddca4b8ab127fdda269532bf4693c6afd805e9a739

/** spec numeric 冻结块（生成时快照；漂移由契约测试机判） */
export const NUMERIC = {
  "DEFAULT_SEED": 20261001,
  "FIXED_STEP_MS": 16,
  "MAX_DT_MS": 250,
  "blockTypes": 7,
  "combo": {
    "appliesFromChain": 2,
    "chainBonus": 50,
    "fourMoveVector": "消/消/不消/消 → +0/+50/归0/+0",
    "resetOnNonClear": true
  },
  "daily": {
    "entryHook": "hud-entry+badge",
    "note": "daily-challenge 最小闭环（链 v4）：种子 = 本地时区日期码（seedBasis 口径）纯函数派生（src/kernel/datetime.ts dailySeed）；进度跨本地零点重置；streak 窗口 = streakTrack。时钟倒拨语义（backdatePolicy）属主人裁决项，本版不声明（A 轮升级条款 Q1 维持挂账）。",
    "resetPolicy": "local-midnight",
    "seedBasis": "YYYYMMDD",
    "storageKey": "daily",
    "streakTrack": 30,
    "timezone": "local"
  },
  "deadlock": {
    "algorithm": "exhaustive_swap_probe",
    "anyTrueMeansCool": true,
    "checkAfterRefill": true,
    "checkAfterSettle": true,
    "directionsMax": 4,
    "statement": "落定结算后+补手后各判一次，任一为真即炉冷；64格×7块×≤4向全穷举"
  },
  "feel": {
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
  },
  "grid": {
    "cells": 64,
    "cols": 8,
    "rows": 8
  },
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
  "palette": {
    "calibration": {
      "from": "block-01/03/04/05 六对（已冻结集）",
      "rule": "floor(minΔE/5)*5"
    },
    "colors": [
      {
        "frozen": true,
        "hex": "#21458C",
        "hsl": [
          220,
          0.62,
          0.34
        ],
        "id": "block-01",
        "name": "深海蓝"
      },
      {
        "frozen": true,
        "hex": "#38B279",
        "hsl": [
          152,
          0.52,
          0.46
        ],
        "id": "block-03",
        "name": "翡翠绿"
      },
      {
        "frozen": true,
        "hex": "#DB6B43",
        "hsl": [
          16,
          0.68,
          0.56
        ],
        "id": "block-04",
        "name": "赤陶红"
      },
      {
        "frozen": true,
        "hex": "#A472CA",
        "hsl": [
          274,
          0.45,
          0.62
        ],
        "id": "block-05",
        "name": "紫水晶"
      },
      {
        "frozen": true,
        "hex": "#C89C19",
        "hsl": [
          45,
          0.78,
          0.44
        ],
        "id": "block-02",
        "name": "余烬金"
      },
      {
        "frozen": false,
        "hex": "#4B2B25",
        "hsl": [
          10,
          0.34,
          0.22
        ],
        "id": "block-06",
        "name": "深余烬褐"
      },
      {
        "frozen": false,
        "hex": "#E3B5BF",
        "hsl": [
          346,
          0.46,
          0.8
        ],
        "id": "block-07",
        "name": "绯玫瑰"
      }
    ],
    "gate": {
      "hueDeg": 25,
      "lightness": 0.1,
      "minPassed": 2,
      "saturation": 0.08
    },
    "rejectedHex": "#FFC94A",
    "sourceArtifact": "g2-blocks/assets/palette/palette-n1-final.json",
    "sourceSha256": "7bc2ca033ee8d7f7a20e63810b174e8cbdabcb92560a0db8dc72a10d553cd2ff",
    "thresholdDeltaE": 25
  },
  "perf": {
    "j1": {
      "budgetMs": 400,
      "device": {
        "browser": "playwright chromium",
        "cpuThrottleX": 4,
        "viewportPx": "390x844"
      },
      "doneMark": "j1_feedback_done",
      "startMark": "j1_settle_start",
      "statement": "J1 = 一次消除从落定结算开始（j1_settle_start）到该次反馈完成（j1_feedback_done）的墙钟时长；双端（Web 端与后续移植端）perf 标记名逐字统一为 j1_settle_start / j1_feedback_done，预算 400ms @ 4x CPU throttle + 390x844"
    }
  },
  "platform": {
    "dy": {
      "bundleLimitBytes": 4194304,
      "interactionBudgetMs": 400,
      "shareCard": {
        "height": 1280,
        "width": 720
      },
      "smokeFrames": 240,
      "storeScreenshotMinCount": 3
    }
  },
  "rng": {
    "algorithm": "mulberry32",
    "forbidDateNow": true,
    "forbidMathRandom": true,
    "testHook": "seededRng"
  },
  "scoring": {
    "baseClear3": 30,
    "note": "基础分与超出块加成为策划基线值；连击加成见 combo（AC-06 只裁决连击加成向量）",
    "perExtraBlock": 10
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
  },
  "spawn": {
    "orientation": "uniform_random"
  },
  "uxProposal": {
    "note": "提案态（链 v8 收缩）：nearMiss / settlement 两组已随 v1.3 首批实现轮转正式（numeric.nearMiss / numeric.settlement，承值零调参平移）；本提案面仅保留强反馈预留提案（修补②）——capPer5s=3 仅供后续版本提案评审，本版无实现无验收。",
    "status": "proposal",
    "strongFeedback": {
      "capPer5s": 3
    }
  }
}         ;

/** spec levels 段（关卡元素/目标文本，goal 正则解析在 game.ts） */
export const LEVELS = [
  {
    "elements": [
      {
        "expect": "8×8=64 格棋盘按 DEFAULT_SEED 初始化，两局逐字节一致",
        "id": "level-1/el-board",
        "kind": "board"
      },
      {
        "expect": "spawn.orientation: \"uniform_random\"，7 类型等概率；seeded RNG 测试钩子可注入固定 seed",
        "id": "level-1/el-spawn",
        "kind": "spawn"
      },
      {
        "expect": "首局教学提示条：开局后高亮一对可成三消的相邻交换，玩家完成首次三消或 3 手后不再出现",
        "id": "level-1/el-hint",
        "kind": "hint",
        "reason": "level-1 是教学局：在无外部文案、零贴图的极简几何前提下，必须有一个 UI 元素承担「怎么走」的教学职责，否则首局目标（3 步内首次三消）无引导路径，首局流失风险不可控；该元素只在 level-1 出现，level-2+ 不出现（难度曲线不因教学元素失真）。"
      },
      {
        "expect": "落定结算后+补手后各判一次，任一为真即炉冷",
        "id": "level-1/el-deadlock",
        "kind": "deadlock"
      }
    ],
    "goal": "3 步内完成首次三消；理解连击与炉冷两个概念",
    "id": "level-1",
    "name": "首炉（教学局）"
  },
  {
    "elements": [
      {
        "expect": "同 level-1 棋盘规则；无教学提示（el-hint 仅 level-1）",
        "id": "level-2/el-board",
        "kind": "board"
      },
      {
        "expect": "四手向量 消/消/不消/消 → +0/+50/归0/+0 机械可判",
        "id": "level-2/el-combo",
        "kind": "combo"
      },
      {
        "expect": "64格×7块×≤4向全穷举",
        "id": "level-2/el-deadlock",
        "kind": "deadlock"
      }
    ],
    "goal": "在 20 手内打出 ≥3 连击并存活到炉冷",
    "id": "level-2",
    "name": "升温局"
  }
];

/** spec content 段（levelCount / sessionSeconds / replayHooks；missions 不激活） */
export const CONTENT = {
  "dailyChallenge": {
    "deferred": [
      "cloud-sync",
      "rewards",
      "leaderboard",
      "backdate-policy"
    ],
    "id": "daily-challenge-min-loop",
    "inScope": [
      "seed-derive",
      "daily-progress",
      "streak-window",
      "hud-entry-badge"
    ],
    "reproduciblePath": "G2_SPEC_PATH=<链 v4 导出件> node scripts/contract-check.mjs --only ac-28-daily-hook-min-loop；真机入口人工复核走 docs/assembly-entry.md 只读入口",
    "scope": "minimal-loop"
  },
  "levelCount": 2,
  "note": "missions 不激活（任务书红线）；scope_gate 挂起，留存评估顺延至 ≥7 天真实样本，由主策划发起。",
  "platform": {
    "items": [
      {
        "acceptance": [
          "wr-acc-1 五件落点在盘（src/platform/wx/wx-env|runtime|adapter|boot-wx.ts + tests/wx/wx-runtime.spec.mjs），Node 侧条目查全绿；被测件缺位 = RED 不装绿。",
          "wr-acc-2 开发者工具验证 runbook 内嵌如下三节原文（N1 补丁①）：\n      - 步骤：① 安装微信开发者工具（稳定版）并在 设置→安全设置 开启服务端口；② 导入项目 = export/wx/，AppID=主人下发的正式号（未下发前 touristappid 仅限工具内预览）；③ 机跑 node tools/verify-wx-devtools.mjs（内部 cli preview --project export/wx）；④ 真机扫码完成首启 60 秒实点与分享/静音/重开四项手测。\n      - 预期输出：③ 成功时 CLI 输出 preview 成功并给出二维码路径（脚本归档原文）；工具内编译面板 0 error；真机首启炉板 64 格满员渲染、无白屏、无报错弹层。\n      - 判定标准：G1 编译零 error；G2 首启 ≤60 秒内完成首次交换（真人实点记录秒数）；G3 会话分享卡片实收且为 5:4 分享卡；G4 静音开关生效且重开复位。任一不过 = reject（逐条指到文件与 spec 条目）；CLI 缺席 = BLOCKED-ENV（exit 2）显式披露，不装绿。",
          "wr-acc-3 复用门面零重抄：storage 走 src/platform/storage.ts 门面、音频走 src/platform/audio.ts 门面（静音态仍走 muted 键）、时钟走 src/platform/clock.ts（可注入）；wx 三件（runtime/share/wx-env）+ adapter/boot 零 Math.random/Date.now 直调字面。",
          "wr-acc-4 分享卡资产绑定 5:4（500×400）——本条目不产图，复用既有 assets/release/ wx 分享卡（A-06，美术复核 PASS 在档）。"
        ],
        "check": "node tests/wx/wx-runtime.spec.mjs",
        "files": [
          "src/platform/wx/wx-env.ts",
          "src/platform/wx/runtime.ts",
          "src/platform/wx/adapter.ts",
          "src/platform/wx/boot-wx.ts",
          "tests/wx/wx-runtime.spec.mjs",
          "tools/verify-wx-devtools.mjs"
        ],
        "id": "wx-runtime",
        "kind": "platform-runtime",
        "maturity": "final",
        "platform": "wx",
        "summary": "微信小游戏容器适配：容器判定 / 存储（复用 T1 storage 门面）/ 音频（复用 T1 audio 门面，合成器可注入、缺失静默跳过）/ 时钟（复用 T3 可注入时钟 + 时区纯函数）/ onShow·onHide 生命周期接线。内核零改动、零 import（玩法/数值/视觉零 diff）。"
      },
      {
        "acceptance": [
          "ws-acc-1 主判据：shareNow 调 wx.shareAppMessage 且绑定 5:4（500×400）分享卡（复用 A-06 件，sha256 随件登记 manifest）；载荷 query 含 sid= 且 sid 形如短随机 token（^[A-Za-z0-9-]{1,32}$，零 PII）。",
          "ws-acc-2 分享入口纯跳转：share.ts 静态 import 面不含 kernel/game/generated/numeric（零数值回调）；分享成功/失败不读写任何玩法状态。",
          "ws-acc-3 降级两路：无 wx 容器 → {ok:false, reason:\"no-wx-container\"}；通道抛错 → {ok:false, reason:\"share-failed\"}；两路均不抛错、入口保留。",
          "ws-acc-4 被动通道：installPassive 注册 wx.onShareAppMessage + wx.showShareMenu，回参同卡同参（title/imageUrl 一致）。"
        ],
        "assets": [
          {
            "file": "assets/release/（A-06 既有件，实现组包时以 manifest 登记实际文件名与 sha256）",
            "id": "wx-share-card",
            "optional": false,
            "size": "500x400"
          }
        ],
        "check": "node tests/wx/wx-share.spec.mjs",
        "files": [
          "src/platform/wx/share.ts",
          "tests/wx/wx-share.spec.mjs"
        ],
        "id": "wx-share-loop",
        "kind": "platform-share",
        "maturity": "final",
        "platform": "wx",
        "summary": "会话分享闭环：主动 shareNow（wx.shareAppMessage）+ 被动 installPassive（onShareAppMessage + showShareMenu）；配图绑 500×400（5:4）分享卡；载荷 query sid=（零 PII）；不可用/失败两路静默降级保留入口；分享入口纯跳转，无数值回调、零内核 import。"
      },
      {
        "acceptance": [
          "wk-acc-1 组包器断言三件套：export/wx/ 含 game.json（deviceOrientation 合法）+ project.config.json（compileType=game，appid 占位 touristappid）+ 载面零 sw.js/manifest.webmanifest/index.html。",
          "wk-acc-2 主包红线：export/wx/ 逐件实测字节求和 ≤ 4MB（4*1024*1024 机判，非估算）；超线即 reject。",
          "wk-acc-3 隐私弹窗触发时机（定死，非阻断、不作「开始玩」前置）：首启完成首帧渲染进入可交互状态后弹出；「拒绝」不阻塞任何玩法入口（拒绝态仍可开始玩，仅个性化分享图等非核心能力维持默认态）；「同意/拒绝」状态落 wx storage（经 T1 storage 门面键制注册）；弹窗不作为「开始玩」按钮的出现前置条件。",
          "wk-acc-4 材料清单逐 id 对照（wx-icon / wx-share-card / 商店截图≥3 / 类目与资质占位=主人侧）：docs/platform/wx/wx-submission-kit.md 逐项给落点与状态。",
          "wk-acc-5 合规自查表：docs/platform/wx/compliance-visual-checklist.md 逐条「条款编号+结论+证据路径」，无红项。"
        ],
        "assets": [
          {
            "file": "assets/release/（wx 图标，规格以微信官方文档核对为准，N3 记录条款编号+证据路径）",
            "id": "wx-icon",
            "optional": false,
            "size": "官方文档核对定稿"
          },
          {
            "file": "assets/release/shots/（同批截图门四机判有效，N4 选批）",
            "id": "wx-store-screenshot-01..03",
            "optional": false,
            "size": "官方文档核对定稿"
          },
          {
            "file": "export/wx/privacy-popup.json（三态视觉稿的机读投影，trigger/blocking 字段机判）",
            "id": "wx-privacy-popup",
            "optional": false,
            "size": "n/a"
          }
        ],
        "check": "node tests/wx/wx-submission.spec.mjs",
        "files": [
          "tools/build-wx.mjs",
          "tests/wx/wx-submission.spec.mjs",
          "docs/platform/wx/wx-submission-kit.md",
          "docs/platform/wx/privacy-popup-visual.md",
          "docs/platform/wx/compliance-visual-checklist.md"
        ],
        "id": "wx-submission-kit",
        "kind": "platform-submission",
        "maturity": "final",
        "platform": "wx",
        "summary": "提审材料与组包：tools/build-wx.mjs → export/wx/（game.json + project.config.json，appid 占位 touristappid，正式号主人下发后替换）；主包 ≤4MB 逐件实测断言；PWA 专属三件（sw.js/manifest.webmanifest/index.html）不入包；提审材料清单落 docs/platform/wx/wx-submission-kit.md。"
      },
      {
        "acceptance": [
          "dr-acc-1 五件落点在盘（src/platform/dy/dy-env|runtime|adapter|boot-dy.ts + tests/dy/dy-runtime.spec.mjs），Node 侧条目查全绿；被测件缺位 = RED 不装绿。",
          "dr-acc-2 复用门面零重抄：storage 走 src/platform/storage.ts 门面（键制注册）、音频走 src/platform/audio.ts 门面（静音态仍走 muted 键）、时钟走 src/platform/clock.ts（可注入）；dy 四件零 Math.random/Date.now 直调字面；宿主 API 直调面收口：tt.* 字面只允许出现在 src/platform/dy/ 目录内，门面外（含 kernel/render/ui/main）出现 tt.* 直调即缺陷（机判扫描，tests/dy/dy-runtime.spec.mjs 断言）。",
          "dr-acc-3 首启引导路径（显式声明，v1.4 冻结）：首屏渲染完成（炉板 64 格满员首帧上屏）→ 第一次有效操作（首次成功交换的反馈完成）构成 dy 首启引导路径；该路径预算 = numeric.platform.dy.interactionBudgetMs（400ms，与 numeric.perf.j1.budgetMs 同源同口径），perf 标记名逐字复用 j1_settle_start / j1_feedback_done（双端统一契约，零新增标记名）；dy 冒烟段机判该路径（帧预算 numeric.platform.dy.smokeFrames=240 内完成）。",
          "dr-acc-4 行为差异按 tt↔wx 差异映射表（docs/platform/dy/tt-wx-diff-mapping.md）执行：容器判定 dy-diff-02、生命周期 dy-diff-05、视口/安全区 dy-diff-06（safeArea 缺失走 adapter 默认值不抛错）、触摸装配面 dy-diff-07（fire 目标非空）、存储 dy-diff-01；tt 缺位项按 dy-diff-08 fallback 口径（dy 包不复制 wx 隐私弹窗运行时），零空洞行。",
          "dr-acc-5 开发者工具验证 runbook 内嵌如下三节原文（沿 wr-acc-2 格式）：\n      - 步骤：① 安装抖音开发者工具（稳定版）并在 设置→安全设置 开启服务端口；② 导入项目 = export/dy/，AppID=主人下发的正式号（未下发前占位符仅限工具内预览）；③ 机跑 node tools/verify-dy-devtools.mjs；④ 真机扫码完成首启 60 秒实点与分享/静音/重开四项手测。\n      - 预期输出：③ 成功时 CLI 输出 preview 成功并给出二维码路径（脚本归档原文）；工具内编译面板 0 error；真机首启炉板 64 格满员渲染、无白屏、无报错弹层。\n      - 判定标准：G1 编译零 error；G2 首屏完成后 60 秒内完成第一次有效操作（真人实点记录秒数，即 dr-acc-3 引导路径真机面）；G3 会话分享卡片实收且为 720×1280 竖版卡；G4 静音开关生效且重开复位。任一不过 = reject（逐条指到文件与 spec 条目）；CLI 缺席 = BLOCKED-ENV（exit 2）显式披露，不装绿。"
        ],
        "check": "node tests/dy/dy-runtime.spec.mjs",
        "files": [
          "src/platform/dy/dy-env.ts",
          "src/platform/dy/runtime.ts",
          "src/platform/dy/adapter.ts",
          "src/platform/dy/boot-dy.ts",
          "tests/dy/dy-runtime.spec.mjs",
          "tools/verify-dy-devtools.mjs",
          "docs/platform/dy/tt-wx-diff-mapping.md"
        ],
        "id": "dy-runtime",
        "kind": "platform-runtime",
        "maturity": "final",
        "platform": "dy",
        "summary": "抖音小游戏容器适配：容器判定 / 存储（复用 T1 storage 门面）/ 音频（复用 T1 audio 门面）/ 时钟（复用 T3 可注入时钟）/ tt.onShow·onHide 生命周期接线 / 触摸装配面。内核零改动、零 import（玩法/数值/视觉零 diff）；tt.* 直调只许出现在 src/platform/dy/ 门面内，门面外出现即缺陷。"
      },
      {
        "acceptance": [
          "ds-acc-1 主判据：shareNow 调 tt.shareAppMessage 且绑定 720×1280 竖版分享卡（复用 A-07 既有件 dy-share-720x1280.png，sha256 随件登记 manifest；卡规格 = numeric.platform.dy.shareCard 机判）；载荷 query 含 sid= 且 sid 形如 ^[A-Za-z0-9-]{1,32}$（零 PII）。",
          "ds-acc-2 分享入口纯跳转：share.ts 静态 import 面不含 kernel/game/generated/numeric（零数值回调）；分享成功/失败不读写任何玩法状态。",
          "ds-acc-3 降级两路：无 tt 容器 → {ok:false, reason:\"no-dy-container\"}；通道抛错 → {ok:false, reason:\"share-failed\"}；两路均不抛错、入口保留。",
          "ds-acc-4 被动通道：installPassive 注册 tt.onShareAppMessage + tt.showShareMenu，回参同卡同参（title/imageUrl 一致）。"
        ],
        "check": "node tests/dy/dy-share.spec.mjs",
        "files": [
          "src/platform/dy/share.ts",
          "tests/dy/dy-share.spec.mjs",
          "docs/platform/dy/tt-wx-diff-mapping.md"
        ],
        "id": "dy-share-kit",
        "kind": "platform-share",
        "maturity": "final",
        "platform": "dy",
        "summary": "抖音分享闭环：主动 shareNow（tt.shareAppMessage）+ 被动 installPassive（tt.onShareAppMessage + tt.showShareMenu）；配图绑 720×1280 竖版分享卡（A-07 复用）；载荷 query sid=（零 PII）；不可用/失败两路静默降级保留入口；分享入口纯跳转，无数值回调、零内核 import（与 wx-share-loop 同构，仅宿主面与卡规格按映射表 dy-diff-03/04/09 改面）。"
      },
      {
        "acceptance": [
          "dk-acc-1 组包器断言三件套：export/dy/ 含 game.json（JSON 可解析且 deviceOrientation 合法）+ project.config.json（工程形态字段以官方文档核对，值允许占位）+ 载面零 sw.js/manifest.webmanifest/index.html（PWA 三件排除机判）。",
          "dk-acc-2 主包红线：export/dy/ 逐件实测字节求和 ≤ numeric.platform.dy.bundleLimitBytes（4194304 机判，非估算）；接近超线时分包决策「先实测后定」：以实测数据为准给分包方案并随件披露，禁止拍脑袋估。",
          "dk-acc-3 提审材料清单 dy 段 v2 逐 id 对照（dy-share-card / dy-icon / dy 商店截图 ≥ numeric.platform.dy.storeScreenshotMinCount 张 / AppID 与类目资质占位=主人侧）：docs/platform/dy/dy-submission-kit.md 逐项给落点与状态；素材规格一律取自 tt↔wx 差异映射表，表上没有的行视为缺件。",
          "dk-acc-4 合规文案位双口径（定死，缺一即 reject）：① 占位冻结——包内合规文案位以本轮冻结的占位文案落地并由组包断言机判在位；② 提审日口径——提审前以抖音官方当日生效规范对文案位逐条人工核对，核对记录（日期+结论+核对人）入材料清单；占位文案不因人工核对改码面（改文案 = spec revisions 增补后落码，零双头维护）。",
          "dk-acc-5 合规自查表：docs/platform/dy/compliance-visual-checklist.md 逐条「条款编号+结论+证据路径」，无团队面红项；主人侧/环境侧待办显式披露不装绿。"
        ],
        "check": "node tests/dy/dy-submission.spec.mjs",
        "files": [
          "tools/build-dy.mjs",
          "tests/dy/dy-submission.spec.mjs",
          "docs/platform/dy/dy-submission-kit.md",
          "docs/platform/dy/compliance-visual-checklist.md"
        ],
        "id": "dy-submission-kit",
        "kind": "platform-submission",
        "maturity": "final",
        "platform": "dy",
        "summary": "提审材料与组包（提审材料清单 dy 段 v2 的 spec 锚）：tools/build-dy.mjs → export/dy/（game.json + project.config.json，appid 占位、正式号主人下发后替换）；主包 ≤ numeric.platform.dy.bundleLimitBytes 逐件实测断言（超线先实测再定分包，决策随件披露）；PWA 专属三件不入包；合规文案位双口径（占位冻结 + 提审日最新规范人工核对）；材料清单落 docs/platform/dy/dy-submission-kit.md。"
      }
    ],
    "note": "v1.4 仅 dy 段增量：dy-runtime / dy-share-kit 由 draft 转 final（acceptance 升级为实现验收）+ 新增 dy-submission-kit；wx 三条目逐字节保留 v1.3 原文（零接触）；world/entities/levels/assets/acceptance(顶层18条) 与 v1.3/v1.1 逐字段相等；numeric 仅新增 platform.dy 参数组（v1.1 十二组玩法 numeric 逐字段全等，对照报告 docs/spec/v14-dy-numeric-report.json）。"
  },
  "replayHooks": [
    "combo（连击上限追逐）",
    "daily_seed（炉板每日种子）",
    "one_more_run（炉冷即重开）"
  ],
  "sessionSeconds": 180,
  "unlocks": []
};

/** spec meta 段 */
export const META = {
  "dodRecalibration": {
    "at": "2026-10-10",
    "beforeFreezeMust": "封版前必办（非数值必改项）：内测样本回收；方法 = ac-30.calibrationRound1 规格（≥10人×≥5局×≥50局×≥3天×3机型档各≥2台；单局四要素缺一即作废；≥10% 且 ≥5 局 seed 重放逐位一致；数字三标注；只出校准值+建议区间）",
    "gatesDecision": "四门槛锁定维持待校准（D1≥30% / D7≥10% / 局均≥3min / 重开率≥40% 零改动）；样本 0（内测未启动，名单=主人件 Q6）→ 无校准值可回写，禁编数",
    "headSha": "e4c65f95ab0d1cb6c8546ec6514fef08ccf3e958",
    "machineEvidence": "gate-logs/v13-a1-merge-20261010/05-qa-batch-rerun.log（QA 复检器 9/9 APPROVE-READY · Q5=DoD 机判面 · Q9 P95 26.1→26.1 零退化）",
    "numericAnchor": "6719edd27d7e121ac90be2ddca4b8ab127fdda269532bf4693c6afd805e9a739",
    "round": "A2 · 主仓 HEAD 复跑（原首轮产自无证据链树，不采信不回写）"
  },
  "engine": "TypeScript 5.x + Canvas 2D + vanilla（零框架、零外部运行时依赖、零外部贴图）",
  "genre": "休闲消除（8×8 交换三消 + 连击 + 炉冷终局）",
  "lineage": "g2-blocks N1 修复轮：主策划已拍板的 5+1 项修法一次折入并以 version 1 一次入链（杜绝 v1→v2 空转）；色板自美术交付件 palette-n1-final.json 并入。",
  "oneLiner": "在 8×8 的熔炉板上交换相邻方块凑成三连：连击不断火就越旺，加成一路往上叠；一旦无路可走，炉子就冷——趁热把连击打满。",
  "platform": "Web 单页（Canvas2D，免安装即开即玩；后续平台移植面单列）",
  "revision_note": "v1（首版入链）：① 冻结段新增 spawn.orientation=\"uniform_random\" + seeded RNG 测试钩子；② AC-06 补四手 combo 向量（消/消/不消/消 → +0/+50/归0/+0）；③ AC-07 定炉冷双判（落定结算后+补手后各判一次，任一为真即炉冷）+ 64格×7块×≤4向全穷举；④ level-1 新增 el-hint 并注明理由；⑤ AC-10 J1 定义逐字入 acceptance + 双端 perf 标记名 j1_settle_start / j1_feedback_done 写死契约；⑥(+1) 美术线色板定稿并入（余烬金弃 #FFC94A 终值 #C89C19 + 暖区第 6/7 色），21 对双门禁全绿，阈值 25 由冻结 4 色校准。\n\nv1.3（WX 移植提审轮 · 链 v5 · draft）：仅平台段增量——content.platform.items 新增五条（wx-runtime / wx-share-loop / wx-submission-kit 定稿；dy-runtime / dy-share-kit draft）。\n【源基线】v1.1 已发布基线（链 v2 cmuqa2mu50023m9zr8mh60uph · approved 导出件 · numeric 锚 302e6336…）。\n【numeric 逐字段相等声明】numeric 段与 v1.1 逐字段相等（整段 sha256(sortKeys) = 302e6336… 全等）；V1.2 手感轮（链 v4，feel/daily 两组 numeric）零接触、零并入。\n【零 diff 面】world / entities / levels / assets / acceptance（顶层 18 条）与 v1.1 逐字节相等；content 段除新增 platform 子对象外零改动。\n【地基解耦声明】工程地基三件（T1 storage/audio 门面、T3 确定性 PRNG/注入时钟/时区工具）已在 v1.1 基线 @ fe5fd38 在档（A 轮 N3 交付），与 v1.2 冻结内容解耦；wx 工作分支 cherry-pick 清单 = ∅（实查记录进黑板 levels.md）。\n【rebase 纪律】本版（v1.3-platform）落 draft；若 v1.2（链 v4 cmut5fkyf00cbic7qudea13g6）先获主人批复，本版按既定纪律 rebase 重出版（revisions version+1，基础切至批复后基线），不做双版本线并行；若主人否决 v1.2，地基独立重落、wx 线 rebase，本版条款不失效。\n【QA 两缺口补丁】① wx-runtime acceptance 内嵌开发者工具验证 runbook（步骤/预期输出/判定标准）；② dy 条目显式声明「本轮仅验收文案完整性、不验收实现」并注明 check 配置理由；③ 隐私弹窗触发时机在 wx-submission-kit 定死（非阻断、不作「开始玩」前置）。\n\nv1.4（DY 平台段校准入链轮 · 链 v6 · draft）：仅 dy 段增量——dy-runtime / dy-share-kit 由 draft 转 final（acceptance 从上轮写案「仅验收文案完整性」升级为实现验收，check 同步指向 tests/dy/*.spec.mjs）+ 新增 dy-submission-kit；numeric 仅新增 platform.dy 参数组（5 参数逐个冻结：bundleLimitBytes=4194304 / smokeFrames=240 / interactionBudgetMs=400 / shareCard=720x1280 / storeScreenshotMinCount=3，无「待定」项）。\n【源链】v5 cmuusk0p60040icryguvlev9j（v1.3-platform draft · parent=v4 cmut5fkyf00cbic7qudea13g6）；wx 三条目逐字节保留 v1.3 原文，零接触。\n【玩法 numeric 零 diff 声明】v1.1 十二组玩法 numeric 与本版逐字段全等（机判对照报告 docs/spec/v14-dy-numeric-report.json，逐组逐字段三列对照 v1.1/v1.3/v1.4）；V1.2 手感组（链 v4，feel/daily numeric）零接触、零并入；本轮新增仅 platform 一个命名空间、其中仅 dy 一个子键。\n【tt↔wx 差异映射表】docs/platform/dy/tt-wx-diff-mapping.md（稳定 id dy-diff-01..10，三栏：wx 行为 / tt 行为 / 判定口径；tt 缺位 API 恰 1 条＝dy-diff-08，fallback 口径已写死：dy 包不复制 wx 隐私弹窗运行时、合规走文案位双口径；零空洞行，表上没有的行视为缺件）。\n【合规文案位双口径】dk-acc-4 定死：占位冻结（包内机判在位）+ 提审日最新规范人工核对（核对记录入材料清单）；两口径缺一即 reject。\n【引导路径显式声明】dy 首启引导路径 = 首屏渲染完成（64 格满员首帧上屏）→ 第一次有效操作（首次成功交换的反馈完成）；预算 numeric.platform.dy.interactionBudgetMs=400ms（与 numeric.perf.j1.budgetMs 同源），标记名逐字复用 j1_settle_start / j1_feedback_done，dy 冒烟段（240 帧内）机判。\n【W-4 澄清（随件注记 · 非码面动作）】v1.1 acceptance ac-10 scopeNote「移植端（wx/dy/Steam/Roblox）deferred 顺延下轮」系 v1.1 轮任务书面文，与 v1.3 起 platform 段落地存在文面时差；本轮澄清：顶层 acceptance 18 条零改动（v1.1 锚点不降），移植端范围演进以 platform 段与各轮 revision_note 为准——wx 三条目 v1.3 定稿、dy 三条目本轮定稿、Steam/Roblox 仍 deferred（开辟决策归主人）。本注记即 W-4 的闭环落点。\n【rebase 纪律】v1.2（链 v4）先获主人批复 → 本版按既定纪律 rebase 重出版（revisions version+1，基础切至批复后基线），不做双版本线并行；主人否决 v1.2 → 地基独立重落，本版条款不失效。\n\nv7（封版就绪冲刺第 1 批 · 链 v7 / meta.version 1.5 · parent=链 v6）：\n【基线修复】找回链 v4（V1.2 核心手感轮）在 v5/v6 平台段建版时未继承的全部增量：\nnumeric.feel + numeric.daily 两组（与 v4 逐字节全等）、assets a04..a07 四项（全等）、\ncontent.dailyChallenge 段（全等）、acceptance ac-22..28 七条（全等）——v6 的平台段（content.platform / numeric.platform.dy）原样保留。\n【增量①】三引导锚点事件实体 e-evt-first-screen / e-evt-first-drag / e-evt-first-place（含属性定义）。\n【增量②】acceptance 新增 ac-29 埋点九事件表（程序 8 事件 + 美术 share_clicked，主人已批准并入；\n代码镜像 src/telemetry/analytics.ts + 双向断言 tests/contract/ac-29-analytics-nine-events.spec.mjs，N4 已落地）。\n【增量③】acceptance 新增 ac-30 封版 DoD 三层门（留存门 D1≥30% / D7≥10%、参与门 局均≥3min、回访门 重开率≥40%），\n全部标「待校准」（assertion=pending / calibration），数据回流后经修订转正式数值与契约件。\n【增量④】候选池 1/2 折入：near-miss 反馈系统（e-nearmiss + world.uxCommitments[0] + ac-31）与\n结算页信息架构（e-settlement + world.uxCommitments[1] + ac-32），实现归 v1.3 实现轮；\n数值全部走 numeric.uxProposal 提案态（status=proposal），现有全部 numeric 组零改动（守卫盯防）。\n【顺延】v3 提案（combo 倍率 / level-stars 派生式 / 第一分钟引导方案本体）继续零实体零验收不入本版。\n【approve】本版落 draft；approve 是主人动作（红线：机器不替人判断）。\n\nv8（v1.3 首批实现轮修补版 · 链 v8 / meta.version 1.6 · parent=链 v7）：\n【批次对位】任务书「v1.3 首批」= near-miss 反馈系统 + 结算页信息架构最小闭环 + 封版 DoD 四项首轮校准；\n链 meta.version 自 1.5 顺延至 1.6（历史 v1.3-feel-draft 写案版本号已占用，链上单调递增防撞车）。\n【修补①】判定口径定死：numeric.uxProposal.nearMiss/settlement 提案值转正式组 numeric.nearMiss / numeric.settlement\n（承值零调参）；predicate 增 axisParity=row-col-equal（行列同权）、fillCountBasis=post-clear-same-frame-endstate\n（填充计数取消除结算后同逻辑帧末态）、tieBreak=cell-index-asc；weakFeedback 频控 perRowPerRun=1 + globalPerRun=3。\n【修补②】本版无强反馈通道：strongFeedback.inVersion=false；numeric.uxProposal 收缩为强反馈预留提案（capPer5s=3，\nstatus 仍 =proposal，无实现无验收——预留位不占验收面）。\n【修补③】个人最佳=0/低分边界条款入 entities：新实体 e-personal-best（无个人最佳或低分时归因层差值文案降级为通用鼓励）。\n【修补④】测量口径入 acceptance 文本：ac-32.measurement（冷启动/热启动分列、最低机型档基准、触达高度 ≥48dp）+\nnumeric.settlement.touchTargetMinPx=48。\n【修补⑤】near-miss 触发/超限埋点事件 id+字段（nm_triggered / nm_capped）入 e-nearmiss.attributes.events 与 ac-31.events；\n结算页 result-slot-* element id（P0–P3 四层六槽）入 e-settlement.attributes.elementIds。\n【修补⑥】文案逐条枚举入 acceptance：ac-31.copy 7 条 / ac-32.copy 6 条；本轮修订/新增的全部 acceptance 条目\n（ac-30/31/32/33）声明 verification ∈ {auto, manual}。既有 28 条维持 v7 原文（逐字节不动守卫优先），\n其 verification 补齐归下一轮内容轮（本版不动既有条目）。\n【另】三档音效用途表入 entities：新实体 e-sfx-usage（tier1 落定 / tier2 消除+near-miss 变体 / tier3 连击爆发；\nnear-miss = 第二档变体参数 durationScale=0.5 + tail=descending）。\n【DoD】ac-30 四项门槛数值零改动（≥30%/≥10%/≥3min/≥40% 全部 pending），只增「首轮校准」规格：\n样本下限 / 作废判定 / seed 重放抽检 / 三标注 / 「只出校准值与建议区间、不改生效阈值、不出达标结论」。\n【提审包】新增 ac-33：wx/dy 提审包零 diff 契约断言 + 内测工具（聚合脚本/内部玩家 tag）不进提审包。\n【approve】本版落 draft；approve 是主人动作（红线：机器不替人判断）。",
  "title": "g2-blocks（熔炉方块）",
  "version": "1.6"
};

/** 与 spec-source.numeric() 同形的读取口（运行时统一走本件，浏览器安全） */
export function numeric()                 {
  return NUMERIC;
}

/** 生成时锚（供漂移守卫比对） */
export const ANCHOR_SHA256 = '6719edd27d7e121ac90be2ddca4b8ab127fdda269532bf4693c6afd805e9a739';


//# sourceURL=generated/spec-data.ts