# QA 对内放行回执 — stack-tower M2.1 正式发布轮 · 第三轮（N2''，r3）

> 回执编号：**QA-REL-M21-20260926-05**（前序：01=r1 对内 · 02=r1 对外 · 03=r2 对内 · 04=r2 对外）
> 签发：T5 游戏 QA · 日期 2026-09-26 · 性质：**第一段「对内放行」闸（r3：发布对象对齐后树）**
> 放行对象：tag `stack-tower-m2.1-release-r3`（= run 分支 `myrd/stack-tower-head-m21-sfx-pack-v1-cmuhvtn2w000vm97ccbverh1t` 快进后 HEAD）

## 一、放行判据核对（只认文件级证据）

| 判据 | 结果 | 证据 |
|---|---|---|
| 发布对象 = 当前分支 HEAD | **已对齐** | `release-healthcheck-m21-r3.md` §0：run 分支自 `a15f66b` 快进至本 tag（fast-forward，零工程改动） |
| 程序发布体检（N1''） | **PASS** | `docs/release-healthcheck-m21-r3.md`：发布面对生产运行树字节全等；v1 冻结七组深比全等；REVISION=1 一致 |
| 门禁矩阵（11 项） | **全绿** | `gate-logs/release-m21-20260926-r3/` 1–11 号日志（美术五项 + 程序六项；routine 62/0 · A–E 22/22 · run-all 22/0/0 · smoke PASS · shell-sim PASS · 双 typecheck 绿） |
| spec 零改动 | **确认** | 平台 v3 approved（`cmugok2uz000xm9ilx42t8pnl`）未动；sw.js 本体零改动（REVISION=1） |
| 素材终检（美术，只检不新做） | **四项全 PASS + 复签** | `art-final-check.md` + 1/2/3 号日志；检对象树与本 tag 树**发布面字节全等**（`git diff 436be68..<tag> -- <发布面>` 为空），证据可转移性成立 |

## 二、对外放行闸状态（驳回①响应——不硬推）

- **不复跑 N6、不做线上冒烟**：R2（平台公网代理剥离 `Service-Worker-Allowed` + 路由护栏禁应用根静态路由）无解除证据（本轮实测代理响应仍无该头；无主人裁决记录）。r1（QA-LIVE-M21-20260926-02）/ r2（QA-LIVE-M21-20260926-04）对外已两轮 FAIL，按铁律**如实记录、不硬推**。
- **闸门状态：关闭**。解除条件 = 主人按 `qa-live-check-m21-r2.md` §三三选一裁决（a 代理放行头【推荐】/ b 放宽路由护栏 / c 非代理托管形态）；解除后工程侧零改动即可复跑 N6（shell-sim 已证头可达形态全链路 PASS）。
- **notes 维持 HELD**：`release-notes-m21.md` 不得对外宣告「可安装/断网可玩」。

## 三、N5 deploy 记录（沿用，不空跑）

- 生产 deployment：`cmuhzflkk001mm97cxzu1tphg` @ `6a6b4a8`（r2 部署，running）。
- 本 tag 树与其**发布面字节全等**（healthcheck-r3 §1 diff 为空）→ 无新增 deploy 必要；生产↔tag 一致性由该 diff 兜底。

## 四、已知未收口项（单列）

- **U1** `tests/audio/events.test.ts` / `tests/audio/bgm-loop.test.ts` D4 冻结件（裁定 4，等 D5 答复，不重复立案）
- **U2** 真机三项（acc-a2/m2/m3 + a5b 真机口径）· **U3** iOS Safari 真机（B6 挂日期）
- **U4** spec v1.1 平台登记（payload 就绪，等 D4/D5）
- **U5** 主人试玩终裁
- **U7** 壳形态 Image 贴图链路（boot 补丁 base64→文本 blob → 程序化降级；不影响可玩；修复点 `server/src/boot-script.ts` 约 3 行，待排期）
- **R2** 平台头剥离 + 路由护栏（**对外放行唯一阻塞**，等主人裁决）

## 五、结论

**对内放行：PASS**（r3 树）。对外放行闸**维持关闭**（R2 未解除，两轮 FAIL 后不硬推）；本回执放行范围止于对内（工程/门禁/素材面），版本链登记见 blockers.md §版本链登记（r3 行）。
