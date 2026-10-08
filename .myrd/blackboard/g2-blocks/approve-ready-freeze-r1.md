# approve-ready-freeze-r1.md — 链 v7 封版包拍板包（封版就绪冲刺第 1 批 · 2026-10-08）

> 负责人：主策划（N1 · 拍板包唯一出具位）
> 提请对象：主人（approve 是人的动作——红线：机器不替人判断）
> 版本标签映射（防第三套命名漂移，先读这张表）：

| 口径 | 值 | 说明 |
|---|---|---|
| 平台链版本 | **v7** | `POST /revisions` version+1 实测 |
| 链上 id | `cmuyvvhql0043m93eu777kop8` | status=draft（approve 归主人） |
| spec 内容版本（meta.version） | **1.5** | 沿链上惯例（wx 轮占 1.3 / dy 轮占 1.4） |
| 任务书口径 | 「v1.3 启动包」 | ≈ 本包（链 v7 / meta 1.5）；差异系 wx/dy 平台段轮占用了 1.3/1.4 标签 |

## 一、本包四项增量（任务书 N1 口径逐项）

| # | 增量 | 落点 | 状态 |
|---|---|---|---|
| ① | 3 引导锚点事件实体（含属性定义） | entities `e-evt-first-screen` / `e-evt-first-drag` / `e-evt-first-place`（eventId/trigger/payload/once/surface/owner 六属性） | ✅ 入 v7 |
| ② | 埋点 9 事件表入 acceptance（程序 8 + 美术 share_clicked，已批准并入） | acceptance `ac-29-analytics-nine-events`（active，events 9 行含触发点/载荷/surface/once/owner） | ✅ 入 v7 + N4 已落地 + 契约件 PASS |
| ③ | 封版 DoD 三层门数值入 acceptance（全部待校准） | acceptance `ac-30-freeze-dod-gates`：留存门 D1≥30% / D7≥10% + 参与门 局均≥3min + 回访门 重开率≥40%（calibration=pending ×4） | ✅ 入 v7（PEND 显式挂起） |
| ④ | near-miss 反馈系统 + 结算页信息架构（候选池 1/2） | entities `e-nearmiss` / `e-settlement` + `world.uxCommitments[2]` + acceptance `ac-31` / `ac-32`（assertion=pending/implementation）+ `numeric.uxProposal`（status=proposal） | ✅ 入 v7（PEND 显式挂起；数值全提案态） |

## 二、基线修复披露（请主人知悉后再拍板）

**链上回归（本轮修复）**：v5(wx 平台段)/v6(dy 写案校准) 两轮基于 v1.1 的 18 条基线建版（对移植线自洽），但链头因此**未继承链 v4 手感轮增量**——v1.2 冻结范围（已实现 + 已部署 r3 + N4 APPROVE-READY 的那版）在链头处失真。v7 = **找回 v4 全量 + 保留 v6 平台段 + 四项增量**：

- numeric：+`feel`/`daily` 两组（与 v4 逐字节全等）；v6 的 13 组逐字节未动；唯一新增组 `uxProposal`（status=proposal，不进任何实现读路面）。
- assets：+a04..a07 四项（全等）；content：+dailyChallenge（全等）；acceptance：+ac-22..28 七条（全等）。
- 机判：十三道守卫全绿（`tools/build-spec-v15-freeze.mjs`，源仓 `5e7f2e5`）。

**顺延项确认**：v3 提案（combo 倍率 / level-stars 派生式 / 第一分钟引导方案本体）继续零实体零验收不入本版（守卫⑫机判）。

## 三、契约三态证据（2026-10-08 实跑）

| 装载态 | 结果 | 意义 |
|---|---|---|
| Mode A（v1.1 approved 18 条） | **18/18 PASS / 0 FAIL / EXIT=0** | 已提交基线零回归 |
| Mode B（链 v7 draft 29 条） | **26 PASS / 0 FAIL / 3 PEND / EXIT=0** | v7 面：找回 7 条 + ac-29 全绿；3 条 PEND=待校准/待实现显式挂起（尾行明示） |
| 前版保留 | v1..v6 六行在链 · v6 锚 `bcc46580…` 零接触 | 版本链零覆盖 |

- v7 numeric 锚：`19661d90b8de07c6…`（sha256(sortKeys)，node 规范化）。
- ac-29 双向断言 = spec 事件表 ↔ `src/telemetry/analytics.ts` 代码镜像 ↔ main.ts call site 三面全等。

## 四、提请主人拍板（逐项）

1. **链 v7（封版包）approve** —— approve 即 approved 唯一；不 approve 则本包作 draft 保留在链（零覆盖，可继续修订）。
2. **四项增量取向追认**（②③④主人已批准并入/点名折入，本包为落实确认；①为②的实体面）。
3. **PEND 三条的转正路径确认**：ac-30（DoD 三层门）待封版上线后 ≥14 天数据回流 → 主人拍板校准值 → v1.x 修订转正式数值 + 契约件；ac-31/32（候选池 1/2）随 v1.3 实现轮随片先红后绿转正式契约件。
4. **numeric 红线核销确认**：现有全部 numeric 组零改动（守卫④机判）；`uxProposal` 仅提案态，approve 不等于提案数值生效。

## 五、approve 后动作（条件写死）

| 节点 | 触发 | 门禁 |
|---|---|---|
| 平台 approve 接口落卷 | 主人回复 approve | `POST /api/v1/game-design-specs/cmuyvvhql0043m93eu777kop8/approve` → 复跑 Mode B（尾行应转 approved）→ 导出件对齐 |
| v1.3 实现轮开工 | v7 approved | 顺序 = 候选池 1（near-miss）→ 候选池 2（结算页 IA）；每片先红后绿；numeric.uxProposal 转正式组走当轮修订 |
| DoD 三层门校准 | 封版上线 ≥14 天 | 平台面板数据 → 主人拍板门槛 → v1.x 修订 |

（本包为呈批材料；「好不好玩」与 approve 终裁归主人。）
