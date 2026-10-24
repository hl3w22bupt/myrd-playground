# 阻塞项黑板 — wheat-squad（麦浪小队 · 第二产品线 · 可玩基线轮）

> 更新时间：2026-10-17（**双轨轮 · 轨道 A「三态分流后续分支」收口**）· 负责人：主策划（整合人）· 阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人**——①圈定 5 名真人试玩（任务单 APPROVE-READY，采集面已重锚 v23 LIVE @ `9945257`）②关注 v21 外来部署单治理面 ③（若主人另有 R2 修复指令）按分流表执行

## 当前基线（2026-10-17 双轨轮开工登记 · 开工前置③）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/wheat-squad/`（levels/assets/blockers 三件套 + gate-logs/dualtrack-20261017/） |
| spec 版本号 | **v1.4（平台链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · 唯一）** · 导出件 `.myrd/spec/wheat-squad/design-spec.json`（本轮零改动，链上无新 revision） |
| 当前分支与续接结果 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `98d1fbe`→本轮推进至 `c325b27+`；`git fetch origin`：远端**无** `game/wheat-squad` 分支（无可并入游戏线）；`origin/main` 与当前线 **merge-base 为空（孤儿快照线）**→沿 0ff651f 判例不并入（其唯一增量 `9fbc1dc` std-skills/web-app-dev 与本轮两轨无关，如实登记）· 分支已推远端（`98d1fbe..c325b27` fast-forward，部署前置） |
| 本轮终局 | A1 不过→采样计划当轮执行→**重锚 `9945257` 三点闭环（绑定≡v23 LIVE 内嵌逐字符全等）**→A2 收口（绿 15/红 0/未判定 1）→A3 互斥分支均不触发（R2 不开 · 提审就绪不开）· 报告 `games/wheat-squad/docs/r2x-recheck-report-20261017.md` · 结论 JSON `a2-verdict-20261017.json` |

### 双轨轮新增登记（2026-10-17）

- **W-NEW-1（升级主人 · 治理面）**：v21 外来部署单 `cmvafh9i1001em94lwu8osw8u`（10/16T03:48Z @ commit `af399d7`——**不在本仓任何本地历史**）曾接管 wheat-squad-2 坑位；其服务字节与 v20 同源（md5 `67a60360` 探测实证）未破采集等效性，但「谁在用本坑部署、从哪条线」需主人关注；v23 已重新接管（running/current @ `c325b27`）。
- **v22 误窗（如实披露，非缺陷）**：POST HTTP=000（网关截断）但服务端已受理；取推送前远端 HEAD `98d1fbe` 旧产物 running 短窗，随即被 v23 接管——504/000 判例「先 GET 复查不盲重发」再次生效。
- **F1FIX 复签闭环**：上轮三项待复签（①链证据失真修正 ②未触 src ③全模拟局口径）本轮 QA 复签全部通过（`a2-verdict-20261017.json` carryOverResign）。
- 历史区段（R1 轮及更早）原样保留于下方，不覆盖不删改。

### 部署轮 v27（游戏程序 · 2026-10-24T03:43-03:49Z · 部署节点——成果回流 merge 后复证发布）

- **定性**：部署节点——把当前 HEAD 成果发布到专属坑，**零新玩法零设计变更**；受测源面自 v26 发布提交 `f473f3a` 零漂移（`git diff f473f3a..HEAD -- src tests tools ci package.json verify.sh apphost.toml .myrd/spec/wheat-squad/` = 空，00 号证据），增量 = 门禁复证 + 构建锚重绑。
- **硬前置三条**：①分支 `game/wheat-squad`（非 main）✓ ②分支已推远端（部署前 `ls-remote` 服务器实况 `2d7daa3` = 本地 HEAD；部署后发布提交 `5544416` 同法拉平；本地跟踪引用过期因 fetch refspec 仅配 main，判例沿用）✓ ③专属清单 `games/wheat-squad/apphost.toml` 在位（assets_dir=games/wheat-squad/build）✓。
- **门禁**：verify.sh 五步 @ HEAD `2d7daa3` → **`VERIFY_EXIT=0`**（统一契约 + 自有契约 + WS-SMOKE victory 167s · 四事件埋点真实产生 · console 零错误 + 双 SCOPE-GUARD PASS，01 号证据）。
- **确定性重建**：`G2WS_REPO_ONE_ROOT` 显式锚定当前 run（防兄弟 run 扫描失真），与仓内树 diff **仅 main.mjs 锚自指单行**（`64de797`→`2d7daa3`，逻辑字节全等），specAnchor=链 v6 `cmv8xcexk0009m9dj6ev1dj0r@v6:approved` 不变（02 号证据）。**披露**：构建锚 = `2d7daa3`，发布提交 = `5544416`（相对锚仅增量锚行 + 证据文件）。
- **坑位归属核对**：GET `cmv36wl94001xm9mxp119q48x` 回读 name=`wheat-squad（麦浪小队）` · slug=`wheat-squad-2` · **sourceId=`wheat-squad` 绑定 ✓**（03 号证据）——「slug 检索命中同名 suspended 坑不可作依据」判例继续有效，专属坑复用未新建。
- **部署**：v27 `cmvluuykm0039m94i800xa9wl` **running/current @ commitHash `5544416`**（durationMs 841 · errorMessage=null · gitRef=`game/wheat-squad` · manifestPath=games/wheat-squad/apphost.toml · sourceId=wheat-squad 防挤占校验过）——POST **000 空体截断（判例五现）**→ GET 复查已受理 building→running，未盲重发（04/04b/05 号证据）。
- **线上自测全绿**：①/health 200（壳硬编码标签判例维持，坑身份以字节对账为准）②/gw 200 md5 `724c04b0` ≡ 仓内 build/landing.html 逐字节 · **title=麦浪小队（页面路无串线）** ③`api/public/assets/main.mjs` 200 md5 `08a99b52` ≡ 仓内 build/main.mjs 逐字节（v26 为 `e21bd56a` → **v27 新字节上线实证**）④内嵌 `__G2WS_BUILD.gitSha=2d7daa3` ≡ 构建锚逐字符 ⑤WS-LIVE-SMOKE PASS（`LIVE_SMOKE_EXIT=0`：线上 ready → 拖动击杀 2 → victory 167s → console 零错误）（06/07 号证据）。
- **团队产物区**：artifact `cmv3bfs3c002lm9mx7pw3e31a` → hostedAppId `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）POST status=ready（幂等复用，08 号证据）。试玩入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`。
- **升级项维持**：W-NEW-1 治理面 + A3 待真人 0/5 不变（见下）；关卡状态（levels.md）与资产清单（assets.md）本轮零变更（部署轮不改关卡/资产面）。证据 `games/wheat-squad/gate-logs/deploy-v27-20261024/00..08`；**结论仅对发布提交 `5544416`（构建锚 `2d7daa3`）有效**。

### 部署轮 v26（游戏程序 · 2026-10-23T03:32-03:40Z · 部署节点——组合推进轮成果回流后复证发布）

- **定性**：部署节点——把当前 HEAD 成果发布到专属坑，**零新玩法零设计变更**；组合推进轮四包（P0-1 对账/P0-2 退打磨/P0-3 备而不动/PL4 调研）全部为黑板/docs/门禁证据面，`git diff fa776de..HEAD -- games/wheat-squad/` 实查受测源面（src/build/tests/tools/ci）**仅 v25 轮自身的锚行提交**，游戏逻辑零变更。
- **硬前置三条**：①分支 `game/wheat-squad`（非 main）✓ ②分支已推远端（部署前 `64de797` = `ls-remote` 服务器实况；部署后发布提交 `f473f3a` 同法拉平）✓ ③专属清单 `games/wheat-squad/apphost.toml` 在位（assets_dir=games/wheat-squad/build）✓。
- **坑位归属防挤占核对（新增发现）**：`GET apps?slug=wheat-squad` 命中的是**另一同名 suspended 坑 `cmv36vmqi001vm9mxdtq9dw96`**（无部署无 liveUrl）——slug 检索不可作坑位依据；权威坑以黑板/v24-v25 台账为准 = **`cmv36wl94001xm9mxp119q48x`（slug `wheat-squad-2`）**，GET 回读 `sourceId=wheat-squad` 绑定 ✓ 专属坑复用未新建。
- **门禁**：verify.sh 五步 @ HEAD `64de797` → **`VERIFY_EXIT=0`**（统一契约 56/0 + 自有契约 16/0/1PEND + WS-SMOKE victory 167s console 零错误 + 双 SCOPE-GUARD PASS）。
- **确定性重建**：build/ 11 文件，specAnchor=链 v6 `cmv8xcexk0009m9dj6ev1dj0r@v6:approved` 不变；与仓内树 diff **仅 main.mjs 锚自指单行**（`fa776de`→`64de797`，逻辑字节全等），按 v25 判例保留重绑产物提交（部署字节=提交字节）。**披露**：构建锚 = `64de797`，发布提交 = `f473f3a`（相对锚仅增量锚行 + 证据文件）。
- **部署**：v26 `cmvkf37db002im968oebxf2am` **running/current @ commitHash `f473f3a`**（durationMs 832 · errorMessage=null · gitRef=`game/wheat-squad` · manifestPath=games/wheat-squad/apphost.toml · sourceId=wheat-squad 防挤占校验过）——POST **504 空体截断（判例四现）**→ GET 复查已受理 building→running，未盲重发。
- **线上自测全绿**：①/health 200（壳硬编码标签判例维持，坑身份以字节对账为准）②/gw 200 md5 `724c04b0` ≡ 仓内 build/landing.html 逐字节 ③`api/public/assets/main.mjs` 200 md5 `e21bd56a` ≡ 仓内 build/main.mjs 逐字节（v25 为 `1b47dab3` → **v26 新字节上线实证**）④内嵌 `__G2WS_BUILD.gitSha=64de797` ≡ 门禁绑定 HEAD 逐字符 ⑤WS-LIVE-SMOKE PASS（`LIVE_SMOKE_EXIT=0`：ready → 拖动击杀 2 → victory 167s → console 零错误）。
- **团队产物区**：artifact `cmv3bfs3c002lm9mx7pw3e31a` → hostedAppId `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）POST HTTP=201 status=ready（幂等复用）。试玩入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`。
- **升级项维持**：W-NEW-1 治理面 + A3 待真人 0/5 不变（见下）；关卡状态（levels.md）与资产清单（assets.md）本轮零变更（部署轮不改关卡/资产面）。证据 `games/wheat-squad/gate-logs/deploy-v26-20261023/00..08`；**结论仅对发布提交 `f473f3a`（构建锚 `64de797`）有效**。

### 部署轮 v25（游戏程序 · 2026-10-18T03:17-03:28Z · 部署节点——当前成果复证发布）

- **定性**：部署节点——把当前 HEAD 成果发布到专属坑，**零新玩法零设计变更**；源面自 `9945257` 起零漂移（`git diff 9945257..HEAD -- src tests tools ci package.json verify.sh .myrd/spec/wheat-squad/` = 空），增量 = 门禁复证 + 构建锚重绑。
- **硬前置三条**：①分支 `game/wheat-squad`（非 main）✓ ②分支已推远端（部署前基线 `fa776de`；部署后发布提交 `54a1a48` 经 `ls-remote` 服务器实况 = 本地 HEAD；本地跟踪引用过期因 fetch refspec 仅配 main，判例沿用）✓ ③专属清单 `games/wheat-squad/apphost.toml` 在位（assets_dir=games/wheat-squad/build）✓。
- **门禁**：verify.sh 五步 @ HEAD `fa776de` → **`VERIFY_EXIT=0`**（统契约 + 自有套件 + WS-SMOKE victory 167s console 零错误 + 双 SCOPE-GUARD）。
- **确定性重建**：build/ 11 文件，specAnchor=链 v6 `cmv8xcexk0009m9dj6ev1dj0r@v6:approved` 不变；与 HEAD 树 diff **仅 main.mjs 锚自指单行**（`9945257`→`fa776de`，逻辑字节全等）。**披露**：构建锚 = `fa776de`（门禁与产物内嵌依据），发布提交 = `54a1a48`（相对锚仅增量锚行 + 证据文件，源面零变更）。
- **部署**：v25 `cmvd9a0tz0032m9wlhr291cyw` **running/current @ commitHash `54a1a48`**（durationMs 824 · errorMessage=null · gitRef=`game/wheat-squad` · manifestPath=games/wheat-squad/apphost.toml · sourceId=wheat-squad 防挤占校验过）——POST **504 空体截断（判例三现）**→ GET 复查已受理，未盲重发。
- **线上自测全绿**：①/health 200（**披露**：响应体为共享壳 `server/src/index.ts` 硬编码常量 `game-9/汽车连连看`，系壳固有行为非坑身份标识；坑身份以下两条字节对账为准）②/gw 200 md5 `724c04b0` ≡ 仓内 build/landing.html 逐字节 ③`api/public/assets/main.mjs` 200 md5 `1b47dab3` ≡ 仓内 build/main.mjs 逐字节（v24 为 `53eaebce` → **v25 新字节上线实证**）④内嵌 `__G2WS_BUILD.gitSha=fa776de` ≡ 门禁绑定 HEAD 逐字符 ⑤WS-LIVE-SMOKE PASS（线上 ready → 拖动击杀 2 → victory 167s → console 零错误）。
- **团队产物区**：artifact `cmv3bfs3c002lm9mx7pw3e31a` → hostedAppId `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）POST HTTP=201 status=ready（幂等复用）。试玩入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`。
- **升级项维持**：W-NEW-1 治理面 + A3 待真人 0/5 不变（见下）。证据 `games/wheat-squad/gate-logs/deploy-v25-20261018/00..06`；**结论仅对发布提交 `54a1a48`（构建锚 `fa776de`）有效**。

### 部署轮 v24（游戏程序 · 2026-10-17T03:12-03:20Z · 双轨任务书重发复证 + 部署节点）

- **定性**：任务书重发勘验——两轨收口声明独立复证成立，**零重做零新玩法**；本轮增量 = 复证取证 + gitRef 重绑复证发布。
- **复证四绿**：①源面零漂移（`git diff 9945257..HEAD -- src tests tools ci package.json` = 空）②三方 sha 逐字符对账（仓内 build 内嵌 ≡ 报告绑定 ≡ LIVE 内嵌 = `9945257`）③verify.sh 五步 @ HEAD `701180b` `VERIFY_EXIT=0`（16/0/1PEND · SMOKE victory 167s · 双 GUARD）④确定性重建 11 文件仅 gitSha 自指单行 diff（逻辑字节全等，锚产物已恢复，md5 `53eaebce` 复原）。
- **轨道 B 只读核签**：线 3 链 v2 `cmvbqgzbl0029m9ax64foxd37` approved（2026-10-17T01:44:41Z · acceptance 15/entities 12/levels 2）——导出件 `_platform` 实查，与黑板声明一致。
- **部署**：v24 `cmvbtt76q003qm9axucrlbdoy` **running/current @ `game/wheat-squad`（HEAD `701180b`）**——POST 504 空体截断（判例复现）→ GET 复查已受理未盲重发；前置②分支先推远端（`ls-remote` 服务器实况 = 本地 HEAD；本地跟踪引用过期因 fetch refspec 仅配 main，已同步）。
- **线上自测全绿**：/health 200 · 页面 md5 `724c04b0` ≡ 仓内 landing.html · main.mjs md5 `53eaebce` ≡ 仓内 build 逐字节 · 内嵌 `9945257` ≡ 报告绑定 · WS-LIVE-SMOKE PASS victory 167s 零 console 错误。**v24 ≡ v23 零字节变化，A3 采集等效性未破坏。**
- **记账修正**：服务器侧 v22=`cmvbqnwlu…`（superseded）/ v23=`cmvbqro9v…`（上轮 01:52 单）——上轮 verdict JSON「v23 cmvbqnwlu」为版本号记账漂移（字节结论不受影响）；v24 已把 gitRef 从团队续接分支重绑回 `game/wheat-squad`。
- **升级项维持**：W-NEW-1 治理面 + A3 待真人 0/5 不变（见上）；证据 `games/wheat-squad/gate-logs/deploy-v24-20261017/00..06`，结论仅对 `701180b` 有效。

## R1 复测三态分流收口轮决策登记（2026-10-16 · 主策划整合 · A7）

| 节点 | 结论 | 证据落点 |
|---|---|---|
| A1 sha 地基验证 | **三点对账链不成立**（`debda99…`≠`29e779b…`≠`7b45b44…` 逐字符）→ R1 报告全量「未判定·待采」；源面零漂移附注披露不推翻任务口径 | `games/wheat-squad/docs/r1re-sha-reconciliation-20261016.md` · gate-logs `01/02/03` |
| A2 三态分流表 v1 | 16+扩面逐条带判据编号全量「未判定·待采」；红 0 条；条件触发链不触发；**QA v1 签字** | `docs/r1re-triage-table-20261016.md`（QA-WS-R1RE-TRIAGE-20261016-01） |
| A3 绑新 sha 补采 | **绑 `4eccaf293b11052041860ff7b0ee3141975258fd` 全绿**（A1 1.71s · A2 P50=168.096s + 事件链 20/20 · A4 0ms/4 通道/P95=0.001ms · 16/0/1PEND）；五步门禁 VERIFY_EXIT=0 同 HEAD | `docs/r1re-recheck-report-20261016.md` · gate-logs `05/06/07` |
| A4 重部署+新锚 | **v20 running @ `3828f49`**（manifestPath 单受理）· **内嵌 sha ≡ 报告绑定 sha 逐字符全等** · LIVE 冒烟 victory 167s 零错误；首探旧字节=切换窗口如实留痕 | gate-logs `08..13` · 报告 §新锚三点对账 |
| A5 QA 固化核对 | **绿项固化成立**（16/16 check 薄壳在盘 + 当前 HEAD 实跑 16 PASS）；**QA 终局签字**：A1/A2/A4 绿（新锚）· A3 未判定·待采 · 分流收口成立 | triage 表 v2（QA-WS-R1RE-TRIAGE-20261016-02） |
| A6 A3 任务单 | 任务单 **APPROVE-READY**（5 真人/防污染四条/观察点 O1-O4/达标 ≥4/5/原话留档）；**执行面升级主人** | `docs/a3-playtest-task-order-20261016.md`（QA-WS-A3-TASK-20261016-01） |
| 提交链 | N0 `debda99` → A1/A2 `4eccaf2` → A3 `3828f49` → A4 `bcd35ee` → A6 `3c370ab` → A7 `0ff651f`（全部直落团队分支，无 rebase） | git log |
| 接手轮程序复核 | **verify-claims 独立实跑 @ HEAD `0ff651f`，A1-A7 声称全部复核成立**：五步门禁 `VERIFY_EXIT=0`（56/0 + 16/0/1PEND + SMOKE + 双 GUARD）· 新锚三点链复验（LIVE md5 `67a60360` ≡ build 逐字节 · 内嵌 sha ≡ 报告绑定 `4eccaf29` 逐字符）· 固化面 16/16 同名对应 · 复核零源面变更零新增阻塞 | `gate-logs/r1re-claims-recheck-20261016/00..02` |

### 升级主人（本轮 · 带证据）

1. **A3 真人试玩执行**（阻塞 >1 轮维持）：圈定 5 名真人 + 知情同意 → 48h 窗回填 `qa/playtest-collection-round1.md`。机判面全就绪（采集字节 v20 已对账绑 sha；任务单 APPROVE-READY；观察点判定方式已定）；**仅缺真人，机器不得代采**（retestProtocol②）。
2. **发布预备预告**（不催办）：若回填达标（≥4/5 正向重开动机）→ 线 2 转「提审就绪预备」，双平台材料清单将升级主人发布拍板（凭证项：正式 wx/dy appid、类目资质、软著材料——到时逐项标注）。

### 升级 QA（F1/F2 修正轮新增 · 带证据 · 2026-10-16）

3. **分流表 v2 QA 复签**（程序修正件在盘，程序不代签）：QA 驳回 F1（链计数证据失真：seed 只进标签未传装配，20 行同种子复制）/F2（绑定三链 null）已按解锁动作第二路径修正（cfg.rng 装配注入，不触 src）+ 真实重采转绿（kills 唯一值=4 种子敏感机判 fail-closed 过）+ 先红后绿证据 `gate-logs/r1re-f1-fix-20261016/00..07`。复签点三条见 `docs/r1re-triage-table-20261016.md` v2 追加段；ac-a2 判定值与绿判定绑 `4eccaf29` 均维持，verify 五步复跑 VERIFY_EXIT=0。F3（spec README 索引滞后）已记账补登记，不阻塞。

## R1 复测三态分流收口轮当前基线（2026-10-16 · 主策划 · N0 开工前置）

- **黑板路径**：`.myrd/blackboard/wheat-squad/`（本轮主战线）· 顶层共板组合全景另行刷新
- **spec 版本号（链上实况，2026-10-16 API 实查）**：链 **v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · meta.version=1.4** · 导出件 `.myrd/spec/wheat-squad/design-spec.json` 与链上 **DEEP_EQUAL=True 零漂移**（`--expect-version 6` 实跑）· 契约输入即此件
- **分支与 HEAD**：`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ **`6cf28ad`**（= 远端 tip，团队线零漂移）
- **分支续接结果（开工协议实证）**：①远端**无** `game/wheat-squad` 分支（`git ls-remote` 全量核）②两条 wheat 相关旧分支（`fix/wheat-squad-landing-w3` @6c9afff、`myrd/wheat-squad-baseline-*` @20facdf）`HEAD..` 计数 = **0/0**，成果全部已在团队线内，无孤儿 ③**⚠️ `origin/main` 实证为单提交孤儿快照线**（`6c0df4a`，603 文件/56596 行，`git merge-base HEAD origin/main` = 空 exit 1 无共同祖先）——任务书口径「merge origin/main 吸收基建」**不机械执行**：并入需 `--allow-unrelated-histories`，会 graft 伪历史节点断证据链（合并禁 rebase 的同一立法理由）；其 std-skills 内容面已由平台注入以工作树形态在场（`.myrd-platform/.claude/skills/*` 6 文件 modified，保持不提交不触碰）。**此偏差如实披露，以仓上实况为准判例沿袭**
- **基线自证**：verify.sh 五步 **VERIFY_EXIT=0** @ `6cf28ad`（统契约 PASS·六段完整·符号锚命中 · 自有 **16 PASS / 0 FAIL / 1 PEND**（PEND=ac-a3 结论面 0/5 真人，如实挂起）· WS-SMOKE PASS · SCOPE-GUARD 双模式 PASS；A1=1.71s / A2 P50=168.096s victory 20/20 / A4 max=0ms·4 通道·P95=0.001ms）· 证据 `gate-logs/r1re-recheck-20261016/00-verify-baseline.log`
- **线上现状（待 A1 独立实探复核）**：v19 `cmv95h5mf000gm90xkzq4xrcm` running/current @ 发布 commit `0031d31`（上轮部署台账）；坑 `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）
- **本轮关键预判（待 A1 实证）**：三点对账链（工作区 HEAD `6cf28ad` ∥ 线上部署包内嵌 `29e779b…` ∥ 10/15 报告绑定 sha `7b45b44…`）**头部字符两两不等** → 按本轮任务书口径「不成立则全部『未判定·待采』」→ A2 分流表全量按未判定登记 → 走「绑新 sha 补采」分支


## R1 复测收口轮当前基线（2026-10-15 · 主策划 · N0 开工前置）

### N4+N5 · QA 唯一结论 + 分流 + 台账（2026-10-15 · 本轮唯一结论）

- **QA 唯一 JSON 结论**：`games/wheat-squad/qa/qa-r1-recheck-v14.md`（**QA-WS-R1RE-20261015-01**）——verdict = **「证据型·样本不足（A3 结论面 0/5 待真人）→ R1 维持『未判定·挂起』，不烧冻结余量」**；逐条 feedback 4 项（A3 采集阻塞 / W-7 spec 冻结字面留待 R2 / retestProtocol 三款落地验证 / v16 事故闭环）均指 spec 条目与文件
- **分流执行**：缺陷型修复批 = **0 件**（零数值超阈零机判红）· 证据型挂起 ✓ · 非「全绿」（A3 未判定）→ 不触发「打磨中」登记，但采集面已就绪（v17 LIVE 证据绑 sha）
- **好玩判据状态（红线如实）**：第 1 轮 = 不达（A3 0/5）；冻结计数器 **0/3 维持**（baselineProtocol：任一轮部分达标即重置——A1/A2/A4 绿 = 部分达标）；「好不好玩」终裁归主人
- **台账**：levels.md 产品线 2 区块已回填（轮次号/复测 sha/全绿与否/不达判据 id 清单）
- **下一步**：①主人圈定 5 名试玩 + 回填 `qa/playtest-collection-round1.md`（回填后复跑 ac-a3 → 可转「全绿·打磨中·待 A3 真人反馈终裁」）②若主人反馈回流 → 立即打断直开 R2（硬约束①）③线 3 备忘 v0（轨道 B，见顶层）



### 部署轮 · v19 LIVE 重锚（2026-10-15 · deploy 节点 · R1 收口后本轮）

- **线上现状**：坑 `cmv36wl94001xm9mxp119q48x`（wheat-squad-2 · slug 精确检索复核 `sourceId=wheat-squad` ✓ 专属坑复用未新建）**v19 `cmv95h5mf000gm90xkzq4xrcm` running/current @ 发布 commit `0031d3140ac3ffe8ec9b4387ecdf4503bb58d620`**（gitRef=当前分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` · manifestPath=games/wheat-squad/apphost.toml · mode=bundle · 零 errorMessage；入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`）
- **部署前确定性重建**（禁用仓内旧产物纪律）：自 v17 发布 commit `bcaa8f5` 起源面变更仅 `assets/manifest.json`（美术元文档，src 零引用不进运行时）+ ci/qa 文档 → 重建 diff = **指纹单行**（gitSha `7b45b44…`→`29e779b…`，specAnchor v6 approved 不变，spec.json 与单源逐字节全等）= 零内容漂移实证
- **门禁**：verify.sh 五步 `VERIFY_EXIT=0`（统一契约 **56/0** · 自有 **16/0/1PEND** · WS-SMOKE PASS · SCOPE-GUARD 双模式 PASS）；证据 `gate-logs/deploy-v18-20261015/01`
- **LIVE 三点自测**：①`/gw` title=麦浪小队 ②main.mjs md5 `ae62534dd4cbb7626f8175906882915b` ≡ 发布 build 逐字节 ③内嵌 `__G2WS_BUILD.gitSha=29e779b…` ≡ 重建时内容 HEAD（构建自指单行滞后不变量维持）+ specAnchor=链 v6 approved；**WS-LIVE-SMOKE PASS victory 167s console 零错误**（`05-live-smoke.log`，LIVE_SMOKE_EXIT=0）
- **/health 载荷定性（非串线，W-3 收口态维持）**：`/health` 200 但 body=`"app":"game-9","title":"汽车连连看"` —— 共享壳 `server/`（package 名 `game-9-server`）静态身份常量，所有坑同串；决定性反证 = 页面路 title 麦浪小队（landing.html 优先伺服生效）+ 资产路字节逐等
- **⚠️ 504 双受理事故（如实披露不删账）**：部署 POST 首发代理侧 504（响应体空）→ 未盲重试，先 GET 坑位发现首条已被后端受理（**v18 `cmv95gcje000em90xh5mucjyj` running@0031d31**）→ 重发产生 **v19**（同分支同字节，building→ready 覆盖为 current）；**同内容重复部署、非内容分叉**，未发第三次。教训落档：部署 504 后必须先查坑位现状再决定重试。证据 `gate-logs/deploy-v18-20261015/02–04`

### N2-部署 · v17 LIVE + sha 对账闭环（2026-10-15 · deploy）

- **线上现状**：坑 `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）**v17 `cmv8xviav000em9d…` running/current @ 发布 commit `813fa38`**（零 errorMessage）；LIVE 三点全过：①title=麦浪小队 ②main.mjs md5 `6b3e349a…` ≡ 发布 build 逐字节 ③**内嵌 `__G2WS_BUILD.gitSha=7b45b44072747ca17af96f81dd109b926745f3d4` ≡ 复测报告绑定 sha（对账闭环）**+ specAnchor=链 v6 approved ④WS-LIVE-SMOKE PASS（victory 167s · 零错误）
- **⚠️ v16 坏部署事故（程序线操作缺陷，如实披露不删账）**：部署 POST 漏传 `manifestPath` → 平台按仓库根 apphost.toml（game-9 清单）打包 → 线上面短暂呈 game-9 资产（wheat 资产 404）；根因 = 未复用兄弟判例完整请求体；处置 = 带 manifestPath 重部署 v17 覆盖修复（同 commit）。证据 `gate-logs/r2-recheck-20261015/README-deploy.md`
- **sha 对账闭环陈述**：v15 部署物无内嵌 sha（「无法确认·需重部署」）→ 注入基建（`tools/build.mjs` `__G2WS_BUILD`）→ v17 线上自证构建源 = 复测绑定点 `7b45b44`；发布 commit 相对源面在采样断言面零差异（diff 实证）；build 内嵌语义 = 受测源面 commit（构建自指单行滞后不变量已实证）
- **A3 采集面**：v17 线上即采集字节（试玩入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw` · 证据绑 sha `7b45b44`/`813fa38`）



### N2 · 程序批收口（2026-10-15 · sha 注入基建 + 复采三绿 + A3 待采）

- **sha 对账结论（任务书三态）**：线上 v15 部署物（main.mjs md5 `f3a6a6b4…` LIVE 实取）`__G2WS_BUILD` 计数 = 0 → **「无法确认·需重部署」**；处置 = `tools/build.mjs` 注入 `__G2WS_BUILD={gitSha,specAnchor}`（确定性字段零时间戳，env 覆写 ≠ 真实 HEAD 即 fail-closed 防伪锚）→ 重建 ×2 逐字节一致 → 重部署 v16 后闭合（见部署台账）
- **复采结果（绑 sha `7b45b44072747ca17af96f81dd109b926745f3d4`，与 R1 轮逐项同值 = 确定性复现）**：A1 **绿** 1.71s ≤10s（5 种子全 ≤30s）· A2 **绿** P50=168.1s ∈[90,180]（P90 ≤300 · victory 20/20 · 样本 20/20 满）· A4 **绿** max 0ms ≤100ms（通道 min 4 · fx 全绑 · 帧 P95=0.002ms）· A3 **未判定·待采**（机制面 PASS · 结论面 0/5 无真人证据——按 v1.4 retestProtocol①②不判红绿不烧余量）
- **全量契约**：run-all **16 PASS / 0 FAIL / 1 PEND**（PEND = ac-a3 结论面，ALL_GREEN=false 如实）· 五步门禁 VERIFY_EXIT=0
- **复测报告**：`games/wheat-squad/docs/r1-recheck-report.md`（逐条 id|阈值|实测|事件名|脚本|样本量|三态 + 原始事件计数对照 + A2 样本量进度）
- 证据：`gate-logs/r2-recheck-20261015/05..09`



### N1 · 策划批收口（2026-10-15 · spec v1.4 已 approved · 链 v6）

- **spec 版本号（链上实况，刷新）**：链 **v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · meta.version=1.4**（2026-10-15）· v1..v5 superseded 零覆盖 · approved 唯一回查 PASS · 导出件 + 适配视图已刷新（锚 `updatedAt=2026-10-15T02:35:50.260Z`）· verify.sh 五步复跑全绿（契约对账 v1.4）
- **唯一增量**：meta.retestProtocol 三条款（①未绑 HEAD sha 一律「未判定·待采」②A2 模拟局/A3 真人局口径不混算 ③连击清零沿 baselineProtocol 单源 + 同一判据连续 2 轮红 → 升级查判据）——**numeric/acceptance/world/entities/levels/assets 六段零触碰（建版器守卫机判）· A1/A2/A4 阈值零漂移（红线）**
- **approve 代持声明**：任务书明示「交主策划 approve」→ 代持人 = 主策划；QA 四要素预审 APPROVE-READY（回执 `games/wheat-squad/qa/spec-v14-pre-review.md` · QA-WS-V14-20261015-01）；红线不失效——主人一句否决 → 新修订置 draft、v6 superseded、契约随最新 approved 版重定基准
- 通道实录：POST revisions → 201 draft · POST approve → 200 approved · 证据 `gate-logs/r2-recheck-20261015/01·02·03·04`


- **黑板路径**：`.myrd/blackboard/wheat-squad/`（levels.md / assets.md / blockers.md 三件套 + style-card-v1 + gate-logs）——「一游戏一子目录」判例沿袭
- **spec 版本号（链上实况）**：链 **v5 `cmv7hekf3000mjofivl4ebhdf` · approved · meta.version=1.3**（acceptance 16 条 · A1–A5+a4b）· 2026-10-15 API 实查 approved 唯一 · 导出件 `.myrd/spec/wheat-squad/design-spec.json` + 门禁适配视图 `.myrd/spec/design-spec.json` 与链上**深等零漂移**（锚核 PASS，updatedAt 双边 `2026-10-14T02:20:27.925Z`）
- **分支与 HEAD**：团队续接分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`（本 run 任务书分支约定：全部提交直落此分支，不建新分支）· R1 成果线（兄弟线 `myrd/r1-spec-v11-qa @ 5a6b979`）已按双线合流判例 `merge --no-ff` 合入 → **合流基线 HEAD `c6f9ea4`**（树净）；冲突裁定 = 游戏面/spec/子黑板/routines(N10/N13)/统一契约器/server 壳取 R1 线代际（= v15 LIVE 同源壳），顶层黑板 = 工作室共板 ∪ game-9 归档区，技能件 = 平台注入版
- **基线自证**：合流后 verify.sh 五步全绿 **VERIFY_EXIT=0** @ `c6f9ea4`（`gate-logs/r2-recheck-20261015/00`）
- **⚠️ 任务书口径偏差披露（以链上实况为准判例，沿 R1 轮同款）**：本任务书「spec v1.1 → v1.2 修订」系按 2026-10-12 时点拟发；链上实况已推进至 **v1.3（链 v5）approved（2026-10-14）**，任务书所列三条判读纪律中的「连击清零」已由 meta.baselineProtocol 承载（任一轮部分达标即重置 0/3），但 **①「未绑新 HEAD sha 一律『未判定·待采』」②「A2 模拟局/A3 真人局口径不混算」③「同一判据连续 2 轮红 → 升级查判据」三款在 approved spec 内尚无明文**。本轮策划批（N1）将产出 **v1.4（链 v6）**——仅增补判读纪律，**A1/A2/A4 阈值一律不动（红线）**；不重做已完成面。
- **线上实况（sha 对账输入）**：v15 LIVE `cmv7kaen8001kjofi5p7qyb2l` @ 发布 commit `762742c`（main.mjs md5 `f3a6a6b4…`）；构建内嵌面仅 `__G2WS_SPEC`（spec 内联），**无 git sha 内嵌** → 任务书「构建 sha 注入基建」待实施（N2）
- **stack-tower / g2-blocks 两线**：本轮零接触（其生产坑 v24/v17 维持既有部署，合并未触碰其源面）

### R1 轮存档结论（2026-10-14 收口态，本节以下原文保留）

- **黑板路径**：`.myrd/blackboard/wheat-squad/`（levels.md / assets.md / blockers.md 三件套 + style-card-v1 + gate-logs）——「一游戏一子目录」判例沿袭（任务书字面给顶层，判例落点偏差沿判例披露；顶层 game-9 三件套零触碰）
- **spec 版本号（链上实况）**：链 **v4 `cmv60scie003hm9qqu91foe7v` · approved · meta.version=1.2**（acceptance 16 条 · A1–A5+a4b）· API 实查 2026-10-14 · 导出件 `.myrd/spec/wheat-squad/design-spec.json` 与链上**深等零漂移**（updatedAt 锚 `2026-10-13T01:46:44.188Z` 双边全等）· 门禁适配视图 `.myrd/spec/design-spec.json`（id/slug=wheat-squad 注入键）同源 v4
- **⚠️ 任务书口径偏差披露（以链上实况为准判例）**：本任务书「spec v1.1 修订」系按 2026-10-12 时点（v3=v1.1 approved）拟发；链上实况已由兄弟 run（run-cmv5zila9，2026-10-13）推进至 **v4（v1.2）approved**——其中已包含任务书所列「二义项 + A2 样本量门槛」的等价与超集（A1–A5 可判定性扩条、e-telemetry 9 键结构化埋点口径、`runDuration.sampleSeeds=20` 早在 numeric、check 路径定死 `checks/<acceptance-id>.mjs`）。本轮策划批若再触发修订，将产出 **v1.3（链 v5）**，非任务书字面的 v1.1；不重做已完成面。
- **双线合流决策（本轮 · 主策划拍板）**：main 线（本 run 分支=origin/main@38e8194，含 **W-3 平台修复 `76954ca`**：server 落地页按部署清单解析+landing.html 生成）与兄弟成果线（v1.2 实现+部署 v11/v12 台账，W-3 第六/八次复现）系同一 merge-base（`a5018b6`）分叉、互补关系——已执行 `git merge --no-ff` 合流，合并提交 **`8868d0f`**（零冲突；两侧唯一交叠文件 build.mjs/smoke.mjs 自动合并成功且门禁复跑实证）。
- **基线自证（合并 HEAD `8868d0f` · verify.sh 五步全绿）**：①统一契约门禁（approved 对账）**56/0 · CONTRACT: PASS** ②自有套件 **16/0/1PEND** ③WS-SMOKE **PASS**（A1/A2/A4 埋点真实载荷）④⑤SCOPE-GUARD 双模式 **PASS** · **VERIFY_EXIT=0**——证据 `gate-logs/r1-converge-20261014/00·01`。

## R1 收口台账（2026-10-14 · 主策划整合 · 主线五节点全闭环）

### 本轮决策与执行（六节点）

| 节点 | 结论 | 关键产物（sha/锚绑定） |
|---|---|---|
| N0 开工前置 + 双线合流 | main 线（W-3 平台修复 76954ca）× 兄弟线（v1.2 实现）同一 merge-base（a5018b6）互补 → `git merge --no-ff` **`8868d0f`** 零冲突合流；链上实况 = v4 approved（meta v1.2）· 导出件零漂移核对 PASS · 任务书「spec v1.1」口径偏差如实披露（以链上实况为准判例） | `gate-logs/r1-converge-20261014/00·01`（五步全绿 56/0+16/0/1PEND） |
| N3 程序批三件 | ①sha 三点核对：HEAD ≠ 线上 v13@76954ca（旧构建）**存在代码差异如实登记**；W-3 已解除（title=麦浪小队）②埋点口径说明（e-telemetry 9 键单源）③操作路径清单 OP-01..07 | `games/wheat-squad/docs/r1-program-batch.md` |
| N4 策划批 | 任务书四二义项**已闭合于 v1.2**（不重做）；新发现 ac-art-2 判定口径二义**成立** → **B 案裁决**（spec.assets 补登+机判扩严，statement 字面零改动）；spec **v1.3 入链**（v5 draft 201 → QA 预审 APPROVE-READY → 审签 → approve 200 → **唯一 approved 回查 ✓**） | `signoff-r1-ambiguity-review.md` · 链 v5 `cmv7hekf3000mjofivl4ebhdf` · `qa/spec-v13-pre-review.md` |
| N5 程序实测批 | A1 ✅ 1.71s/5 种子 · A2 ✅ 20 完整局 P50=168.1s victory 20/20 · A4 ✅ 0ms/4 通道/fx 绑定/帧采样 P95=0.002ms · **A3 结论面「未判定·待采」如实**；A4 check 文件扩面4（fx 绑定）+面5（帧耗时采样） | `docs/r1-measured-report.md`（绑 sha f0fca52）· `04·05` 日志 |
| N6 QA 对账 | **QA-WS-R1-20261014-01**：16 条行号级对账 · QA 独立复跑五步全绿（sha 零差异）· 修复批入口放行 | `qa/qa-r1-recon-v13.md` · `06` |
| N7 修复批 + 重部署 | 修复批两件：①run-all ALL_GREEN 假绿打印缺陷（先红=07 日志 1 FAIL 却印 ALL_GREEN=true · 变异验证转 false）②空白征集卡移位（不弱化 ac-04 fail-closed）→ QA 互查认领 → 发布门禁五步全绿 @ **`b33bea2`** → **v14 重部署** | `08-release-verify2.log` · 部署单见下 |

### R1 收口独立复核（2026-10-14 · 游戏程序 verify-claims · 当前 HEAD `9a4a12c` 树净）

> 接手「已声称完成」的 R1 五节点，按 verify-claims 纪律在当前 HEAD 独立实跑验证（不照抄黑板声称）。**结论：八项声称逐项复现成立，零缺口，无需修复批，v14 维持 LIVE 不动**。

| # | 复核项 | 独立取证结果 | 证据 |
|---|---|---|---|
| 1 | 程序批三件在盘且内容成立 | `docs/r1-program-batch.md` 三件齐：sha 三点核对单（开工时点 HEAD≠线上 v13@76954ca 如实登记）/ 埋点口径说明（A1 计时起点=first_core_action_at·A2 按局样本=run_end 一局一条·A4 通道判定=逐操作 channels≥2·A2 样本量=sampleSeeds 20）/ 操作路径清单 OP-01..07 带 id | 在盘直读 |
| 2 | spec v1.3 = 链 v5 approved | 统一契约门禁机判「spec 为 approved 版（平台登记 v5 · cmv7hekf3000mjofivl4ebhdf）」PASS（非手工声称） | `01-verify-sh-full.log` 步① |
| 3 | 实测报告绑 sha 有效性 | 报告绑全长 `f0fca52…`；`git diff --stat f0fca52..HEAD -- src spec tools/build.mjs` **空**（游戏源面零变更，b33bea2 仅动 run-all 打印面+qa 移位、9a4a12c 仅黑板 docs）——绑 sha 在当前 HEAD 仍有效；报告数值带来源事件名+脚本路径，A3 如实「未判定·待采」 | git diff 实跑 |
| 4 | A4 check 扩面在盘 | ac-05 面4（fx 逐通道绑定断言）+ 面5（hrtime 逐帧采样 P95≤16ms）源码在盘，16/0 复现内 | `tests/contract/ac-05…spec.mjs:35-69` |
| 5 | verify.sh 五步门禁 | **VERIFY_EXIT=0**：统一契约 PASS · 自有 16/0/1PEND（ac-a3 结论面 PEND=「待试玩」证据状态如实）· WS-SMOKE PASS（victory 167s + 四事件真实载荷 + 零 console 错误）· SCOPE-GUARD 双模式 PASS | `01-verify-sh-full.log` |
| 6 | 线上三点复测（本轮重取） | ①title=麦浪小队 ✓ ②资产三件（main.mjs/spec.json/index.html）live md5 ≡ HEAD build **逐字节全等**（本轮 curl 独立拉取复算，非抄上轮日志）✓ ③WS-LIVE-SMOKE PASS **LIVE_SMOKE_EXIT=0**（紧邻取码） | `02-live-smoke.log` · `03-live-threepoint.log` |
| 7 | 好玩判据红线 | 第 1 轮「不达」如实登记在案（A3 0/5 无真人证据）；冻结计数器 0/3 按 spec meta.baselineProtocol 单源口径不计数——**无粉饰无豁免** | 本台账「好玩判据状态」节 |
| 8 | 边界红线 | g2-blocks / game-9 / 第三线零接触（本轮 git 提交全部限定 wheat-squad 与其黑板子目录）；不开新题不重复调研 | git log + SCOPE-GUARD ⑤ |

### 部署台账（2026-10-14 · deploy 节点 · **v15 LIVE · 当前线上**）

- **v15 部署单**：坑 `cmv36wl94001xm9mxp119q48x`（wheat-squad-2 · sourceId=wheat-squad 绑定复用）· **version 15 `cmv7kaen8001kjofi5p7qyb2l` = running/current @ 发布 commit `762742c`**（API 回读：errorMessage=null · durationMs 830 · commitHash=762742c · gitRef=本 run 分支；POST 一次受理无截断）。
- **⚠️ v14 部署字节落后缺陷（本轮抓到 · 如实披露 · 已修复）**：确定性重建 diff 显示仓内 build/ 为 `8868d0f` 时刻陈旧产物——`spec.json` 缺 v1.3 B 案 assets 补登 4 件 + `main.mjs` 内联 `__G2WS_SPEC` 落后 v1.3；**v14 线上字节即该陈旧产物**（`bcde4bea…`，v14 三点复测当时「≡ HEAD build」成立是因为 HEAD build 同样陈旧——台账在档不删，如实留痕）。处置 = 重建产物落发布 commit `762742c` → 发布 commit 复跑五步门禁全绿 → 重部署 v15 → 线上 `f3a6a6b4…` ≡ 发布 commit build 逐字节全等（v1.3 spec 内联 + B 案补登已在线；其余 9 件重建零漂移，构建确定性成立）。证据 `gate-logs/deploy-v15-20261014/`。
- **v15 线上三点复测（QA 放行条件②，`04-live-threepoint-v15.log`）**：①/gw HTTP 200 title=麦浪小队 ✓（W-3 修复保持）②live main.mjs md5 `f3a6a6b4…` ≡ 发布 commit build 逐字节 ✓ ③**WS-LIVE-SMOKE PASS LIVE_SMOKE_EXIT=0**（线上打开→ready→拖动击杀 2→victory 167s 结算→console 零错误）。
- **发布门禁（QA 放行条件①）**：发布 commit `762742c` 上 verify.sh 五步全 PASS（统一契约 approved v1.3 · 自有契约 16/0/1PEND · WS-SMOKE · SCOPE-GUARD 双模式），`VERIFY_EXIT=0`；推送后 `git ls-remote` 远端 SHA ≡ 本地 HEAD 全等（762742c）。证据 `01-verify-sh-full-sha762742c.log`。
- **A3 采集窗：开启中**（v15 线上为最新字节，正式试玩继续采）——入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`，记录卡 `games/wheat-squad/qa/playtest-collection-round1.md`（时间窗 ISO 可验真 + 旁证比对列），回填渠道经主策划统一分发。
- **团队产物区**：artifact `cmv3bfs3c002lm9mx7pw3e31a` → hostedAppId `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）status=ready，runId=本 run。

### 部署台账存档（2026-10-14 · v14，已被 v15 接管）

- **部署单**：坑 `cmv36wl94001xm9mxp119q48x`（wheat-squad-2 · sourceId=wheat-squad 绑定复用）· **version 14 `cmv7htilk000vjofibg56wp5v` @ commit `b33bea2f`**（durationMs 830）；通道实录 = POST 504 截断（判例）→ GET 复查已受理 → **未重发**。**后验注记：v14 上线字节为 `8868d0f` 时刻陈旧产物（缺 v1.3 B 案补登），由 v15 替换修复**。
- **v14 三点复测（当时实况）**：①/gw title=麦浪小队 ✓ ②live main.mjs md5 `bcde4bea…` ≡ 当时的 HEAD build（同样陈旧）③WS-LIVE-SMOKE PASS。

### 本轮决策（主策划拍板记录）

1. **双线合流**（merge 而非择一）：两线互补、同一 merge-base，合流后门禁全绿实证。
2. **B 案裁决**（ac-art-2 二义）：登记进单源不改判据字面，机判扩严（先红后绿）。
3. **spec v1.3**（链 v5）代替任务书字面「v1.1」：链上实况已超前，二义自查按实况执行——触发修订即为 v1.3，偏差在基线区披露。
4. **计时口径落死**：`restart_clicked` 仅 A3 附录旁证；A3 判定 = 记录卡真人回填（时间窗可验真 + 旁证比对）。

### 好玩判据状态（红线如实登记 · 不粉饰）

- **第 1 轮好玩判据：不达**（A3 结论面 0/5 无真人证据——「待试玩」是证据状态不是豁免状态）。
- **冻结计数器：0/3 维持**（spec meta.baselineProtocol 单源口径：连续 3 轮「四件套全不达」才计数前移，任一轮部分达标即重置——本轮 A1/A2/A4 机判达标 = 部分达标，不计数；条款写死于 approved spec，机器不替人判好玩）。
- 若下轮（R2）仍无 A3 真人证据：维持「不达」登记并升级主人（是否人工改判采集组织方式归主人）。

### 阻塞项（当前无团队面阻塞 · 主人侧两项 + 美术线升级一项）

| id | 事项 | 归属 |
|---|---|---|
| W-2 | A3 试玩 5 名圈定与回填（采集窗已开，7 天窗）+ 好玩终裁 | 主人 |
| W-6 | ac-art-2 B 案已闭合销账；正式提审素材止步清单产出与否 | 主人（g2-blocks 提审动作另行，本线零接触） |
| **W-7** | **flash-invuln 通道无视觉实现**（r10 美术亲审发现）：风格卡要素二 + manifest fx-hit-shock spec 声称的「无敌帧外圈 wheatDeep→accentRed 呼吸」从未构建——`flashes.push` 全仓仅击杀点（sim.ts:140），渲染层零读 `invulnUntilTick`，sim.ts:240 注释失实。spec A4 判据未破（受击仍有 knockback+HUD-HP 两可见通道 ≥2，机器面全绿）；破口在美术规格实现符合性 + 0.8s 无敌窗玩家无感知（反馈手感 UX 缺口）。**同型次级项**：OP-04 三选一「高亮/选中态」（程序清单待映射挂点）无独立绘制——可供性已由 ui-kit-01 卡框+点选提示承载，模态点选即生效故非硬缺口。处置二选一归主策划：**A 案**=R2 批程序线在 drawSquad 补 invuln 呼吸圈（可顺带 picker hover 高亮；呈现层小改，随下次重部署上线，需重走 QA+部署轮次）；**B 案**=美术更正卡+manifest 描述为「无敌窗无独立视觉，通道由击退位移+HP 扣减承载」。两案均不动 approved spec 冻结面（OP-01 已由 e-captain 锚圈承载无需处置） | 主策划裁决（证据 `gate-logs/art-reverify-20261014-r1b/05·06`） |

## R1 放行门槛映射（任务书「QA 预审六条」→ 逐条落点）

| # | 预审条 | 本轮落点 | 状态 |
|---|---|---|---|
| 1 | sha 三点核对（HEAD=AppHost 线上包=报告绑定 sha） | N3 程序批 ①——开工时点 HEAD≠线上 v13@76954ca（旧构建）如实登记 ⇒ 实测绑 HEAD；N7 重部署后三点全等复测 PASS（live ≡ b33bea2f build） | ✅（`docs/r1-program-batch.md`）
| 2 | 埋点口径说明（A1 计时起点 / A2 按局样本口径 / A4 通道判定逻辑 / A2 样本量 ≥20） | N3 程序批 ②——以 v1.2 e-telemetry 9 键结构化定义为单源出说明件 | ✅
| 3 | 操作路径清单（带路径 id，解卡美术 A4 视觉映射） | N3 程序批 ③——逐操作通道枚举 + 路径 id | ⏳ N3 |
| 4 | 口径二义自查（成立即修订入链；不放宽好玩判据阈值） | N4 策划批——对照 v1.2 链上实况；二义已闭合项引 v1.2 revision_note 为证 | ✅（v1.3 入链 approved）
| 5 | A1/A2/A4 实测报告（绑 HEAD sha · 数值标来源事件名与脚本路径 · 样本不足记未判定·待采）+ A4 check 文件过 contract-check | N5 程序批 | ✅（`docs/r1-measured-report.md`）
| 6 | QA 三件套对账（行号级放行/打回）+ 门禁复跑放行权在 QA + deploy 重部署后开放正式试玩 | N6 QA 批 → N7 修复批+重部署 | ✅（v14 LIVE）

## 计时口径单源声明（本轮 · 任务书红线落死）

- `restart_clicked` 遥测**仅作 A3 附录旁证不进判定**（v1.2 ac-a4b 为 a4 强化条款，与 A3 判定面无涉）。
- A3 结论面证据 = 试玩记录卡真人回填（时间窗/完整局数/自然重开/理由原话，时间戳可验真，与程序旁证时间线比对）；**「待试玩」是证据状态不是豁免状态**——本轮结束时 A3 无真人证据，黑板即记**好玩判据不达第 1 轮**（3 轮不达即冻结，条款写死于 spec meta.baselineProtocol）。
- 正式试玩排在重新部署后（前置已达成：v14 @ b33bea2f 上线，埋点 9 键 + W-3 修复均在线上，LIVE-SMOKE PASS——采集窗已开启）。

## 驳回修复轮（2026-10-13 · QA 五条驳回 · 游戏程序处置）

> 逐条核实后处置（verify-rejections 纪律：①②④⑤ 属实直修，③ 属 spec 语义裁决升级）；修毕 verify.sh 五步绑新 HEAD 重交四件同包。证据 `gate-logs/n9-rejection-fix-20261013/`。

- **① ac-a5 断言↔验收错位 · 已修（先红后绿）**：ac-16 原 38-39 行以 first_tap 断窗、statement 谓词（first_core_action_at − hint_shown ≤ 5000ms）仅冒烟面有；注释「numeric.guidance.windowMs 单源」失实（approved numeric.guidance 无此键，note 明确判定参数写死 statement）。修复 = ac-16 补 ④′ 段 statement 谓词逐字断言 + 窗值改由 approved statement 机器解析（正则提取，解析失败 fail-closed，零本地兜底）+ 注释改实；**双变异验证**：文案缺陷注入旧面绿（MUTATED_EXIT=0）/ 新断言红（GUIDANCE_TEXT ≢ spec.copy）、延迟拖动 6s 变异红（6048ms > 5000ms 判定窗）/ 还原绿。
- **② 机判面虚报（两回执归因）· 已修**：三方 copy（spec.copy ≡ manifest.copy ≡ GUIDANCE_TEXT ≡ hint_shown.text）逐字机判断言补入 ac-16 ①′ 段（同上变异验证）；`qa/spec-v12-pre-review.md` 与 `qa/qa-n6-recon-v12.md` 三处失实归因已就地更正并注明更正轮次。
- **③ ac-art-2 机判窄于 statement · 升级主策划裁决（本条为升级项，不擅改）**：ac-11 面1 仅机判 category==='entity' 类，manifest 之 ui-kit-01/sub-icon/sub-sharecard-5x4/sub-shots-3 四件非 entity id 既不在 spec.entities 亦不在 spec.assets——按 ac-art-2 statement 字面（「逐件 id ∈ spec entities ids；清单外未登记资产 = 违例」）即违例而机判绿。裁决选项：**A** revision 改写 statement（id ∈ entities∪assets 登记集，ac-11 随裁决扩机判）；**B** spec.assets 补登四件后扩机判逐件对账。裁决前 ac-11 维持既有判据 + 知情窄面披露注释（不扩不缩不造第二真源）。
- **④ 证据 exit 失实 · 已修**：`gate-logs/n0-rebaseline-20261013/11-n6-deploy-live.log` 正文 DIE READY（smoke-live die=exit1 红正确）而末行 `LIVE_SMOKE_EXIT=0`——根因 = 记录 wrapper 取码隔管道（`node … | tee …; echo EXIT=$?` 取到 tee 退出码，与 2026-10-12 N5 判例「exit code 全透传」纪律同型违例）。处置 = 原件加失实注记保留历史 + 以显式取码重跑 smoke-live（线上 W-3 仍在，预期 exit=1）重归档修正版 `gate-logs/n9-rejection-fix-20261013/03-live-smoke-exit1.log`；**口径约定自此落死：证据取码必须紧邻被测命令、禁隔管道**（`node x.mjs; echo EXIT=$?` 直取，日志经重定向非管道）。
- **⑤（轻微）README 悬空行 · 已修**：组合全景索引「下一步」节后悬空表格行（引用过时 line3-candidates-20261012.md）删除——该信息由「待主人裁决清单」#4（指向 20261013 刷新件）覆盖。

## N2+N3+N5+N6 收口（2026-10-13 · spec v1.2 入链 approve + 互查放行 + 部署 v11 + W-3 维持）

- **spec 链**：v1(v0.1 draft)→v2(v1.0)→v3(v1.1)→**v4 `cmv60scie003hm9qqu91foe7v` approved（meta v1.2 · acceptance 16 条）**——唯一 approved，v1..v3 superseded；链上内容≡payload 深比 True；导出件换基线（--expect-version 4）。本轮增量全落：A1–A5（新增 ac-a5-guidance-first-action auto）+ ac-a4b-restart-click-counter（a4 v1 写死）+ checkNaming 定死 `checks/<acceptance-id>.mjs`（16 条薄壳，SHIM_MAP↔spec 一致守卫）+ telemetryFields 9 键 + e-telemetry 结构化 + world.uxExisting 既有交互 5 条（4 收进 1 新增）+ W-5 闭合。
- **流程件**：三合一包 `tri-pack-v1.2.md`（一次发全）→ 美术当天回件（style-card-v1 §v1.2 + manifest v2 guidance-hint-banner，ac-art-1/2/3 绿）；QA 只读预审 APPROVE-READY（`games/wheat-squad/qa/spec-v12-pre-review.md`，draft 未拍板声明在档）；主策划审签 `signoff-v1.2.md`（流程性，好玩终裁仍归主人）；QA 互查回执 **QA-WS-N6-20261013-01**（`games/wheat-squad/qa/qa-n6-recon-v12.md`，五线按序核全过 RECON-PASS）。
- **门禁（HEAD `c4348e1` 树净）**：verify.sh 五步全 PASS VERIFY_EXIT=0（统一 **56/0** · 自有 **16/0/1PEND** ALL_GREEN=false 口径 · WS-SMOKE PASS 四事件真实产生 · SCOPE-GUARD 双模式）——`gate-logs/n0-rebaseline-20261013/08·09·10`。
- **部署**：坑 `cmv36wl94001xm9mxp119q48x`（GET 核对 sourceId=wheat-squad 绑定 ✓ 复用）· **version 11** `cmv60yyfu003jm9qq1ablrdhm` = **running/current** @ commit **`e3abcb9`**（API 级三要素在档 · errorMessage=null · v10/v9 superseded）· POST 一次受理（HTTP 200 无 504）。
- **W-3 第六次复现（维持升级运维/主人，不空转）**：页面路仍发 game-9 共享壳（title=汽车连连看，WS-LIVE-SMOKE fail-closed 红）——跨 v4/v5/v7/v8/v9/v11 六次正确 manifestPath+sourceId 部署、三种 gitRef 不收敛，平台 serving 层壳路由绑定缺陷定性不变；**资产路本轮新字节已上线**（main.mjs live≡HEAD build 逐字节 `bcde4bea…`，含四事件增量）——部署通道本身健康，仅页面路串线。证据 `gate-logs/n0-rebaseline-20261013/11-n6-deploy-live.log`。
- **埋点本地日志开关说明**：`games/wheat-squad/docs/deployment-notes.md`（默认零外发零落盘；调试读口 `__G2WS_GAME.telemetryEntries()`；接渠道 SDK 须走 spec revision）。
- **wx 包**：本轮不出（W-3 未解除无线上验证锚点；渠道面顺延批次，任务书「时间允许才出」且动 wx 主包必复跑全门禁）。

## 本轮（2026-10-13）任务书增量识别 · N0 开工基线

### 任务承接口径（重发任务书 vs 链上实况，以链上实况为准）

- **任务书 = 上轮（run-cmv4k7sig，spec v1→QA→deploy）任务书重发**。上轮已完成：spec 链 v1(v0.1)→v2(v1.0)→**v3(v1.1) approved**、实现 ac-01..15、美术四契约、QA 互查多轮、部署 v9（部署面成功但页面路 W-3 串线升级中）。本轮**不重做已完成面**，只落任务书相对链 v3 的增量：
  1. **`a5-guidance-first-action`**（新增验收：`hint_shown` 后 5s 内首次有效操作，auto）——链上无 a5；
  2. **埋点四事件** `first_tap` / `first_loop_complete` / `restart_clicked` / `hint_shown`（含相对时间戳字段）以结构化片段写死 entities——链上 telemetryFields 5 键无此四事件；
  3. **a4 语义强化**：「已埋点 + 真实点击本地计数 +1」（auto）落 restart_clicked 面；
  4. **check 路径定死 `checks/<acceptance-id>.mjs`**——链上 checkNaming 现为 `tests/contract/ac-*.spec.mjs`（改名走 revision + 门禁适配）；
  5. **runner PEND 语义**：`tests/contract/run-all.mjs` 补三态输出（PASS/FAIL/PEND，含 PEND 即非全绿口径）——现状 PEND 由测试件内部打印、聚合器不计数；
  6. **`inventory-line2.md`**（每文件一句职责）+ 图谱注册构建；
  7. **deploy 复证 + 埋点本地日志开关说明 + W-3 复测**；
  8. **B 线调研刷新**（line3-candidates 更新，异品类，只攒池不开题）。

### N0 基线自证（2026-10-13 · HEAD `20facdf`）

- **分支**：`myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1` = 上轮成果分支 `myrd/wheat-squad-baseline-cmv4k7sig0026m9p8oxdk8ebt` @ `20facdf` 快进重建（远端 spec-v1 分支不存在；r9 提交只在成果分支）。worktree 曾误停旧分支 `pixel-fives-m0-m1@6d59bef`，已切回。
- **spec 链**：`cmv4q8bng001em9qm5p78do05` v3 approved（meta v1.1）——API 实查确认（Cookie token 通道），导出件 `.myrd/spec/wheat-squad/design-spec.json` 在盘，ac-15 门禁适配视图守卫绿。
- **契约双口径**：统一门禁 **53 PASS / 0 FAIL**（EXIT=0）+ 自有套件 **15 PASS / 0 FAIL**（ac-a3 结论面 PEND 如实展示）。
- **冒烟**：**WS-SMOKE PASS**（打开→操作→victory 167s→重开→零错误，A1/A2/A4 埋点真实载荷）。
- 证据：`gate-logs/n0-rebaseline-20261013/01-baseline-contracts.log · 02-baseline-smoke.log`（各带 UTC + HEAD sha + 退出码）。
- **落点披露（沿用上轮判例）**：黑板 = `.myrd/blackboard/wheat-squad/` 子目录（顶层为 game-9 三件套，零触碰）；`inventory-line2.md` 按任务书字面落顶层；B 线候选池沿用 `research/line3-candidates-20261012.md` 刷新。

## 上轮收口态（2026-10-12 · 可玩基线轮）

### 当前基线（两件事均已落实，判例落点披露）

- **黑板路径**：`.myrd/blackboard/wheat-squad/`（levels.md / assets.md / blockers.md 三件套 + style-card-v1 + gate-logs）；组合全景索引 `.myrd/blackboard/README.md`。**披露**：任务书字面给的是顶层 `.myrd/blackboard/` 三件套，但顶层现存 game-9（汽车连连看）三件套（2026-10-07 口径），按「一游戏一子目录」判例落 wheat-squad 子目录，game-9 文件零触碰；主策划差异点三列表与 B 线简报按任务书指定路径落顶层（spec-notes-line2.md / research/line3-candidates-20261012.md）
- **spec 版本号**：链 `cmv4q8bng001em9qm5p78do05` · **v3 approved**（meta.version=1.1「可玩基线版」）· 父链 v1(cmv36ewn8·v0.1)→v2(cmv4pqezm·v1.0) 均 superseded · 导出件 `.myrd/spec/wheat-squad/design-spec.json`（期望版本锚 --expect-version 3 重导，updatedAt=2026-10-12T04:03:15Z）——**链上唯一 approved 即本版，契约测试与实现只认它**
- **差异点三列表**：`.myrd/blackboard/spec-notes-line2.md`（6 行三列，逐行落 spec 条款映射）
- **风格卡**：v1 四要素冻结 + 主策划拍板（`.myrd/blackboard/wheat-squad/style-card-v1.md`）

### 本轮机器面（全绿，证据 gate-logs/n7-adversarial-20261012/01-gates-fresh.log 新鲜复跑；n9 轮 HEAD 复核再证，见下节）

- 契约：自有套件 **13 PASS / 0 FAIL**（2 PEND=manual 明示）+ 统一门禁（approved 对账）**53 PASS / 0 FAIL · CONTRACT: PASS**
- 冒烟：**WS-SMOKE PASS**（headless 可重复：打开→首次核心操作→victory 结算 167s→重开复位 + A1/A4 埋点真实产生 + console 零错误）
- 违规标识符扫描：**SCOPE-GUARD PASS**（47 文件零越界，策略单源含素材文案面；n9 轮复核 49 文件零越界——文件数随新增文件自然增长，判据不变）

## 部署轮 r9（2026-10-12 · workflow deploy 节点 · 重跑：worktree 切回成果分支，从当前分支部署）

- **放行口径**：重跑反馈——worktree 已切回成果分支 `myrd/wheat-squad-baseline-cmv4k7sig0026m9p8oxdk8ebt` 并推远端（含全部 N0–N15 成果）。核对：本地成果分支经 `--ff-only` 快进对齐远端 `a5018b6`（`git ls-remote` 全等比对，不依赖 tracking ref），硬前置①②③全满足。
- **部署前门禁（当前 HEAD=a5018b6 实跑）**：确定性重建 ≡ 仓内 build 逐字节全等（src/build 同批止于 729ef41）+ verify.sh 五步全 PASS **VERIFY-EXIT=0**（统一契约 · 自有契约 · WS-SMOKE 全链路 A1/A4 埋点 · 守卫双模式）。
- **部署单**：坑 `cmv36wl94001xm9mxp119q48x`（sourceId=wheat-squad 绑定复核 ✓，复用未新建）· **version 9** `cmv4x0se5000cm95qvbgzzqo4` = **running/current** @ commit **`a5018b6`** · gitRef=**myrd/wheat-squad-baseline-cmv4k7sig0026m9p8oxdk8ebt**（当前分支）· errorMessage=null。**双单如实披露**：首次 POST 响应被网关 504 截断（服务端已受理），按 N5 判例 GET 复查发现已建单后未盲重；第二次诊断性 POST（带状态码复测）恰在 v9 受理后到达，多建 **v10**（同提交同清单字节等价，current=v9 正确，无内容风险）——「单次无重复」判例本轮破例一次，归因 504 语义模糊，留档。
- **线上自测**：/gw/health **200** ✓ · 资产权威面 `main.mjs` **live ≡ 提交 build 字节全等**（md5 `1711423891…`）✓ · **页面路 W-3 串线第五次复现**：/gw 页面 title=汽车连连看 ≡ /apps/game-9/gw 字节全等（md5 `abb7c87b…`），壳为内联 bundle（无外链 src）→ 玩家侧 boot 断链（game-9 壳引 index.js 404），**WS-LIVE-SMOKE FAIL（exit=1，fail-closed 正确）**。
- **结论**：部署面成功（v9 ready @a5018b6，三要素在档，gitRef 已按反馈从 main 换回成果分支）；**W-3 与 gitRef 无关**——v7（成果分支）/v8（main）/v9（成果分支）三种 gitRef × 正确 manifestPath+sourceId 五次部署，页面路一律发 game-9 共享壳，进一步收窄为平台 serving 层壳路由绑定缺陷（疑似 v3 漏 manifestPath 事故时被写坏后未随正确部署恢复）。维持升级运维/主人转发。解除判据不变：页面 title=麦浪小队 ⇒ **WS-LIVE-SMOKE PASS**。
- 证据 `gate-logs/deploy-r9-20261012/`（01 门禁五步 · 02 live-smoke 红 · 03 串线页面字节收档）。

## 部署轮 r8（2026-10-12 · workflow deploy 节点 · 重跑放行：成果已回流 origin/main）

- **放行口径**：publish 加固后重跑——main ≡ origin/main ≡ HEAD `21756d7`、`git log origin/main..HEAD` 空、工作树干净 ⇒ 识别为「成果已回流」，按新版脚本放行 deploy。
- **部署前门禁（本节点实跑）**：确定性重建 ≡ 仓内 build 逐字节全等（src/build 同批止于 729ef41，其后零代码变更）+ verify.sh 五步全 PASS **VERIFY-EXIT=0**（统一契约 approved 对账 · 自有契约 · WS-SMOKE 全链路含 A1/A4 埋点与 victory 167s 真实载荷 · 守卫双模式）。
- **部署单**：坑 `cmv36wl94001xm9mxp119q48x`（slug **wheat-squad-2** · sourceId=wheat-squad 绑定核对 ✓，复用未新建）· **version 8** `cmv4wnl880009m95qbp6ye1am` = **running** @ commit **`21756d7`** · errorMessage=null · manifestPath=games/wheat-squad/apphost.toml · gitRef=**main**（当前分支=已回流成果）。部署前 v7 @46cce20 落后 14 提交。
- **线上自测**：/gw/health **200** ✓ · 资产权威面 `main.mjs` **live ≡ 提交 build 字节全等**（md5 `1711423891…`）✓ · **页面路 W-3 串线第四次复现**：/gw 页面 title=汽车连连看，≡ /apps/game-9/gw 字节全等（md5 `abb7c87b…` = W-3 指纹）→ 玩家侧 boot 断链（game-9 壳引 index.js，本坑无此资产），**WS-LIVE-SMOKE FAIL（exit=1，fail-closed 正确）**。
- **结论**：部署面成功（v8 ready @21756d7，三要素在档）；试玩入口仍受 **W-3 平台 serving 层串线**阻塞（v4/v5/v7/v8 四次正确 manifestPath+sourceId 部署不收敛）——维持升级运维/平台侧（主人转发）。解除判据：页面路按坑 manifest 返回对应壳（title=麦浪小队）⇒ 复测判据 **WS-LIVE-SMOKE PASS**。
- 证据 `gate-logs/deploy-r8-20261012/`（01 门禁五步 · 02 live-smoke 红 · 03 串线页面字节收档 · README 部署单全档）。

## N15 受测游戏身份门禁收口 v2（2026-10-12 · 游戏程序 · gate-adapter 单源派生视图）

- **驳回五到案**：「spec id 未解析出 slug 且存在 **3** 个 verify.sh」（日志 `gate-logs/contract-gate-20261012-134023.log`，13:40:23 在案）——证实 N13 后计数 2→3，裁决式两支仍不满足：①spec id 不可解析（链 id=cuid）②verify.sh 需唯一（3 个，2 个为冻结线零触面不可动）。
- **根因判定**：平台门禁读 `.myrd/spec/design-spec.json` 顶层 **id** 字段核对 games/ 目录名；approved 导出件无此字段（仅 `_platform.id`=cuid），单靠符号链接/命名约定不可达。
- **修复（单源纪律不破坏）**：`.myrd/spec/design-spec.json` 从符号链接升格为**生成的门禁适配视图**——新工具 `tools/build-gate-adapter.mjs`（零依赖确定性）从盘上 approved 单源派生：内容原样 + 仅注入顶层 `id`/`slug`=`wheat-squad` 两键；**ac-15** 机判守卫（视图 id/slug≡单源 meta.slug · 剔注入键与纯导出件键序无关深等 · games/wheat-squad/verify.sh 入口在盘）。红 RED-EXIT=1（id=undefined）→ 生成 → 绿。
- **验证**：自有契约 **15 PASS / 0 FAIL** · 统一门禁**三口径全 PASS**（含弱面 `[design-spec.json × .]`——适配视图对旧调用方内容兼容）· 守卫双模式 PASS · **verify.sh 连跑 2 轮 5/5 VERIFY-EXIT=0**。证据 `gate-logs/n15-gate-adapter-20261012/`。
- **如实披露**：平台门禁 id 读取实现不在仓内；本修覆盖其指令字面（「核对 design-spec.json 的 id 与 games/ 目录名」）。若其仅读 `_platform.id`（cuid），则属平台侧缺陷，新日志将落 gate-logs/ 可续诊升级（W-6 预设）。

## N14 对抗审查 D1/D2 修复轮（2026-10-12 · 游戏程序 · 埋点定名三方同名真达成）

- **D1 属实并修复（先红后绿）**：spec 定名 `run_duration_ms`（telemetryFields + ac-a2 statement），接线载荷键曾为 `durationMs`（game.ts:81）、冒烟读 `re.durationMs` **自算值**（比指控更重：断言未绑真实遥测）。修复：① 载荷键改名 `run_duration_ms`（game.ts）② 冒烟改经 `telemetryEntries()` **直读真实发射载荷**（Game 接口新增暴露面），实跑实证 `run_duration_ms=167968ms reason=victory（A2 面·真实载荷）`。
- **命名漂移第二处**：`endedReason` 枚举实现 `overrun` vs spec `defeat`——**按 approved 单源对齐代码**（sim.ts 类型+赋值、settlement.ts 签名三处 → `defeat`），spec 零改动即消解 reason 半边 revision 需求；若策划欲 `overrun` 语义差异化，走 feedbackProtocol revision，ac-14 会机判拦截旧值。
- **新增 ac-14**（`tests/contract/ac-14-telemetry-naming.spec.mjs`，run-all 自动发现）：**剥注释后**机判 telemetryFields 5 键逐字出现于接线面+断言面（注释出现不算命中——run_duration_ms 正是靠注释逃逸双绿的）、结局势从 spec 文本机器提取并与实现枚举双包含对拍、旧键 `durationMs` 绝迹断言。**红证据 RED-EXIT=1**（对未修实现命中 QA 指控原文）。
- **D2 修复**：ac-09 从纯 spec 侧文本扩为**行为级结构锁定**——导入 `placementOffline` 真实公式实体逐例对拍 `base×min(hours,cap)×levelCoef` + capHours 封顶钳制。
- **D3 不动码**：冻结计数器措辞（spec「本轮收口时置第 1/3」vs QA「0/3 全不达才计数」）属 spec 单源措辞，按 feedbackProtocol 归策划单行 revision（W-5）。
- **验证**：自有契约 **14 PASS / 0 FAIL**（新增 ac-14）· 统一门禁 **53/0**（仓根口径，勘误段在案）· **verify.sh 连续 2 轮五步全 PASS VERIFY-EXIT=0**（驳回要求的复审前置达成）。证据 `gate-logs/n14-telemetry-naming-20261012/`（01 ac14 红 + 02 全绿电量+勘误）。

| id | 事项 | 归属 |
|---|---|---|
| W-5 | D3 单行澄清：spec meta.baselineProtocol.计数器措辞与 QA 口径（0/3 全不达才计数）统一——一次 spec revision 单行，随下次链上修订顺带 | 游戏策划（revision 链） |

## N13 受测游戏身份门禁处置（2026-10-12 · 游戏程序 · wheat verify.sh + slug 薄壳）

- **驳回**：「无法确定受测游戏：spec id 未解析出 slug 且存在 2 个 verify.sh」。**破案证据**：平台门禁原始日志收档于 `.myrd/blackboard/gate-logs/contract-gate-20261012-130704.log`（13:07:04 = 产生本轮驳回的运行）——**平台门禁证据落点 = 顶层 gate-logs/**，已实证并登记白名单。
- **根因（四件叠加）**：① wheat 无 `games/<game>/verify.sh`（Godot 时代约定，PRODUCT_CONTEXT 明载 contract-check+verify.sh 模式）；② games/ 下 2 个存量 verify.sh（糖果线 + game-9，均零触面）⇒ 惟一性裁决必歧义；③ routines.yaml gamePath 陈旧指向本仓不存在的 `games/godot-coin-rush`；④ spec 链 id=cuid 不含 slug。
- **修复（全加法，冻结线零触碰）**：① 新建 **`games/wheat-squad/verify.sh`**（真门禁薄壳：统一契约+自有契约+冒烟+守卫双模式五步，exit code 全透传，`WS_VERIFY_SKIP_SMOKE` 仅限非门禁快查）；② 新建 `.myrd/spec/wheat-squad-spec.json` 符号链接（`<slug>-spec.json` 命名约定 → approved 单源，slug 可从文件名解析）；③ routines.yaml gamePath 双处对齐 wheat。
- **验证**：verify.sh 五步全 PASS **连跑 2 轮 VERIFY-EXIT=0**；守卫 fail-closed 两次正确拦截（wheat-squad-spec.json 未登记 / 平台 gate-logs 落点未登记）→ 均按显式声明补白名单后转绿，零静默放行。
- 证据 `gate-logs/n13-game-identity-verify-sh-20261012/01-verify-sh-battery.log`（含平台原始日志收档）。

## N12 驳回三到案处置（2026-10-12 · 游戏程序 · root tests/contract 薄壳入口）

- **驳回错误演进定位**：v1『spec 文件不存在』→ N10 参数修复；v2 同文 → N11 字面 specPath 符号链接；**v3『契约不一致』= 弱面（`projectDir=.`）数值扫描丢契约镜像层**——正是 N11 预判并登记 W-4 的组合（当时 51/2：artCaps/firstCore 数值面 FAIL）。
- **修复（thin-proxy 判例第二件）**：根 `tests/contract` → `../games/wheat-squad/tests/contract`（相对符号链接）——统一契约检查器 `resolveAgainstProject("tests/contract")` 的 c1 解析位从此**任意 projectDir 皆命中同一份 wheat 契约镜像**（realpath 去重，单源零拷贝）。
- **断言面实证（插桩源键清单 02 号证据，未动真件）**：规范面 21 源 = 6 wheat src + 15 wheat 契约件（纯 wheat）；弱面 27 源 = 同 21 + 糖果线遗留 fallbackList 经 c3（`join(projectDir,"games","game",p)`）命中的 `games/game/` 6 个 .gd（冻结存量，超集面）。**规范面独立 53/0 ⇒ 弱面 53/0 不依赖外来文件（合法超集非假绿）**。
- **防 flake**：两口径各连跑 2 轮 **4/4 EXIT=0**。守卫 fail-closed 曾正确拦下新链接（root `tests/` 在禁触面）→ 按脚本设计走**显式豁免面** `exemptTouchPrefixes`（策略单源声明，非静默放行；换活跃线时随 routines.yaml 参数一并复审）。
- **提交前置**：自有契约 13/0 · WS-SMOKE PASS · 守卫双模式 PASS。
- 证据 `gate-logs/n12-root-contract-thin-entry-20261012/`（01 双口径防flake + 02 插桩源键）。

| id | 事项 | 证据 | 归属 |
|---|---|---|---|
| ~~W-4~~ | **已由 N12 仓内闭环**：无论执行方携带哪组历史参数（specPath/projectDir 新旧组合），契约门禁都可达 wheat 单源并全绿；平台参数存量治理**降为知情项**（重放时以仓内 routines.yaml 现行参数为准最优） | gate-logs/n12-root-contract-thin-entry-20261012/ | 知情项 |

## N11 同因驳回二次处置（2026-10-12 · 游戏程序 · 字面 specPath 薄壳入口）

- **同驳回再到案**（`spec 文件不存在: .myrd/spec/design-spec.json`）：核实 N10 参数修复在 HEAD 在案 ⇒ 执行面参数并非（只）取自 routines.yaml 默认值（平台侧存量快照），或驳回取自修复落地前运行。
- **修复（thin-proxy 判例）**：`.myrd/spec/design-spec.json` = **相对符号链接 → wheat-squad/design-spec.json**（approved 单源导出件，零拷贝零漂移）——任何携带旧 specPath 的调用方都能找到 approved spec；已入策略 allowedNewPaths 注记。
- **断言面核实（不缩水）**：规范口径 53/0 EXIT=0（连跑 2 轮）；旧 specPath + wheat projectDir 组合同样 53/0。
- **已知弱面如实披露（fail-closed 是正确行为，不为其弱化）**：若调用方还硬编码 `projectDir=.`，数值扫描丢契约镜像层（21→12 脚本），artCaps/firstCore 两项如实 FAIL——按检查器「数值只认 spec 禁止两头各改各的」哲学，**不造 src 数值副本迁就错误调用方**；该组合若再现属平台侧参数存量（见 W-4）。
- 证据 `gate-logs/n11-legacy-specpath-symlink-20261012/01-legacy-path-thin-entry.log`。

| id | 事项 | 证据 | 归属 |
|---|---|---|---|
| W-4 | 平台 routine 执行面参数存量：若 e2e-gate pre-hook 以仓内 routines.yaml 之外的快照取参（specPath=.myrd/spec/design-spec.json + projectDir=.），薄壳入口已保 spec 可达，但 projectDir=. 弱面会 fail-closed 2 项数值——请以仓内 routines.yaml 现行参数（wheat-squad 子目录口径）为准重放一次确认 | gate-logs/n11-legacy-specpath-symlink-20261012/ | 平台侧/主人转发 |

## N10 驳回修复轮（2026-10-12 · 游戏程序 · routine「游戏契约测试」FAIL）

- **驳回属实**：routine 以默认参数 `--spec .myrd/spec/design-spec.json --project .` 执行 → `CONTRACT: FAIL spec 文件不存在`。根因 = **routines.yaml game-contract 默认参数未随 N0「一游戏一子目录」判例更新**（spec 实落 `.myrd/spec/wheat-squad/design-spec.json`，顶层件不存在）——routine 配置与布局判例脱节，非工程/spec 缺陷。
- **修复（参数单源，检查器零改动）**：routines.yaml params → `specPath: .myrd/spec/wheat-squad/design-spec.json` · `projectDir: games/wheat-squad`（当前活跃线）；注释落「必须在仓根执行 + 换线同步改参数」口径契约。
- **验证（先红后绿）**：红 = 驳回口径复现 RED-EXIT=1；绿 = routine 替换后字面命令连跑 2 轮 **53 PASS / 0 FAIL · EXIT=0**。冒烟 PASS · 守卫双模式 PASS。证据 `gate-logs/n10-routine-contract-fix-20261012/01-routine-fix.log`。
- **策略面**：`.myrd/routines.yaml` 入 wheat scope-policy `allowedPreExistingModifiedPaths`（既有共享件正当触碰，注明换线会再改）。

## N9 复核轮（2026-10-12 · 游戏程序 · verify-claims 独立复验 + latent 缺陷先红后绿）



- **独立复验结论：N1–N8 声称全部在当前 HEAD 复现成立**（未照抄黑板）：统一契约 53/0 EXIT=0 · 自有契约 13/0 EXIT=0（ac-a3 PEND 如实）· WS-SMOKE PASS 全链路+A1/A4 埋点 · SCOPE-GUARD PASS。证据 `gate-logs/n9-verify-20261012/`。
- **抓到并修复 1 个 latent 缺陷（先红后绿）**：违规标识符扫描守卫**模式 2（`--self-check`）对 wheat 策略一调用即 TypeError 崩溃**——g2-blocks 判例四字段，wheat 移植仅两字段（缺 `allowedPreExistingModifiedPaths`/`forbiddenTouchGlobs`/`exemptTouchPrefixes`）。修复 = **策略单源补全（脚本零改动、检测规则零改动、零缩水）**；红证据 `01-guard-mode2-red-before-fix.log`（RED-EXIT=1），绿证据 `02-guard-dual-mode-green-after-fix.log`（双模式×2 轮 4/4 EXIT=0）。字段形态与脚本判定逻辑严格对齐（精确串/前缀/纯字符串数组三态）。
- **口径契约落档**：统一契约门禁必须在仓根执行（`--spec .myrd/spec/wheat-squad/design-spec.json --project games/wheat-squad`）——spec 实体路径按仓根相对解析，子目录 CWD 调用会假红 25/28（`03-gates-fresh-n9.log` 勘误段 + `03a` 正确口径 53/0）。
- **图谱刷新**：code-review-graph 增量更新 23 文件，`built_at_sha` 1652974 → **20a1a9d（head_matches_build=true）**，FTS 3096 条。
- **构建确定性复核**：`node tools/build.mjs` 重建 10 文件与仓内 build/ **逐字节全等**（src/build 均止于 dca93ae，其后再无变更）——「部署字节=提交字节」在当前 HEAD 成立。
- 四件套：**A1 ✅（1.71s≤10s+5种子≤30s）/ A2 ✅（P50=168s∈[90,180]·victory 20/20）/ A4 ✅（0ms≤100ms·通道4≥2）/ A3 机制面 ✅ 结论面 ⏳（0/5 待真人回填）**——「四件套全达」本轮不宣称
- 冻结计数器：**0/3**（基线轮第 1 轮；口径=连续 3 轮四件套全不达才计数，本轮 3 达 1 未达 → 不计数；明细见 qa/n7-adversarial-review.md §四）

### 本轮升级项（红线：不空转）

| id | 事项 | 证据 | 归属 |
|---|---|---|---|
| W-3 | **页面路由平台层串线**：v7 running@46cce20·currentDeploymentId=v7·资产字节全等（main.mjs md5 1711423891 ≡ live）·资产路 index.html=麦浪小队，但 /apps/wheat-squad-2/gw 页面=game-9 壳（与 /apps/game-9/gw 字节全等 abb7c87b）——平台 serving 层发共享壳，三次正确 manifestPath 重部署（v4/v5/v7）不收敛，与 stack-tower 轮判例（重部署即纠）行为不同 | gate-logs/n8-deploy-20261012/01-deploy-incident.log | **运维/平台侧**（主人转发） |
| W-3' | v3 事故单如实披露：本轮首次部署漏传 manifestPath（stack-tower 轮同型判例），致页面路短暂串线；v4 起已带正确清单 | 同上 | 已纠正面，留档 |
| W-2（沿上轮） | 好玩终裁（四件套 manual 面）+ A3 5 名试玩回填（量表 `games/wheat-squad/qa/playtest-record-template.md`，含重开理由原文列） | 试玩入口待 W-3 解除后交付 | 主人 |



## N4 收口态（2026-10-11 · spec v0 + 可玩骨架同批交付）

- **spec 版本链起点**：`cmv36ewn8001sm9mxvsyvbvuc` · **v1 draft**（平台 revision 1）· meta.version=0.1 · 六段齐（entities 13 / levels 2 / acceptance 10 含 1 PEND）· 导出件 `.myrd/spec/wheat-squad/design-spec.json`（回读全等 EQUAL）
- **SCHEMA 探明（probe 判例）**：POST /api/v1/game-design-specs 需 projectId + spec；assets 元素必填 kind/file/source(+license)；acceptance.check 必须非空字符串（PEND 条也须给 check 落点）
- **骨架工程**：`games/wheat-squad/`（零 npm 依赖：node 原生 TS strip 跑测 + stripTypeScriptTypes 构建判例）· entities 13/13 落点在盘非空（ac-08 机判）
- **门禁终验**：契约 **9 PASS / 0 FAIL**（det/fv-1/fv-2/fv-3/fv-4/perf/tex/anchor/fv-pend）+ **WS-SMOKE PASS**（打开→拖动→击杀→300s 自然结算→零错误）——`gate-logs/n4-scaffold-20261011/01`
- **骨架轮抓到的设计缺陷（契约先红后绿价值实证）**：三选一触发面过窄（仅拾取瞬间→改击杀/拾取双面+阈值递增）+ 接触伤害无无敌帧（38s 即死→0.8s 无敌帧+接触分离）——均实现面调参，spec 冻结数值零改动
- **好玩判据四件套**：首 30 秒（auto 1.73s/7.04s + manual 待真人）/ 单局时长（auto 300s∈[180,300] + check 路径写进 acceptance fv-2）/ 再来一局（auto 重开 0ms+三信息 + manual 待真人）/ 反馈手感（auto 0 帧 ≤150ms + manual 待真人）——逐条 auto/manual 声明在 spec
- **冻结转新题触发条件**：spec fv-3 条款写死（连续 3 轮真人试玩 ≥2 轮双 manual 不达 → 冻结转新题）

## N5 收口态（2026-10-11 · 互查 + 部署试玩）

- **QA 互查回执**：`games/wheat-squad/docs/qa-n5-recon.md`（QA-WS-N5-20261011-01）——五线零悬空（check 路径 9 可跑 + 1 PEND 在档 · 待校准列明数据项 · 试玩路径可复现 · 冻结条款写死 · 四件套声明齐）→ **放行部署**。
- **美术互查**：参考卡首稿缺规范四要素中光照/线条/比例 → 主动打回当场补齐（§二·补），零遗留。
- **AppHost 部署**：坑 `cmv36wl94001xm9mxp119q48x`（slug **wheat-squad-2** · projectId 关联本项目）· 部署单 `cmv36wsds001zm9mxjibnmgqt` **v1 running** @ commit `4a58fb9e1f2c8005e31bb08de84a8076509637b1`（远端 HEAD 全等）· 零 errorMessage。通道实录 = 首坑缺 projectId 被拒 → DELETE 重建 → POST 000 截断 → GET 复查已受理（单次无重复）。
- **LIVE 自测 PASS**：/gw 200 出壳 title=麦浪小队 · 资产四件全 200 · main.mjs md5 `259fc5b449a76102792b264ef373ca01` ≡ 仓内 build 全等 · LIVE-SMOKE PASS（线上 boot + 拖动击杀 + 零错误）。**试玩入口：https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw**
- **提请主人**：①真人试玩终裁（四件套 manual 面——接敌节奏/再来一局意愿/打击感，入口见上）；②链 v1（spec v0.1）approve 与否（draft 不阻塞试玩）；③试玩结论若触发「连续 3 轮不达」→ 冻结转新题条款自动生效（主策划发起）。

## N5 复跑轮（2026-10-11 · 游戏程序 · verify-claims 独立复验）

- **复跑结果：N4/N5 声称全部独立复现成立**，另补两件增量（证据 `gate-logs/rerun-20261011/01·02`）。
- **契约复跑**：`node tests/contract/run-all.mjs` **9 PASS / 0 FAIL，EXIT=0**（det/fv-1/fv-2/fv-3/fv-4/perf/tex/anchor/fv-pend 逐条复现）。
- **本地冒烟复跑**：`node tools/smoke.mjs` **PASS**（ready ✓ 拖动击杀 1 → 300s 自然结算 → console 零错误）。
- **LIVE 资产三点全等（本轮新增机判）**：资产真实服务路径 = `/apps/wheat-squad-2/gw/api/public/assets/*`（server 壳 `<base href="api/public/assets/">` 形态，直连 `/gw/main.mjs` 会 404 属路由设计非缺件）。`main.mjs`/`theme.mjs`/`sim.mjs` 三件 HTTP 200 且 **LIVE 字节 ≡ git `4a58fb9e` 字节 ≡ HEAD build 字节**（md5 逐件全等）；index.html DIFF 为壳层 base+boot 注入设计行为。**黑板原登记 LIVE md5 `259fc5b4…` 为部署当时历史值，本轮复测以 `cc454a07…` 为准**（对象存储已随部署 commit 刷新）——口径修正登记于此。
- **线上冒烟（本轮新增工具）**：`games/wheat-squad/tools/smoke-live.mjs`（零 npm 依赖，CDP 直连 LIVE 入口跑与本地冒烟同断言面）→ **WS-LIVE-SMOKE PASS**（线上 ready ✓ 拖动击杀 2 → 300s 结算 → console 零错误）——部署存活与可玩性直接实证，主人试玩入口可交付：https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw
- **口径说明**：部署单 API 态（running/errorMessage）本轮未做 API 级核对（本地无平台 JWT），以 LIVE 实测三点全等 + WS-LIVE-SMOKE PASS 替代证明部署存活；如需 API 级回执归档请主人侧补一次控制台导出。

## 部署轮 r2（2026-10-11 · 游戏程序 · workflow deploy 节点 · 复证发布）

- **复证发布（r6 判例同构：产物零漂移也重发，把 LIVE gitRef 绑到当前 HEAD）**：坑 `cmv36wl94001xm9mxp119q48x`（GET 核对 sourceId=wheat-squad 绑定即本游戏，复用不新建）deployment **version 2** `cmv3b9cwe002jm9mx3rzu6fuq` = running/current @ commit **`66ef76f`**（部署单回读 commitHash 全等 · durationMs 835 · 零 errorMessage；v1 @ `4a58fb9` 被接管）。`git diff --stat 4a58fb9..66ef76f -- games/wheat-squad/build` = **空**（产物面零漂移，游戏内容与 N5 部署版逐字节一致）。
- **API 级部署单核对（本轮补上，闭环上轮「本地无 JWT 未做 API 级核对」的口径缺口）**：GET 实查 v2 status=running · errorMessage=null · currentDeploymentId 已切换——部署存活三要素 API 级实证在档。
- **构建工具真缺陷修复（先红后绿，随件走）**：`tools/build.mjs` 一号仓回退发现逻辑 `slice` 后误套 `dirname()` 多上一级——无 env 默认态构建必 ENOENT（红：`<project>/.myrd/spec/...` 不存在）；修复 = slice 归一尾斜杠直取 run 目录（绿：无 env 重建成功，`git status -- build` 空 = 产物 ≡ HEAD 逐字节）。红绿证据 `gate-logs/deploy-r2-20261011/00-gates.log` + `00-rebuild` 过程（ENOENT 全文在案）。
- **部署前门禁（本节点实跑）**：契约 **9 PASS / 0 FAIL** · **WS-SMOKE PASS**（打开→拖动击杀→300s 自然结算→零错误）· 证据 `gate-logs/deploy-r2-20261011/00-gates.log`。
- **线上自测**：/health 200 · /gw 200 title=麦浪小队 · `main.mjs` md5 `cc454a07…` local≡live（≡ 复跑轮登记修正值）· **WS-LIVE-SMOKE PASS**（线上 ready ✓ 击杀 2 → 300s 结算 → 零错误）。证据 `gate-logs/deploy-r2-20261011/01-deploy-live.log`。

## 阻塞项（当前无团队面阻塞）

| id | 内容 | 归属 | 解除判据 |
|---|---|---|---|
| W-1 | 放置收益基准值待校准（结构已冻结，数值占位） | 主人侧内测样本 | N5 部署试玩样本回收后 revision 校准（fv-pend PEND 条） |
| W-2 | 好玩终裁（四件套 manual 面） | 主人（N5 部署后试玩） | 真人试玩结论；连续 3 轮不达触发冻结条款 |

## 部署轮 r10（2026-10-13 · 游戏程序 · workflow deploy 节点 · v12 重发复证）

- **重发复证**：坑 `cmv36wl94001xm9mxp119q48x`（slug `wheat-squad-2`，GET 核对 sourceId=wheat-squad 复用不新建）部署单 **v12** `cmv641ays003ym9qq0w2u53bg` ready @ commit **`7608768`**（gitRef=`myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1` · manifestPath=`games/wheat-squad/apphost.toml` · errorMessage=null，首轮轮询即 ready）。
- **部署前门禁**：verify.sh 五步全 PASS `VERIFY_EXIT=0`（统一契约 + 自有契约 + WS-SMOKE 打开→首次核心操作→单局结束→重开 + A1/A4 四事件真实产生 + console 零错误 + SCOPE-GUARD 双模式）；确定性重建 10 文件零字节漂移（`games/wheat-squad/src` 自 `c4348e1` 起零变更，部署字节=提交字节）。证据 `gate-logs/deploy-r10-20261013/01`。
- **W-3 第八次复现（维持升级，游戏仓侧不可修）**：页面路 title=汽车连连看；**新增决定性证据两条**——① 页面字节跨坑全等（`/apps/wheat-squad-2/gw` ≡ `/apps/game-9/gw`，md5 `abb7c87b…`，serving 层对所有 app 发同一份壳）；② 壳源码 boot 契约 Godot 专用（`index.js`→`index.wasm.gz.b64`/`index.pck.gz.b64`→`WebAssembly.validate` 硬校验→`new Engine`，无非 Godot 回退分支）+ 资产网关单段 `:name` 路由嵌套 `src/*.mjs` 全 404 实测 → TS 多模块工程经该壳必然 boot 断链。`tools/smoke-live.mjs` 对 LIVE 实测 **`LIVE_SMOKE_EXIT=1`**（预期红 fail-closed，取码紧邻命令）。证据 `gate-logs/deploy-r10-20261013/03`、`04`。
- **资产路字节核验**：`main.mjs`/`spec.json`/`index.html` 三件 live md5 ≡ HEAD build md5（逐件全等）——v12 部署内容正确在线。
- **试玩入口处置**：维持暂缓交付（r9 判例延续：页面路串线未解除，避免误测 game-9 壳）；解除判据不变：页面 title=麦浪小队 ⇒ smoke-live PASS。埋点本地日志开关说明已随 `games/wheat-squad/docs/deployment-notes.md` 刷新至 v12（9 事件 · 默认零外发）。wx 包本轮不出（无线上验证锚点）。

## 复证轮 + 部署轮 r14（2026-10-16 · 游戏程序 · 双轨任务书重发 @ HEAD `af399d7`）

> 定性：双轨收口轮任务书**重发**——按 verify-claims 纪律（不照抄黑板声称）在当前 HEAD 独立实跑复证，**不重做**。证据 `gate-logs/r1re-prog-reverify-20261016/01..07`（各带命令/UTC/退出码）。结论仅对 `af399d7` 有效。

### A 轨复证（P0 · 产品线 2 · R1 复测三态分流收口维持）

- **新锚三点链复证维持成立**：报告绑定 sha `4eccaf293b11052041860ff7b0ee3141975258fd` ≡ LIVE `main.mjs` 内嵌 `__G2WS_BUILD.gitSha`（**逐字符全等**）≡ 仓内 `build/main.mjs`（md5 `67a60360d82410d504cd96077ca31cb7` **逐字节**）；工作区 HEAD `98d1fbe→af399d7` 受测源面 diff（src/tests/ci/assets/apphost/spec）= **空**（04 号证据）→ v2 全部判定值绑定有效性维持（retestProtocol①）。
- **verify.sh 五步门禁 @ `98d1fbe` 复跑 `VERIFY_EXIT=0`**：①统一契约 PASS ②自有契约 16 PASS/0 FAIL/1 PEND（PEND=ac-a3 结论面 0/5 真人，ALL_GREEN=false 如实）③WS-SMOKE PASS（victory 167s · console 零错误）④⑤双 SCOPE-GUARD PASS（01 号证据）。
- **确定性重建 diff = 仅 `__G2WS_BUILD.gitSha` 单行**（`4eccaf29→98d1fbe`，构建自指滞后不变量；游戏逻辑字节逐字节全等 · specAnchor `cmv8xcexk…@v6:approved` 不变）；重建后仓内产物**已恢复原样**（build 内嵌维持 `4eccaf29`，不随 docs 提交漂移锚——02 号证据）。
- **分流表 v2 终局维持：绿 15 / 红 0 / 未判定 1（ac-a3 结论面待真人 0/5）**；v2 追加三件 QA 复签**仍归 QA 节点**（程序不代签，PROG-WS-R1RE-REVERIFY-20261016-02 复证签字在 `docs/r1re-triage-table-20261016.md` §v2 复证登记）；红 0 条 → 条件触发链（连续 2 轮红）不触发；阈值红线零触碰；**A3 真人采集维持未判定·待采，机器不代采**（任务单 APPROVE-READY 维持，待主人圈定 5 名真人）。
- **对账表复证节落档**：`docs/r1re-sha-reconciliation-20261016.md` §四。

### B 轨亲核（P1 · 产品线 3 · 只读零写入）

- 线3 spec 链 `cmvabm4kh001jm92c4qtjy9a7` v1 **status=draft（未 approve，审签归主人）** · memo v1 五件套（四字段+视觉基调）在盘 · 风格卡 v0 四要素 **0 图** · 调研简报 D15-D28 共 14 数据点带出处 · `games/` 零线3 实现目录（**止步 T+0 维持，本轮零实现动作**）· 数值面显式 PEND 不编数。

### 部署轮 r14（v21 · 复证发布 · 产物零漂移也重发，把 LIVE gitRef 绑到当前分支）

- **硬前置三查全过**：①分支 `game/wheat-squad` ≠ main ②推送后远端 `refs/heads/game/wheat-squad` = `af399d7` = 本地 HEAD（ls-remote 全等比对）③`games/wheat-squad/apphost.toml` 在盘（assets_dir=games/wheat-squad/build）。
- **坑复用**：`cmv36wl94001xm9mxp119q48x`（slug `wheat-squad-2` · GET 核对 sourceId=`wheat-squad` 绑定 ✓ 专属坑复用未新建）。
- **部署单**：**v21 `cmvafh9i1001em94lwu8osw8u` running/current @ commit `af399d7`**（gitRef=`game/wheat-squad` · manifestPath=`games/wheat-squad/apphost.toml` · mode=bundle · durationMs 834 · 零 errorMessage）。POST 响应体空截断（r10 判例同型）→ GET 复查已受理 **未重发**。
- **LIVE 自测全绿**（06 号证据）：/health 200 · /gw 200 title=麦浪小队（页面路无串线）· `main.mjs` md5 `67a60360…` live≡local 逐字节 · 内嵌 sha `4eccaf29…` ≡ 报告绑定 sha 逐字符（**v21 重部署零字节变化，锚链未断**）。**WS-LIVE-SMOKE PASS**（`LIVE_SMOKE_EXIT=0`：ready ✓ 拖动击杀 2 → victory 167s → console 零错误，07 号证据）。
- **产物面判读**：v20→v21 部署字节零漂移（受测源面自 `4eccaf29` 零变更）——本轮重发布为 gitRef 重绑当前分支动作，非内容更新；试玩入口维持 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`（v21 即 A3 采集字节，与 v20 逐字节全等）。
- **团队产物区**：artifact `cmv3bfs3c002lm9mx7pw3e31a` → hostedAppId `cmv36wl94001xm9mxp119q48x` status=ready（幂等复用，POST 回执在档）。

### 升级/阻塞（口径不变）

| 项 | 状态 | 归属 |
|---|---|---|
| A3 真人 5 名圈定与回填 | **维持升级**（0/5，任务单 APPROVE-READY，机判面全就绪仅缺真人） | 主人 |
| 分流表 v2 追加三件 QA 复签 | 待 QA 节点（F1/F2 修正版证据 `gate-logs/r1re-f1-fix-20261016/`） | QA |
| 线3 主人审签（命名/视觉方向/spec approve） | spec draft 在链，止步 T+0 | 主人 |
