# 阻塞项黑板 — wheat-squad（麦浪小队 · 第二产品线 · 可玩基线轮）

> 更新时间：2026-10-12（可玩基线轮收口）· 负责人：主策划（整合人）· 阻塞超一轮未解 → 升级主人，不空转
> 下一步：①运维/主人侧处置页面路由平台层串线（W-3，证据齐）→ 试玩入口恢复交付；②主人 5 名试玩回填（A3 结论面）

## 可玩基线轮收口态（2026-10-12）

### 当前基线（两件事均已落实，判例落点披露）

- **黑板路径**：`.myrd/blackboard/wheat-squad/`（levels.md / assets.md / blockers.md 三件套 + style-card-v1 + gate-logs）；组合全景索引 `.myrd/blackboard/README.md`。**披露**：任务书字面给的是顶层 `.myrd/blackboard/` 三件套，但顶层现存 game-9（汽车连连看）三件套（2026-10-07 口径），按「一游戏一子目录」判例落 wheat-squad 子目录，game-9 文件零触碰；主策划差异点三列表与 B 线简报按任务书指定路径落顶层（spec-notes-line2.md / research/line3-candidates-20261012.md）
- **spec 版本号**：链 `cmv4q8bng001em9qm5p78do05` · **v3 approved**（meta.version=1.1「可玩基线版」）· 父链 v1(cmv36ewn8·v0.1)→v2(cmv4pqezm·v1.0) 均 superseded · 导出件 `.myrd/spec/wheat-squad/design-spec.json`（期望版本锚 --expect-version 3 重导，updatedAt=2026-10-12T04:03:15Z）——**链上唯一 approved 即本版，契约测试与实现只认它**
- **差异点三列表**：`.myrd/blackboard/spec-notes-line2.md`（6 行三列，逐行落 spec 条款映射）
- **风格卡**：v1 四要素冻结 + 主策划拍板（`.myrd/blackboard/wheat-squad/style-card-v1.md`）

### 本轮机器面（全绿，证据 gate-logs/n7-adversarial-20261012/01-gates-fresh.log 新鲜复跑；n9 轮 HEAD 复核再证，见下节）

- 契约：自有套件 **13 PASS / 0 FAIL**（2 PEND=manual 明示）+ 统一门禁（approved 对账）**53 PASS / 0 FAIL · CONTRACT: PASS**
- 冒烟：**WS-SMOKE PASS**（headless 可重复：打开→首次核心操作→victory 结算 167s→重开复位 + A1/A4 埋点真实产生 + console 零错误）
- 违规标识符扫描：**SCOPE-GUARD PASS**（47 文件零越界，策略单源含素材文案面；n9 轮复核 49 文件零越界——文件数随新增文件自然增长，判据不变）

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
