# 黑板 · 阻塞项（blockers.md）

> 主策划整合更新（2026-09-12，v1.2 拍板轮）。规则：阻塞超过一轮解决不了 → 升级主人，不空转。

## 当前阻塞（升级主人，与 Team Lead 升级口径一致）

| # | 项 | 影响 | 状态 |
|---|---|---|---|
| B1 | 平台 `game-design-specs` 接口不可达 | v1.2 approved 为 offline 落文盖章；正式版本链待 `POST /api/v1/game-design-specs/:id/revisions` 补建（待归位清单见 v1.2-approval-record.md §5） | 升级中（主策划本线无 Bash 无法复测；恢复后主策划执行归位） |
| B2 | 工作区黑板此前不存在 | 已由主策划初始化本三文件（工作区落位版）；平台侧黑板仍待恢复 | 部分解除 |
| B3 | 工程仓库注册 0 个 / Open Design daemon 不可达 | 证据落 repo（现行约定）；美术 preview.html 无法建 OD 项目在线评审 | 升级中 |

## 本轮新增阻塞 / 风险（整合发现）

| # | 项 | 等级 | 处置 |
|---|---|---|---|
| B4 | 全轮各线运行时无 Bash → 四组测试与 bot-sim 100 场**未实跑**，git 提交未执行（本轮改动均在工作区磁盘，待有 Bash 会话 `git add -A && git commit && git push origin myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`） | 高 | 验证命令清单：`pixel-fives/docs/dev/evidence-prog-m1.md` §6；9/19 DoD 复盘前必须实跑 |
| B5 | 主策划本线无 Bash | 事实 | 本线职责（复核/拍板/预排/版本链）均以文件工具完成，不阻塞 |

## 已解除

| 项 | 解除方式 |
|---|---|
| spec 未 approved（QA verdict 前置缺口） | ✅ 2026-09-12 主策划盖章 v1.2 approved（六问全 yes）；程序翻转槽位、QA 出 verdict、美术量产同步解锁 |
| 风格卡/首批资产未获批 | ✅ 同日盖章 v1-APPROVED + manifest 全量 approved |

## 下一轮看板

1. 程序线：翻转 `PENDING_APPROVED_SLOTS`（含 `bot.*` 两条别名）并回报 → contract-check mode=approved errors=0；
2. QA：三份输入已齐 → 按 spec §6 出 verdict（bot-sim 实跑 + 同 seed 复跑逐字节）；
3. 美术：量产首批 → `gen-assets.mjs` 预算闸门 + bytes 回填；
4. 主策划：9/19 M1 DoD 复盘；M2 预排三项待主人拍板（合规路径/提审节奏/变现边界，见 m2-preplan §7）。
