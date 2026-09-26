# 森林收集水果限时赛：控制小松鼠在森林里限时收集掉落的水果，越

单屏森林场景休闲收集游戏：操控松鼠在 **60 秒**内尽量多地收集水果，同时躲避横向滚来的原木。
碰到原木本局立即结束；时间归零正常结算。数值口径以知识 `6e91a11d`（game-5 玩法设计要点）为准。

## 玩法参数（需求硬性口径）

| 项 | 值 |
| --- | --- |
| 单局时长 | 60 秒逐秒倒计时（`GameState.MATCH_SECONDS` 唯一定义） |
| 基础得分 | 每个水果 +10（苹果/浆果外观不同、分值等价） |
| 连击加成 | 3 秒窗口内每追加 1 个额外 +5（窗口刷新式，`GameState.add_score()` 唯一入口） |
| 原木生成 | 2~4 秒随机间隔，与水果补货计时相互独立 |
| 原木速度 | `v(t) = lerp(1.8·v0, v0, timeLeft/60)`，v0 = 120（随剩余时间递增） |
| 水果供给 | 初始 8~12 个；存量 < 6 时每 0.8~1.5 秒补 1 个 |
| 边界 | 松鼠永 clamp 在场景内（视觉 14px，碰撞盒 11px ≈ 78% 宽容度） |
| 结算 | 本局得分 + 收集数量 + 历史最高分（`user://game_5_save.cfg` 持久化，仅破纪录覆写） |
| 重开 | 双通道：触摸「重新开始」按钮 + 键盘 Enter/Space（confirm 动作） |

## 操作

- 桌面：WASD / 方向键移动（对角线已归一化）；结算界面 Enter / Space 重开
- 移动端：左下虚拟摇杆移动（`virtual_joystick.gd`，动作生产者）；结算界面触摸「重新开始」

## 工程结构

```
autoload/game_state.gd   计分唯一入口 + 连击状态机 + 最高分持久化（模板协议）
autoload/juice.gd        反馈单例：pop/flash/shake/hit_stop/sfx + feedback_fired（playtest 采样锚点）
scripts/main.gd          单局流程：倒计时 / 双终局路径（时间到 | 被原木击中）/ 重开 / 飘分
scripts/player.gd        松鼠：归一化移动 + 边界 clamp + moved 信号
scripts/fruit.gd         水果 Area2D：碰松鼠 → collected 信号
scripts/log_roller.gd    原木 Area2D：横滚 + 出界自毁 + 碰松鼠 → hit_player
scripts/fruit_spawner.gd 铺场 + 补货（独立计时器）
scripts/log_spawner.gd   原木节奏 + 速度递增公式（独立计时器）
scripts/hud.gd           HUD：时间/得分/水果/连击窗口条 + 结算三要素面板
scenes/main.tscn         主场景（Player/FruitSpawner/LogSpawner/Popups/Hud 装配）
tests/smoke.tscn|gd      无头冒烟断言（协议：GODOT_SMOKE: PASS/FAIL）
tests/playtest.json      机器人试玩局时长与阈值
```

## 本地门禁

```bash
bash games/game-5/verify.sh
```

等价于依次调用仓库判定脚本：`resolve-godot.sh` → `preflight.py` → `smoke.sh`（240 帧）→
`input-fuzz.sh` → `playtest.sh`。判定只认仓库内 `std-skills/godot-game-dev/scripts/`，
本工程不含任何自制判定器。全绿标记：`GODOT_SMOKE: PASS` / `GODOT_FUZZ: PASS` / `GODOT_PLAYTEST: PASS`。

## 冒烟断言 ↔ 验收标准映射

| 验收 | 冒烟断言 |
| --- | --- |
| 1. 60s 逐秒递减、归零自动结算 | 实测 65 帧后 `time_left` 下降且 HUD 文本变化；`time_left=0.08` 注入后进入「时间到」结算 |
| 2. 移动 + 不越界 | 键盘注入位移 ≥ 1px；贴边持续右移 30 帧后 x == clamp 边界（±0.5px） |
| 3. 收集 +10、连击累加 | 传送收集第一笔 +10（连击=1）；3s 窗口内第二笔增量 +15（连击=2） |
| 4. 原木 2~4s、速度递增、碰撞即终局 | `wait_time ∈ [2,4)`；v(60)=v0、v(30)>v(60)、v(0)=1.8·v0；原木瞬移到松鼠 → 「被原木击中」结算 |
| 5. 结算三要素 + 最高分持久化 | 结算后 `best ≥ 本局分` 且 `user://game_5_save.cfg` 存在（真机刷新留痕由 qa 节点复验） |

## 已知边界（对下游节点的提示）

- 音效为程序化合成短音（`assets/sfx/*.wav`）；Web 端出声依赖壳页音频手势解锁（部署节点硬契约）
- 一期无暂停（需求未要求）；若加暂停，必须同步冻结 60s 倒计时，否则验收 1 判失败
- `first_reward_seconds_max` 设为 `-1`（关闭）：bot 是随机游走者、不追踪水果，开局世界布局
  与 bot 事件流分属不同随机源，「10s 内撞上水果」是随机事件而非设计承诺，纳入机判会随机翻车
  （实测同一 seed 两轮执行一次 fb=13、一次 fb=4）。开局必有可收目标（铺场 8~12）与收集链路可用
  这两条真承诺已由 smoke 的确定性断言覆盖；其余阈值（反馈间隔 ≤10s、每局反馈 ≥2）保留机判
