# 【呈批件】g2-blocks spec v1 · approve-ready 包（N1 修复轮闭合）

> 更新时间：2026-10-01（N1 修复轮收口 · 主策划呈批）
> 呈批对象：**主人**（approve 唯一拍板位，团队不代拍）
> 结论：**B1/B2 已解除 · round-2 无红 · 提请 approve**
> 回执：`gate-logs/n1-round2-20261001/README.md`（QA-G2-N1-R2-20261001-01）

## 一、请主人拍板的一件事

**是否 approve `g2-blocks（熔炉方块）GameDesignSpec v1`**（平台 id `cmuv...`，见下）。
approve 后：冻结值相关实现与门禁才开工（11 条 PENDING-APPROVE 解冻）；不 approve 则 v1 维持 draft，不产生任何实现投入。

## 二、版本链（平台实查）

| 版本 | 平台 id | status | 内容 |
|---|---|---|---|
| **v1** | `cmuovwra0004gm97tinha15zq` | **draft（待主人 approve）** | 首版一次成链：八段全量 + 全部冻结值 + 5+1 修法 + 色板并入 |

- 一次成链纪律：仅一次成功 POST（version 1），零 v1→v2 空转；幂等防线（链上已有即拒 POST）已实测生效。
- numeric 冻结锚 sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`
- 导出件（契约测试与 QA 共同输入）：`.myrd/spec/g2-blocks/design-spec.json`（回读与链上 sortKeys 全等）
- 一号仓库（stack-tower v1.5 approved 链）**零接触**，版本链互不干扰。

## 三、5+1 修法闭环（QA round-2 逐字核过，9 锚全中）

| # | 修法 | 落点（链上） | 核对 |
|---|---|---|---|
| ① | `spawn.orientation: "uniform_random"` + seeded RNG 测试钩子入冻结段 | numeric.spawn / numeric.rng（mulberry32 + seededRng + 禁 Math.random/Date.now） | ✅ |
| ② | AC-06 四手 combo 向量 | ac-06 + numeric.combo（chainBonus 50 / 第 2 手起 / 非消除归零）：**消/消/不消/消 → +0/+50/归0/+0** | ✅ |
| ③ | AC-07 炉冷 | ac-07 + numeric.deadlock：**落定结算后+补手后各判一次，任一为真即炉冷**；**64格×7块×≤4向全穷举** | ✅ |
| ④ | level-1 加 el-hint 并注明理由 | level-1/el-hint（reason 132 字：教学局唯一「怎么走」引导，level-2+ 不出现） | ✅ |
| ⑤ | AC-10 J1 定义逐字 + 双端标记名 | ac-10 + numeric.perf.j1（**j1_settle_start / j1_feedback_done**，400ms @4x throttle + 390x844） | ✅ |
| ⑥(+1) | 色板并入 | numeric.palette（7 hex + gate + thresholdDeltaE 25 + 弃用值记录） | ✅ |

## 四、色板定稿（B1 解除）

- 门 A：HSL 三选二（ΔH≥25° / ΔL≥0.10 / ΔS≥0.08）；门 B：ΔE(CIEDE2000) ≥ **25**（冻结 4 色 6 对校准 floor(min/5)*5）
- **21 对全绿**：minΔE 26.555（margin +1.555）；CIEDE2000 实现对 Sharma 2005 Table 1 的 18 对标准向量全对（tol 1e-4）才允许出结论
- 余烬金：`#FFC94A` → **`#C89C19`**；暖区第 6/7 色：深余烬褐 `#4B2B25` / 绯玫瑰 `#E3B5BF`
- 证据：`gate-logs/n1-palette-20261001/`（5 log + README，四要素齐）

## 五、必须请主人知悉的披露项（详见回执 §五）

1. **前轮记录缺口**：本工作区未检索到 g2-blocks 前轮台账 → 「已冻结 4 色（01/03/04/05）」数值原文不可恢复，本轮由美术线一次性登记冻结（检索留痕见 blockers.md）。
2. **`#FFC94A` 否决依据是语义 + 量化**（饱和顶格通道裁切 / L\*83.7 全板最亮 / 柠檬观感），数值门禁不构成否决 → 余烬金观感请主人人工确认。
3. **落点偏差两处（显式记录）**：spec 导出件落 `.myrd/spec/g2-blocks/`（顶层 design-spec.json 是一号在用件）；黑板落 `.myrd/blackboard/g2-blocks/`（顶层三件是一号在用台账）。
4. **门 A 判据为策划定值并已冻结**（首轮 0.18/0.15 过严 → 重定 0.10/0.08，全程留痕）。
5. **【R2 驳回③ · 措辞二义，请主人裁定】** 链上 v1 `ac-11` 的 statement/note 写「theme.js（运行时单源）」，与同文档 `assets.a01`、`entities.e-renderer.script`（均声明 `g2-blocks/src/render/theme.ts`）及 `tests/theme.spec.mjs` 断言（按 theme.ts）不一致。**实查平台 `PUT`/`PATCH` /game-design-specs/{id} 均 405** → 无 draft 原位更正通道，改措辞只能产生 v2（违反「一次成链」纪律）→ 批前显式披露：请主人 approve 时一并裁定「theme.js → theme.ts」是否随 approve 备注修正（执行面无歧义：实现/测试/实体/资产四方均按 theme.ts）。
6. **【R2 驳回⑤ · 交付件注记漂移，归美术线，待下轮 spec 修订】** 美术交付件 `palette-n1-final.json` 的 block-02 intent 写「L\*≈64」，实测 L\*=66.6（`05-lstar-table.log` / assets.md / `04-rejected-ffc94a.log` 三处一致）。**不可静默改该文件**：`tools/build-spec-v1.mjs` 强制校验 spec `numeric.palette.sourceSha256` == 该文件哈希，且链上 v1 已锚定 `7bc2ca03…`，改注记即破坏链上锚 → 登记待下轮 spec 修订由美术线随 `sourceSha256` 一并更正（色值、门禁结论均不受影响）。

## 六、approve 之后的下一步（供主人预览，本轮未做）

codegen 生成 `src/render/theme.ts` → 实现 kernel/board·combo·deadlock·render·audio → 补 ac-01..ac-10,13,15,16 契约测试 → QA round-3 → 关卡可玩 → 「好不好玩」人工验收终裁（始终归主人）。
