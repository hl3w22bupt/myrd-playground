# 《光路谜阵》playtest 验收包（games/game-4）

- 验收对象：`games/game-4`（光路谜阵，Godot 4.3 光束折射解谜）
- 运行分支：`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`（tip `122dcb8`，与部署 gitRef 谱系一致）
- 判定脚本：`std-skills/godot-game-dev/scripts/playtest.sh`（本仓库内唯一来源，sha256
  `23c3051a…d18f686`，与平台技能目录副本逐字节一致；配套 `playtest_driver.gd` sha256
  `191411e5…d4cf769`）
- 运行环境：Godot 4.3.stable.official.77dcf97d8（headless）
- 前序阻塞记录：`games/game-4/qa/PLAYTEST_BLOCKED.md`（门禁脚本缺失）——本次已由
  「补 playtest.sh / playtest_driver.gd 进 std-skills」commit 解除，门禁得以真实执行。
- 本包结论：**playtest 机器判定 FAIL（结构性）**，原因见 §2；人工四问量表全部**待用户试玩**（§5）。

## 1. 判定行与指标摘录

门禁原始输出（seeds `20260913,20260914,20260915` × 900 帧，即 3 局 × 15 秒）：

```
godot-playtest: FAIL 机器人试玩未通过（退出码 1）
GODOT_PLAYTEST: FAIL autoload Juice 未注册（反馈单例缺失，按 SKILL.md §3B 补模板协议）
GODOT_PLAYTEST_METRICS: {"frames_per_run":900,"runs":[],"thresholds":{"feedback_events_min_per_run":2,"feedback_gap_seconds_max":10,"first_reward_seconds_max":10,"seed_outcomes_min_distinct":1},"thresholds_source":"built-in"}
```

要点：`runs` 为空数组 —— 因 Juice 检查失败，driver 在 `_physics_process` 首帧即
`_report()` 终止，**3 局均未实际开跑**（游戏在 bot 输入流下的健壮性本次未被 playtest 覆盖，
该维度仍由 input-fuzz / smoke 门禁负责）。

## 2. FAIL 根因（结构性，非阈值问题）

门禁通用层依赖模板协议的两个采样锚点：`GameState.score_changed`（得分事件）与
`Juice.feedback_fired`（反馈事件）。本工程实际接线（`autoload/game_state.gd`）：

| 门禁期望 | 本工程实况 |
|---|---|
| autoload `GameState` | ✓ 已注册 |
| `GameState.score_changed` 信号 | ✗ 仅有 `moves_changed` / `level_changed` / `level_solved` / `level_unlocked` |
| autoload `Juice` | ✗ 未注册（`project.godot` `[autoload]` 仅 GameState） |

`playtest_driver.gd` 中该检查是**无条件硬失败**：`_ready()` 里 `_juice == null` 即
`_failures.append("autoload Juice 未注册…")`，随后 `_physics_process()` 首行
`if _done or not _failures.is_empty(): _report()` 直接终局。**没有任何阈值键或环境变量
可以关闭该检查**（`_load_config()` 只认 `frames_per_run` + 4 个内置阈值键，未知键 WARN 忽略）。

因此本 FAIL 不可能通过「配 `tests/playtest.json` 阈值」消除，属于工程协议与门禁协议的结构性错位。

## 3. 为什么本次未配置 tests/playtest.json

1. 4 个阈值键（`first_reward_seconds_max` / `feedback_gap_seconds_max` /
   `feedback_events_min_per_run` / `seed_outcomes_min_distinct`）无一能影响 §2 的 Juice 硬检查 ——
   配了也过不了，只会制造「已配阈值仍 FAIL」的误导性痕迹。
2. SKILL.md §4.5 纪律要求 `frames_per_run = 60 × spec 单局目标秒数`；本工程 spec 未定义
   `sessionSeconds`（关卡制解谜，单局时长由玩家解谜速度决定，非节奏类）。凭空取值违背纪律。
3. 协议补齐（§4）后，建议再按当时的实际单局时长配置，本文件届时同步更新。

## 4. 解除阻塞的修复路径（二选一，均需相应节点授权，本验收节点未越权执行）

- **A. 游戏侧（推荐）**：由开发节点给 `games/game-4` 补模板反馈协议 —— 注册 `Juice`
  autoload（提供 `feedback_fired` 信号与 `clear_events()`），并在旋转管道 / 光束接通 /
  过关等反馈点发射事件；解谜语义下「得分」可映射为 `level_solved`。注意这会改动已部署工程
  （`export/web/index.pck` 需重新导出），应由开发节点走完整门禁链路。
- **B. 门禁侧**：上游（std-skills 模板仓库）让 `playtest_driver.gd` 支持品类信号锚点
  （如把 `level_solved` 计入奖励事件、Juice 缺席时降级为 WARN）。属判定脚本变更，需上游评审，
  不得在本仓库现场自造等价脚本（与 PLAYTEST_BLOCKED.md 的门禁独立性约束同源）。

## 5. 人工试玩指引与四问量表（待回填）

**入口**：`https://leomac-studio.tail49399e.ts.net/apps/game-4/gw`
（liveUrl 出处：`qa/LIVE_VERIFY.md` 与 artifacts `op=run_workflow / status=completed`，
deploymentId `cmuihb72x002dm9gcj5f1ud2b`；建议浏览器直接打开，移动端可横屏）。

**操作**：`WASD`/方向键移光标（触屏左下摇杆）；点击格子或光标对准管道按 `空格`/`回车`
旋转 90°（触屏右下「旋转」）；`Z` 撤销、`R` 重开、`Q`/`E` 切关、通关后 `空格` 进下一关。

**四问量表**（每问 1-5 分 + 一句话；未经真人试玩一律保持「待用户试玩」，严禁编造）：

| # | 问题 | 分数 | 一句话反馈 |
|---|---|---|---|
| Q1 | 你愿意立刻再玩一局吗？ | 待用户试玩 | 待回填 |
| Q2 | 不看说明的情况下，前 60 秒你知道该做什么吗？ | 待用户试玩 | 待回填 |
| Q3 | 有哪一刻让你觉得「爽」？有哪一刻让你卡住/想退出？ | 待用户试玩 | 待回填 |
| Q4 | 难度曲线是否平滑（有没有某关突然劝退）？ | 待用户试玩 | 待回填 |

## 6. 调参入口与参数说明（§3C 调参工作台契约）

壳页在引擎加载前把 URL `?tuning=<json>` 解析进 `window.__GAME_TUNING__`，
`GameState._ready()` 读取、只认 `TUNING_META` 声明的键并按 min/max 钳制
（`autoload/game_state.gd` `_apply_tuning()`）。用法示例：

```
https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?tuning={"beam_core_width":10,"beam_glow_width":28}
```

| 键 | min | max | default | 作用 |
|---|---|---|---|---|
| `beam_core_width` | 2.0 | 16.0 | 6.0 | 光束核心线宽（`board_view.gd` 绘制） |
| `beam_glow_width` | 4.0 | 40.0 | 16.0 | 光束辉光线宽（同上） |

非 Web 平台（含无头门禁）无注入物，直接取 default —— 门禁确定性不受调参影响。

## 7. 复跑指引

```bash
# 前置：playtest.sh / playtest_driver.gd 已在 std-skills/godot-game-dev/scripts/（sha256 见头部）
bash std-skills/godot-game-dev/scripts/playtest.sh games/game-4
# 可选环境变量：GODOT_BIN=… GODOT_PLAYTEST_SEEDS=a,b,c GODOT_PLAYTEST_FRAMES=900
# 判定协议：GODOT_PLAYTEST: PASS / FAIL <原因>（退出码 0/1，2 = 环境不可用）
```
