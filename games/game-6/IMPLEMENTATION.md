# 《复刻天天酷跑》实现节点交付说明（[CHECKPOINT]）

> 工程目录 `games/game-6`（Godot 4.3 · GDScript 2.0 · Web 导出目标）
> 需求基线：cmuj6vls40010m9hcmj2lscuh ｜ 策划案：cmuj78cxu0017m9hc6fixc96i（v1 approved，`.myrd/spec/design-spec.json`）
> 实现分支：`myrd/game-6-goal-cmuj6p1q2000em9hc4srodpkt`（见文末「部署侧注意事项 1」）

## 一、门禁结果（与门禁同源命令，2026-09-27 本机实测）

| 步骤 | 命令（同源） | 结果 |
|---|---|---|
| godot-availability | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | OK（Godot 4.3.stable） |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-6` | **PASS**（13 类，57 文件），退出码 0 |
| headless-smoke | `GODOT_SMOKE_FRAMES=320 … smoke.sh games/game-6` | **GODOT_SMOKE: PASS**，退出码 0，日志无脚本错误 |
| input-fuzz | `… input-fuzz.sh games/game-6` | **GODOT_FUZZ: PASS**（seed=20260913），退出码 0 |
| playtest | `… playtest.sh games/game-6` | **环境缺口，见文末「环境缺口 1」** |

帧预算：冒烟阶段流需 ~290 物理帧，`.myrd/routines.yaml` 的 `godot-smoke.params.smokeFrames` 与 `games/game-6/verify.sh` 已同步调为 **320**（模板明示的每工程参数，两处同值）。

## 二、实现范围（对照需求与 spec）

- **核心循环**：自动奔跑 + 跳跃/二段跳 + 滑铲；碰撞/坠坑死亡 → 弹飞 + 慢动作 0.3s → 结算页 → 一键重开（按钮 / R / 确认键，无重启加载）。
- **操作双通道**（acc-01）：键盘 ↑/W/空格=跳跃（二段跳封顶）、↓/S=滑铲、R=重开；触屏点按/上滑=跳跃、下滑=滑铲（`touch_swipe.gd` 只生产 InputMap 动作，右下跳跃按钮保留）。
- **程序化赛道**（acc-03）：`chunk_defs.gd` 逐元素固化 spec l1/l2/l3 三预制件（含元素 id），`track_builder.gd` 按距离权重抽取、9 实例对象池循环复位（只实例化 levels 声明的 3 个场景）；速度曲线 v(m)=320+0.3m（封顶 720）。
- **收集与道具**（acc-04）：金币成串/成弧线；磁铁（8s/200px 吸附）、护盾（挡 1 次+1s 无敌帧）、冲刺坐骑（4s×1.8 倍速无敌碾怪 +30 分）——数值全部走 `game_state.gd` 调参区。
- **结算与成长**（acc-05/06）：得分 = ⌊距离⌋×2 + 金币×10 + 碾怪×30；结算页展示距离/金币/得分/最高分/累计金币/最远距离；ConfigFile 存 `bestScore/totalCoins/bestDistance`（key=game6_save_v1）。
- **表现**：Q 版几何角色跑/跳/滑/死姿态动画、三层视差（云 0.1x/山 0.2x/街区 0.5x）、金币拾取飘字 +10、道具/碾怪/破盾反馈（HUD 飘字，订阅 `GameState.feedback`）；UI 全部独立 CanvasLayer（Hud layer=5 / Overlay 6 / TouchUI 10），中文文案走全局内嵌字体（未动字体与 `[gui] theme/custom_font`）。

## 三、冒烟断言 ↔ 验收标准映射

`tests/smoke.gd` 阶段流：噪声相位（确定种子对抗输入）→ 负向局（不输入撞怪判负）→ 按钮信号链重开清零 → 正向局（越障/延迟实测/二段跳封顶/滑铲时长/磁铁吸附/护盾破盾/冲刺碾怪/坠坑结算）→ 8 契约全量。

| 验收 | 机判落点 |
|---|---|
| 1 操作与手感 | `input_contract`（InputMap+键位逐键+零 KEY_ 扫描+触屏节点）、`input_latency_contract`（实测 ≤3 帧）、冒烟噪声相位 |
| 2 赛道与难度 | `track_passability_contract`：布局四硬约束机判 + **10 固定种子（1..10）机器人实跑 ≥1000m**（时间轴判定：决策窗 ≥0.2s、坑宽 < 当地速度单跳距离、落地缓冲，与游戏物理同源常量）；速度/密度爬升由 `GameState.chunk_weights_for_distance` + 生成器实测 |
| 3 收集与道具 | `powerup_contract`（数值=spec.numeric + 冒烟实测吸附/破盾/碾怪计分）、`score_settle_contract`（金币账实一致：run_ended 携带值 == 实际拾取） |
| 4 死亡与结算 | 冒烟负向局（撞怪 hazard）+ 坠坑（fall）双死因 + 结算页展示 + 重开即时清零 |
| 5 数据持久化 | `save_contract`（写→改→重载回环 + end_run 落盘路径，测试后恢复原档） |
| 调参协议 | `tuning_contract`（TUNING_META 键集 == spec.numeric 39 键；apply_tuning 生效/钳制/拒绝） |

新增玩法面均有新断言覆盖；正例（跳跃/收集/道具）与负例（撞怪/坠坑/未达预算）双向可拦。

## 四、关键推导（碰撞包络余量，注释与常量一致）

- 低飞怪盒 56×88、中心 hover_y：hover_y=96 → 盒离地 [52,140]：站立顶 64 必撞、滑铲顶 36 必过、单跳顶点盒底 168.75 可越；hover_y=208 → [164,252]：贴地过、单跳撞、二段跳 308.75 越（spec §四语义逐条吻合）。
- 坑宽上限 192 < 最低速单跳水平距离 320×0.75=240（裕度 20%）；满速决策窗 224/720=0.311s > 输入预算 0.15s。
- 冒烟起跳线 380：落地 620 > 障碍右沿 592（裕度 28px）；二段跳测试在滞空前段完成，滑铲结束点与低飞怪的暴露帧由冲刺无敌帧罩住。

## 五、遗留与移交

1. **环境缺口（上报运维）**：模板仓库 `std-skills/godot-game-dev/scripts/` 未预置 `playtest.sh`（及配套 `playtest_driver.gd`），本节点无法跑机器人试玩门禁；注入目录 `.myrd-platform/.claude/skills/` 里有新版脚本但属阅读副本，未按规范用作判定器。请运维把模板仓库技能资产补齐到与注入目录同版本，后续节点再挂 playtest 步。因无 playtest，`Juice` 单例/SFX 银行未接入（fail-closed 口径），反馈走工程内 `GameState.feedback` + HUD 飘字。
2. **spec 口径备注**：`pitLandingBufferPx` 的「落地缓冲」按策划案 §四算术采用「坑右沿 → 下一威胁点中心」（l3：500−372=128）；若按威胁盒左沿算 l3/e3 处为 96。建议策划案下次修订时把口径写明。
3. **部署侧注意事项**：① 远端实际分支名为 `myrd/game-6-goal-cmuj6p1q2000em9hc4srodpkt`（任务文本中的 `myrd/games-goal-…` 在远端不存在，goal id 一致，命名符合 game-2..6 惯例），部署 gitRef 请用它，勿用 main；② 门禁 `godot-smoke` 的 `params.gamePath` 已指向 `games/game-6`、`smokeFrames=320`。
4. 真机 FPS 记录（acc-08 人工项：中端机 ≥30FPS）与 iOS Safari 取证留待试玩/部署节点回填 `games/game-6/qa/`。
