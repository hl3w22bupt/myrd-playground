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

> 逐关取证行（v3）：冒烟日志逐关打印 `[smoke] 第 N 关通关（…，★n，hpScale x.xx）` 与
> `[smoke] 无尽模式探针通过（…）`；试玩日志逐局打印 `[main] playtest run -> level N`
> —— 断言的执行证据随门禁日志落盘，验收节点可直接核对。

## 4. implement 节点增补（2026-11-02 · run cmvyp0n86006zm9y0ysizzt2t）：HUD 挂件审计 + 结算误触窗全路径

> 本轮不改 spec（八关数值/机制/音频三面零改动）；两条增补都是把既有条款的**真实行为面**
> 补进机判 —— 缺陷面来自线上实现，非策划案缺口。

### 4.1 HUD 挂件审计（排版硬底线的机判落点：常驻挂件唯一性）

- **缺陷面（探针实证，run 内取证）**：`hud.gd::rebuild_cards()` 旧实现整行重建 ——
  每次开局/重开把「下一波/波次/生命/返回/重开/操作提示」一起重挂一套；旧挂件失联后
  文案冻结成假信息（旧波次计数、旧生命数残留显示），顶栏水平溢出。首局开局即复现
  （row_children=18，常驻挂件 ×2、提示 Label ×2）。
- **修复**：常驻挂件收口 `_build_fixed_widgets()`（`_build()` 一次性挂载，永不重建）；
  `rebuild_cards()` 只重建出战卡按钮（关卡槽随 roster 变化是它存在的唯一理由）。
- **机判**：冒烟断言 19 `tests/smoke.gd::_audit_hud_widgets`（调用入口
  `scripts/hud.gd::widget_audit`）—— 按文案签名统计顶栏与提示层挂件数：出战卡 = 卡槽张数、
  六类常驻挂件各恰好 1；在第 1 关开局与八关扫描逐关进入两点复核（覆盖多局累计与 L4 四卡槽）。
  口径必须是**签名计数**而非当前引用计数 —— 失联残留没有引用，只有签名能现形。
- **红/绿证据**：红 = 复刻整行重建后 `HUD 挂件审计（第 1 关开局）：常驻挂件「skip_wave/back/
  restart/wave/lives/hints」在栏 2 个 ≠ 1` 六条全红；绿 = 修复后六门禁全绿（见
  `qa/gate-logs/20261102-implement-v15-hud-audit/`）。

### 4.2 结算误触窗覆盖按钮点按路径（触屏优先的行为面）

- **缺陷面**：`ResultOverlay` 类契约写明「弹出后 400ms 内不接受确认输入，防连点误触直接
  跳过结算」，但防线只挂在 `press_primary()`（键盘 confirm 路径）；主/选关按钮的
  `Button.pressed` 处理器无条件放行 —— 触屏玩家（本作第一公民）在终局瞬间的连点
  恰恰走这条路，可以直接跳过结算。
- **修复**：`_on_primary_pressed` / `_on_select_pressed` 过同一 `can_accept()` 防线
  （窗期内点按静默拒收；窗期满行为不变）。
- **机判**：冒烟断言 20（RESULT 相位）—— 窗口临时拉到 600ms（与帧时序解耦，探针后立刻
  恢复测试通道 30ms），窗期内注入按钮点按必须「浮层仍在 + 未触发重开」；窗期满 confirm
  正常受理（重开链路断言保持）。
- **红/绿证据**：红 = 旧实现 `结算误触窗：窗期内点按主按钮直接跳过了结算（按钮路径未过
  防线）` + `…触发了重开（防连点防线断线）` 两条全红；绿 = 修复后冒烟通过。
- 部署门禁影响面核查：mobile-web-smoke 的 touch-response 探针落在选关页空白落点，
  acceptance-live-probe 步骤到「进关→选卡→布防」为止 —— 都不触结算浮层，本修复零影响。

### 4.3 顺手收口（同轮小修）

- 无尽模式终局 HUD 波次战报 off-by-one（`wave_index` 0 起，展示按对局中口径 +1）。
