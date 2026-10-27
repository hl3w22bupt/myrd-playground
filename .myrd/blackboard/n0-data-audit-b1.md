# N0 · 数据盘点（B1 上头循环轮 · 2026-09-29 · 程序+QA 只读 · 主策划整合）

> 更新时间：2026-09-29（N0 当日完成 · 主策划）
> 负责人：程序线（实测取证）+ QA 线（口径复核）· scope 判定归主策划，本文件只给数
> 下一步：结论即时上黑板 → N1 spec v1.4 按窄口径登记（missions 顺延）

## 一、三行对照表（门槛原文 vs PWA 实测）

门槛原文来源：spec v1.3 `content.analytics.targets`（B 轮启动门槛，v1.2 登记时写死）；口径注记同段 `content.analytics.note`。

| # | 门槛 | 门槛原文（逐字） | PWA 实测 | 样本量 | 是否足以决策 |
|---|---|---|---|---|---|
| 1 | 会话完成率 | `sessionCompletionRate = 85%（B 轮启动门槛：会话完成率，口径 = 到达 targetLayers(level) 或 game-over 前未中途流失）` | **无数据**（客户端 sink 为 no-op：`src/telemetry/emitter.ts` L120–138 `browserTelemetryDeps` 的 `sink: () => {}`；无 sendBeacon / fetch 上报；服务端无采集端点，见下） | 0 | ❌ 不足以决策 |
| 2 | 人均局数 | `avgSessionsPerUser = 3 局（B 轮启动门槛：人均局数）` | **无数据**（同上；anonId 已持久化 `st.telemetry.anonId`，但事件零落盘零回流） | 0 | ❌ 不足以决策 |
| 3 | 重开率 | `restartRate = 20%（B 轮启动门槛：game-over 后重开率）` | **无数据**（同上；restart 事件在枚举内但出口为空） | 0 | ❌ 不足以决策 |

**无回流链实证（三条，逐条可复现）**：

1. 客户端出口为空：`games/stack-tower/src/telemetry/emitter.ts` L138 `sink: () => {}`（默认装配 no-op）；全 src 无 `sendBeacon`，唯一 `fetch(` 调用是 sfx 资产加载（`src/platform/browser.ts` L47）。
2. 服务端无采集端点：`server/src/` 7 文件（index/boot-script/game-page/apphost-shim/runtime/asset-store/asset-bytes）grep `analytics|telemetry` 零命中；静态服务 `serve.mjs` 无 `/api` 路由。
3. 客户端无事件持久化：localStorage 仅 `st.settings.muted` 与 `st.telemetry.anonId` 两键，无事件队列/缓冲文件。

**判定说明**：三门槛均属 v1.2 登记时写明的「B 轮启动门槛（业务目标）」；其数据采集通道（上报 + 服务端聚合）从未建成，属 B1 前置欠账。**0 样本 → 按已锁定决策①「未达标或样本不足」分支执行**。

## 二、SW 缓存现状（N0 交付第二项）

- **策略**：fetch = **cache-first**（命中即返，未命中网络回填），`sw.js` L88–108。`index.html` 在 precache 清单内 → **用户可能长期滞留旧 index/旧模块**（B0 记录的 U6 立案同源）。
- **版本**：`CACHE = 'st-precache-v1'`，REVISION 真源 = `spec.numeric.deploy.PRECACHE_REVISION = 1`（`tools/gen-sw.mjs` L17–21，读不到显式失败）。
- **⚠️ 矛盾点（升级主策划拍板，本文件给出口径）**：B1 要求「SW 缓存版本递增」，但 `numeric.deploy` 位于冻结段（锚 sha256 `c3af773b…`，逐字节不可动）。**拍板处置**：版本递增改由工具侧管理——`gen-sw.mjs` 引入 `META_CACHE_EPOCH = 1`（B 轮常量），CACHE 名 = `st-precache-v{REVISION + META_CACHE_EPOCH}` = `st-precache-v2`；`numeric.deploy.PRECACHE_REVISION` 维持 1 冻结不动（语义注记：v1 基线值）。该口径随 v1.4 附录登记，契约可断言（CACHE 名非 v1 + index network-first）。
- **B1 策略变更**：`index.html` 改 **network-first**（超时/失败回退缓存副本），其余静态资源维持 cache-first——增量发布可见性由 index 可达性保证。

## 三、存档 schema 现状（N0 交付第三项）

| 键 | 写入方 | 内容 | 版本号 |
|---|---|---|---|
| `st.settings.muted` | `src/audio/audio-manager.ts` | `"1"/"0"` 静音开关 | ❌ 无 |
| `st.telemetry.anonId` | `src/telemetry/emitter.ts` | UUID v4 | ❌ 无 |

- **无 meta 层存档**：无最高分、无连胜、无每日挑战记录、无任务状态。
- **B1 迁移目标**：新键 `st.meta.save.v2`（JSON，带 `schemaVersion` + `createdAt/updatedAt`）；迁移器读取既有 v1.3 玩家痕迹（muted + anonId 保留沿用，零损），无 meta 旧键需要搬运 → **迁移语义 = 新增段 + 既有键零触碰**，fixture 断言既有两键迁移前后逐字节一致。

## 四、三钩子技术就绪度信号（给美术与程序，随本表即时上黑板）

| 钩子 | 就绪度 | 依赖面 | 信号 |
|---|---|---|---|
| daily-challenge | 🟢 高 | 日期→seed（新增 sfc32 + 字符串哈希，与内核 mulberry32 并列）；开局摆位复用现有 `numeric.opening`（3–5 块，seeded）| 不碰冻结数值；UTC+8 日期字符串入参可测 |
| streak-display | 🟢 高 | 存档新增连胜计数 + HUD 徽章位；数据源 = 本地局结果序列 | 纯增量，无外部依赖 |
| missions | 🟡 中 | 需埋点验证口径闭环（三类埋点 + 断网队列 + 去重）+ 任务 JSON 校验器 + 发奖幂等 | 可实现，但验收判据依赖埋点回流面——本轮样本为 0，验收口径无法实证 → **建议顺延**（决策归主策划） |

## 五、N0 结论（只给数 + 主策划拍板）

- **数**：三门槛实测全部无数据（样本量 0），数据采集通道未建成；SW cache-first + index 在 precache；存档 2 键无版本。
- **主策划拍板（依已锁定决策①）**：**scope_gate = 窄口径** —— B1 仅上 `daily-challenge` + `streak-display` 两钩子；`missions` 顺延下一轮（其技术件：missions JSON 校验器 + 发奖幂等 + 任务面板资产 id，随 v1.4 附录登记为「预留 id、本轮不实现」）。v1.4 以 `scope_gate` 字段落死此判定。
