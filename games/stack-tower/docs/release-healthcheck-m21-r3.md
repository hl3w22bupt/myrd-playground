# 发布体检（N1''）— stack-tower M2.1 正式发布轮 · 第三轮（r3）

> 签发：T4 游戏程序 · 日期 2026-09-26 · 性质：**发布对象对齐 + 程序侧发布链补全**（承接 r1/r2；响应驳回四点）
> 发布对象：**本 run 分支 `myrd/stack-tower-head-m21-sfx-pack-v1-cmuhvtn2w000vm97ccbverh1t` 的 HEAD**（驳回②口径）——已快进对齐至含 U6 修复与 r3 证据的最终门禁树，随 tag `stack-tower-m2.1-release-r3` 固化

## 0. 发布对象对齐（驳回②响应）

| 事实 | 实测（2026-09-26） |
|---|---|
| run 分支对齐前 HEAD | `a15f66b`（= origin/main，shallow 边界；**其树不含 `games/stack-tower`**——`git ls-tree a15f66b games/` 仅 `games/game`） |
| 对齐方式 | 快进（fast-forward）：`a15f66b` 是工作树 `9a9329b` 的祖先（merge-base 实测 = a15f66b），无冲突、零工程改动 |
| 对齐后发布对象 | r3 tag（见 §5），树内容 = M2.1 全量 + U6 修复 + r1/r2 收口文档 + r3 素材终检证据 |
| 门禁覆盖 | 本 tag 树上全量重跑（§3），满足「门禁跑完到打 tag 之间落新 commit 则全量重跑」 |

## 1. 发布面增量（对生产运行树 `6a6b4a8`，即 r2 部署）

- `git diff 6a6b4a8..<r3 tag> -- server/ games/stack-tower/export/ games/stack-tower/src/ games/stack-tower/sw.js games/stack-tower/manifest.webmanifest games/stack-tower/assets/ games/stack-tower/build/` = **空**（r3 新增仅为黑板/文档/门禁日志，发布面字节全等）。
- 结论：**生产已运行同发布面**（deployment `cmuhzflkk001mm97cxzu1tphg` @ `6a6b4a8`）→ 本轮不重复 deploy（N5 沿用 r2 部署记录），避免零价值空跑；r3 tag 与生产的发布面一致性由上式兜底。

## 2. 数值一致性核对（spec v1 冻结段，复跑）

- v1 冻结七组（DEFAULT_SEED / FIXED_STEP_MS / MAX_DT_MS / perfect_window / cut_width / scoring / difficulty）键序无关深比：**全等，零漂移**。
- `numeric.deploy.PRECACHE_REVISION = 1`（spec v3 approved `cmugok2uz000xm9ilx42t8pnl` L456 冻结段）：sw.js `CACHE='st-precache-v1'` 一致（r3 素材侧 `2-precache-coverage.log` 复核）。
- spec 零改动；sw.js 本体零改动。

## 3. 全量门禁矩阵（最终树，2026-09-26，证据 `gate-logs/release-m21-20260926-r3/`）

| # | 门禁 | 结果 | 日志 |
|---|---|---|---|
| 1 | maskable 像素安全区（美术） | **PASS 3/3** | `1-maskable-pixel-check.log` |
| 2 | precache 覆盖/REVISION（美术） | **PASS**（CACHE=st-precache-v1 · REVISION=1） | `2-precache-coverage.log` |
| 3 | sfx 注册表（美术复签） | **ART-SFX-REGISTRY-PASS 6/6** | `3-sfx-registry-check.log` |
| 4 | 资产（browser） | **PASS** | `4-assets-check.log` |
| 5 | 契约（A–E 口径） | **PASS 22/22** | `5-contract-check.log` |
| 6 | 契约（routine 口径） | **CONTRACT: PASS 62/0** | `6-routine-mode-contract-check.log` |
| 7 | 契约总盘 run-all | **PASS 22 / FAIL 0 / not-runnable 0** | `7-run-all.log` |
| 8 | 冒烟（browser） | **PASS** | `8-smoke.log` |
| 9 | 壳形态模拟（SW+断网） | **PASS**（头可达形态全链路闭环） | `9-shell-sim.log` |
| 10 | 类型（游戏） | **绿** | `10-typecheck.log` |
| 11 | 类型（壳，=平台构建 step2b 同命令） | **绿** | `11-server-typecheck.log` |

- 「audio events / bgm-loop」两文件为 D4 冻结件（裁定 4 既定处置），仓库不存在 → 不计门禁红，随回执单列。

## 4. N5 deploy 处置 / N6 对外放行处置（驳回①响应）

- **N5**：不重复 deploy。生产（`cmuhzflkk001mm97cxzu1tphg` @ `6a6b4a8`）与本 tag 树发布面字节全等（§1）；deploy 记录沿用 r2（含 AppHost deploymentId、manifestPath=`games/stack-tower/apphost.toml` 教训）。
- **N6**：**不复跑、不硬推**。R2（平台公网代理剥离 `Service-Worker-Allowed` + 路由护栏禁应用根静态路由）本轮实测仍无解除证据（代理 `:3001` sw.js 响应仍无该头；黑板/平台无主人裁决记录）→ 按铁律「门禁红两轮（QA-LIVE-M21-20260926-02 / -04）= 发布失败如实记录不硬推」，对外放行闸**维持关闭**，线上冒烟不做、notes 维持 HELD；解除依赖主人按 `qa-live-check-m21-r2.md` §三三选一裁决，工程侧已备妥（头可达形态 shell-sim 全链路 PASS）。

## 5. tag 与发布对象固化

- tag：`stack-tower-m2.1-release-r3`（打在门禁后最终提交；门禁树→tag 树发布面 delta=0 字节，惯例同 r1/r2）。
- run 分支 `myrd/stack-tower-head-m21-sfx-pack-v1-cmuhvtn2w000vm97ccbverh1t` 快进至同 commit，此后「当前分支 HEAD = 发布对象」持续成立。

## 6. 已知未收口（移交 QA 单列，沿 r2 口径）

- **U1** audio events/bgm-loop 冻结件（等 D5）· **U2** 真机三项 · **U3** iOS 真机 · **U4** v1.1 平台登记 · **U5** 试玩终裁 · **U7** 壳形态 Image 贴图链路（`server/src/boot-script.ts` 约 3 行，待排期）
- **R2** 平台头剥离 + 路由护栏（**对外放行闸未解除的唯一原因**，等主人三选一裁决）
