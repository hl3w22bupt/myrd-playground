# 好玩判据本地埋点方案 v1 —— line3-tower-defense（2026-10-23 · P0-3 · 游戏程序署名件）

> 更新时间：2026-10-23 ｜ 负责人：游戏程序（本件）· 游戏策划（判据映射联签）· 游戏 QA（测量面复核） ｜ 下一步：实现轮（开启条件=主人反馈回流或下一行为面变更轮）随工程轮门禁落码；本轮零代码零资产（备而不动纪律）
> 硬约束：**不依赖平台 API**（遥测出账→本地持久层→文件导出，全程本机）；**事件键集合冻结**（meta.telemetryFields 八键 = fnd-1 机判锚，本方案零新增零改名）

## 一、三判据 ↔ 既有遥测字段映射（零新增事件键）

| 好玩判据 | 既有字段（八键内） | 计算式（测量方法） | spec 挂点 |
|---|---|---|---|
| **单局时长**（真人口径） | `run_end.run_duration_ms`（game.ts:150 已出账）· `run_start.seed` | 逐局取 run_duration_ms，按会话聚合 P50/P90；**与 a2 模拟局口径分开统计不混算** | a2 真人面对应面（v1.1 增补表述） |
| **再来一局点击** | `restart_clicked.count` + `atMs` | 会话级 count ≥1 判「有点击」；点击率 = 有点击会话 / 到达结算页（run_end）会话 | a5/fnd-1 机面已机判 + a3 真人面意愿主条 |
| **首 30 秒流失** | `run_start` + `first_placement_at` + `run_end` 复合判定 | **流失 = 会话内 run_start 后 30,000ms 内无 first_placement_at 且无 run_end（含中途离开）**；流失率 = 流失会话 / 有 run_start 会话 | a1 真人面对应面（v1.1 增补表述；a1 机面阈值一字不动） |

## 二、关键缺口与本地持久层设计（实现轮草案 · 本轮不落码）

**缺口**：中途离开（未到 run_end 即关页）时，进程级缓冲随页面销毁丢账 → 首 30 秒流失会漏计「未布防即走」的最大流失人群。

**本地持久层（零平台 API、零网络、零个人身份信息）**：

1. **存储**：`localStorage["l3.tl.v1"]`，JSONL 追加，逐局一条 summary：
   `{session_id, seed, run_duration_ms|null, first_placement_at_ms|null, restart_count, ended:"victory"|"defeat"|"abandoned", recorded_at}`
2. **flush 时机**（防丢账四时机）：`run_end` / `restart_clicked` / `visibilitychange→hidden` / `pagehide`。已知局限如实披露：部分 WebView `pagehide` 不保证触发 → 以 run_end/点击即时落盘为主、离开信号为辅；`ended:"abandoned"` = 有 run_start 无 run_end 的会话在下次启动时补记。
3. **导出面**：游戏页 URL 带 `?telemetry-export=1` → 触发本地文件下载（浏览器下载动作，非平台 API）；主人/试玩者线下回传文件，与 a3 记录卡同批回收。
4. **session_id**：会话首次进入时本地生成随机 id，仅用于去重计数，不含任何身份信息。

## 三、样本计划与判读纪律

- 样本 = a3 同批 5 名真人（W-L3-3 合并采集，省一次组织成本）；**观测型，不设达标线**：三判据阈值均为观测型初始锚定，真人样本回流后走 revision 校准（numeric 初始锚定值判例同构，不编实测数）。
- 冻结纪律：本方案不触发 fnd-1（键集合零改动）、不触发 a1/a2 既有阈值（一字不动）、不触发 numeric 段（逐字节冻结）。
- 判读分工：QA 回收导出文件 → 机判计算式出数 → 与 a3 记录卡原话互证（点击行为 vs 自述理由）。

## 四、与契约面的关系（三问预审结论的落地面）

1. 本文件 = spec v1.1 修订中 a1/a2「真人面对应面」表述引用的**测量方法附件**（修订经 `POST /api/v1/game-design-specs/:id/revisions` 入链，version+1，父版 superseded，已达阈值一字不动）。
2. 实现轮落码（持久层 + 导出面）随工程轮 verify.sh 五步门禁（含 fnd-1/a5 回归）执行，本轮零代码（备而不动：反馈未回流不开 R1、不产新资产）。
3. QA 复核结论：测量面全部为数值谓词与计数谓词，无「流畅/有趣」类模糊词，与 acceptance 四要素口径一致。
