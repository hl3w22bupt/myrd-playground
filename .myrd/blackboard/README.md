# 黑板组合全景索引（2026-10-14 · **R1 打磨轮收口** · 主策划整合）

> 口径：一游戏一子目录判例（顶层三件套属 game-9 存量，零触碰）；本索引 = 全线一页视图。上轮全量台账见文末「2026-10-12 可玩基线轮」存档节。

## 组合全景（2026-10-14 刷新 · R1 打磨轮）

| 线 | 状态 | 本轮动作 | 关键产物 |
|---|---|---|---|
| **game-9《汽车连连看》**（一线已交付） | 维持：等主人试玩拍板 | **零接触** | 顶层三件套（存量） |
| **g2-blocks《熔炉方块》** | 维持：提审就绪 · 被动触发器 | **零接触**（任务书红线：无主人凭证不越权提审） | 兄弟 run 工作区 |
| **wheat-squad《麦浪小队》**（第二产品线） | **R1 打磨轮收口**：spec **v1.3 = 链 v5 approved**（B 案 assets 登记闭合）· 双线合流（W-3 平台修复 × v1.2 实现）· 实测三样绑 sha（A1/A2/A4 达标 · A3 未判定·待采）· QA 行号级对账放行 · 修复批两件（ALL_GREEN 假绿打印/征集卡移位）· **v14 重部署 LIVE @ b33bea2f**（三点复测全过 + WS-LIVE-SMOKE PASS）· **A3 采集窗已开启**；好玩判据第 1 轮**不达**（A3 无真人证据，如实登记；冻结计数器 0/3 按 spec 协议不计数） | R1 主线五节点全闭环（详见 wheat-squad/blockers.md 收口台账） | 链 v5 `cmv7hekf3000mjofivl4ebhdf` · 回执 QA-WS-R1-20261014-01 · 实测报告 r1-measured-report.md · 程序批 r1-program-batch.md · 记录卡 playtest-collection-round1.md |
| **第三产品线** | 候选池维持（不开题不立项） | 本轮零接触（任务书「不开新题、不重复调研」红线） | `research/line3-candidates-20261013.md` |

## R1 轮台账速览（2026-10-14 · wheat-squad · 全文见 wheat-squad/blockers.md「R1 收口台账」）

1. **N0 双线合流** `8868d0f`：main（W-3 平台修复 76954ca）× 兄弟线（v1.2 实现）merge-base a5018b6 互补 → 零冲突合流，五步门禁全绿
2. **N3 程序批**：sha 三点核对（HEAD≠线上如实登记）+ 埋点口径说明（9 键单源）+ 操作路径清单 OP-01..07
3. **N4 策划批**：二义自查（任务书四项已闭合于 v1.2 不重做）→ 新发现 ac-art-2 口径二义成立 → **B 案裁决** → **spec v1.3 入链 approved（v5，唯一 approved 回查 ✓）**
4. **N5 实测批**：A1 ✅ 1.71s · A2 ✅ P50=168.1s 20 局 victory 20/20 · A4 ✅（fx 绑定+帧采样两新面）· A3 ⏳ 未判定·待采（如实）
5. **N6 QA 对账**：行号级 16 条 · 独立复跑全绿 · 修复批入口放行
6. **N7 修复批 + 部署**：ALL_GREEN 假绿缺陷修复（变异验证）+ 征集卡移位（不弱检）→ 发布门禁绿 @ b33bea2 → **v14 LIVE** → 三点复测 + LIVE-SMOKE PASS → **A3 采集窗开启**

## 2026-10-12 可玩基线轮台账存档（wheat-squad · 按时间序 · N1–N17 原文保留）

1. **N0** 实证勘察：本 run 种子无 wheat-squad → 自兄弟 run 分支 6d59bef 窄路径移植真源/契约/黑板（判例披露：spec 落点 `.myrd/spec/wheat-squad/`（一游戏一文件），黑板 `.myrd/blackboard/wheat-squad/`（一游戏一子目录），不采任务书字面顶层路径——防撞 game-9 存量与糖果线冻结件）
2. **N1** 图谱注册：code-review-graph 全量建图 177 文件/3271 节点，锚定 commit 1652974
3. **N2** 主策划差异点三列表 6 行（对标/差异/是否需视觉可观察），逐行落 spec 条款
4. **N3** spec v1.0 入链（cmv4pqezm·v2 draft）：A1-A4 四件套条目化（fv-1..4 退役映射）+ 埋点三方同名 + entities 符号锚对齐（修 11 处）+ 总则/范式/反馈协议入 meta + 美术四条款
5. **N4** 风格卡 v1 主策划拍板开产：四要素冻结 + manifest 9 件（≤封顶 13）+ 提审素材占位模板（止步清单红线）
6. **N5** QA 四要素联审 PASS → **approve（机械合规审放行；好玩终裁仍归主人）** → v1.1 单点修订（e-settlement 锚修正，反馈接入协议首次实际执行）→ v3 approved（cmv4q8bng，链上唯一 approved）
7. **N6** 实现补全：victory 终局 + 埋点接线 + 裸 hex 收口 + 机型档 perf + 扫描框架平移——契约 13/0 + 统一门禁 53/0 + WS-SMOKE 全链路（**顺修 2 个 latent 缺陷**：CDP 盲打坐标/零持按拖拽）
8. **N7** QA 对抗审查（三输入四门禁新鲜取证）：14 条逐条对账 + 5 缺口如实列明 + 扫描清单七类防缩水确认 + 冻结计数器 0/3
9. **N8** 部署：v3 事故（漏 manifestPath，如实披露）→ v4/v5/v7 正确清单重部署；**v7 running@46cce20 资产面全等；页面路由平台层串线 W-3 升级运维**（两坑页面字节全等 abb7c87b 为决定性证据）
10. **B 线**：第三线简报落盘——放置挂机互斥排除（同 idle 轴）；候选 ≤3（跑酷/模拟经营/io 对战·高风险标注）；全部带出处
11. **N9** 游戏程序 verify-claims 独立复核（当前 HEAD）：N1–N8 全部复现成立（53/0 + 13/0 + 冒烟 + 扫描四绿）；**抓到守卫模式 2 latent 崩溃并策略单源修复**（先红后绿，脚本/规则零改动）；图谱刷到 20a1a9d · 重建与仓内 build 逐字节全等。证据 `wheat-squad/gate-logs/n9-verify-20261012/`
12. **N10** 游戏程序驳回修复：routine「游戏契约测试」FAIL 属实（默认参数指向已不存在的顶层 spec 件——routines.yaml 未随 N0 一游戏一子目录判例更新）；修复 = 参数单源对齐 wheat 线，检查器零改动；字面命令连跑 2 轮 53/0 绿 + 冒烟绿。证据 `wheat-squad/gate-logs/n10-routine-contract-fix-20261012/`
13. **N11** 同因驳回二次处置：字面 specPath 薄壳入口（`.myrd/spec/design-spec.json` 相对符号链接 → approved 单源，零拷贝零漂移，thin-proxy 判例）；规范口径连跑 2 轮 53/0 绿；`projectDir=.` 弱面 fail-closed 2 项如实披露不弱化（平台参数存量升级项 W-4）。证据 `wheat-squad/gate-logs/n11-legacy-specpath-symlink-20261012/`
14. **N12** 驳回三到案收口：v3『契约不一致』= 弱面丢契约镜像层（W-4 预判命中）；root `tests/contract` 薄壳链接（→ wheat 契约镜像）使检查器 `tests/contract` 解析位任意 projectDir 单源命中；插桩实证规范面 21 源纯 wheat 独立 53/0、弱面 27 源为合法超集（糖果线遗留 c3 命中 games/game 冻结件）非假绿；两口径各 2 轮 4/4 EXIT=0；**W-4 仓内闭环降为知情项**。证据 `wheat-squad/gate-logs/n12-root-contract-thin-entry-20261012/`
15. **N13** 受测游戏身份门禁收口（破案：平台门禁日志落点=顶层 gate-logs/，原始驳回日志在档）：新建 **wheat verify.sh**（五步真门禁薄壳，2 轮全 PASS）+ `.myrd/spec/wheat-squad-spec.json` slug 命名薄壳 + routines.yaml 陈旧 gamePath 纠正；两处守卫拦截均显式登记后转绿，冻结线零触碰。证据 `wheat-squad/gate-logs/n13-game-identity-verify-sh-20261012/`
16. **N14** 对抗审查 D1/D2 修复（先红后绿）：埋点定名 `run_duration_ms` 真达成（接线载荷键改名 + 冒烟经 telemetryEntries 直读真实载荷，弃自算）；`overrun`→`defeat` 按 approved 单源对齐；新增 **ac-14** 剥注释机判 5 键三方同名+结局势 spec 同源+placementOffline 行为锁定（D2）；14/0 + 53/0 + verify.sh 2 轮全绿；D3 措辞归策划 revision（W-5）。证据 `wheat-squad/gate-logs/n14-telemetry-naming-20261012/`
17. **N15** 受测游戏身份门禁收口 v2：`.myrd/spec/design-spec.json` 升格为**生成的门禁适配视图**（tools/build-gate-adapter.mjs 从 approved 单源派生，注入顶层 id/slug=wheat-squad 两键）；新增 **ac-15** 漂移守卫（剔注入键深等）；15/0 + 三口径 PASS + verify.sh 2 轮全绿；平台门禁 id 读取实现不在仓，若仍败走 W-6 升级。证据 `wheat-squad/gate-logs/n15-gate-adapter-20261012/`

## 待主人裁决清单（2026-10-13 刷新）

| # | 事项 | 入口/载体 |
|---|---|---|
| 1 | **W-3 页面路由平台层串线转发运维**（**第八次复现**：v12 `cmv641ays003ym9qq0w2u53bg` @ 7608768 资产路字节在线（三件 md5 全等）但页面路仍发 game-9 共享壳；本轮新增决定性证据 = 页面字节跨坑全等（md5 `abb7c87b…`）+ 壳源码 Godot-only boot 契约（index.js/wasm.gz.b64/pck.gz.b64 硬链 + 嵌套资产网关 404，TS 工程必断链）；证据 `wheat-squad/gate-logs/deploy-r10-20261013/03-live-w3-probe-v12.log`） | 黑板 blockers.md 升级项 |
| 2 | **A3 5 名试玩组织与回填（R1 更新：W-3 已解除 · v14 LIVE · 采集窗已开）** + 四件套 manual 面终裁（好玩判定归主人） | 记录卡 `games/wheat-squad/qa/playtest-collection-round1.md`（时间窗可验真）；入口 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw` |
| 3 | **Q-1 缺陷修复授权**（offerIfNeeded 死阈值 5 与 sim 递增阈值不同源 → xp≥5 三选一连弹；修复涉 approved A1/A2 行为面，须走 feedbackProtocol revision——`games/wheat-squad/qa/known-defect-q1-offerif-bypass.md` 含修复方向与复测判据） | 黑板 blockers.md 升级项 |
| 4 | 第三线候选点名（跑酷/模拟经营/io 对战三候选池已刷新，只攒池未开题） | `research/line3-candidates-20261013.md` |

## 2026-10-13 增量轮台账（本轮 · 任务书重发承接）

> 上轮（2026-10-12 可玩基线轮 N0–N15）全量台账原文保留于文末存档节。

1. **N0** 分支快进重建（远端成果分支 20facdf → 本 run 分支）+ 基线自证（53/0+15/0+冒烟 PASS）+ 任务书增量识别八项——**定性：任务书为上轮重发，本轮只落增量不重做**
2. **N1** 地基：图谱注册构建（3306 节点@129bf56）+ `inventory-line2.md`（每文件一句+渲染管线一行结论交美术）+ **runner PEND 三态**（ALL_GREEN=false 口径落死 + 严格模式 exit 2 样例输出交 QA）+ **埋点四事件先红后绿**（ac-16：hint_shown/first_tap/first_loop_complete/restart_clicked，atMs 相对时间戳）+ a3 实测初值（duration-log 20 种子 P50=168.1s）；顺修遥测被冻结吞账缺陷（step 遥测段前移）；**抓到 Q-1 已知缺陷不擅修**（升级项）
3. **N2/N3** 三合一包一次发全 → 美术当天回件（参考卡 §v1.2 + manifest v2）→ spec v1.2 生成器（冻结守卫）→ QA 只读预审 APPROVE-READY → 主策划审签 → **POST revisions 入链 v4 draft → approve → 回查唯一 approved + 链上≡payload 深比 True** → 导出件换基线 → checks 16 件薄壳（SHIM_MAP 守卫 fail-closed 实证）→ 门禁 56/0+16/0/1PEND+冒烟 PASS
4. **N5** QA 互查 QA-WS-N6-20261013-01：四件同包绑 HEAD c4348e1 + 五线按序核（A1–A5 可判定性/账实/断言对应/核心循环/首分钟引导）全过 RECON-PASS 放行
5. **N6** 部署 v11 `cmv60yyfu003jm9qq1ablrdhm` running@e3abcb9（POST 一次受理 HTTP 200）+ **W-3 第六次复现**（资产路新字节在线 ✓ / 页面路仍串线 ✗ 维持升级）+ 埋点本地日志开关说明落档 + wx 包本轮不出（无线上验证锚点）
6. **B 线** 候选池刷新：D8–D14 七个新数据点（含微信官方榜检索时点实时面 + DataEye 2025 年度抖音买量面）+ 三候选补齐三要素（含六件套可判定性预判）——只攒池不开题
7. **N8** 游戏程序 verify-claims 独立复核（HEAD `304dacf` 树净）：N0–N6 全部声称逐条实跑复现成立（verify.sh 五步 VERIFY_EXIT=0 · 严格模式 exit 2 样例 · 链 v4 ≡ 仓内逐字节 · 构建零漂移 · a3 初值复跑逐值一致 · W-3 第七次复测仍串线/资产路 md5 全等）；账实修复 = levels.md 补 v1.2 轮状态段 + assets.md 补 manifest v2 复证登记 + inventory-line2 过时行清账。证据 `wheat-squad/gate-logs/n8-reverify-20261013/`
8. **N9** 游戏美术复证轮 r8（HEAD `c33a816`）：任务书重发勘验定性复证而非重做（美术面 N2/N3 已收口 + 增量纯黑板文档）；八项重证全绿——verify.sh 五步 VERIFY_EXIT=0（自有契约 16/0 含 ac-art-1..4+ac-16）+ 三方色值机判 8 色全等 + 裸色值两规则面零违例 + **7 件交付件对 `304dacf` 逐字节零漂移** + 三入口 palette 亲核 + §v1.2 引导横幅目检亲审七项全符合；三合一包索求面回件零缺口核对在档；冻结件零触碰零新产（wx/dy 分享图维持不出）；闭合 N8 登记中「美术线复证仍归游戏美术」挂点。证据 `wheat-squad/gate-logs/art-reverify-20261013/`
9. **N10** 游戏美术复证轮 r9（HEAD `7c570ec` · N9 驳回修复轮跨线认领）：任务书再重发勘验见 N9 两笔新提交（`a0929c2` 契约断言层 + `7c570ec` 证据收口）——断言直指美术交付件（ac-16 三方 copy 机判绑定 manifest copy / ac-11 窄面披露涉 ac-art-2），美术件本体零字节变更（7 件 vs r8 基线逐字节零漂移）；verify.sh 五步 **VERIFY_EXIT=0** + 四项快检全绿后逐项认领：①② 认领零保留（文案面自人工目核升逐字机判，与 G-1 逐字单源同向）；③ 美术线立场登记（裁决选项 A 更契合 manifest 类别学 / 选项 B 致双登记漂移面，两选项 manifest 零字节变更，冻结面不动）；自身瑕疵两项如实披露（status 取样自污染 / 隔管道取码同型违例即刻重取）。证据 `wheat-squad/gate-logs/art-reverify-20261013-n9/`
10. **N11（本轮）** workflow deploy 节点 · **部署轮 r10（v12 重发复证 @ `7608768`）**：坑复用 `wheat-squad-2`（GET 核对 sourceId 绑定）→ 部署单 **v12** `cmv641ays003ym9qq0w2u53bg` **ready**（errorMessage=null，首轮轮询即 ready）；部署前 verify.sh 五步 `VERIFY_EXIT=0` + 确定性重建 10 文件零漂移（src 自 `c4348e1` 零变更，部署字节=提交字节）；资产路 main.mjs/spec.json/index.html 三件 live≡local md5 全等（v12 内容正确在线）；**W-3 第八次复现维持升级**，新增决定性证据两条（页面字节跨坑全等 `abb7c87b…` + 壳 Godot-only boot 契约与嵌套资产 404 → TS 工程必断链），`smoke-live` LIVE_SMOKE_EXIT=1 预期红 fail-closed；**试玩入口维持暂缓交付**（r9 判例）；埋点日志开关说明随 deployment-notes.md 刷新至 v12；wx 包本轮不出。证据 `wheat-squad/gate-logs/deploy-r10-20261013/`

## 本轮拍板记录（主策划）

- **拍板 1**：任务书定性为上轮重发，执行策略 = 以链上实况为基线只落增量（八项清单见 wheat-squad/blockers.md 本轮区段）；不重做已完成面、不重入链。
- **拍板 2**：既有交互 5 条裁决 = 4 条收进 spec 标「既有交互」+ 1 条定性新增条款（ux-ex-hint→ac-a5）；裁决随 spec v1.2 入链落死。
- **拍板 3**：spec v1.2 流程性审签通过（signoff-v1.2.md）→ approve 入链（授权依据 = 任务书「主策划审签 → 入链 approved」+ 执行规则不等待人工审批；「好不好玩」终裁仍归主人不代行）。
- **拍板 4**：Q-1 缺陷本轮不修（修复涉 approved 行为面，单方面修复违反 feedbackProtocol——升级主人裁决，修复方向与复测判据已备）。

## 下一步（团队面）

- wheat-squad：等 W-3 解除（运维/主人侧）→ WS-LIVE-SMOKE PASS → 试玩入口正式交付 → A3 回填与四件套终裁 → fv-pend 校准 revision（样本回收后）；Q-1 若主人授权 → 独立 revision 轮（offerIfNeeded 对齐 + 20 种子复测 + A1/A2 行为面重估）。
- 第三线：主人点名后开题（跑酷候选具备当天出骨架条件）。
- g2-blocks / game-9 / 糖果线：零动作维持。
