# m1-rejection-ledger-v2.md — Pixel Fives M1 打回清单 v2（逐项三态 · 16:00 交付物）

> 更新时间：2026-09-21 16:00 检查点（QA 证据核 → 复跑 → 三态结论）
> 负责人：游戏 QA（出具）/ 主策划（整合核对）
> 下一步：三项「占位待核销」按各自复验动作转核销；呈主人三件（§D）待拍板
>
> ## 三态口径（本清单唯一判定语言）
> - **核销 ✅**：复验证据在盘可查（机器层原文归档），无未决条件，本项关闭。
> - **占位待核销 🟡**：功能/接线已过机判，但依赖后续交付（美术 UI 稿 / 真机复验），
>   完成指定复验动作后转核销。**不允许静默转核销。**
> - **再打回 ❌**：未达标准且归属明确的修复责任方。本期 0 项。
>
> ## 底账说明（如实）
> 昨日（9/20）M1 响应式实跑的七项打回底账**未随工作区入库**（9/21 工作区全新 checkout，
> 黑板重建后仅存 9/21 凌晨版）。本 v2 以**spec v1（approved）acceptance 七条**为底账逐项重建，
> 并入今日任务给定的 3 项程序阻塞与 N1 残影项；「v1.2 七项」从未出版的事实见 blockers.md B-3。

---

## A 区 · M1 七项（spec v1 acceptance 逐项 · QA 契约证据核）

> 证据源：`gate-logs/m1-recap-20260921-094116/`（契约双口径 46 PASS / 0 FAIL；冒烟 PASS；
> audio-tick PASS；fx-settlement PASS；preflight PASS）。核对方法 = 契约输出逐条
> ↔ acceptance 七条的 check 落点 ↔ 实跑退出码，三输入一致方判核销。

| # | acceptance 条款 | 契约证据（46 PASS 中对应断言） | 冒烟证据 | 三态 |
|---|---|---|---|---|
| 1 | ac-smoke-pass（无头运行 PASS） | `验收项 ac-smoke-pass 依赖存在: std-skills/…/smoke.sh` | `GODOT_SMOKE: PASS`（exit 0） | ✅ 核销 |
| 2 | ac-core-loop（开始→交换→收集→加分扣步） | `实体 e1–e6 script/scene 存在`（链路八路径） | 阶段 1–4 全过 | ✅ 核销 |
| 3 | ac-win-lose（双态判定 + 重开复位） | `验收项 ac-win-lose 依赖存在: tests/smoke.gd` | 阶段 9–11 全过（WIN 遮罩/过关推进/LOSE/RETRY 复位） | ✅ 核销 |
| 4 | ac-difficulty（阶梯单调） | `验收项 ac-difficulty 依赖存在` | 阶段 8 全过（公式锁值 L1→L6） | ✅ 核销 |
| 5 | ac-audio-tick（音画同 tick） | `验收项 ac-audio-tick 依赖存在: tests/smoke.gd + tests/contracts/audio-same-tick.gd`（2 条） | `AUDIO_SAME_TICK: PASS`（exit 0，A–E 五组同帧断言） | ✅ 核销 |
| 6 | ac-deadlock（死局洗牌必可解） | `验收项 ac-deadlock 依赖存在` | 阶段 7 全过（模 5 交错盘） | ✅ 核销 |
| 7 | ac-invalid-swap（无效交换三重反馈不耗资源） | `验收项 ac-invalid-swap 依赖存在` | 阶段 12 全过 | ✅ 核销 |

**A 区结论：7/7 核销，0 再打回。** 契约 46 PASS / 0 FAIL（双口径一致）与冒烟 0–12 阶段互为印证；
「v1.2 复核」一项不属七条判定，挂 §D-2 呈批。

## B 区 · 收口冲刺 3 项程序阻塞（9/21 任务给定）

| # | 阻塞项 | 处置（程序） | 机判证据 | 复验动作 | 三态 |
|---|---|---|---|---|---|
| B-#1 | 结算三态（局末断链） | 三态口径 WIN/LOSE/RESUME；RESUME = SaveState 存档 + 开始遮罩「继续/新开」双入口；复用现有控件，**零新美术资源** | `FX_SETTLE_PERSIST: PASS`（E 组：WIN→NEXT / LOSE→RETRY / RESUME 双入口 + 继续恢复 score/moves/level 逐字段一致） | 美术三态 UI 稿交付 → 程序确认「只改数值/换资源」 → 复跑 fx-settlement 契约 + 真机触摸复跑三态 | 🟡 **占位待核销**（UI 为程序占位稿，见 assets.md §1.6） |
| B-#2 | 消除/连击反馈（帧率不掉） | 默认参数接通：粒子/飘分（board.gd FX 区）+ 连击提示（波数≥2）+ 升调音 + 屏震（幅度逐波增强封顶 10px / 0.28s 有界归零） | `FX_SETTLE_PERSIST: PASS`（A 组消除反馈同帧含屏震；B 组阈值/字号/封顶；C 组归零精确复位；F 组 PERF avg 61.1 ≥50 / 稳态最差 53.4 ≥30） | 美术调参后复跑契约（F 组自动断帧率下限）；真机帧率曲线归真机批次 | ✅ 核销（默认参数基线，桌面机判口径） |
| B-#3 | 分数本地持久化（刷新后分数仍在） | SaveState autoload（`user://pixel-fives-save.json`，Web=IndexedDB）+ GameState 结算栈同 tick 落档 + best_score 跨局保留 | `FX_SETTLE_PERSIST: PASS`（D 组：盘档逐字段比对一致 / best_score 结算刷新 / 新开局清快照不误供续局） | 真机浏览器「页面刷新→分数仍在」人工复验（headless 以盘档读回为机判等价物，已在契约注明） | 🟡 **占位待核销**（待真机刷新动作复验；机判已全过） |

**B 区结论：1 核销 + 2 占位待核销 + 0 再打回。** 三个「再打回」全部清零：阻塞均已在今日接通并过机判。

## C 区 · N1 残影补测证据归档（QA 台账「待证」处置）

| 项 | 证据 | 判定 |
|---|---|---|
| 桌面帧率曲线 | `games/game/qa/snake-ghost-spike/data/20260921-010743/fps.csv`（逐秒采样） | ✅ 归档（verdict_desktop=能，fps_pct_at60=98.3% ≥95%） |
| 桌面内存 | 同目录 `mem.json` | ✅ 归档（heap_delta=0.0MB <50MB） |
| 运行原文 | 同目录 `run-headless.log` | ✅ 归档（与 concept-pool §A2.3 引文逐字一致） |
| 真机录屏 + 反馈延迟 ≤100ms + 机型清单 | 本环境无真机，**物理不可产出**（不伪造） | 🟡 占位待核销 → 转 N1 立项令随令补证条款（concept-pool §A6.3 ②），归属「真机复验批次」 |

**C 区结论：QA 台账「待证」解除至桌面口径**；移动端两项随立项令条款化，不再阻塞终裁与 N1 排期。

## D 区 · 未闭环但不属打回项（呈主人拍板清单）

| # | 项 | 状态 | 需要主人 |
|---|---|---|---|
| D-1 | spec v1 追认（代记 approved，今日复跑 46 PASS 双口径） | 🟡 待拍板 | 正式追认或一句否决回滚；API（localhost:3001 需登录态）恢复后补 `POST /:id/approve` 留痕 |
| D-2 | v1.2 口径二选一（v1.2 从未出版，B-3） | 🟡 待拍板 | 「v1 即长期基线」或授权走 revisions 出版 v1.2 |
| D-3 | spec 修订建议两条（新手引导量化；三态/持久化/帧率下限条款化） | 🟡 待批 | 批准后主策划走 revisions → version+1（今日 spec 零改动，版本链零越线） |

---

## 总结论（QA × 主策划联署）

- **M1 门禁：全绿**（契约 46 PASS/0 FAIL 双口径 · 冒烟 · audio-tick · fx-settlement · preflight，
  原文归档 gate-logs/m1-recap-20260921-094116/）。**再打回 0 项**；
  核销 8 项（七项 acceptance + 阻塞#2）；占位待核销 4 项（阻塞#1 三态 UI、阻塞#3 真机刷新、
  残影真机两项、以及 §D 三件呈批不在三态语义内单列）。
- **N1 立项令：条件已成立并发出**（清单闭环 + 残影桌面证据归档）→ 标的 snake-ghost，
  fallback brick-roguelite；GameDesignSpec v1 为条件触发的下一步，不在本任务内（concept-pool §A6.3）。
- **红线重申**：本清单为机器层 + 职能层结论；**M1 最终人工验收（好不好玩）归主人**，
  占位项转核销均需二次复验证据，不允许以「已接线」冒充「已验收」。

## 变更记录

- 2026-09-21 游戏 QA（16:00 批次）：按「契约证据核 → 可玩性复跑 → 逐项三态」出具本清单；
  七项 acceptance 证据逐条对上（46 PASS 断言 ↔ check 落点 ↔ 冒烟阶段）；3 项程序阻塞按机判证据
  定三态；残影桌面证据归档、真机项如实保留并条款化。
- 2026-09-21 主策划（整合核对）：底账重建口径写入头部（昨日七项底账未入库，本版以 spec v1
  七条为底账）；三态口径固化；N1 立项令触发条件核验成立；呈批三件单列 §D。
- 2026-09-21 游戏程序（独立复跑批次）：A/B 区全部证据**第二次独立实跑互证**——六门禁亲自复跑全绿
  （契约双口径 46 PASS/0 FAIL 两副本 diff 为空、smoke、audio-tick、fx-settlement PERF avg 61.0/稳态最差 53.5、
  verify PREFLIGHT），原文归档 `gate-logs/m1-recap-20260921-095257-prog/`，与 094116 目录构成两次独立实跑；
  实现层读码核实三阻塞接线真实在盘、契约断言非空转（runbook §6.3）。**三态结论零变更**：占位项
  （B-#1 三态 UI、B-#3 真机刷新、C 区真机两项）转核销仍须各自复验动作完成，不以「复跑全绿」冒充二次复验。
