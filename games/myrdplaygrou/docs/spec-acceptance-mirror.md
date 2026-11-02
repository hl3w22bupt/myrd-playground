# 《植物人大战僵尸-网页版》验收条目镜像与操控语义修订（Bug cmvxrs3fv005em905y4eouy35）

> 权威基准：平台 GameDesignSpec（链 `cmvy3ccqq0010m9y06sz653gh` 最新 approved = **策划案 v3：
> 八关机制差异化/难度曲线上调/真实出声机判**；其前序链 `cmvxw290c000wm9z6cec4yg92`（14 条，
> 含 acc-input-semantics）已 superseded；v2 = `cmvxrtp2z005gm9055alqx9md` / v1 =
> `cmvxkdcdp002om905wneuanvw` 已 superseded）。
> 本文件是工程侧镜像：记录 spec.acceptance 的对齐核验结论 + 操控语义条目的入链结论。
> 纪律：spec 修订只能走平台 `POST /api/v1/game-design-specs/:id/revisions`（产生新版本、链上旧版自动 superseded），
> 本节点不直接改平台库、不改 approved 版 —— 新版本均由该 API 产生（status=approved，版本链自动维护唯一 approved）。

## 1. 对齐核验结论（2026-11-01 · 对 v2 approved 版逐条核对）

v2 `spec.acceptance` 共 13 条：`acc-playable-loop` / `acc-level-select` / `acc-difficulty-curve` /
`acc-session-duration` / `acc-spec-consistency` / `acc-flat-palette` / `acc-contrast` /
`acc-touch-only` / `acc-audio-unlock` / `acc-audio-complete` / `acc-mute-instant` /
`acc-resource-loop` / `acc-no-placeholder`。

**核对结论：v2 未覆盖「操控语义」。** 最接近的 `acc-touch-only` 只声明「操作可单指点按完成、
目标 ≥44px、无键盘/悬停必经」，属于**可达性**口径；没有一条声明**方向语义**
（上/下/左/右的位移分量方向与轴支配关系）。Bug cmvxrs3fv005em905y4eouy35 的
「若 r2 策划案 v2 已覆盖则只做对齐核验」分支不成立 → 走「补条目」分支（§2）。

## 2. 已入链修订：`acc-input-semantics`（操控语义验收，spec v3）

工程侧已先行落地机判实现（冒烟门禁四轴断言，`tests/smoke.gd::_step_move_axis`）：

- 右/左/上/下逐轴按住注入，各校验位移分量方向：`move_right ⇒ Δx>0`、`move_left ⇒ Δx<0`、
  `move_up ⇒ Δy<0`、`move_down ⇒ Δy>0`（最小分量阈值 8px，期望位移 ≈17px@2 帧）；
- 且本轴分量必须支配正交轴（`|Δ本轴| > |Δ正交|`，拦「上下反了 / 左右反了 / 按一键动两轴」）；
- `Player.moved` 信号必须到达订阅方（连接断裂即红）。

旧断言只看「位移量级 ≥1px」，对轴映射反转/串轴完全失明 —— 这就是本 Bug 的缺陷面。

**入链结论（implement 节点，2026-11-01）：** 上节点的修订载荷因当时沙箱不可达平台 API 而落镜像待入链；
本节点经平台 `POST /api/v1/game-design-specs/cmvxrtp2z005gm9055alqx9md/revisions`（`design-spec:write` 能力）
正式入链，产生 **v3 = `cmvxw290c000wm9z6cec4yg92`（approved，14 条）**，v2 自动 superseded。
条目按 Bug 原文的命名落为 `acc-input-semantics`（原载荷名 `acc-input-direction` 作废），内容一致并补强
「位移量级断言不构成本条达成」的判定口径：

```json
{
  "id": "acc-input-semantics",
  "check": "games/myrdplaygrou/tests/smoke.gd",
  "mode": "auto",
  "statement": "操控语义与屏幕直觉一致（四轴方向断言）：move_right/move_left/move_up/move_down 逐轴按住注入后，布防光标位移分量必须各向期望方向（右/下 Δ>0、左/上 Δ<0，沿轴分量 ≥8px），且本轴分量支配正交轴（|Δ本轴| > |Δ正交|，禁止一键动两轴、轴映射反转、上下/左右颠倒），Player.moved 信号到达订阅方；由 godot-smoke 冒烟门禁（GODOT_SMOKE: PASS，tests/smoke.gd::_step_move_axis）无头机判，位移量级断言不构成本条达成。"
}
```

## 3. 门禁 ↔ 验收条目映射（v3 八关线，本节点升级后的机判面）

> 权威基准升级：链 `cmvy3ccqq0010m9y06sz653gh` 最新 approved = **策划案 v3（八关机制差异化 /
> 难度曲线上调 / 真实出声机判）**；本表按 v3 验收条目对齐。

| 验收口径 | 机判位置 | v3 节点改动 |
|---|---|---|
| 操控语义（四轴方向，`acc-input-semantics`） | `tests/smoke.gd::_step_move_axis` | 保持（Bug cmvxrs3fv005em905y4eouy35） |
| 八关均可通关 + 关卡推进 + 通关第 8 关解锁无尽（`acc-playable-loop`） | `tests/smoke.gd::_step_sweep_setup/_kill/_advance/_step_endless` | 扫描扩到 8 关：第 1 关真实输入链、第 2-7 关直选推进、末关 replay 语义；星级入档 + 无尽解锁/入口可见/波次无限/1.08^波 复合/巨尸混编 全机判 |
| 选关页 8 关名称/星级/进度 + 解锁链（`acc-level-select`） | `scripts/level_select.gd::_refresh_entries/_is_locked` | 8 关单页两行网格 + ★x n 进度 + 锁定关点按即时反馈（触屏「按了有反应」） |
| 难度曲线上调（`acc-difficulty-curve`，替代 v2「≤30%」口径） | `tests/smoke.gd::_check_level_table` | 重写为 spec.numeric.difficulty 八关锚点 + 单调性机判：hpScale/speedScale/加权血量/加权速度/总数/平均每波严格递增、波数单调不减、节奏锚点逐关核对 |
| 关卡机制差异化（`acc-level-mechanics`） | `_check_level_table` 机制声明 + SWEEP 逐关行为探针 | L1 教学引导（完成态机判）/ L3 波隔 12s / L4 天降节流 24s/15 + 卡槽 4 张无双发 / L5 夜幕遮罩（边界 x + 剪影↔显形）/ L6 单波 ≥3 类 / L7 巨尸第 4/9 波 + 碾压（接触即毁坚果、不进啃食循环、复用 hit+zombie_die）/ L8 巨尸第 7/10 波 + 无尽解锁 |
| 音频真实出声机判（`acc-audio-unlock` / `acc-audio-complete` / `acc-mute-instant`） | 壳页 `__audioDebug().getOutputEnergy()`（新增）+ `tests/smoke.gd::_check_audio_contract` | 壳层 AnalyserNode 能量探针（fftSize=256，连续 2 窗 RMS>0.01 判真实出声、≤0.001 判真实静默）；游戏侧补 bus 音量核查（Master 无启动静音/增益 0dB/BGM = spec 0.4 线性 ≈ -8dB、LOOP_FORWARD）；sfxBindings 全 8 类注册机判保持 |
| 资源闭环（`acc-resource-loop`） | `tests/smoke.gd` COMBAT/经济断言 | 掉落面额补坦克巨尸 100；L1 首布防引导完成态（向日葵+射手各 1）入机判 |
| 全程无占位（`acc-no-placeholder`） | 冒烟「日志无 SCRIPT ERROR」+ 资产进包核查 | 坦克巨尸完整扁平绘制（含受击/倒地/碾压态）；13 音频资产 pck 字节级在包核查随导出执行 |
| 扁平色板/对比度（`acc-flat-palette` / `acc-contrast`） | `_check_contrast` | 色对 11→12 对（+夜幕剪影对 4.39）；章节配色扩四套（+正午暖黄） |
| 试玩逐关覆盖 | `playtest_driver.gd`（仓库判定器）× `main.gd` 轮换钩子 × `GameState.playtest_level_cursor` | 保持：3 局种子逐局对准关卡表前 3 关（`[main] playtest run -> level N` 证据行进门禁日志） |
| 试玩反馈四问回填（?tuning=1 面板 → spec.numeric 修订建议，owner 拍板后入链） | `tests/smoke.gd::_check_four_questions_contract` | 新增（本节点）：面板脚本工程内可编译可实例化 + 无头不创建；映射层机判——缺答拒产出（不得代填）/ 全刚好零建议 / Q1-Q3 方向与曲线严格递增 / 第 1 关教学入口不动 / Q4 用户原话逐字透传 / tuning_applied 恒 false / 默认值快照比对不变（不得直接改代码默认值）；契约详见 `docs/tuning-feedback-four-questions.md` |

> 逐关取证行（v3）：冒烟日志逐关打印 `[smoke] 第 N 关通关（…，★n，hpScale x.xx）` 与
> `[smoke] 无尽模式探针通过（…）`；试玩日志逐局打印 `[main] playtest run -> level N`
> —— 断言的执行证据随门禁日志落盘，验收节点可直接核对。
