# 《植物人大战僵尸-网页版》验收条目镜像与操控语义修订（Bug cmvxrs3fv005em905y4eouy35）

> 权威基准：平台 GameDesignSpec（approved 版 **v3 = `cmvxw290c000wm9z6cec4yg92`**，14 条 acceptance；
> v2 = `cmvxrtp2z005gm9055alqx9md` / v1 = `cmvxkdcdp002om905wneuanvw` 已 superseded）。
> 本文件是工程侧镜像：记录 spec.acceptance 的对齐核验结论 + 操控语义条目的入链结论。
> 纪律：spec 修订只能走平台 `POST /api/v1/game-design-specs/:id/revisions`（产生新版本、链上旧版自动 superseded），
> 本节点不直接改平台库、不改 approved 版 —— v3 即由该 API 产生（status=approved，版本链自动维护唯一 approved）。

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

## 3. 门禁 ↔ 验收条目映射（本节点升级后的机判面）

| 验收口径 | 机判位置 | 本节点改动 |
|---|---|---|
| 操控语义（四轴方向，spec v3 `acc-input-semantics`） | `tests/smoke.gd::_step_move_axis` | 新增（Bug cmvxrs3fv005em905y4eouy35） |
| 三关均可通关 + 关卡推进 | `tests/smoke.gd::_step_sweep_setup/_kill/_advance` | 新增三关逐关通关扫描（Bug cmvxr1f1a004fm905ua2ua9ir） |
| 难度数值逐关生效 | 同上（v2 口径：起始阳光 100/150/200 分档、波数 4/5/6、总僵尸 12/15/19 逐关核对 + 编制内种类真实出生路径行为探针：血量/速度 = `ZOMBIE_KINDS` 绝对值 + 击杀掉落面额） | 新增 |
| 试玩逐关覆盖 | `playtest_driver.gd`（仓库判定器）× `main.gd` 轮换钩子 × `GameState.playtest_level_cursor` | 新增：3 局种子逐局对准第 1/2/3 关（`[main] playtest run -> level N` 证据行进门禁日志） |
| 难度平缓（≤30%） | `tests/smoke.gd::_check_level_table` | v2 重写为编制加权口径（波数/总数/加权血量/加权速度/出怪间隔/首波延迟/波间隔，相邻增幅 ≤30%） |

> 逐关取证行（r3）：冒烟日志逐关打印 `[smoke] 第 N 关通关（…）` 与 `[smoke] 关卡推进 → 第 N 关（…）`，
> 试玩日志逐局打印 `[main] playtest run -> level N` —— 三类断言的执行证据随门禁日志落盘，验收节点可直接核对。
