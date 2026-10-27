# N2 部署一致性自证三件套 — line4-unblock-jam（2026-10-27 · 程序件）

> 更新时间：2026-10-27T02:05Z（**重部署批刷新段见文末 §四，现行锚以该段为准**） ｜ 负责人：游戏程序 ｜ 下一步：QA 对账通过 → 放行 N3 试玩采集
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

## 四、重部署批刷新（2026-10-27T02:05Z · 程序件 · **现行锚以本段为准**）

> 触发：黑板挂账项⑥（驳回建议①：渲染层零裸 hex → theme token 单源 + acc-05 断言⑤）按「下一部署批一次做齐」兑现；捆同批完成挂账项⑦（线上 `__L4_BUILD__` 归档）。日志目录 `.myrd/blackboard/gate-logs/line4-hex-token-deploy-20261027/`（10..14 号原件 + verify 01..09）。

### 件一：spec approved 版号 + sha（复证不变）

| 项 | 值 | 取证方式 |
|---|---|---|
| 平台链上状态 | **approved · version=2 · id `cmvlrc0ma001tm94ialxeykjn`** | `GET /api/v1/game-design-specs/:id` → 200 实测（2026-10-27 本轮复证）；spec 零改动零 revision |

### 件二：部署 commit sha + 构建时间戳 + AppHost 渠道（**全量刷新**）

| 项 | 值 | 取证方式 |
|---|---|---|
| 部署单 | **`cmvq14lhy00j1m91krnulup8w` · running · error=null · mode=bundle** · finishedAt=2026-10-27T01:52:11.137Z · durationMs=834 | `GET /api/v1/apphost/deployments/:id` 实测（`12-deployment-final.json`） |
| 部署 commit | **`de5aefa0c56c6f18e2ba07d37e3290db139bdd31`**（=产物提交=推送时远端 HEAD，`git ls-remote` 实测同值） | **接口明细本轮直接返回 `commitHash` 字段——上轮「接口不回 commitSha」披露缺口就此关闭**（list 视图仍不回，detail 视图回） |
| 仓内构建锚 | `export/web/src/main.mjs:1 __L4_BUILD__.gitSha = 1b101a45e49c02d…`（=源码提交 `1b101a4`，两段式提交：源码先行、产物随建） | 产物直读 |
| **线上锚（挂账项⑦ 归档完成）** | **`1b101a45e49c02d…` ≡ 仓内构建锚同值**（`curl -sL https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/api/public/assets/src/main.mjs \| head -1` 实测） | `13-live-entry.log` / `14-online-bytes-diff.log` |
| **部署字节=提交字节（机器级）** | 线上 vs 仓内 sha256：`src/main.mjs`/`manifest.json`/`landing.html` **3/3 全等 MATCH** | `14-online-bytes-diff.log` |
| 环境面变化披露 | 上轮「tailscale 域名沙箱不可达(000)/资产路由 404」本轮**已可达**（308→200 跟随重定向；`:3111` 网关资产路由仍 404，沿判例登记为网关面限制） | 如实记录 |
| AppHost 坑位 | `cmvollw2z001dm91k4ptf30aw`（slug/sourceId=`line4-unblock-jam`，POST 前复核绑定归属；**坑复用零新建**，旧单 `cmvolm4s7…` 保留可回滚） | `GET /api/v1/apphost/apps` 实测 |

### 件三：contract-check + 冒烟输出摘要（新锚复跑）

| 门禁 | 结果 | exit | 日志 |
|---|---|---|---|
| `verify.sh`（WX=1 全量 17 步） | **17 步全 PASS**（含契约 29/0 + 套件 8+1 件 + smoke 4/4 + port-gate web/wx + 资产 31 断言 + 构建 + 壳契约 guard） | 0 | `01..09` 号日志 |
| `tools/smoke-playable.mjs`（**口径勘误 2026-10-27T02:45Z**：为「仓内最新产物复跑 + 线上字节全等间接覆盖」——verify 09 号日志（09:49:27）早于部署（09:54:52），其对象为重锚前构建；对部署字节的直接绿证=16 号落档复跑（对象=仓内 export/web 最新产物，与线上字节全等由 14 号 sha256 3/3 间接闭合）） | **20/20 局全 WIN · PASS=68 FAIL=0** | 0 | verify `09` + `16-smoke-playable-repo-artifacts.log` |
| acc-05 断言面 | **4→5 断言**（新增⑤「渲染层零裸 hex，theme.ts 唯一落点」）+ 作用域勘误（扫描基准=本游戏 src，原 5 级上级实指工作区根共享壳 src） | 0 | `02-check-acc-05-no-external-texture.log` |

### 带版本标识的试玩入口（锚值已刷新）

- **入口**：`https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/`（或 `/gw`，主入口 200 + 标题「挪出一条路 · line4-unblock-jam」本轮实测）
- **版本标识（现行）**：试玩者填 `1b101a4`（线上构建锚，页内 HUD「锚/build」直接可核对）或 `de5aefa`（部署单锚）；**旧锚 bc3cd56/4f8ad155 作废**（F1–F4 采集表 + 合并版反馈单两处已同步刷新）。
- **N3 采集窗**：开启中；样本实况仍 **0/3**（无新增回流，如实维持），verdict 维持 PENDING_PLAYTEST 不计轮。

—— 游戏程序（重部署批自证）· 2026-10-27T02:05Z
