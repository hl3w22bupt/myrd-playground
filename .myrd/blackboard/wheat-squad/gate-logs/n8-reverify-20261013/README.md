# N8 独立复核（2026-10-13 · 游戏程序 · verify-claims-not-blackboard）

> 触发：任务书重发承接轮黑板声称 N0–N7 全部完成（HEAD `304dacf`，分支 `myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1`，树净）。
> 纪律：不照抄黑板声称，当前 HEAD 独立实跑全部门禁与交付物核验。**结论：声称与实况一致，零偏差。**

## 复核矩阵（每条声称 → 独立实跑结果）

| # | 声称（黑板 N1–N6） | 独立实跑结果 | 证据 |
|---|---|---|---|
| 1 | verify.sh 五步全 PASS（统一 56/0 · 自有 16/0/1PEND · 冒烟四事件 · 守卫双模式） | **复现成立 · VERIFY_EXIT=0** | `01-verify-sh.log` |
| 2 | runner PEND 三态（含 pending 即非全绿 · 严格模式 exit 2 交 QA 预核） | **复现成立**：宽松 16/0/1PEND `ALL_GREEN=false` LENIENT_EXIT=0；严格 `STRICT_EXIT=2` | `02-strict-pend-sample.log` |
| 3 | spec 链 v4 `cmv60scie003hm9qqu91foe7v` 唯一 approved（meta v1.2 · acceptance 16 条 · e-telemetry 结构化 9 键） | **复现成立**：`--expect-version 4` 导出成功，链上导出 ≡ 仓内单源逐字节（DEEP_EQUAL=true） | `03-chain-export-deep-equal.log` |
| 4 | a3 实测初值（20 种子 P50=168.1s victory 20/20 带内） | **复现成立**：复跑逐值一致（确定性），`local-duration-log.json` 恢复提交版零漂移 | `04-build-determinism-a3.log` |
| 5 | 部署 v11 running@e3abcb9 · 资产路新字节在线 · W-3 页面路串线维持 | **复现成立**：页面 title=汽车连连看（W-3 仍在）；live main.mjs md5 `bcde4bea…` ≡ HEAD build | `05-live-w3-probe.log` |
| 6 | 构建确定性（部署字节=提交字节） | **复现成立**：`node tools/build.mjs` 重建后 `git diff build/` = 0 文件 | `04-build-determinism-a3.log` |

## 附带账实修复（本轮唯一增量）

- `levels.md`：补 spec v1.2 轮状态段（原停在 2026-10-12 口径）——本 README 为证据源。
- `assets.md`：补 manifest v2（guidance-hint-banner，10 件）程序线复证登记。
- `inventory-line2.md`：头部「下一步」行已过时（该增量已随 N1 落地），改为完成态指认。

## 边界声明

- 只复核 + 账本同步，零设计决策、零代码变更、零 spec 变更（`git diff e3abcb9..HEAD -- games/wheat-squad` 仅 docs/deployment-notes.md 文档面）。
- W-3 为平台 serving 层缺陷，维持升级运维/主人侧（解除判据：页面 title=麦浪小队 ⇒ smoke-live PASS）。
- 结论仅对 `304dacf01cac6e7ad192ac8dffbd26513cd48eee` 有效。
