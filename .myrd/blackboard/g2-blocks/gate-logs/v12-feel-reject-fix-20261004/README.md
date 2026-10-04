# V1.2 驳回修复轮（D1–D6）· 全链复跑归档 · 2026-10-04

> 执行：游戏程序 · 源仓 g2-blocks @ `cf967ec`（D1+D5+复检器加固提交态）· 一号仓黑板块同步提交
> 结论：**D1 红已闭（粒子上屏可观察 + 差分像素归因）· D2 红已闭（七件四要素真红 + R3.a 加固）· D3 红已闭（三处引述以归档原文更正）· D4/D6 披露与口径钉死（零 spec 改动）· D5 闭（尾行随装载态）**
> 复跑终态：契约双态 18/18 + 25/25 · 八门禁 ①–⑧ 全 PASS · SMOKE PASS + 粒子上屏断言 · 基准 P95=16.7ms（=基线快照① 全等）· N4 15/15 APPROVE-READY

## D1（红 · 闭环）消除粒子视觉面接线 + 上屏可观察断言

- **红态取证**：smoke 先加「粒子上屏」门禁再改实现 → `RED 粒子上屏断言缺调试面` EXIT=1（红原文随本件 `01-smoke-red.log`）。
- **接线**：`renderer.drawParticles`（消费 `snap.particles`：几何圆 / accentWarm token / sizeRatio×cell 半径 / alpha 查表衰减 / 随震屏平移 / 出屏裁剪 / 返回实绘数）；`RenderState.particles`；`main.ts` syncState 透传 + 渲染循环调用 + `__G2_FEEL().drawnParticles/drawnPoints` + `__G2_LAYOUT()`（观测面，不进玩法路径）。
- **上屏断言两级**：① 渲染层消费确证（drawnParticles>0）② **差分像素**：绘制坐标 getImageData，存活帧命中 accentWarm 色系 vs 寿命后同坐标复采回落（block-02 余烬金与 accentWarm 同色 #C89C19，单帧色域不可区分 → 必须差分归因）。
- **绿态实测**：`drawn=8`（= perClearBase）· 存活帧 8/8 命中 · 消亡后复采 0 · 3 连跑稳定 · J1 173.2–175.3ms 达标（`08-smoke-final.log`）。
- **R2.b 口径修订（D1 授权）**：「git diff = 空」→「只增不改」（v1.1 判据行零删除，粒子门禁纯新增 50 行）——R2.b 加固后机判 PASS（`07-n4-recheck.log`）。

## D2（红 · 闭环）红证据重归档 + R3.a 加固

- **失实处置**：旧 6 件（绿灯内容挂红名/转写无命令头/自认转录）移入 `v12-feel-n2-20261004/retired-falsified-20261004/`（含 n1 目录 05-slice1-red.log），不销毁、不再作证据引用。
- **真红重归档**：`v12-feel-n2-20261004/01..07-red-ac2x-*.log` 七件 —— 隔离 worktree（基座 = 最终 HEAD `01c2f06`）注入一处实现↔spec 漂移（如 landSquash.frames 8→9、perClearBase 8→7、storageKey daily→dailyx），跑 `--only ac-2x` 得真红原文。每件含 **命令头 + RED 行 + 合计 0 PASS/1 FAIL + EXIT=1 + 注入说明**；构造态仅存临时 worktree，不入实现树（worktree 已 prune，主仓树净）。
- **R3.a 加固**（`tools/qa-v12-feel.mjs`）：从「含 RED 字样 ≥3 件 + 文件名 /加固/ 放水」改为逐件机判 **四要素（命令头/RED 行/FAIL 合计/EXIT=1）+ 名实一致（文件名 ac<NN> ↔ RED 行 id）+ ac-22..28 七条款全覆盖，≥7 件零放水**。加固后实测：在档=7 · 缺格=0 · 覆盖 7/7（`07-n4-recheck.log` R3.a PASS）。

## D3（红 · 闭环）J1 转抄三处更正（以归档原文为准）

| 处 | 原（失实） | 更正后（= 归档原文） |
|---|---|---|
| `v12-feel-n4-rerecheck-20261004/README.md` 结论行 | J1=174.9ms | **J1=172.1ms**（172.09999999403954，at=02:19:13Z）+ 更正注记 |
| 同 README 归档清单 04-smoke.log 行 / .j1-evidence.json 行 | 174.9ms / 174.90000000596046 | 172.09999999403954（两行均改，并注明 .j1-evidence 为 N4 内部冒烟跑次、与 04 非同批） |
| `blockers.md`「提交前复跑」行 | SMOKE PASS（J1=174.9ms） | SMOKE PASS（J1=172.1ms · 归档原文口径） |

- **根因流程性消除**：本轮起冒烟归档执行「**先写 log、立即同批 cp `.j1-evidence.json`**」（本目录 `01-smoke.log` ↔ `02-j1-evidence.json` 同批 = 173.59999999403954ms；收口同批 `08` ↔ `09` = 173.19999998807907ms）；N4 内部冒烟会覆写工作区证据件 → 以「收口同批」为提审引述口径。

## D5（黄 · 闭环）契约尾行随装载态

- `scripts/contract-check.mjs` 尾行固定「实现与 approved 策划案一致」→ `实现与 spec v<version> <status> 一致（本轮仅承诺与装载件一致…）`；`CONTRACT: PASS` 前缀保留（下游断言锚零变化）。实测 Mode A 尾行 `v2 approved`、Mode B `v4 draft`（`03`/`04` 原文）。

## D4（黄 · 披露落点）daily 完成谓词实现裁量

- 披露落点 = `docs/release-readiness.md` §F「D4 披露」条 + §I 拍板清单第 4 项；blockers.md 升级条款 Q-D4 登记（与 G-Q1 backdatePolicy 同批裁决）。
- 不改 spec（ac-28 未冻结谓词属 N1 修订面；若主人裁定更强口径 → N1 v1.3 增补 `numeric.daily.donePredicate`）。

## D6（黄 · 闭环）重开真机层口径钉次数

- `docs/release-readiness.md` §G 钉死「**同机同条件 5 次取中位数**（任务书口径）」，并注明 numeric.feel.restart.deviceLayer 为冻结字符串不含次数（零漂移不改，本节即口径归档位）；blockers.md 挂账行同步。

## 归档清单

| 件 | 内容 | 结果 |
|---|---|---|
| `01-smoke.log` + `02-j1-evidence.json` | 冒烟（同批对） | SMOKE PASS · J1=173.59999999403954ms |
| `03-contract-mode-a.log` | approved v1.1 · 18 条 | 18/18 · EXIT=0 · 尾行 v2 approved |
| `04-contract-mode-b.log` | 链 v4 draft · 25 条 | 25/25 · EXIT=0 · 尾行 v4 draft |
| `05-gates-eight.log` | 八门禁 ①–⑧ | 全 PASS · EXIT=0 |
| `06-perf-p95.log` | T2 基准跑 | fps=60 · jank=0 · **P95=16.7ms = 基线全等** |
| `07-n4-recheck.log` | N4 全量（加固 R3.a/R2.b） | **15/15 · APPROVE-READY** |
| `08-smoke-final.log` + `09-j1-evidence-final.json` | 收口冒烟（同批对 · 提审引述口径） | SMOKE PASS · 粒子上屏 ✓ · J1=173.19999998807907ms |
| `01-smoke-red.log` | D1 红证据（smoke 粒子断言先红） | RED · EXIT=1 |

## numeric 冻结面与本轮改动边界

- **numeric 零漂移**：本轮 D1–D6 修复零触碰 spec（锚 `302e6336…` / `1720df8e…` 不变；N4 R2.e2 九守卫复跑 PASS）。
- 改动面 = `src/render/renderer.ts` + `src/main.ts`（D1 接线）· `tools/smoke.mjs`（D1 断言，判据只增不改）· `scripts/contract-check.mjs`（D5 尾行）· `tools/qa-v12-feel.mjs`（D2 加固）· `docs/release-readiness.md`（D4/D6 披露口径）· 黑板三件套（D3 更正）。
- stack-tower 零接触：源仓 diff 零一号路径；一号仓本轮仅 `.myrd/blackboard/g2-blocks/` 白名单路径。
