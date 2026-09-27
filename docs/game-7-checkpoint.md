# [CHECKPOINT] game-7《星云穿行》脚手架 + 玩法骨架交付

- 目标 cmujmfy0r002im99i3inkbu6i · 需求 cmujmowd6003bm99i5zjlwlzz · AppHost cmujmfvha002gm99i1lpbo1fr（slug game-7）
- 分支 myrd/game-7-goal-cmujmfy0r002im99i3inkbu6i · 工程 games/game-7

## 门禁记录（本地与 .myrd/routines.yaml godot-smoke 同源，判定器均为仓库 std-skills/godot-game-dev/scripts/）

| 步骤 | 结果 |
| --- | --- |
| resolve-godot | exit 0，Godot 4.3.stable.official.77dcf97d8 |
| preflight | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（30 个工程文件）`，exit 0 |
| smoke（GODOT_SMOKE_FRAMES=240） | `GODOT_SMOKE: PASS …全部通过`，退出码 0，日志无 SCRIPT ERROR / Parse Error |
| input-fuzz（seed=20260913） | `GODOT_FUZZ: PASS batches=6`，退出码 0 |
| verify.sh（三步汇总入口） | 退出码 0 |

## 冒烟断言覆盖 → 验收映射

1. 操控与穿行：噪声相位 30 帧对抗输入后，按住 move_right 10 帧位移 >1px；`Player.moved` 信号到达订阅方；无输入帧飞船零漂移。
2. 躲避判定：真实碰撞路径（`meteor.body_entered → hit_player → take_hit`）HP 3→2、N 清零、速度回 100 px/s、1s 无敌激活；无敌期再命中免伤。
3. 收集提速：真实拾取（`crystal.collected`）N=1 → 110 px/s；公式扫描 N=5 → 150、N=10 → 封顶 200；封顶后每颗 +50 分；HUD 档位与实测同公式刷新（`%StatsLabel` 含 2.0x）。
4. 循环完整：到时限触发 `finish_run("arrived")`，结算面板展示存活时长/水晶数/最高速度/总分四项；总分全程单调不回退；confirm 重开复位 HP/N/速度/总分并清理上一局实体。
5. 数值可配置：全部口径出自 `config/game_config.json`（V0/step/cap/capBonusScore/HP/无敌时长/时限/生成间隔与收紧斜率/三色陨石规格/配色），`GameState.start_run()` 每局重读配置——改配置重开一局即生效，零代码改动。

## 实现要点

- 模板起步：复制 `std-skills/godot-game-dev/templates/minimal-2d`（全局中文字体 assets/fonts 与 `[gui] theme/custom_font` 原样保留，P13 通过）；触摸 UI（虚拟摇杆 + 确认按钮）按 `DisplayServer.is_touchscreen_available()` 启用，键盘/触控双通道走同一组 InputMap 动作。
- 素材零依赖：陨石（8~12 边不规则多边形 + 2px 深描边 #0E0E20 + 同色 30% 外发光）与水晶（规则菱形 + 白高光 + 2Hz 呼吸）全部 `_draw()` 自绘；配色红 #FF4D5E / 黄 #FFD24A / 蓝 #4DB8FF / 青 #7FF6E8 / 底 #0B0B22 按调研结论。
- 生成节奏：陨石 0.8s±0.3s（斜率 0.06 收紧）、水晶 1.1s±0.4s（同速收紧）+ 单屏 ≥1 保底 + 生成点避开飞船 ±80px。
- 修复记录：① 手写 meteor/crystal 场景 `parent=""` 触发 Godot 4.3 .tscn 解析段错误（ResourceLoaderText::_parse_node_tag，SIGSEGV/SIGABRT）→ 改回模板惯例 `parent="."`；② 冒烟断言 `player_hit` 未连接信号导致假失败 → 补连接。

## 遗留说明（不阻塞本节点）

- `std-skills/godot-game-dev/scripts/playtest.sh` 模板仓库仍未预置（曾按纪律上报 blocked，被门禁打回「工程不存在」要求先推进）。实际挂载的 godot-smoke routine 只引用 resolve/preflight/smoke/input-fuzz（均已 PASS）；verify.sh 只调用仓库内真实存在的判定脚本，未自造、未复制注入副本。
- 音效拾取反馈、Web 导出（单线程 + AudioContext 解锁）与 AppHost 部署属于后续节点。
