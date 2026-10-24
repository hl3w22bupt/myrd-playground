# QA 对内放行回执 — stack-tower M2.1 正式发布轮

> 回执编号：**QA-REL-M21-20260926-01**
> 签发：T5 游戏 QA · 日期 2026-09-26 · 性质：**第一段「对内放行」**（deploy 前置闸）
> 对象：release tag `stack-tower-m2.1-release` @ commit `5a3284fa137a3926fabb5f7b4fcdd098bd075df3`（分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`）
> 判据纪律：**只认文件级证据**（文件名 + 日期 + 命令 + 输出摘要 + tag hash，v1.1 D3 证据格式）；无文件证据不采信

## 一、放行判定：**对内放行 PASS**（附「已知未收口项」单列，不阻塞对内，全部挂账在案）

## 二、文件级证据清单（QA 独立复核，非转抄程序自述）

| # | 证据项 | 文件/命令 | 日期 | 输出摘要 | QA 复核方式 |
|---|---|---|---|---|---|
| E1 | 发布体检报告 | `games/stack-tower/docs/release-healthcheck-m21.md`（tag 树内） | 2026-09-26 | 增量 12 文件全归类零范围外；冻结七键三方 EQUAL；PWA 专项 PASS；准予打 tag | 已读全文，结论与下述 E2–E6 一致 |
| E2 | 门禁① unified | `.myrd/blackboard/gate-logs/release-m21-20260926/1-routine-mode-contract-check.log`（65 行，tag 树内） | 2026-09-26 | `node scripts/contract-check.mjs --spec .myrd/spec/stack-tower-spec.json --project .` → `CONTRACT: PASS`，合计 **62 PASS / 0 FAIL** | tail 原文行核读 |
| E3 | 门禁② A–E | `…/2-ae-mode.log`（8 行，tag 树内） | 2026-09-26 | `RESULT: PASS（spec ↔ 工程一致）`，[B] 22/22 实跑 | 同上 |
| E4 | 门禁③ run-all | `…/3-run-all.log`（143 行，tag 树内） | 2026-09-26 | `PASS 22 / FAIL 0 / not-runnable 0`；含 a4a/a4b、a5a/a5b、a6、d2 断网全链路 + sfx 404 负面用例 | 同上；d2 段两行 `ok` 逐条核读 |
| E5 | 门禁④⑤ smoke/assets | `…/4-smoke.log` + `…/5-assets-check.log`（tag 树内） | 2026-09-26 | 双 `RESULT: PASS (browser)`（非降级；降级版已被程序自捕并重跑，报告 §3 坑位留证） | 核对 `(browser)` 字样与零 pageerror 行 |
| E6 | 门禁⑥ build/typecheck | `npm run build` / `typecheck`（tsc） | 2026-09-26 | 双 exit 0；重编译后 `git status` 发布面零漂移；`build/ ≡ export/web/build/`（27 文件 diff 空） | QA 侧复验 `git diff f908217..stack-tower-m2.1-release -- games/ scripts/` = **0 字节** |
| E7 | tag 与证据同树 | `git ls-tree stack-tower-m2.1-release .myrd/blackboard/gate-logs/release-m21-20260926/` | 2026-09-26 | 5 份日志全部在 tag 树内 | QA 直接对 tag 对象执行 |

## 三、「门禁跑完 → 打 tag 之间落新 commit」复核（放行专项）

- 门禁于树 `f908217` 实跑全绿 → 日志落盘 commit `5a3284f`（= tag 树）→ 立即打 tag。
- 间隔 commit 仅 1 个，内容 = `git diff f908217..5a3284f --name-only` → **仅 `.myrd/blackboard/gate-logs/release-m21-20260926/3-run-all.log`**（证据日志刷新）。
- 发布面（`games/stack-tower/{src,export,sw.js,manifest.webmanifest,assets}` + `scripts/`）diff = **0 字节** → 门禁覆盖对象零变化，**不触发全量重跑**（QA 裁定：证据追加 ≠ 内容变更；口径与体检报告 §6 一致）。

## 四、增量与数值复核（抽证）

- `git diff 75debf9..stack-tower-m2.1-release --name-status` = 12 文件：平台注入 3 + 黑板/spec 治理 6 + 测试/spec 工具链 3；**游戏运行时文件零变化**（范围外文件零容忍 → 满足）。
- 冻结数值：v1 / 平台 v3 approved / 导出件三方键序无关深比七键全 EQUAL（QA 抽验脚本输出与体检报告 §2 一致）；spec 零改动（本轮无 POST revisions 调用，平台 version 仍为 3）。

## 五、已知未收口项（单列，挂账在案，不阻塞对内放行）

| # | 项 | 状态 | 依据/挂账位 |
|---|---|---|---|
| U1 | `tests/audio/events.test.ts`、`tests/audio/bgm-loop.test.ts`（任务书门禁清单「audio events / bgm-loop 冒烟」） | **文件不存在**，属 v1.1 D4 冻结件（主人答复 D5 前冻结） | blockers.md 裁定 4 + B8；本轮按「接口实查为准」判例处理 |
| U2 | 真机三项 + 帧率真机口径（acc-a2 首手势解锁 / acc-m2 触控归一 / acc-m3 遮罩暂停 / a5b 真机录屏） | 自动化面全绿，真机未核销，**不判完成** | B6（挂主人排期；证据=设备型号+录屏） |
| U3 | iOS Safari 真机单列（型号+UA；首触解锁/静音键/后台切回） | 对外放行段仅能做自动化模拟面；真机项并入 U2 | B6 |
| U4 | spec v1.1 平台登记 | 冻结于 D4/D5；payload 就绪、权限障碍已解除 | B8 |
| U5 | 「好不好玩」人工终裁 + e05 开局体感人工列 | 主人试玩未做 | B3 代持台账 |

## 六、放行效力

- 本回执 = 第一段放行闸。deploy（N5）凭本回执执行；**deploy 成功 ≠ 发布成功**，对外宣告以第二段「对外放行」（N6 线上冒烟）为闸。
- 红线声明：门禁红两轮 = 发布失败如实记录不硬推（本轮未触发，一轮全绿）。
