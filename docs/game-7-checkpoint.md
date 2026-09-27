# [CHECKPOINT] game-7《星云穿行》玩法实现 + 反馈完备性交付

- 目标 cmujmfy0r002im99i3inkbu6i · 需求 cmujmowd6003bm99i5zjlwlzz · AppHost cmujmfvha002gm99i1lpbo1fr（slug game-7）
- 分支 myrd/game-7-goal-cmujmfy0r002im99i3inkbu6i · 工程 games/game-7
- 前序：脚手架节点（提交 0749947）已交付可跑骨架；本节点把玩法做到验收标准并补齐模板协议。

## 门禁记录（判定器唯一来源：仓库 std-skills/godot-game-dev/scripts/，与 .myrd/routines.yaml godot-smoke 同源）

| 步骤 | 结果 |
| --- | --- |
| resolve-godot | exit 0，Godot 4.3.stable.official.77dcf97d8 |
| preflight | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（39 个工程文件）`，exit 0 |
| smoke（GODOT_SMOKE_FRAMES=240） | `GODOT_SMOKE: PASS …全部通过`，退出码 0，日志无 SCRIPT ERROR / Parse Error |
| input-fuzz（seed=20260913） | `GODOT_FUZZ: PASS batches=6`，退出码 0 |
| verify.sh（三门禁汇总入口） | exit 0 |

## 本节点改动（玩法完成度 / 手感 / 反馈 / 调参 / 断言）

1. **反馈完备性（SKILL.md §3B）**：移植模板 `autoload/juice.gd` 并注册 autoload `Juice`；五个结果性事件全部挂反馈——
   拾取水晶（pop + pickup 音效 + 白粒子）、陨石命中（hit 音效 + 红闪 + 震屏 + 红粒子）、到达终点（win 音效 + 面板弹跳 + 绿色标题）、
   飞船损毁（fail 音效 + 面板弹跳 + 红色标题 + 顿帧定格）、confirm 重开（confirm 音效）。音效由 `tools/gen_sfx.gd` +
   `tests/sfx-recipes.json` 程序化合成（pickup/hit/fail/win/confirm 共 5 个 wav，确定种子可复现，零外部资产依赖）。
2. **胜负反馈明确（验收 4）**：结算标题按 reason 切换文案与配色（到达终点=绿 / 飞船损毁=红），败局叠加顿帧；主场景加 Camera2D 使
   Juice.shake 真实生效（相机位于视口中心 (320,180)，世界坐标 0..640/0..360 不变）。
3. **调参工作台（SKILL.md §3C）**：`game_state.gd` 新增调参区——`move_speed` / `player_margin_px` / `meteor_spawn_interval` /
   `crystal_spawn_interval` 四个可调变量 + `TUNING_META`（min/max/step）+ `apply_tuning()` 唯一入口 + `?tuning=` Web 桥 +
   `scripts/tuning_panel.gd` 面板（网页带 ?tuning 参数才创建）。config/game_config.json 仍是唯一数值基准（验收 5），
   `load_config()` 在任何分支收尾都同步调参变量，`start_run()` 每局重读配置回到基准。
4. **手感（能玩）**：
   - 碰撞盒余量注释与常量推导对齐：陨石碰撞半径 = 视觉半径 × 0.92（8% 玩家有利余量，≤ 验收 2 的 10% 容差，常量
     `COLLISION_RADIUS_RATIO`）；飞船视觉改箭头形（包围盒 22×22）、碰撞矩形 20×20（误差 ≈9%，玩家有利）；水晶拾取半径 16px
     刻意大于视觉半高 14px（收集判定向玩家倾斜，防「碰到没吃到」）。
   - 边界钳制每物理帧执行（margin 出自调参变量），推到边上不卡死角、不飞出屏。
   - 引擎尾焰（CPUParticles2D，代码构建）强度随档位放大——「收水晶→提速」在 HUD 之外多一条身体反馈通道。
5. **生成频率收紧（核心循环 5）**：抽出纯函数 `main.gd::tighten(base, slope, streak)`，节拍器与冒烟共用同一公式。

## 冒烟断言覆盖 → 验收映射（新增断言以 ★ 标注）

1. 操控与穿行：噪声相位 30 帧对抗输入后，按住 move_right 10 帧位移 >1px；`Player.moved` 到达订阅方；无输入帧飞船零漂移；
   ★ 边界钳制：飞船被丢出可视区外后必须被兜回 margin 内侧。
2. 躲避判定：真实碰撞路径（`meteor.body_entered → hit_player → take_hit`）HP 3→2、N 清零、速度回 100 px/s、1s 无敌激活；
   无敌期再命中免伤；★ 三色陨石（红/黄/蓝）均能按配置生成、颜色互异、半径落在配置区间、碰撞余量 ≤10% 容差。
3. 收集提速：真实拾取（`crystal.collected`）N=1 → 110 px/s；公式扫描 N=5 → 150、N=10 → 封顶 200；封顶后每颗 +50 分；
   HUD 档位与实测同公式刷新。
4. 循环完整：到时限触发 `finish_run("arrived")`，结算面板四项数据齐全且总分单调不回退；★ 败局路径：三连真实命中 HP 归零 →
   `finish_run("destroyed")`，reason/面板/标题文案配色/音效逐项断言；confirm 重开复位 HP/N/速度/总分并清理上一局实体（重开两次均断言）。
5. 数值可配置：全部口径出自 `config/game_config.json`，`start_run()` 每局重读——改配置重开一局生效，零代码改动。
6. ★ Juice 反馈非空 + 具体 sfx 记录（拾取 pickup / 胜 win / 败 fail / 重开 confirm）。
7. ★ 调参协议：TUNING_META 非空；apply_tuning 应用已声明键并按 max 钳制；未声明键拒绝；load_config 后回配置基准。
8. ★ 生成频率随档位收紧（tighten 纯函数精确断言：N=10 间隔 = base/(1+0.06×10) < N=0 基准）。

## 迭代修复记录（error-signatures 流程）

- 第 1 轮冒烟 FAIL，根因一处、级联全工程：新调参变量 `player_margin` 与既有函数 `player_margin()` 同名（GDScript 禁止）→
  变量更名 `player_margin_px`（TUNING_META 键同步）；同轮自伤：冒烟场景（extends Node）误用 CanvasItem 的
  `get_viewport_rect()` → 改经 `_main.get_viewport_rect()`。修复后 preflight + smoke + fuzz 全绿。

## 遗留说明（不阻塞本节点）

- `std-skills/godot-game-dev/scripts/playtest.sh` 模板仓库仍未预置（前序节点曾按纪律上报 blocked）。实际挂载的
  godot-smoke routine 只引用 resolve/preflight/smoke/input-fuzz（均已 PASS）；verify.sh 只调用仓库内真实存在的判定脚本，
  未自造、未复制注入副本。若后续要接 §4.5 机器人试玩门禁，需运维先补模板仓库。
- Web 导出（单线程 + 壳页面音频手势解锁 + AudioContext）与 AppHost 部署属于后续节点；Juice.sfx 调用点已全部钉住，
  部署节点接壳页面解锁后即有声音。调参面板/调参桥供部署节点壳契约校验与试玩调参。
