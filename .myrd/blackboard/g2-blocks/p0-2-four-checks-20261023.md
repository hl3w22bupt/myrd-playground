# 产品线 2（g2-blocks《熔炉方块》）收口四查 —— 提审就绪 vs 退打磨中（2026-10-23 · P0-2 · 游戏 QA 主审署名件）

> 更新时间：2026-10-23 ｜ 负责人：游戏 QA（主审）· 配合：游戏策划（派生核对表）/ 游戏美术（合规自查+体积预算）/ 游戏程序（缺口清单）· 主策划（整合）
> 下一步：**退「打磨中」（R3）**，差项 G-1..G-8 进子黑板 blockers.md 与共板；R3 闸门 =「B-6 链面修复（revision 入链+主人 approve）+ 主人提审凭证 + approve 后门禁全量复跑绑新 sha」三项（10/18 修正口径维持）
> 输入基线：源仓检出 `dy/port-v1.1` @ `023e5838`（树净）· 部署源面 `sync/dy-v1.3` @ `9c27438`（worktree g2-blocks-main）· wx 线头 `wx/port-v1.1` @ `4fba03a`（worktree g2-blocks-wx）· 契约导出件锚 v9/1.6（`_platform` 实况）· **链上实况：v1–v10 全 superseded、approved=0（2026-10-23 共板 API 通道读回确认）**

## 四查结论总表

| 查 | 内容 | 结论 | 关键证据 |
|---|---|---|---|
| **① 归档完整性** | sha 答复 / 互查 / QA 核签 三类记录指向同一 spec 版本同一 sha | **部分通过（1 差项 G-3）**：答复 v2（`trackb-sha-answer-20261018.md`）↔ QA 核签 v2（`qa-trackb-signoff-20261018.json`）**同指同锚**——三 sha 组 {检出 `023e5838` / 部署源面 `9c27438` / 部署提交 `2bb69c7`} + spec 锚 v9/1.6（导出件 `_platform` 实况一致，本轮复读核对）；**互查件（QA-RECON-D1-20261011-01，源仓 `docs/qa-recon-d1-20261011.md` @ `db01bc7`）绑定的是 10/11 N1 对账基线，未对 10/18 复跑面重出** | 本轮复读两件 v2 原文 + 导出件 `_platform` 比对 |
| **② 提审硬门禁记录** | 双平台 contract-check+冒烟最近通过记录对应当前 sha · 违规标识符扫描 · 移植轮复跑 | **部分通过（1 决定性差项 G-1 + 1 低风险差项 G-4）**：**dy 面 ✓**——10/18 复跑对应当前双线 sha（`023e5838` 线 contract v1.1 存档锚 18/18 + 八件聚合 8/8 · `9c27438` 线 check-v13 四态 + contract v9 29+1PEND + dy 三条 27 PASS + dy-smoke PASS J1=146.1ms，日志 `g2-blocks/gate-logs/sha-answer-rerun-20261018/00..03` 本轮复读在档）；**移植轮（dy/port-v1.1）复跑记录 ✓ 绑 `023e5838`**；**违规标识符扫描（wx 反扫 tt 零命中）最近记录 = 10/11 @ `4fba03a`**——wx 线头至今未变（本轮 `git log -1 wx/port-v1.1` 实证 `4fba03a` 2026-10-05）→ 记录仍对应当前 wx sha，但 wx 面未随 10/18 复跑（G-4）；**决定性缺口 G-1：链上 0 approved，契约绿绑的是仓内 approved 存档锚/共同输入导出件，非链上 approved 资质** | `02-revparse-g2-source.log`（P0-1）+ 复读 10/18 复跑日志 |
| **③ 材料清单派生性** | 材料清单逐项可溯源到 spec 字段 | **结构可溯源（策划件已逐项对表）· 派生源链面失效（差项 G-5）**：dy kit v3（部署源面在档）逐 id（dy-share-card/dy-icon/dy-store-screenshot-01..03/dy-appid/compliance-copy）有规格来源+落点+状态；但其 **spec 锚 = 链 v6（draft→superseded）+ 链 v10（draft→superseded）**——派生源在链上已无 approved 资质（B-6 连带） | `g2-blocks-main/docs/platform/dy/dy-submission-kit.md` + 派生核对表（策划件） |
| **④ 差项清单** | 全量差项 | **G-1..G-8**（见下节） | — |

## 二选一裁决

> **退「打磨中」（R3 继续）**——四查未全过（②决定性 G-1 + ①G-3/②G-4/③G-5），且 G-1/G-2 均在主人侧，团队面无法单方关闭。
> 依据：QA 核签 v2 判例口径（chainApprovedPresent=FAIL 即不可提审就绪）+ 本轮四查复认。**非「提审就绪」**：正式提审三硬前置（链面 approved 资质、提审日人工核对记录回填、DC-10 工具侧/真机档）无一在位。

## 差项清单（G-1..G-8 · 逐项负责人 + 关闭判据）

| # | 差项 | 负责人 | 关闭判据（以门禁/接口记录为准） |
|---|---|---|---|
| **G-1（决定性）** | 平台链 0 approved（v1–v10 全 superseded）→ 契约面失效 | 主人 approve（revision 入链=团队配合） | `POST /:id/revisions` 出新 draft → `POST /:id/approve` 200 → 链上唯一 approved 回查 + 导出件换基线零漂移 |
| **G-2（决定性·升级主人）** | 正式 AppID / 私钥 / 类目资质（dy + wx 双平台）未下发 | **主人** | 凭证下发 → `project.config.json` 占位 `touristappid` 替换 → 材料清单 🚨 行转 ✅ |
| G-3 | 互查件（QA-RECON-D1）绑 10/11 基线未重出 | 游戏 QA | R3 链面修复后随全量复跑对 10/18+ 基线重出互查回执（新绑 sha 与答复/核签一致） |
| G-4 | wx 面（反扫+门禁 7+9+15）未随 10/18 复跑（记录绑 `4fba03a`，线头未变仍对应当前 sha） | 游戏程序 | R3 复跑批：wx worktree 反扫 + wx 门禁 exit 0 留档（env 锚定判例） |
| G-5 | 材料清单 spec 锚指向 v6/v10（均已 superseded） | 游戏程序+主策划 | G-1 关闭后 kit 头 spec 锚刷新为新 approved 版（revision 面声明随链） |
| G-6 | 商店截图三张 v1.3 形态重摄挂账（10/11 N2 判「提审前必办」） | 游戏美术 | 重摄 3 张 @ 当前部署源面形态 + manifest sha256 三面全等机判 |
| G-7 | DC-07 适龄/分级 + DC-09 工程形态字段 = 提审日人工核对（占位冻结口径②）；提审日核对表待回填 | **主人（提审日）** | 官方生效规范逐条人工核对 + 记录回填（日期+结论+核对人） |
| G-8 | DC-10 抖音开发者工具 CLI 本机未装（工具侧编译/真机首启档缺） | **主人（环境）** | CLI 在位 → `tools/verify-dy-devtools.mjs` 一键复跑 PASS |

## 升级主人（本件新增/维持）

1. **G-2 凭证**（维持升级）：dy-appid/私钥/类目资质 + wx 同批——**未下发前团队不越权提审（红线）**。
2. **G-1 链面 approve**（维持升级）：v11（或直挂 v10 线）revision 入链后由主人 approve 恢复契约资质。
3. G-7/G-8（新增明示）：提审日人工核对与 CLI 环境，两项均主人侧动作，团队已备好执行件与 runbook。

——联署：游戏 QA（主审 · 限制性核签判例延续）· 主策划（裁决登记）
