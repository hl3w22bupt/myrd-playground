# 《Soccer》11 人足球

Godot 4.x 2D 俯视足球小游戏：两队各 11 名低模小人（含门将，带程序化跑步动画）在标准球场
（中圈 / 禁区 / 球门）打满上下半场，模拟 90 分钟计分比赛。

## 操作（全部映射到 project.godot [input]，代码只引用动作名）

| 按键 | 动作 | 行为 |
|---|---|---|
| WASD / 方向键 | move_left/right/up/down | 移动当前受控球员（脚下有球即带球，速度略降） |
| J | pass | 传球给前场最合适的队友 |
| K | shoot | 向对方球门射门 |
| Q / Tab | switch_player | 切换控制离球最近的本队球员（主队拿球时也会自动切换） |
| C | difficulty_next | 循环切换难度：简单 → 普通 → 困难（只调客队 AI） |
| L | match_length_next | 循环切换比赛真实时长：短场 2 分钟 → 标准 4 分钟 → 长场 6 分钟 |
| R | restart | 任意时刻重开一场比赛 |
| M | toggle_mute | 静音开关（也可点 HUD 右上「音效：开/关」按钮） |
| Enter / Space | confirm | 终场结算画面按确认重开 |

**触摸屏（v2，触屏设备自动显示、桌面键盘环境自动隐藏）**：左侧虚拟摇杆 = move_*
四动作（方向 + 幅度调速）；右侧按钮 = 射门 / 传球 / 切换球员，与键盘映射到同一批
InputMap 动作（`scripts/touch_controls.gd` 是动作的「生产者」，经 InputEventAction 注入，
游戏逻辑层不感知触摸）；多点触控下摇杆与按钮可同时按压。

**终场结算「再来一局」按钮（v3）**：结算画面下方触摸 / 鼠标可点的按钮（触达区域
260x64 ≥ 44x44），与键盘 R 映射到同一个 `restart` 动作（`scripts/result_controls.gd`，
InputMap 生产者模式）；仅终场结算出现且可交互，键盘快捷键（R / Enter / 空格）行为不变。

## 音效（v2）

- 事件音：踢球 / 传球 / 抢断 / 哨声（开球一声、中场两声、终场三声）/ 进球音 +
  人群欢呼分层叠加 + 人群环境声循环。
- Web 自动播放策略：`autoload/audio_manager.gd` 做解锁门控 —— 首次用户交互
  （点击 / 按键 / 触摸）前只记账不发声、不报错不阻塞；交互后自动解锁并启动环境声。
- 静音：主总线静音，立即生效（M 键 / HUD 按钮 / 代码 set_muted 均可）。
- 素材：`assets/audio/*.wav`（16-bit 单声道 22050Hz，合计约 0.44MB，预算 5MB），
  由 `tools/gen_audio.py` 纯标准库合成，可重生成。

## 玩法与规则

- 比赛流程：开球 → 上半场（模拟 45'）→ 中场交换场地 → 下半场 → 终场结算面板（比分 +
  胜/平/负 + 重开入口提示）；全场真实时长三档可切换（`autoload/game_state.gd`
  的 `MATCH_LENGTH_OPTIONS`，默认标准 4 分钟）。
- 难度梯度：C 键三档循环，只缩放客队 AI —— 移速系数 / 同时上抢人数 / 起脚距离 /
  门将扑救反应 / 贴身抢断时间（数值表见 `game_state.gd` 的 `DIFFICULTY_*`，主队玩家永不缩放）。
- 控球：自由球由最近球员拿走；对方贴身按难度完成抢断；门将持球短停后自动开大脚。
- 规则事件：出边线判界外球（对方掷球）；出底线按最后触球方判——守方触球 → 角球（攻方
  角旗区开出）、攻方触球 → 球门球（守方门将开球）；进球后比分实时更新并由失球方重新开球。
- AI：非受控队友与对手按 4-3-3 阵型跑位接应/回防；持球队员向球门推进、受压传球或起脚；
  门将沿门线跟随球做出扑救反应。

## 目录结构

```
games/soccer/
├── project.godot          # 主场景 / autoload / InputMap / 全局中文字体
├── autoload/game_state.gd # 比赛状态机（比分/计时/阶段）+ 数值调参区
├── scenes/                # main.tscn（比赛装配）、footballer.tscn（小人）、ball.tscn（足球）
├── scripts/               # main.gd（比赛控制器/AI/规则）、footballer.gd、ball.gd、pitch.gd
├── assets/fonts/          # 全局中文字体（Web 导出沙箱无系统字体，勿删）
└── tests/smoke.tscn|gd    # 无头冒烟自检（门禁断言场景）
```

## 本地门禁（与 .myrd/routines.yaml 的 godot-smoke 同源）

```bash
bash games/soccer/verify.sh
# 或分步：
python3 std-skills/godot-game-dev/scripts/preflight.py games/soccer
GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/soccer
```

通过判据：退出码 0 且日志含 `GODOT_SMOKE: PASS`（断言覆盖：场景接线 / 键位契约 /
移动 / 传球 / 射门进球 / 界外球 / 角球 / 球门球 / 难度梯度 / 时长配置 / 终场结算面板 / 重开 /
结算「再来一局」按钮触达与触摸·鼠标重开）。
