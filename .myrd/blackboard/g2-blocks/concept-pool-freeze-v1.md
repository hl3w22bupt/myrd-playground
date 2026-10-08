# concept-pool-freeze-v1.md — g2-blocks 封版策划候选池 v1（主策划立池 · 2026-10-08）

> 更新时间：2026-10-08（封版就绪冲刺第 1 批 · N1 输入件）
> 负责人：主策划（候选池唯一维护位；候选折入 spec 走版本链，禁止口头版）
> 下一步：候选 1/2 已按主人任务指令折入链 v7 封版包（entities/world/acceptance + numeric 提案态）；approve 归主人
> 句式纪律：R1 无形容词（逐句可核对）/ R2 三字段句式（触发事件 + 可观测代理 + 量化门槛）/ R6 成本显式

## 候选 1 · near-miss 反馈系统（炉冷惜败反馈）

- **触发事件**：炉冷结算时 nearMiss 谓词命中（三择一：① 连击目标差 ≤1 连；② 首消步数差 ≤1 步；③ 剩余手数 ≤1 且当局 chain ≥2）。
- **可观测代理**：结算面「惜败反馈条」展示次数 ≥1（埋点面遥测可统计，随九事件表会话归因）。
- **反馈规格**：结算横幅追加冷色文案一行 + 弱脉冲一次（数值提案：pulse 600ms / 文案条驻留 2400ms，落 `numeric.uxProposal.nearMiss` 提案态）。
- **量化门槛**：near-miss 局的重开率高于全场基线 ≥ +10 个百分点（反向健康校准指标，随 DoD 三层门数据回流校准）。
- **成本项（R6）**：谓词只读复用 kernel combo/goals 现成面（零内核改动）；表现面 = 结算横幅一行 + 一次脉冲（复用 MOTION/theme token，零新色零新贴图）；预估一个实现切片。
- **红线**：不进确定性内核（纯表现层）；数值全部提案态，不改任何生效值。

## 候选 2 · 结算页信息架构（三层 IA）

- **现状**：结算 = 冷却横幅（coolBanner）+ HUD 分数，无结构化结算层；玩家在局终看不到「差在哪、下一步做什么」。
- **目标 IA（三层自上而下）**：
  1. **结果层**：本局分数 / 最高连击 / 用步数（主视觉，数值全部现成状态面，零新计算）。
  2. **归因层**：差一点原因一行——nearMiss 谓词命中项（候选 1）或「无可消除」平铺提示。
  3. **行动层**：主按钮 = 再来一局（doRestart 同源同路径）；次按钮 = 每日挑战入口（daily.entryState().visible 时展示）。
- **可观测代理**：结算层三区块渲染态可辨（smoke 断言面）+ 行动层主按钮触发重开链路（与 ac-27 重开一键同源）。
- **版式约束**：沿用 UI token 九键 + 冻结色板，零新色零新字体；结算层出现期间玩法输入维持封印（cooled 既有语义，不新增状态机）。
- **数值提案**：出现延迟 = 冷却横幅后 400ms / 入场动画 240ms（`numeric.uxProposal.settlement` 提案态）。
- **成本项（R6）**：一个结算层渲染件 + smoke 断言扩展；复用 layout/computeLayout 网格定位；预估一个实现切片。
- **红线**：零玩法逻辑改动（结算层是纯表现层 + 现成状态读取）；不动 ac-08 结算顺序语义。

## 折入记录（链 v7 · 本轮）

| 候选 | 折入面 | 落点 |
|---|---|---|
| 候选 1 | entities + world + acceptance + numeric 提案态 | `e-nearmiss` 实体 · `world.uxCommitments[0]` · `ac-31-nearmiss-feedback`（assertion=pending/implementation）· `numeric.uxProposal.nearMiss` |
| 候选 2 | entities + world + acceptance + numeric 提案态 | `e-settlement` 实体 · `world.uxCommitments[1]` · `ac-32-settlement-ia`（assertion=pending/implementation）· `numeric.uxProposal.settlement` |

- 两候选验收条目均走 **PEND 通道显式挂起**（实现归 v1.3 实现轮，随片先红后绿后转正式契约件）；approve 前零实现代码（红线：approve 前不写冻结值玩法实现）。
- 候选 3+ 留池位：本轮不立（任务书仅点名候选 1/2；后续候选走新版本链，不入本池）。
