# 风格一致性互查回执（AC-A4 结论面 · qa/style-consistency-check.md · 2026-10-12）

> 执行：游戏美术产出 → 主策划逐件核对（同 agent 双角色执行，**主人终裁保留**——本回执为工作室面互查，不替代主人对「好不好看」的裁决）
> 判据：style-card-v1 四要素 + spec acceptance ac-art-4 · 机器面：ac-10 色板白名单 12 文件零违例（gate-logs/n7-adversarial-20261012/01-gates-fresh.log）

## 逐件核对（清单 9 件，对照风格卡 v1）

| 件 id | 色板白名单 | 命名↔id | 体积上限 | 风格一致（四要素） | 结论 |
|---|---|---|---|---|---|
| e-captain | ✅ wheatGold/wheatDeep | ✅ ∈entities | ✅ 程序化零位图 | ✅ 圆形语言/外圈描边2px/直径5% | PASS |
| e-squadmate | ✅ wheatDeep | ✅ ∈entities | ✅ | ✅ 圆 r7 群像 | PASS |
| e-pest | ✅ pestBrown/inkBrown | ✅ ∈entities | ✅ | ✅ 椭圆敌方语言 | PASS |
| e-bullet | ✅ wheatDeep | ✅ ∈entities | ✅ | ✅ 圆 r3 无尾迹 | PASS |
| e-wheat-pickup | ✅ wheatGold | ✅ ∈entities | ✅ | ✅ 6×8 穗形抽象 | PASS |
| ui-kit-01 | ✅ skyCream/inkBrown/wheatDeep/accentRed | ✅ ui- 前缀 | ✅ | ✅ HUD 带/卡片框/面板框 token 化 | PASS |
| sub-icon | ✅ 模板色值 ∈ 白名单 | ✅ sub- 前缀 | ✅ SVG 1.5KB ≤300KB | ✅ 队长圆+麦穗+治愈底 | PASS |
| sub-sharecard-5x4 | ✅ | ✅ | ✅ 1.8KB ≤1024KB | ✅ 5:4 治愈短句版式 | PASS |
| sub-shots-3 | ✅ | ✅ | ✅ 2.1KB ≤500KB/张 | ✅ 390×640@3x HUD 带复刻 | PASS |

## 三方同源证明（palette 单源链）

- spec numeric.palette（8 色）≡ theme.ts THEME（8 色 + 2 派生 α token）≡ style-card-v1 要素一（8 色）——ac-10 机判 12 文件零违例佐证；game.ts 裸 hex ×5 已收口为 THEME token（本轮 N6）。

## 结论

AC-A4 机制面 + 结论面（工作室面）全 PASS；**保留项**：主人试玩时对整体观感的终裁意见若触发风格修订 → 走 spec revision（feedbackProtocol），本回执不阻塞部署。
