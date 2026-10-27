# M2 反馈表现力 + bot 曲线 + onboarding · 程序可行性批注 v1

> 更新时间：2026-09-22（M2 立项冲刺 · 游戏程序线出具，主策划整合）
> 负责人：游戏程序（可行性判定与预算并表）/ 主策划（整合核对）
> 下一步：主人批准 v1.3 后按本批注落点开发；**结论先行：三块全部可行，零 core 结构改动**

## 1. 总判定

| M2 块 | 可行性 | core（src/core/）改动 | 落点 |
|---|---|---|---|
| 反馈表现力 | ✅ 可行 | **零**（反馈事件流已存在：match.sfxEvents / world.events） | src/app/feedback.js（新）+ src/platform/haptics.js（新） |
| bot 曲线 | ✅ 可行（已验证） | **零**（DR-P4：bot 策略参数属程序内实现） | src/ai/bot.js 档位参数化 + tools/bot-sim.mjs --profile |
| onboarding | ✅ 可行（acc-05 已闭环） | **零**（firstTouchS/alpha 已在 match.js） | src/app/onboarding.js（新）+ tests/ui/ |

## 2. 反馈表现力：实现路径与 60fps 预算并表

**事件通道（已在库，复用）**：进球/触球/失球均可从 `match.step()` 的同 tick 状态变化捕获
（sfxEvents 排程模式 = acc-06 已验证的同 tick 语义）→ 首帧 ≤100ms 的 headless 断言即
「反馈事件排程 tick == 输入 tick」，物理上 ≤16.7ms，留 6× 余量；动画通道 ≤1 帧渲染延迟 ≤42ms，留 2.4×。

| 反馈项 | 渲染成本/帧 | 内存 | 60fps 预算判定 |
|---|---|---|---|
| A09 goal-burst | ≤24 sprites（对象池复用，无 GC 分配） | +2KB 常驻池 | ✅ 仿真核单 tick p95=0.002ms，渲染预算 16.7ms 占用 <3% |
| A10 concede-flash | 全屏 vignette 1 层（167ms） | 复用池 | ✅ |
| A11 kick-puff | ≤6 sprites | 复用池 | ✅ |
| 震动（3 级） | 0 渲染成本（Vibration API/平台 adapter） | 0 | ✅ 不可用环境静默降级（try/catch 单点） |

并表结论：**60fps 预算内余量充足**；风险仅「低端机粒子堆积」→ 降级阶梯 = 粒子减半 → 火花 A12 先砍（与美术清单 §4 顺序一致）。

## 3. bot 曲线：档位参数化（零 core 改动实证）

M1 复验已实证 DR-P4 杠杆有效：同套 core，仅调 bot.js 策略参数（门前纪律/解围/射速冷却），
100 场分布从 avg 13.5→5.52，ratio 0→1.0。M2 方案：

- `BotController` 构造器加 `profile` 参数（'onboarding' | 'ranked'），档位只映射策略参数
  （BOT_SHOOT_RANGE_PX / laneHalf / shotCd / 解围半径），**core 物理与判定零触碰**；
- `bot-sim.mjs --profile <name>`：报告 meta 增 `profile` 字段（R-08 契约字段不增不改名——
  profile 加在 meta 展位，两比率/逐场字段逐字不动，契约测试 29 断言全保持）；
- 可行性实测锚点：M1 调参 6 轮全部落在「策略参数→分布平移」线性关系上，无参数悬崖；
  场均 [2,4] 目标（当前 5.52）预估 1-2 轮可达。

## 4. 轻量本地埋点（双口径降级兜底）设计批注

**约束**：无后端、无账号体系（v1.2 负面清单）→ 埋点只做「本地环形缓冲 + 平台 SDK 可选上行」。

| 项 | 设计 | 可行性依据 |
|---|---|---|
| 事件 schema | 5 个事件：session_start / first_touch / first_goal / match_end(比分) / tutorial_step；JSON 一行一条 | 与 acc-13/14 指标还原所需字段一一对应，不多采 |
| 环形缓冲 | localStorage/IndexedDB 定容 256 条，满则丢最旧 | Web 零依赖已有先例（糖果线 SaveState IndexedDB 同款） |
| 双口径降级 | 平台 SDK 存在→上行后清缓冲；不存在/失败→留缓冲；**schema 两口径逐字一致**（acc-15 断言） | 降级开关单点，无分支扩散 |
| 隐私 | 无身份字段（无账号/无设备指纹），仅会话级随机 id | 合规低危 |
| 体积 | 预估 ≤6KB 代码 | 主包预算余量巨大（43KB/1.5MB） |

## 5. 风险与升级项

| 风险 | 等级 | 处置 |
|---|---|---|
| 真机震动 API 差异（iOS Web 长期不支持 Vibration API） | 中 | adapter 三档：平台 API → Web Vibration → 静默降级；iOS Web 真机项归真机复验批次台账 |
| 场均压到 [2,4] 后 bot 过弱致 0:0 回潮 | 中 | acc-13 复验口径含逐场 [1,12] 不回退；终末保底机制（82s 释放）保留为兜底 |
| 平台 SDK 字段变更 | 低 | schema 对照表落文 + acc-15 断言 |

## 变更记录

- 2026-09-22 游戏程序：三块可行性判定 + 60fps 并表 + 埋点设计批注（M1 复验实证数据作锚）。
- 2026-09-22 主策划（整合）：与美术清单/提案指标逐条对齐，无孤项。
