# 策划案 v0（人读版）— 挪出一条路（线 4 · 工作名待主人定）

> 链 v2 `cmvlrc0ma001tm94ialxeykjn` · **approved**（2026-10-24T08:43:25.904Z 主人平台侧拍板，GET 200 实测；链 v1 `cmvlpx0uf0019m94iyuroz578` superseded 原文留档于下——**2026-10-25 驳回项4 勘误落盘**，本行此前停留 draft 口径）
> 机读契约件：`.myrd/spec/line4-unblock-jam/design-spec.json`（整行含 `_platform` 锚）· 版本链记账：同目录 `REVISIONS.md`
> 拍板依据：`.myrd/blackboard/next-line/decision-record-v1-20261024.md`（拍板 B ≡ 简报 v2 候选② · 品类避让双出处核对 PASS）

## 一句话

拖动堵路车辆、给红色目标车让出出口的挪车小解谜：同 seed 关卡谱系逐字节可复现做每日一局公平竞技，红轮高难三边界数值写死。

## meta

- **品类**：超休闲解压·物理小解谜（挪车/挤压类 · IAA 主导 · 关卡谱系）
- **产线**：ts-canvas（TS + Canvas 2D · 零外部贴图 · 零 npm 依赖——三线判例平移）
- **平台**：web → wx/dy 顺延（v0 骨架只定义契约面，可玩面待审查通过版）
- **双对标**：《上个了车》《看谁先上车》（简报 v2 §三候选②行 · D35）+《挪了下车》（同 · D40）

## 核心循环（单局制）

一局 = 一关：局始 → 拖动堵路车（沿其朝向轴）腾挪空间 → 红色目标车驶出出口（`level.complete`）→ 下一关由谱系导演派生；步数预算耗尽（`level.fail`）终局。红轮（高难轮）按三边界编入：

| 三红轮边界 | 数值/谓词（写死） |
|---|---|
| 进入 | 前关步数 ≤ par（par 谱系参数 PEND-待校准，谓词冻结） |
| 完成 | `redRoundStepBudget=12` 步内目标车驶出（连击窗口 ×2） |
| 失败 | 超预算即 fail；连败 `redRoundFailDowngrade=2` 降级回标准轮 |

**连击铁律**：仅 `car.exit` 事件帧 `comboCount+1`；pending（拖拽中未确认）一律不计——恒等式进 acc-03。计数器唯一所有权（计数控名人）= `src/kernel/session.ts`。

## 首 60s 引导（判据 g-01 → 资产 a04-guide-hand）

60s 窗口内三步：首次拖动 ≥1 辆 → 首次驶出 1 辆 → 通关教学关；判读 = dev HUD `first60s` 读数 + 冒烟 20 局 bot 面。

## 数值锚（v0 冻结面）

`DEFAULT_SEED=20261024` · `FIXED_STEP_MS=16` · `firstGuideWindowSec=60` · `redRoundStepBudget=12` · `redRoundFailDowngrade=2` · 调色板 8 色冻结（风格卡 v1，单源 `.myrd/blackboard/line4-unblock-jam/assets.md` §一）· perf：实体帽 60 / stepBudget 16ms / 中端 60fps。

**测量口径（F4 定死）**：时钟源=表现层 `performance.now()`（内核零 Date.now）；设备档=中端 60fps；采样=冒烟 20 局（seeds 42..61）全量帧 + a3 真人 5 名（好玩终裁）。

**telemetry 三列（6 键，单一判读出口对齐）**：`first60s_guide_done_rate`（≥0.90）/ `car_exit_latency_ms_p95`（≤100ms）/ `combo_pending_violations`（=0 恒等）/ `frame_time_p95_ms`（≤16）/ `fps_min`（≥55）/ `session_complete_rate_bot`（≥0.85）。

## 验收（9 条 · 明细见契约件 acceptance 段）

acc-01 确定性 · g-01 首 60s 引导 · acc-02 驶出反馈延迟 · acc-03 pending 不计连击恒等 · acc-04 三红轮边界 · acc-05 零外部贴图 · acc-06 性能帽 · acc-07 埋点键集合全等 —— 8 条 auto（check 均为规划落点，审查通过版转真）；acc-a3 重开意愿（manual 真人面 · **终裁归主人**）。

## 状态

**approved · 链 v2 锁版本**（2026-10-25 驳回项4 勘误落盘；本节此前停留「draft · 转正式审查」口径）。审查链走毕：QA 七条缺陷 7/7 核销（核销表 `.myrd/blackboard/line4-unblock-jam/qa-seven-defects-clearance-20261024.md`）→ 主人 10-24 平台侧拍板 approve → 过审链当日完成：四实体灌实（lot/car/exit/director）+ 8 条 acceptance checks 转真 + 契约 29/0 全绿 + 部署面预检（smoke 4/4 · port-gate web/wx PASS）。**真实 deploy 冒烟待实现轮 export/web 产出后由工作流 deploy 节点补**。
