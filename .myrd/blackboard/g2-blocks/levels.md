# 关卡状态黑板 — g2-blocks（**封版就绪冲刺 · 第 1 批 · 2026-10-08**）

> 更新时间：2026-10-08（冲刺开工 · 主策划）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：N1 v7 封版包入链 → N2 证据 / N4 埋点 / N5 物料并行 → N3 真机轨挂起等主人 → 汇总《提审建议书》
> 红线：**numeric 不改生效值（新增仅提案态）**；埋点零玩法 diff（纯增量，先红后绿）；不触 stack-tower；顺延项（v3 提案 combo 倍率/level-stars/第一分钟引导方案本体）继续零实体零验收

## 封版就绪冲刺节点台账（第 1 批 · N1–N5 · 2026-10-08 收口）

| 节点 | 线 | 交付与落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| N1 spec 拍板包 | 主策划 | 候选池 v1 + 链 v7 draft（找回 v4 + 3 引导锚点实体 + 9 事件表 + DoD 三层门待校准 + 候选池 1/2）+ 拍板包 | 十三守卫 + POST + 回读全等 + 提请 approve | ✅（approve 归主人） |
| N2 证据补齐 | 程序 | 三处契约实跑 + wx 哈希对照表 + dy spec-v12 断言声明 + 引导断言指认 + v1.1→v1.2 diff 清单 + 红线自查脚本 v1（三树 6/6） | 机读 pass/fail 报告落 gate-logs | ✅（复核轮修正：工具迁出源仓，见下行） |
| N2 复核轮（程序 · 2026-10-08 二次实跑） | 程序 | **抓到真缺陷**：红线脚本 `b8ac090` 入源仓后 ac-18 守卫红（Mode A 17/18）——前轮三绿止于 `5e7f2e5`，封版脚本提交后未复跑契约。修复 = 工具重定位 `.myrd/blackboard/g2-blocks/tools/redline-selfcheck.mjs`（树根参数化），源仓 `1e3eff4` 回归零引用；拒绝策略自豁免（不替 spec 改语义） | 复跑六门全绿：Mode A 18/18 · Mode B(v7) 26/0/3 PEND · SMOKE PASS · 三树红线 6/6 · wx/dy 契约 EXIT=0 · N4 numstat 删除=0（原文 `gate-logs/freeze-sprint-r1-recheck-20261008/`） | ✅ |
| N3 真机冒烟 | QA | 冒烟清单 + 机读 JSON 报告（真机槽位 `not_run`）+ 结论「不可提审（真机轨缺位）」 | 真机到位前不出「可提审」结论 | ✅（不造假） |
| N4 埋点落地 | 程序 | web 埋点模块 9 事件（31 行纯新增 0 删除）+ wx/dy 原生路由 + ac-29 双向断言 | 零玩法 diff + 断言双绿 | ✅ |
| N5 物料矩阵 | 美术 | 物料代差清单 M-01..M-11 + 风格卡回写 + 素材归档 + 分享卡模板 + wx 比对 + dy 文案 | 矩阵逐格可核 · 零新绘 | ✅ |
| 汇总 | 主策划 | 《提审建议书》+ v1.3 五条 gate 挂 blockers.md | 提审按钮归主人 | ✅ |

## 关卡状态（继承 V1.2 轮收口态，本轮零玩法改动）

- level-1（引导面：首屏提示条 el-hint + 首次交换引导）/ level-2（键盘 1 / `?level=` / `__G2_SET_LEVEL` 三入口）——实现态与链 v4 手感轮一致，本轮 N4 埋点为纯增量观测面，**零关卡逻辑改动**；N2④ 指认引导路径断言所在测试文件与条目（见本轮 gate-logs）。

---
---

# 以下为上一轮存档（V1.2「核心手感 6 项 + daily-challenge」轮）

> 更新时间：2026-10-04（N1–N5 全链核销 · 主策划）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：等主人拍板（链 v4 approve + 人工验收）；PWA 发布归 deploy 节点
> 红线：**numeric 冻结前不写数值实现代码**；顺延项（连击任务/成就/皮肤 + v3 提案的 combo 倍率/level-stars/第一分钟引导）零实体零验收；性能口径不进 spec acceptance

## V1.2 核心手感轮节点台账（N1–N5）

| 节点 | 线 | 交付与落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| N1 spec 校准入链 | 策划+程序 | 链 v4 draft `cmut5fkyf00cbic7qudea13g6`（numeric 增 feel/daily · acceptance 增 ac-22..28 · assets +a04..a07 · content +dailyChallenge） | ✅ 九守卫全绿 + POST v4 parent=v3 + READBACK EQUAL + v1/v2/v3 零覆盖 · 锚 `1720df8e…` |
| N2 五切片 | 程序 | ①形变+震屏 ②粒子+三档音效 ③连击反馈 ④重开一键 ⑤daily 钩子（源仓 a19e132..cf57708 六提交） | ✅ 每片先红后绿（红证据 6 件）· Mode A 18/18 + Mode B 25/25 · 每片 T2 采样 P95 不退化 |
| N3 视觉打磨包 | 美术 | F-01..F-07 全落 + a03 三档资源 + 分享卡轻更新 + A-10/A-11 收口 | ✅ 四要素校样（gate-logs/v12-feel-n3-20261004/README）· ART-RECHECK 12/12 · 差距清单零 open |
| N4 复检 | QA | 四步对抗复检（tools/qa-v12-feel.mjs） | ✅ 15/15 无红 · VERDICT: APPROVE-READY（复检器首跑五缺陷自曝全修） |
| N5 打包提审 | 主策划+程序 | 打包 + 证据三件套 + release-readiness §F..I | ✅ 提请主人 approve（PWA 发布归 deploy 节点） |
| 提交前复跑（程序 · 提审包封箱自检） | 程序 | 源仓 `eab0df0`→`01c2f06` 全量重跑：契约双态 18/18 + 25/25 · 八门禁 ①–⑧ · SMOKE（J1=172.1ms 归档原文口径）· T2 基准 P95=16.7ms（与基线快照①全等）· N4 复检双姿势 15/15 | ✅ 无红（原文 `gate-logs/v12-feel-n4-rerecheck-20261004/`，独立核验五项判据在档） |
| 驳回修复轮 D1–D6（程序 · 全闭） | 程序 | D1 粒子视觉面接线（renderer.drawParticles + smoke 差分上屏断言，先红后绿）· D2 七件真红重归档 + R3.a 四要素加固 · D3 J1 三处引述以归档原文更正 · D4 完成谓词包内披露（升级 Q-D4）· D5 契约尾行随装载态 · D6 真机层口径钉「5 次中位数」 | ✅ 源仓 `cf967ec`：契约双态 18/18+25/25 · 八门禁全 PASS · SMOKE+粒子上屏 ✓（drawn=8 · 8/8 · 复采 0）· P95=16.7ms 全等 · N4 加固版 15/15 APPROVE-READY（原文 `gate-logs/v12-feel-reject-fix-20261004/`）|

---

# 存档：A 轮「发布收尾主线 + v1.2 写案并行」（2026-10-03 收口）

> 更新时间：2026-10-03（A 轮开工 · 主策划）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：N2–N6 并行推进；N1/N7/N8/N9 条件触发（条件写死，见 blockers.md 待触发区）
> 红线：**v1.2 数值冻结前不写数值实现代码**（N8 三闸齐才派）；性能口径不进 spec acceptance

## A 轮节点链台账（N2–N6 · 全核销）

| 节点 | 线 | 交付与落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| N2① 图注册表 | 程序 | code-review-graph registry `g2-blocks` → `/Users/leo/.myrd/workspaces/…/g2-blocks` | `list_repos` 返回条目（alias g2-blocks） | ✅ B1 闭合 |
| N2② 装配区只读入口 | 程序 | `docs/assembly-entry.md` + `docs/assembly-manifest.json` + `tools/assembly-entry.mjs`（同批判据 = **buildSha256 唯一**，不同批拒绝出清单；gitRef 信息性，见 R4④） | ASSEMBLY: PASS · 同批 `be310288cff10563`（10/3 复检重建导出后同批重拍；双清单 gitRef 同锚 `4f67806`）· QA/美术两用 | ✅ B2 闭合 |
| N2③ B3 归档 | 程序 | 黑板 `gate-logs/deploy-20261002/{01-README,02-contract-check.log,03-smoke.log}`（10/2 发布 commit `0c3aa95` 复跑原文） | 契约 18/18 EXIT=0 · SMOKE PASS J1=175.2ms · 含命令/钉值/时间戳 | ✅ B3 闭合 |
| N3-T1 | 程序 | `src/platform/storage.ts`（注册键制 + 版本化迁移，fromVersion 显式）+ `src/platform/audio.ts`（合成器可注入） | 门禁 T1a–g PASS · ac-16 键级最小集不降 | ✅ |
| N3-T2 | 程序 | `src/telemetry/fps.ts` + main.ts rAF 接线 + `__G2_FPS` + `tools/perf-report.mjs` | 基准跑 fps=60 · P95=16.7ms · 卡顿 0；口径落 `docs/release-readiness.md`（红线④） | ✅ |
| N3-T3 | 程序 | `src/kernel/datetime.ts`（时区纯函数 + dailySeed）+ `src/platform/clock.ts`（可注入时钟） | 门禁 T3a–f PASS · 零外部依赖 · 内核纯净不降 | ✅ |
| N4 发布素材包 | 美术 | 9 件 → `assets/release/`（icons/favicon/OG/wx/dy）+ 4 张同批实机截图 | IHDR 尺寸逐张机判 · 生成器零裸 hex · maskable 安全区 · 美术四门禁自检过 | ✅（美术复核欠） |
| N4 风格盘点 | 美术 | A-09/A-10/A-11 → assets.md（四列齐） | A-09 实锤并代改待认领；A-10/A-11 挂账 | ✅ |
| N5 spec v1.2 | 策划 | 链 v3 `cmurqo70l001uiccx7hjjr37e` **draft**（parent=v1.1）· 八道守卫全绿 | 三 check 写死 3/3 PASS · 漂移面=白名单 · v1.1 approved 保留 · READBACK EQUAL | ✅（approve 留主人） |
| N6 对抗用例预研 | QA | `n6-adversarial-cases.md` 六维 **42 条**（6+6+7+8+7+8，含开放问题 Q1–Q3） | 逐条可执行（命令+预期+判定）· 不依赖装配区 | ✅ |

## A 轮复跑基线（收口态 · g2-blocks @ `fe5fd38` 树净 · 10/3 驳回修复 R4 后）

> 本段数字**全部有原文在档**（驳回②判据「归档 = 复跑 stdout 原文」）：
> 收口态 `c425e1f` → `gate-logs/c425e1f-closeout-recheck-20261003/`；
> 最终态 `fe5fd38` → `gate-logs/prog-r4-docfix-recheck-20261003/`。J1 为墙钟实测，跑间毫秒级抖动，
> **以归档原文为准，不跨 run 转抄**。

- 契约全量（approved v1.1 基线）：**18 PASS / 0 FAIL · EXIT=0**（两态同绿）
- v1.2 三条新 check：**3/3 PASS**（`G2_SPEC_PATH=v1.2 draft` + `--only`；结论依据 **draft**，未拍板）
- 八门禁：**①–⑧ 全 PASS**（⑧ = 本轮新增工程前置面，20 断言）
- 冒烟：**SMOKE: PASS · EXIT=0**——`c425e1f` 态 **J1=172ms**、最终态 **J1=174.6ms** ≤ 400ms（原文在档）
- 装配区：**ASSEMBLY: PASS · 同批 `be310288cff10563`**（判据 = `buildSha256`；双清单 gitRef 已同锚 `4f67806`）
- P95：基准 **P95=16.7ms @ fps=60 · 卡顿 0**（最终态重出，代理口径披露在案）
- numeric 锚：v1.1 `302e6336…`（零漂移）· v1.2 draft `00ca798c…`
- 提交链：`a6eef71` → `49402b5` → `8410986` → `d564b5c` → `4f7470d` → `bb4c836` → `2a5d480`（程序复检修 3 缺陷）→ `aa929e3`（证据重出）→ `c425e1f`（**美术线复核收口**）→ `4f67806`（**驳回修复 R4①③④**）→ `fe5fd38`（双清单重出）

## 程序线独立复检（2026-10-03 · 新 run 工作区，不沿用上轮证据）

> 复检口径：在新 run 工作区（`run-cmurp7sfe000ticcx6ddkrvca`）**实跑**全部门禁拿本轮自己的证据，
> 不引用上一轮 run 的输出。结果：**3 处缺陷修掉，复跑全绿不降**（N3 验收信号达成）。
> 原始输出归档：`gate-logs/a-round-prog-recheck-20261003/`（含 cmd/gitRef/钉值/UTC/EXIT，N7 对账输入）。

| # | 复检项 | 本轮实测（命令 + 退出码） | 结果 |
|---|---|---|---|
| 1 | 契约全量（approved v1.1） | `node scripts/contract-check.mjs` → EXIT=0 | **18 PASS / 0 FAIL** |
| 2 | v1.2 三条新 check | `G2_SPEC_PATH=<draft>` + `--only ac-19/20/21` → 各 EXIT=0 | **3/3 PASS**（工程面零 v1.2 实现痕迹，红线①机判） |
| 3 | 工程门禁八件 | `npm run gate` | **①–⑧ 全 PASS**（⑧ = 20/20） |
| 4 | 冒烟 | `node tools/smoke.mjs` → EXIT=0 | **SMOKE: PASS · J1=171.5ms ≤ 400ms** · 控制台零错误 |
| 5 | P95 报告（N3-T2） | `node tools/perf-report.mjs` | **基准 P95=16.7ms @ fps=60 · 卡顿 0**（当前批次重建） |
| 6 | 装配区入口（N2②） | `node tools/assembly-entry.mjs` → EXIT=0 | **ASSEMBLY: PASS · 同批 `be310288cff10563`** |
| 7 | 图注册表（N2①） | `list_repos` | alias `g2-blocks` → 源仓路径在册 |
| 8 | B3 归档（N2③） | 黑板 `gate-logs/deploy-20261002/` | 原文含 cmd/gitRef/钉值/UTC/EXIT · 契约 18/18 · J1=175.2ms |

### 复检修掉的 3 处缺陷（判据未放宽，见 blockers.md 修复区）

| 缺陷 | 根因 | 修法 | 证据 |
|---|---|---|---|
| R1 定位器误锚旧 run | `tests/contract/repo-one.mjs` 在多 run 并列最高 version 时按**字母序** tie-break → 锚上一轮 run（`run-cmuq9pz86…`）；ac-17 扫的是陈旧快照、ac-19/20/21 在新 run 全红 | tie-break 改「spec updatedAt → **git HEAD 提交时刻最新（活跃工作区）**」；env 双钉仍最优先（已归档证据可复跑） | 不设 env 时 `repoOneRoot()` = 本 run；ac-17 detail `root=run-cmurp7sf…` |
| R2 契约 `--only` 假绿 | id 不在当前装载 spec 的 acceptance 段时零断言仍报「契约全绿」（违本脚本反审查约束②）——裸跑 ac-19/20/21 必假绿 | 零断言显式红 + EXIT=1 + 恢复路径提示（指向 `G2_SPEC_PATH=<draft>`） | 裸跑 ac-19 实测 `RED … EXIT=1`；带钉后 3/3 PASS |
| R3 导出产物漂移 | `src` 注释（禁 API 字面量措辞）改动后未重建 → tracked `build/` ≠ src（违「确定性导出」） | `node tools/build.mjs` 重建 + `node tools/screenshot.mjs` 同批重拍 + P95 报告重出 | 重建后 diff 仅 datetime/fps 注释 + sw 版本号；同批 `be310288cff10563` |

### 驳回修复 R4（2026-10-03 · 第二次驳回 · 4 处文档/证据链缺陷，机器面与玩法面零改动）

> 驳回范围：机器面与玩法面全绿，打回仅针对文档/证据链。程序线认领 4 处全改，`g2-blocks @ 4f67806` + `fe5fd38`。

| # | 驳回点 | 修法 | 证据 |
|---|---|---|---|
| R4① | `docs/assembly-entry.md` 钥匙 batchId 手抄 `750c70b6440ad04c`（R3 重建导出前陈旧值） | 钥匙段改为**引用 `docs/assembly-manifest.json` 字段**（batchId/buildSha256/gitRef），文档不再手抄批次值，杜绝再陈旧 | `assembly-entry.md`「钥匙」段；与 `05-assembly-and-perf.log` 机判清单同源 |
| R4② | 收口态复跑数字（SMOKE J1=171.3ms / 八门禁 / 契约 18/18）无原文归档，违「归档 = 复跑 stdout 原文」（B3 同判据） | `git worktree add` 干净 `c425e1f` 实跑四门禁并归档原文（含命令/gitRef/钉值/UTC/EXIT/J1）；**J1 更正为有档实测 172ms**（171.3 为跨 run 转抄，作废）；最终态 `fe5fd38` 另档全量复跑 | `gate-logs/c425e1f-closeout-recheck-20261003/`（4 件 + README）· `gate-logs/prog-r4-docfix-recheck-20261003/`（5 件 + README） |
| R4③ | `docs/release-readiness.md` §C「🔄 本轮 N4」/ §E.2「A-09 待认领」滞后于 assets.md 收口态（A-01..A-08 复核完成、A-09 已认领、ART-RECHECK 12/12） | §C 同步为收口态（素材复核 PASS / A-09 已认领 / A-12..A-14 已修重出 / 四门禁 12/12）；§E.1（发现器挂账）与 §E.2 一并划掉并给解除证据 | `docs/release-readiness.md` §C/§E |
| R4④ | 双 manifest `gitRef` 异锚（shot `bb4c836` vs assembly `2a5d480`）构成 QA 必核第三条歧义；根因 = `assembly-entry.mjs` 必核项自带「gitRef 与归档证据一致」 | 双生成器落 `sameBatchCriterion` 随件字段（criterion/exclusive/gitRefRole/note）+ 必核项更正「buildSha256 唯一判据」+ `assembly-entry.md` 新增「同批判据」表；**双清单重出后 gitRef 同锚 `4f67806`**，历史异锚值不复存在；4 张 PNG 逐字节未变 | `05-assembly-and-perf.log` 对账段 · `docs/assembly-manifest.json` / `assets/release/shot-manifest.json` |

另：levels.md N6 计数更正 **38 → 42 条**（6+6+7+8+7+8，实数清点 `n6-adversarial-cases.md`）。

### N9 前置提醒（部署面）

仓库 `build/` = 批次 `be310288cff10563`；一号仓库部署镜像 `games/g2-blocks/export/web` 仍是
10/2 发布批次（commit `8d40c39`）。**N9 触发时必须重新导出镜像**，否则线上 ≠ 源仓当前批次。

## v1.2 数值提案（策划线 · 冻结前仅供参考，冻结以链上 numeric 为准）

| 提案 | 数值 | 备注 |
|---|---|---|
| combo | max_multiplier=5 / step=20% / **rounding=floor** | 取整方向必须显式写进 numeric（契约测试读 numeric，不硬编码） |
| daily | star=1 / streak_track=30 / 种子=YYYYMMDD **本地时区** | 种子纯函数可测（N3-T3 时区工具支撑） |
| level-stars | [B, 1.5B, 2.2B] 派生式 | 派生式，禁在契约里硬编码三颗星的具体分数 |
| 第四提案 | 首分钟引导核查 | 核查 v1/v1.1 是否已含；无则补写（含可复现操作路径） |

## 待触发节点（条件写死）

| 节点 | 触发条件 |
|---|---|
| N1 approve 确认 | 主人回复落卷（不接受沉默推断） |
| N7 round-2 复检 | N1 落卷 + N2 三件到齐 → 门禁六条 + 美术四条逐条核 |
| N8 v1.2 实现 | v1 基线 approve + v1.2 数值冻结 + 主人拍板，**三闸齐** → 当轮即派，顺序 combo → level-stars → daily |
| N9 发布 + 提审 | N7 绿 + N4 素材就位，机器证据随包 |

---

# 上一轮（R2「spec v1 → 首个可玩构建」轮）存档

> 更新时间：2026-10-02（R3 驳回修复轮：QA round-1 打回 F1–F4 全部闭合，N4 复检 APPROVE-READY）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：等主人拍板（approve-ready 包：spec v1.1 approve 追认 + 构建人工验收）

## R3 驳回修复轮实录（2026-10-02 · QA round-1 打回 F1–F4 → 修复 → 复检）

| 打回 | 修法（可核对） | 修复后证据 |
|---|---|---|
| F1 双判退化单点 | `sim.ts` 判点一「落定结算后」真实前移至**重力落定后/补手前**（盘面含消除空洞），判点二维持补手后；`SwapResult.probes[]` 记录 phase/boardHash/filled/idx | ac-07 机判：判点一 `filled=61/64`（含 3 格空洞）· boardHash ≠ 判点二 · 序号 0/1（`a8a0c90`） |
| F1 披露失真 | blockers.md 旧挂账注记①所述语义（判点一在补手前含空洞盘）现已按代码落地 → 披露与实现一致，无需缺口通道改 spec | 本行 + blockers.md B7 闭合记录 |
| F2 trace 重排无效机判 | 删除 `CANONICAL` 重排与 `record` 去重；trace = 真实执行序（尾部 `match` = 级联稳态确认，如实记录） | ac-08 机判真实流水 `swap→match→score→gravity→deadlock-check→refill→match→deadlock-check` + probes 交叉验证（`a8a0c90`） |
| F3 rgba 盲区 | renderer 7 处 rgba 全接线 theme 单源（辉光弃漂移值 rgb(210,160,40) 改 `heatGlow.hex`=#C89C19；vignette 接线既有 token；描边/高光/遮罩/透明端点走 MATERIAL/BACKDROP+withAlpha）；美术规格补录 tint/innerStroke/topHighlight/coolScrim；ac-11 扫描扩展 rgba(/rgb( 三元组 | ac-11 全仓 17 色溯源 PASS；红验实测 rgba(1,2,3) 必红（`b819be1`） |
| F4 level-2 不可达 | `?level=` URL + 键盘 1/2 + `__G2_SET_LEVEL` 三入口；HUD 显示 spec 关卡名+goal 现读；`tests/levels.spec.mjs`（run-all ⑦）补 parseGoals/goalEval/el-hint 覆盖；smoke ⑦b 补 level-2 面；顺带修 `game.ts` hintElement undefined≠null 误判 | smoke：`level-2 入口可达 ✓（HUD「升温局 · 20 手内打出 3 连击」= spec 现读）`+ 可玩 + 切换回路 ✓（`b819be1`） |
| 附带加固 | `tests/contract/repo-one.mjs` 共享定位件（多候选取 spec 导出件 updatedAt 最新）根治 ac-17/framework 字母序误锚旧 run（N4 已披露坑） | ac-17 自动发现即锚本 run：`root=run-cmuq9pz86001vm9zrmqyfm59c`（不设 env 同样正确） |

## R3 修后门禁原文摘要（g2-blocks @ `46a85b0`，树净）

- 契约：`node scripts/contract-check.mjs` → **18 PASS / 0 FAIL · EXIT=0**
- 工程门禁：`npm run gate` → **七件全 PASS**（①守卫 ②色板 21 对 ③theme ④零冻结值面 ⑤内核确定性 ⑥check 落点 ⑦关卡面）
- 冒烟：**SMOKE: PASS**——可开+可玩（level-1 双手 0→160→240）+ **level-2 入口可达可玩** + SW 激活 + manifest + **控制台零错误**
- J1：**177.3ms ≤ 400ms**（QA 复检器现场复跑 G3/b；冒烟直跑 177.7ms）
- QA N4 复检：**VERDICT: APPROVE-READY · gates 24/24 · R1–R7 零打回**（G1–G6 含反审查污染探针），证据 `g2-blocks/docs/evidence/qa-round3-run.log`（commit `46a85b0`）

## 关卡面（spec v1.1 = 链 v2 approved；levels 段与 v1 零 diff）

| 关卡 | 目标 | 元素 | 实现状态（R3 修后） |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint` / `el-deadlock` | ✅ 可玩（el-hint 行为有测试：首消或 3 手后隐没，`tests/levels.spec.mjs`） |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock` | ✅ 可玩且**玩家可达**（键盘 1 / `?level=level-2` / `__G2_SET_LEVEL`；冒烟双关全通；goal 文案 spec 现读） |
| level-3+ | content.levelCount=2 预算外 | — | ⏸ 不做（spec 红线：零新增） |

## 关卡面（spec v1.1 = 链 v2 approved；levels 段与 v1 零 diff）

| 关卡 | 目标 | 元素 | 实现状态（R2 轮） |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint` / `el-deadlock` | ✅ 可玩（目标文本 spec 直读，提示条首消/N 手后隐没） |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock` | ✅ 已实现（createGame({levelId:'level-2'}) 可入；本轮冒烟主走 level-1，level-2 共享同核无独立门禁面） |
| level-3+ | content.levelCount=2 预算外 | — | ⏸ 本轮不做（spec 红线：零新增） |

## R2 轮节点链台账（N1–N5 全核销）

| 节点 | 线 | 产物 | 验收信号 | 状态 |
|---|---|---|---|---|
| N1 基线确认 | 主策划+策划 | 基线记录（blockers.md 当前基线区：v1 approved + 锚 + approve 动作披露） | 版本号/哈希/批复状态三全 | ✅ |
| N1 spec v1.1 | 策划 | `tools/build-spec-v11.mjs`（八道守卫）+ `tools/post-spec-v11.mjs` → 链 v2 `cmuqa2mu50023m9zr8mh60uph` | numeric 零 diff + 回读全等 + 唯一 approved | ✅ |
| N2 M0 契约先行 | 程序 | `tests/contract/` 18 件 + `scripts/contract-check.mjs` spec 驱动入口 | 红证据 `m0-red-first-run.log`（15R）→ 绿 `r2-contract-green.log`（18 PASS/0 FAIL · EXIT=0） | ✅ |
| N2 M1 spec 直读 | 程序 | `tools/gen-spec-data.mjs` → `src/generated/spec-data.ts` + 发现器防污染（version 最高） | acmap/g+h 锚守卫绿；内核零冻结值硬编码（G4/d） | ✅ |
| N2 M2 核心循环 | 程序 | kernel board/match(L·T 去重)/combo/deadlock(全穷举 224 探针)/sim(结算唯一序+双判) | ac-01..09,14 全绿 | ✅ |
| N2 M3 表现层 | 程序 | theme.ts 单源生成 + renderer/main/audio/persistence/perf | ac-11/13/15/16 绿；全仓 hex 溯源 theme | ✅ |
| N2 M4 PWA | 程序 | build/{index,manifest,sw,14 modules} + 零依赖 CDP 冒烟器 | 冒烟 PASS：可开+可玩+SW 激活+J1=179~196ms≤400ms | ✅ |
| N3 资产三批 | 美术 | 三批 JSON + MAPPING.md + 黑板总表 | G5/a–d 双向一致机判绿 | ✅ |
| N4 对抗复检 | QA | `tools/qa-round3.mjs` + verdict JSON + 全量输出原文 | VERDICT: APPROVE-READY（24/24 gates · R1–R7 零打回 · 反审查污染探针实测会红） | ✅ |
| N5 整合打包 | 主策划 | blockers 清零 + 黑板核销 + approve-ready-r2 提请包 | 本包 | ✅ |

## 提交链（g2-blocks 仓库 · R2/R3 轮）

`19ed02c` N1 spec v1.1 → `e6ba6fb` M0 契约红态 → `4e510b6` N2+N3 实现 → QA 修正系列 → `743fb77` N4 复检器 → `4a9cadb` N4 收口 → `c07ac4e`+`8249249` 复证轮 → `a8a0c90` R3 F1+F2 内核 → `b819be1` R3 F3+F4+加固 → `46a85b0` R3 N4 复检归档（HEAD，树净）。

---

# 上一轮（N1 修复轮 · 2026-10-01）关卡台账存档

| 关卡 | 目标 | 元素 | 状态 |
|---|---|---|---|
| level-1 | 教学局 | `el-board`/`el-spawn`/`el-hint`（reason 132 字）/`el-deadlock` | ✅ 在链 v1 |
| level-2 | 升温局 | `el-board`/`el-combo`/`el-deadlock` | ✅ 在链 v1 |

## N1 轮节点链核销（存档，全部 ✅）

线1 色板定稿（d401cab）→ 线2 spec v1 入链（19abac4）→ 线3 N3 前置（1a47805）→ 线3 契约收口（05a644e + edc414f）→ 线4 round-2（ff7d34c）→ 主人拍板（R2 轮开工时以任务书授权 + approve 接口实调闭合）
