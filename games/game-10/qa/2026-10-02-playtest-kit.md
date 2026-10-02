# 试玩验收包（playtest_kit）— game-10 复现天天酷跑（2026-10-02）

> 本节点只负责把「好不好玩」的判定交还给人：下面是指引 + 量表 + 调参入口。
> **试玩结论只能来自主人**；量表未回填前，本包一切主观项状态 = 待回填。
> 依据：需求 cmuqk2zhg0018m9bf4er5mxoy（加速降晃 + 终局单晃）。
> 工程内无 `.myrd/spec/design-spec.json`，试玩指引按实现说明（README + `autoload/game_state.gd` 常量区）为口径。

## 0. 入口

- 游戏：https://leomac-studio.tail49399e.ts.net/apps/game-10/ （部署 commit `0b5f4bd`，分支 `myrd/game-10-goal-cmuqjy7dk000mm9bf5jef68ay`）
- 调参工作台：**https://leomac-studio.tail49399e.ts.net/apps/game-10/?tuning=1**
  打开后画面右上角出现调参面板，拖滑杆即时改数值；点「复制调参 URL」得到带
  `?tuning=<JSON>` 的链接，把它发回来就是一次完整的调参结果。

## 1. 试玩指引（怎么玩 / 看什么）

**meta**：休闲收集跑酷。角色自动前进，跑满 **500m** 通关（`WIN_DISTANCE_M`）；
撞到障碍即 game over。基速 `BASE_SPEED_PX_S`，吃到加速星提速 `ACCEL_MULTIPLIER` 倍、
持续 `ACCEL_DURATION_S`=10 秒。

**操作**（桌面键盘 + 移动端虚拟摇杆双输入，移动端打开自动出现虚拟摇杆）：
跳跃 / 快速下落 / 左右走位。

**content**：场上实体按固定种子序列生成（`_rng.seed = 20261002`，可复现）——
金币 4 枚一弧（高度对齐跳跃弧）、加速星（25% 概率，`BOOST_CHANCE`）、障碍交替出现；
首个实体前 1.2s 起步缓冲。计分：金币每枚 +10（`COIN_SCORE`）。

**重点看什么（本次晃动修复的体感验收，机判代理指标见 §3）**：
1. 吃到加速星后的 10 秒内，画面只有**轻微可察的微抖**（1.2px / 5Hz）——连续玩几个加速段，
   注意是否还头晕；
2. 撞障碍触发 game over：画面**只晃一次**（0.3s、短促），之后完全静止——
   盯 3 秒，看有没有残余抖动或二次晃动；
3. 加速过程中故意撞障碍：应只播放终局单晃，不应出现晃动叠加/放大。

## 2. 结构化试玩量表（四问逐条填，不许合并）

| # | 问题 | 回填 |
|---|---|---|
| ① | 首分钟能否看懂目标与操作？（是 / 否 + 卡点） | **待回填** |
| ② | 结束时想不想再来一局？（1–5 分 + 原因） | **待回填** |
| ③ | 手感与反馈（1–5 分：打击感 / 音效 / 画面响应） | **待回填** |
| ④ | 节奏有没有明显断档或无聊段？（有 / 无 + 出现在第几秒） | **待回填** |

> 状态：**待用户试玩**。收到量表结论 + 调参 URL 后，由下一环节解析 `?tuning=` JSON、
> 与现值 diff，经 game-design-specs revisions 接口写入 spec.numeric 后 approve 拍板。
> 未收到前本包不得出现「试玩通过 / 好玩」类结论。

## 3. 本轮门禁与机判代理指标（判据来源：仓库内 std-skills/godot-game-dev/scripts/）

在 HEAD `2b1f8ad`（与部署 commit `0b5f4bd` 代码一致，其后仅文档变更）复跑，全绿：

| 门禁步骤 | 结果 |
|---|---|
| preflight.py | PASS（13 类检查，43 个工程文件） |
| smoke.sh（240 帧） | PASS（退出码 0，断言标记齐全，日志无脚本错误） |
| input-fuzz.sh | PASS（seed=20260913 batches=6 total_frames=239） |
| godot-availability | PASS（GODOT_BIN 解析成功） |

机判代理指标（`tests/smoke.gd` 无头实测，2026-10-02 记录，代码未变故沿用）：
加速晃动峰值 1.20px（基线 6.0px，降 80%，验收线 ≤50%）；game over 计数恰 +1、
峰值 5.83px ≤ 配置 7.0px；结束后 3.5 游戏秒逐帧 `offset == Vector2.ZERO`（要求 ≥3s）；
重开可再次单晃。「不头晕 / 结束感干脆」属人工体感，以 §2 量表回填为准。

## 4. 调参工作台可用键（GameState.TUNING_META，只认这 5 个）

| 键 | 当前值 | 范围 | 步长 | 含义 |
|---|---|---|---|---|
| `shake_accel_amplitude_px` | 1.2 | 0–3.0 | 0.1 | 加速微抖幅度（上界=验收线 3.0px） |
| `shake_accel_frequency_hz` | 5.0 | 0–6.0 | 0.5 | 加速微抖频率（上界=6Hz） |
| `shake_game_over_amplitude_px` | 7.0 | 0–12 | 0.5 | 终局单晃幅度 |
| `shake_game_over_frequency_hz` | 16.0 | 1–24 | 0.5 | 终局单晃频率 |
| `shake_game_over_duration_s` | 0.3 | 0.1–0.5 | 0.05 | 终局单晃时长（上界=0.5s） |

URL 里出现未在上表的键会被忽略并在 diff 说明中标注；所有值按 min/max 钳制，
写不出破坏验收标准的值。调参结论以 spec 为唯一事实源，下一轮工作流按新 spec 重部署。
