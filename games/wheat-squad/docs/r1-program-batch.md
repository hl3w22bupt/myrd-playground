# R1 打磨轮 · 游戏程序批三件（2026-10-14）

> 署名：游戏程序（主策划工作室代行节点，产物独立落盘）· 绑定基线：合并 HEAD `8868d0f`（门禁五步全绿 `gate-logs/r1-converge-20261014/`）· 三件一批交：① sha 三点核对单 ② 埋点口径说明 ③ 操作路径清单
> 口径单源：链 v4 approved（meta v1.2）导出件 `.myrd/spec/wheat-squad/design-spec.json`（与链上深等零漂移）

## ① sha 三点核对单（任务书红线：未核对前 A1/A2/A4 实测一律无效）

### 三点实查（2026-10-14，命令与输出可复现）

| 点 | 实查对象 | 结果 |
|---|---|---|
| 点 1 | 本轮 HEAD | `8868d0f`（双线合流提交；基线落账后推进为 `f4533c0`——**最终报告绑定 sha 以 N7 发布 commit 复跑时点为准**，N5/N7 再钉） |
| 点 2 | AppHost 线上包 | 坑 `cmv36wl94001xm9mxp119q48x`（slug wheat-squad-2 · sourceId=wheat-squad 绑定）· 部署单 API 实查（GET /api/v1/apphost/apps/:id/deployments）：**v13 `cmv66glrh…` running @ commit `76954ca`**（gitRef=`fix/wheat-squad-landing-w3` · 2026-10-13T04:25Z · errorMessage=null · 晚于兄弟线 v12@`7608768` 并接管） |
| 点 3 | 指纹对账 | 线上 `main.mjs` md5 **`1711423891dfde8ea59eb9cd3829803d`** ≡ `76954ca` 树内 `build/main.mjs`（逐字节定源）；HEAD `build/main.mjs` md5 **`bcde4bea67cfc6a1af57ce7ae4297e2d`**（v1.2 四事件增量构建） |

### 核对结论：三点不全等，存在代码差异（如实登记）

- **差异定位**：线上包 = **W-3 修复后的新网关**（server 落地页按部署清单解析）+ **旧 v1.1 时代游戏构建**（`76954ca` 树的 build 未含兄弟线 v1.2 四事件增量）；HEAD = W-3 修复 + v1.2 全量实现（埋点 9 键/guidance/checks 薄壳 16 条）。
- **按 QA 红线的处置**：sha 间有代码差异 ⇒ 本轮全部门禁在 HEAD 复跑（已做：`gate-logs/r1-converge-20261014/01` 五步全绿 VERIFY_EXIT=0；N7 发布 commit 将再复跑一次作为报告绑定面）。
- **A1/A2/A4 实测有效性**：实测跑在 HEAD 本地 headless 机判（可重复、可复跑），**绑定 HEAD sha 有效**；线上包差异如实登记，**不据此宣称「线上实测」**。
- **W-3 页面串线状态（线上复测 2026-10-14）**：`GET /apps/wheat-squad-2/gw` → **title=麦浪小队**（非 game-9 共享壳）——v13 网关修复**已生效，试玩入口恢复**；但线上游戏构建为旧 v1.1 产物（无 v1.2 埋点 9 键），**A3 正式试玩采集排在 N7 重部署之后**（旁证时间线需与 v1.2 口径一致）。

## ② 埋点口径说明（单源 = spec v1.2 `e-telemetry` 9 键结构化 + `meta.telemetryFields` + `numeric`）

> 三方同名：spec（本节引用）= 程序接线（`src/game.ts#telemetry`，ac-14 剥注释机判）= 冒烟断言。只缓冲不外发（`docs/deployment-notes.md`）。

| 判据 | 口径定义 | 判定 |
|---|---|---|
| **A1 计时起点** | `first_core_action_at.atMs` = **首次核心操作（首次拖动队长）**的局内毫秒时刻 = tick × `FIXED_STEP_MS`(16)。起点**不是** run_start、**不是** hint_shown——引导浮层展示（hint_shown，首局 running 起始 atMs=0）与 A1 计时无涉 | 自该起点首杀 ≤ `firstCore.maxLatencySec`(10s)；且 `firstCore.sampleSeeds`(5) 种子局首杀必 ≤ `mustReachBySec`(30s)（ac-a1 statement） |
| **A2 按局样本口径** | 样本单位 = **一完整局**（`run_start` → `run_end`，victory/timeout/defeat 任一结算），每局产 `run_end.run_duration_ms` 一条；**一局一条，不按事件采样、不按玩家采样** | `runDuration.sampleSeeds`(20) 种子完整局：P50 ∈ [p50MinSec 90, p50MaxSec 180]s 且 P90 ≤ p90MaxSec(300)s；判定面结局 ∈ {victory, timeout}（ac-a2 statement） |
| **A4 通道判定逻辑** | 一「操作」由 `feedbackEvents[].opId` 标识（`kill#N@tT` / `hit@tT`）；每操作一条 `feedback_latency_ms{latencyMs, channels[]}`；**通道判定 = 逐操作 channels 集合 size ≥ `feedback.minChannelsPerOp`(2)**；延迟 = 操作 tick → 反馈呈现 latencyMs ≤ `feedback.latencyBudgetMs`(100ms)；视觉时长 `hitFlashMs`(90ms) ≤ 预算。现接线通道：击杀 = `['flash','particles','pickup-spawn','hud-kills']`（4 通道）、受击 = `['flash-invuln','knockback','hud-hp']`（3 通道）（`src/kernel/sim.ts` opId 产出点） | ac-05 三面机判（延迟/通道/flash 口径），auto |
| **A2 最低样本量 ≥20 完整局** | `numeric.runDuration.sampleSeeds = 20`（**v1.1 起已冻结于 numeric，v1.2 零改动**）——样本量门槛**已在 spec**，实测不足 20 完整局时按任务书记「未判定·待采」，不得以部分样本宣称达标 | numeric 冻结，ac-a2 以 20 种子实跑 |

## ③ 操作路径清单（带路径 id · 解卡美术 A4 视觉映射）

| 路径 id | 操作 | 输入面 | 现行反馈通道（视觉可映射） | 埋点锚 |
|---|---|---|---|---|
| **OP-01** | 拖动队长移动 | pointerdown + move（canvas 全域，`game.ts` pointer→captain.target） | 队长位移 + 选中态（程序绘制，**待美术特效批映射**） | `first_tap{atMs,once}` · `first_core_action_at{atMs}` |
| **OP-02** | 击杀害虫 | 自动（OP-01 引导：队长近战接触 + 小队弹丸） | `flash` / `particles` / `pickup-spawn` / `hud-kills` | `first_kill{tick}` · `feedback_latency_ms{channels}` |
| **OP-03** | 掉落拾取 | 自动（OP-02 衍生：掉落物接触拾取） | `pickup-spawn` / HUD 计数 | 循环链中间面（→OP-04） |
| **OP-04** | 三选一升级点选 | 点选选项卡（`upgradePickerHit` 视图坐标→index） | 选项高亮/选中态（程序绘制，**待美术特效批映射**） | `first_loop_complete{atMs,once}` = 首次选择完成（拖动→击杀→掉落→拾取→升级闭环） |
| **OP-05** | 受击反馈 | 自动（害虫接触，0.8s 无敌帧） | `flash-invuln` / `knockback` / `hud-hp` | `feedback_latency_ms{channels}` |
| **OP-06** | 结算页重开 | 结算页重开按钮点按（`restart()`，真实点击本地计数） | 按钮态 + 重开复位 | `restart_clicked{count,atMs}`（**仅 A3 附录旁证不进判定**——任务书红线） |
| **OP-07** | 首屏引导浮层 | 自动（首局 running 起始 0~`guidance.hintSec`(4s) 窗口内可见） | `guidance-hint-banner`（**资产 id 已登记 manifest v2**，文案 `GUIDANCE_TEXT` 三方同名） | `hint_shown{atMs,text}`（a5 判定锚） |

**美术映射约定**（给游戏美术的输入）：A4 视觉通道绑资产 id——特效批新增/映射的视觉元素须逐件登记资产 id 进 manifest（ac-art-2 机判：清单外未登记 = 违例）。⚠️ 既有悬置裁决：ac-art-2 机判窄面（manifest 之 ui-kit-01/sub-icon/sub-sharecard-5x4/sub-shots-3 四件非 entity id）A/B 两案待主策划拍板（兄弟线驳回修复轮升级项③）——**特效批产出前须先落此裁决**，否则新资产 id 落点无单源依据。
