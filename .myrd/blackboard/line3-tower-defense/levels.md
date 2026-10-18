# 关卡状态黑板 — line3-tower-defense（单场景塔防 · 第三产品线）

> 更新时间：2026-10-18（**实现轮 · A 轨 N1–N5**）· 负责人：主策划（整合）/ 游戏程序（N4）/ 游戏美术（N3）/ 游戏 QA（N2/N5）
> 下一步：N4 实现轮转真 → 门禁全绿绑 HEAD → N5 互查+部署 → 主人试玩（A4 主观层唯一判官）

## 实现轮节点状态（2026-10-18 · A 轨五节点）

| 节点 | 负责人 | 状态 | 产物落点 |
|---|---|---|---|
| N1 骨架（复核+pending 样例） | 游戏程序 | ✅ 完成 | 12/12 entities 落点在盘 + inventory 12 行对上（路径口径差=工程相对 vs 仓根相对，检查器归一化）+ 14 check 文件在盘 + pending 样例 `gate-logs/n4-impl-20261018/00-pending-sample.log`（run-all exit=1 显式非假绿）@ 锚 `0870263b` |
| N2 预核（四看标准） | 游戏 QA | ✅ **放行 N4** | 四看全 PASS（显式非假绿/pending-fail 分账 14+1/编号全等 14/命令可核销 14）+ 1 口径登记项（inventory 归一化）→ `gate-logs/n4-impl-20261018/01-qa-n2-precheck.md`（QA-L3-N2-PRECHECK-20261018-01） |
| N3 素材（三合一包→风格卡→映射表） | 游戏策划→美术 | ✅ 完成 | tri-pack-v1 ✓ + 风格卡 v1 ✓ + entities id→文件名映射表 12 行（assets.md）+ 首批资产 6/13 件落账（逐件 sha256，ac-art-2 机判输入） |
| N4 闭环（核心循环+14 check 转真） | 游戏程序 | ✅ **完成（绑锚 `a27ca0e`）** | 核心循环全通（输入→反馈→结算→再来一局）· auto **14/14 PASS + 0 FAIL**（a3 PEND 单列）· 统一门禁 63/0 · L3-SMOKE PASS（锚内嵌 gitSha≡绑定锚）· verify ×2 同锚非 flaky · 判据映射表+实现决策披露 D1-D5 落本文件 · 证据 `gate-logs/n4-impl-20261018/02·03·04` |
| N5 互查+部署 | 游戏 QA → AppHost | ✅ **完成（部署 v1 running）** | 三件套核签 JSON `qa-n5-signoff-20261018.json`（QA-L3-N5-SIGNOFF-20261018-01 · 确定性抽样 2 条独立复现 + 源面零漂移）· 部署 v1 running @ `b81d17b`（app `cmvd6lt7f002km9wl2kbex7w4`/line3-tower-defense-2 · 504 判例 GET 复查受理不盲重发）· **L3-LIVE-SMOKE PASS**（线上真实浏览器全链路 + LIVE 锚≡绑定锚 + spec.json 零漂移）· 证据 `gate-logs/n4-impl-20261018/05..08` · ⚠️ 坑位路由 `/gw` 串 game-9（W-3 指纹重现）→ **B-5 升级**；**主人试玩入口（资产面，可玩）= https://leomac-studio.tail49399e.ts.net/apps/line3-tower-defense-2/api/public/assets/index.html** |

## 判据 → 测试文件 → 结果（N4 交付面 · 绑定锚 HEAD `a27ca0e86b618e2bf0ca2f8621efbb1e8c78955e`）

> 口径：0 红 ≠ 绿（pending 单列）；全绿仅对「绑定 sha」有效；a3 真人面机器不代采。
> 证据：`gate-logs/n4-impl-20261018/02-verify-run1.log` + `03-verify-run2.log`（同锚连跑 ×2 VERIFY_EXIT=0）+ `04-regression-and-build-determinism.log`

| 判据 id | 测试文件 | 结果 | 备注（判定值摘录） |
|---|---|---|---|
| a1-td-first-placement-feedback | `tests/contract/checks/a1-td-first-placement-feedback.mjs` | ✅ PASS | 5/5 种子 first_placement_at=0ms ≤20s 预算 ≤30s · 延迟 0ms ≤100 · 首交互 0ms |
| a2-td-wave-duration-band | `tests/contract/checks/a2-td-wave-duration-band.mjs` | ✅ PASS | 20 局 P50=282.128s ∈[240,420] · P90=335.312s ≤600 · 链 20/20 · 结局={defeat:20} |
| a3-td-restart-willingness | `qa/playtest-collection-round1.md`（manual） | ⏳ PEND 未判定·待采 | 0/5 真人 · 机器不代采 · 采集窗=N5 部署 LIVE 后（升级主人 W-L3-3） |
| a4-td-feedback-channels | `tests/contract/checks/a4-td-feedback-channels.mjs` | ✅ PASS | 放置3通道/升级2通道/命中4通道(flash,particles,trace,hud) ≥2 · 延迟4样本≤100ms · 帧P95=0.033ms n=3000 |
| a5-td-onboarding-four-events | `tests/contract/checks/a5-td-onboarding-four-events.mjs` | ✅ PASS | hint@0ms→first_tap@4800ms(≤5000窗,once)→first_loop_complete@44352ms→restart 1→2 · 文案三方逐字 12/12 |
| a6-td-operation-paths | `tests/contract/checks/a6-td-operation-paths.mjs` | ✅ PASS | 5/5 条可达，各带视觉锚断言 + 绘桩 smoke 5 帧零异常 |
| det-1-td-seeded-determinism | `tests/contract/checks/det-1-td-seeded-determinism.mjs` | ✅ PASS | 双局全 tick=13511 哈希逐字节等 · 四表逐值等 · src 19 文件零 Math.random/Date.now |
| tex-1-td-no-external-texture | `tests/contract/checks/tex-1-td-no-external-texture.mjs` | ✅ PASS | src+tools 23 文件零位图构造 · manifest 6 件全带 hash |
| perf-1-td-entity-cap | `tests/contract/checks/perf-1-td-entity-cap.mjs` | ✅ PASS | 峰值 35 ≤220 · 单步 P95=0.003ms ≤16 · 中端档 13511/13511 ≤33ms · 首交互 0.2ms ≤3000 |
| ac-art-1-td-palette-whitelist | `tests/contract/checks/ac-art-1-td-palette-whitelist.mjs` | ✅ PASS | src+tools 22 文件 hex 扫描零违例（8 色白名单+派生声明面） |
| ac-art-2-td-asset-manifest-cap | `tests/contract/checks/ac-art-2-td-asset-manifest-cap.mjs` | ✅ PASS | 6/13 件逐件 生成器行号+sha256 · 重生成逐字节一致 |
| ac-art-3-td-stylecard-tokensource | `tests/contract/checks/ac-art-3-td-stylecard-tokensource.mjs` | ✅ PASS | 裸 hex 仅 config.ts 声明面（spec→config→theme 单源链）· PALETTE≡spec≡风格卡 8 行逐值 |
| ac-art-4-td-visual-signature | `tests/contract/checks/ac-art-4-td-visual-signature.mjs` | ✅ PASS | 映射键集合全等 8/8（a1/a4/a5 + 5 path id） |
| inv-1-td-entity-file-alignment | `tests/contract/checks/inv-1-td-entity-file-alignment.mjs` | ✅ PASS | entities 12/12 落点在盘 ∧ inventory 一一对应（归一化口径） |
| fnd-1-td-telemetry-fieldnames | `tests/contract/checks/fnd-1-td-telemetry-fieldnames.mjs` | ✅ PASS | 键集合全等 8/8 · 四件定名逐字符在位 |

**汇总：auto 14/14 PASS · 0 FAIL · manual 1 PEND（非全绿声明：a3 未判定）。统一门禁（routines 同入口）63 PASS / 0 FAIL；L3-SMOKE PASS（构建锚内嵌 gitSha=`a27ca0e` ≡ 绑定锚，specAnchor=`cmvbqgzbl0029m9ax64foxd37@v2:approved`）。**

> **续接复核一行（2026-10-18 · 游戏程序 · 独立复跑 @ 当前 HEAD `1b953cd24f45d5091c9b0323b41332469ae4acda`）**：绑定锚 `a27ca0e` 之后分支前进 4 个纯 docs/构建提交（c5d0933→1b953cd，源面 src/tests 零改动），本轮在续接线端点独立实跑 `verify.sh` 四步**全 PASS · VERIFY_EXIT=0**——① 统一契约 CONTRACT: PASS（「spec 为 approved 版 · 平台登记 v2 · `cmvbqgzbl0029m9ax64foxd37`」）② RUN-ALL 机判 **14/14** 全绿 · a3 真人面单列未判定（0 红 ≠ 绿口径维持）③ L3-SMOKE PASS（打开→开始→放置→加速→结算→重开 · 构建锚=HEAD `1b953cd2` · 零 console 错误）④ SCOPE: PASS（src+tools 25 文件三判零违例）。构建面按口径以 HEAD 重建，与提交面差异**仅锚位两处**（`02-build-anchor-diff.log` 实证业务产物零差异），取证后 restore 回部署锚面（b81d17b 提交面 ⊃ a27ca0e）不制造锚位漂移。线上单次复查：部署 v1 **running**（commitHash=`b81d17b3…` · errorMessage=null）+ 资产面 `/api/public/assets/manifest.json` gitSha **≡ 绑定锚 `a27ca0e`** + index.html 200。**结论：上轮全绿结论在续接线端点成立；主人试玩入口不变（资产面 URL，见 N5 行）。证据 `gate-logs/n4-recheck-20261018-head/01-verify.log` + `02-build-anchor-diff.log`。**

### 实现决策披露（不与 spec 冲突 · 校准候选）

| # | 决策 | 依据/影响 |
|---|---|---|
| D1 | 首波编成全 grunt（教学波）；mix 比例 grunt60/runner25/brute15 由 seededRng 驱动 | waveTable 未规定 kind 构成；a2 判定值 P50=282s 在带内 |
| D2 | 实现层节奏常量：wavePrepMs=8000 / waveIntermissionMs=5000 / 弹速 320px/s | 非 spec.numeric 冻结面；影响时长带落点，若校准与 numeric 同轮 revision |
| D3 | **a2 结局=defeat 20/20（victoryWaves=8 敌量×血量双 1.35 爬升 → 波次总血量 1.82^n 复合增长）** | spec 允许 {victory,defeat} 判据过；「通关不可达」为数值校准候选（W-L3-4 升级主人，实测后走 revision，不静默改尺子） |
| D4 | harness 自动布防策略（末段走廊 8 塔→全员 L2→逐塔 L3）为契约驱动面，非产品逻辑 | 策略收口：20 种子 P50=282s/P90=335s（校准记录） |
| D5 | 统一门禁三处加法扩展（scene "-"=声明无场景 / checks/ 入扫描源 / `_` 前缀注记键跳过） | wheat 56/0 · stack-tower 82/0 零回归实证；加法不缩水判例 |

## 关卡结构（v1.0 口径 · 维持）

**B 轨程序线复核一行**（2026-10-17 · 游戏程序 · 独立实查 @ HEAD `476090c`）：**B3 三件与 B6 approve 复核成立**——① 图谱：`.code-review-graph/graph.db` 实查含 **line3-tower-defense 节点 45 个**（File/Class/Function 入图，full build @ `0ac1fcf`，build_state=complete）；口径披露：库内实查 File=667/节点总数=6135，与 B3 行构建时点 stdout 口径「669 文件/6385 节点」存在小幅出入（统计口径差，注册事实不受影响，如实登记）；② `docs/inventory.md` 24 文件逐条一句职责在盘 ✓；③ 埋点桩 `src/telemetry/emitter.ts` + `fnd-1-td-telemetry-fieldnames.mjs` 在盘 ✓，且 0ac1fcf 时点 src 16 文件共 **105 行纯占位常量 fail-closed**（`git show 0ac1fcf --stat` 实证）——「approve 前零玩法」合规 ✓；④ B6：`gate-logs/b6-six-criteria.md` 六判据全 PASS + approve 动作 POST 200（01:44:41Z）+ 链上 v2 `cmvbqgzbl0029m9ax64foxd37` approved 在档 ✓。

**B4 美术复证一行**（2026-10-17 · 游戏美术 · 目检+机判双证）：B4 交付**复证成立且完成缺陷修复**——方向稿 3 张目检揪出 Lv3 炮塔出画（cx=688>640，三阶对比失效）与 mix() 小写 hex 机判隐患两处，生成器修复后重出稿；确定性=连续两次重跑 sha256 逐字节一致（`09c4d565`/`7fda59ec`/`4185b770`，旧稿 `117d9680` 等基线留档）；独立审计 23 项全 PASS（manifest sha 实算对拍 + 色值 ∈ spec 白名单∪派生重算 + 零渐变 + 全元素画布内 + 构成件尺寸 + HUD 样例值 ≡ numeric coreLives 10/startGold 120/victoryWaves 8）；palette 8 色与派生规则**零触碰**；方向 2/3 标注候选（采纳须 spec revision，W-L3-2）；跨线认领：生成器名义共管归程序，待程序线复签。证据 `line3-tower-defense/gate-logs/art-sketch-fix-20261017/`。

## B 轨节点状态（2026-10-17 双轨轮 · **B 轨收口：approve 完成**）

| 节点 | 负责人 | 状态 | 产物落点 |
|---|---|---|---|
| B1 源校验（只读） | 游戏策划 | ✅ 完成 | ①调研简报 `research/line3-research-brief-20261016.md`（D15-D28 带出处+日期，QA 抽查环境限制如实）在盘 ✓ ②选型拍板 `line3-memo-v1.md`（差异点三列=§一.④ 品类查重表 3 行；不同品类声明=零机制复用）在盘 ✓ ③拍板已落黑板 ✓ → 可动笔 |
| B2 spec v1 六件套 | 游戏策划 | ✅ 完成 | `.myrd/spec/line3-tower-defense/spec-v1-payload.json`（六段 · builder 六段校验 PASS）+ fragments + 复现链 `tools/build-spec-v1.mjs` + 人读版 `games/line3-tower-defense/docs/design-spec-v1.md` |
| 三合一包（world 草稿+entities id+首屏文案） | 游戏策划→美术 | ✅ 一次发齐 | `.myrd/blackboard/line3-tower-defense/tri-pack-v1.md`（美术回执在档） |
| B3 骨架三件 | 游戏程序 | ✅ 完成 | ①工程注册入图谱：669 文件/6385 节点 @ `0ac1fcf` ✓ ②`docs/inventory.md` 逐文件一句职责 ✓ ③埋点八键桩（四件定名逐字符常量+缓冲式发射器，零外发）✓ —— spec approve 前零玩法（全占位 fail-closed） |
| B4 风格卡草案 | 游戏美术 | ✅ 完成（复证轮补实证明细） | `.myrd/blackboard/line3-tower-defense/assets.md`（四要素锁定 + 视觉签名映射表 + 美术回执「对得上」）+ 3 张方向稿（`games/line3-tower-defense/assets/style-sketch/`，复证轮修复出画/小写 hex 两缺陷后确定性重跑逐字节一致 + 独立审计 23 项 PASS，证据 `gate-logs/art-sketch-fix-20261017/`）· palette 8 色已冻结进 spec numeric.palette |
| B5 QA 预审（六条口径） | 游戏 QA | ✅ PASS | `qa-preaudit-v1.log`（QA-L3-SPECV1-PREAUDIT-20261017-01 · 机检脚本两次过严断言修正留痕，spec 内容零改动） |
| B6 主策划 approve（六判据） | 主策划 | ✅ **approved** | 六判据核签 `gate-logs/b6-six-criteria.md` · `POST /revisions`→v2 draft（`cmvbqgzbl0029m9ax64foxd37`）→ `POST /approve`→200 approved（2026-10-17T01:44:41Z）· 父版 v1 superseded 回查 ✓ · 导出件 `.myrd/spec/line3-tower-defense/design-spec.json` 零漂移 PASS · README 索引+REVISIONS 台账三处登记 |

## 链上实况（2026-10-17 实查）

- 链 id `cmvabm4kh001jm92c4qtjy9a7` · platform version **1** · **status=approved**（2026-10-16T02:34:48Z）· spec.meta.version=0.1（骨架版）
- 骨架 acceptance 7 条（det-1/a1/a2/a3/a4/tex-1/perf-1，check 为规划落点）；本轮 v1.0 六件套承其 id 连续性（a1/a2/a3/a4/det-1/tex-1/perf-1 不改名，新增 8 条）
- 埋点四件定名（本轮 approve 后锁定，rename 一次性收口）：`first_tap` / `first_loop_complete` / `restart_clicked` / `hint_shown`（与线 2 逐字符一致）

## 关卡结构（v1.0 口径）

| 关卡 | 结构 | 判据锚 |
|---|---|---|
| level-1 首潮（教学波次） | 3 波 · 首波编成 ×0.5 宽松（前 10 秒敌量减半）· 路径箭头常显 | a1 首布防 ≤20s（5 种子） |
| level-2 涨潮（波次爬升） | victoryWaves=8 波通关即胜利结算 · 敌量/血量 1.35×/波爬升 · 核心生命 10 · 漏怪 -1 | a2 P50∈[240,420]s · P90≤600s（20 模拟局） |
