# R1 复测收口轮 · 证据档案（2026-10-15 · 本轮 N0 起）

> 四要素：文件名 / 日期(2026-10-15 UTC+8) / 命令 / 工作区根 = 仓库根（`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`）

| # | 文件 | 内容 | 命令 | 结论 |
|---|---|---|---|---|
| 00 | `00-verify-baseline-c6f9ea4.log` | N0 基线自证（合流后 HEAD `c6f9ea4` 树净） | `bash games/wheat-squad/verify.sh` | **VERIFY_EXIT=0**（五步全 PASS：统一契约 approved 对账 / 自有契约 16/0/1PEND / WS-SMOKE / SCOPE-GUARD ×2） |
| — | （对话留痕）链锚核对 | 导出件 `.myrd/spec/wheat-squad/design-spec.json` + 适配视图 `.myrd/spec/design-spec.json` vs 链 v5 `cmv7hekf3000mjofivl4ebhdf` | python sortKeys 深比 + updatedAt 比对 | **PASS 零漂移**（updatedAt 双边 `2026-10-14T02:20:27.925Z` 全等，spec 深等 True ×2） |

## 本轮前置实况（主策划勘察，2026-10-15）

- 团队续接分支原点 `6d59bef`（10-11）不含 R1 成果线（spec v1.3 工具面/复测件/黑板 R1 段在兄弟线 `myrd/r1-spec-v11-qa @ 5a6b979`）→ 依分支约定 `git merge --no-ff 5a6b979` 合入（冲突裁定：games/wheat-squad、spec 导出件、wheat-squad 子黑板、routines.yaml(N10/N13 修订)、contract-check-unified、server 壳 = R1 线代际（v15 LIVE 同源）；顶层黑板 = 工作室共板 ∪ game-9 归档区；.myrd-platform 技能件 = 平台注入版）。合流提交 `c6f9ea4`。
- g2-blocks（v17）/stack-tower 两坑生产面维持既有部署不动，未受本合并影响（本轮零接触红线继续）。
