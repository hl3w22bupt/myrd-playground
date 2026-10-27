# N2 部署一致性自证三件套 — line4-unblock-jam（2026-10-27 · 程序件）

> 更新时间：2026-10-27T01:18Z ｜ 负责人：游戏程序 ｜ 下一步：QA 对账通过 → 放行 N3 试玩采集
> 全部证据为 2026-10-27 本机实跑（`@ 0675dd7540c0`），日志目录 `.myrd/blackboard/gate-logs/line4-n2-consistency-20261027/`。

## 件一：spec approved 版号 + sha

| 项 | 值 | 取证方式 |
|---|---|---|
| 平台链上状态 | **approved · version=2 · id `cmvlrc0ma001tm94ialxeykjn`** | `GET /api/v1/game-design-specs/cmvlrc0ma001tm94ialxeykjn` → 200 实测（2026-10-27） |
| 本地导出件 | `.myrd/spec/line4-unblock-jam/design-spec.json` | sha256 前 24 = `8236afaa74192b530168db60` |
| 构建产物 specAnchor | `cmvlrc0ma001tm94ialxeykjn@v2:approved` | `export/web/manifest.json` 直读 |

## 件二：部署 commit sha + 构建时间戳 + AppHost 渠道

| 项 | 值 | 取证方式 |
|---|---|---|
| 部署单 | `cmvolm4s7001fm91knv2x7mci` · **running** · error=null · mode=bundle | `GET /api/v1/apphost/deployments/:id` 实测（2026-10-27）；建单时间 2026-10-26T01:49:15.320Z |
| 部署 commit | **`4f8ad155`**（上轮远端 ls-remote 实证）→ HEAD `0675dd7` **源码面零漂移机判成立**：`git diff --name-only 4f8ad155 HEAD -- games/line4-unblock-jam` 仅 1 份 docs 文档，**非 docs 变更 = 0 文件** | 本轮 git 机判 |
| 仓内构建锚 | `export/web/manifest.json.gitSha = bc3cd5669e3161…`（与 main.mjs 锚行同值，10/26 续接轮三锚表口径） | 产物直读 |
| AppHost 坑位 | `cmvollw2z001dm91k4ptf30aw` · slug `line4-unblock-jam` · projectId `cmto0g28j0002m9sqnvjdy8o7` · status=ready | `GET /api/v1/apphost/apps` 实测 |
| **commitSha 字段披露** | 部署详情接口**不返回 commitSha 字段**（仅 id/status/mode/error）——部署 commit 采用上轮 ls-remote 实证值 + 本轮零漂移机判补链，两锚（bc3cd56 产物 / 4f8ad155 部署单）已在 10/26 三锚表对账 | 如实披露 |

## 件三：contract-check + 冒烟输出摘要（HEAD 复跑）

| 门禁 | 结果 | exit | 日志 |
|---|---|---|---|
| `node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project games/line4-unblock-jam` | **29 PASS / 0 FAIL** | 0 | `01-contract-check.log` |
| `node games/line4-unblock-jam/tools/smoke.mjs` | **SCAFFOLD-SMOKE PASS（4/4 面）**：确定性双跑 / 计数控名人 pending 增量=0 / telemetry 6 键全等+旁路拒绝 / sha 指纹在位 | 0 | `02-smoke.log` |
| `node games/line4-unblock-jam/tools/smoke-playable.mjs` | **20/20 局全 WIN · PASS=68 FAIL=0**（seeds 42..61 逐局，F3 六键实测载体） | 0 | `03-smoke-playable.log` |

## 带版本标识的试玩入口

- **入口**：`https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/`（或 `/gw`）
- **版本标识**：试玩者按 F1–F4 采集表 `build_version` 字段填写 `bc3cd56`（仓内构建锚）或 `4f8ad155`（部署单锚）；页内可核对面=dev HUD F4 面板。
- **采集窗状态**：开启中（a3 记录卡 + F1–F4 合并版反馈单见 `docs/spec/f1-f4-capture-sheet-20261027.md` §二）。

## QA 对账结论（放行判定）

| 检查 | 结果 |
|---|---|
| 件一 spec 锚 = 件二产物 specAnchor | ✓ 同值 `cmvlrc0ma001tm94ialxeykjn@v2:approved` |
| 件二部署单 running 且线上面存在 | ✓（liveUrl 在位；线上直读受沙箱网络面限制，沿 10/26 判例挂账不冒领） |
| 件三门禁 HEAD 复跑全绿 | ✓ 29/0 + 4/4 + 68/0 |
| **放行 N3** | **✅ 三件套齐，N3 试玩采集放行** |

—— 游戏程序（自证）· QA（对账放行）· 2026-10-27
