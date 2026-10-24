// spec-data.ts — GENERATED（tools/gen-spec-data.mjs · 勿手改；spec 改版后 npm run gen 重跑）
// 真源: 平台 GameDesignSpec 导出件 id=cmuqa2mu50023m9zr8mh60uph v2 (approved)
// numeric 锚: sha256(sortKeys)=302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89

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
  "deadlock": {
    "algorithm": "exhaustive_swap_probe",
    "anyTrueMeansCool": true,
    "checkAfterRefill": true,
    "checkAfterSettle": true,
    "directionsMax": 4,
    "statement": "落定结算后+补手后各判一次，任一为真即炉冷；64格×7块×≤4向全穷举"
  },
  "grid": {
    "cells": 64,
    "cols": 8,
    "rows": 8
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
  "spawn": {
    "orientation": "uniform_random"
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
  "levelCount": 2,
  "note": "missions 不激活（任务书红线）；scope_gate 挂起，留存评估顺延至 ≥7 天真实样本，由主策划发起。",
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
  "engine": "TypeScript 5.x + Canvas 2D + vanilla（零框架、零外部运行时依赖、零外部贴图）",
  "genre": "休闲消除（8×8 交换三消 + 连击 + 炉冷终局）",
  "lineage": "g2-blocks N1 修复轮：主策划已拍板的 5+1 项修法一次折入并以 version 1 一次入链（杜绝 v1→v2 空转）；色板自美术交付件 palette-n1-final.json 并入。",
  "oneLiner": "在 8×8 的熔炉板上交换相邻方块凑成三连：连击不断火就越旺，加成一路往上叠；一旦无路可走，炉子就冷——趁热把连击打满。",
  "platform": "Web 单页（Canvas2D，免安装即开即玩；后续平台移植面单列）",
  "revision_note": "v1（首版入链）：① 冻结段新增 spawn.orientation=\"uniform_random\" + seeded RNG 测试钩子；② AC-06 补四手 combo 向量（消/消/不消/消 → +0/+50/归0/+0）；③ AC-07 定炉冷双判（落定结算后+补手后各判一次，任一为真即炉冷）+ 64格×7块×≤4向全穷举；④ level-1 新增 el-hint 并注明理由；⑤ AC-10 J1 定义逐字入 acceptance + 双端 perf 标记名 j1_settle_start / j1_feedback_done 写死契约；⑥(+1) 美术线色板定稿并入（余烬金弃 #FFC94A 终值 #C89C19 + 暖区第 6/7 色），21 对双门禁全绿，阈值 25 由冻结 4 色校准。",
  "title": "g2-blocks（熔炉方块）",
  "version": "1"
};

/** 与 spec-source.numeric() 同形的读取口（运行时统一走本件，浏览器安全） */
export function numeric()                 {
  return NUMERIC;
}

/** 生成时锚（供漂移守卫比对） */
export const ANCHOR_SHA256 = '302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89';


//# sourceURL=generated/spec-data.ts