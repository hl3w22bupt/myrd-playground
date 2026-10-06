# playtest 机判 round2 —— PASS（implement 节点迭代 · 2026-10-06）

- 判定器：`std-skills/godot-game-dev/scripts/playtest.sh`（仓库自带，未改动）
- 被测代码：部署分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn` @ `7a68d1e`
  （= 线上 AppHost v4 deployment `cmuwpdpxw004pm9lgt8rljmsz` 的同源代码，v4 running）
- 环境：本机 Godot v4.3.stable（resolve-godot.sh 解析），阈值来源 `tests/playtest.json`
- 结论：**GODOT_PLAYTEST: PASS，退出码 0**——门禁默认档与全 session 档两档全绿（可复现）

## 指标

### 门禁默认档（3 种子 × 900 帧，`report.log`）

```json
{"frames_per_run":900,"runs":[
 {"run":1,"seed":20260913,"feedback_events":71,"first_reward_seconds":0.067,"max_feedback_gap_seconds":1.317,"outcome":"score=0|fb=71"},
 {"run":2,"seed":20260914,"feedback_events":80,"first_reward_seconds":0.267,"max_feedback_gap_seconds":1.167,"outcome":"score=0|fb=80"},
 {"run":3,"seed":20260915,"feedback_events":76,"first_reward_seconds":0.017,"max_feedback_gap_seconds":0.950,"outcome":"score=0|fb=76"}],
 "thresholds":{"feedback_events_min_per_run":30,"feedback_gap_seconds_max":6,"first_reward_seconds_max":5,"seed_outcomes_min_distinct":2},
 "thresholds_source":"tests/playtest.json"}
```

### 全 session 档（3 种子 × 5400 帧 = 90s/局，`report-full-session.log`）

```json
{"frames_per_run":5400,"runs":[
 {"run":1,"seed":20260913,"feedback_events":517,"max_feedback_gap_seconds":1.317,"outcome":"score=0|fb=517"},
 {"run":2,"seed":20260914,"feedback_events":488,"max_feedback_gap_seconds":1.283,"outcome":"score=0|fb=488"},
 {"run":3,"seed":20260915,"feedback_events":518,"max_feedback_gap_seconds":0.950,"outcome":"score=0|fb=518"}],
 "thresholds_source":"tests/playtest.json"}
```

对照 round1：最长无反馈窗口 **13.2s → ≤1.32s**（约 10× 收敛），反馈密度 **6 次/局 → 71~518 次/局**，
GODOT_PLAYTEST **FAIL → PASS**。

## tests/playtest.json 标定依据（回溯 GameDesignSpec，非放宽）

| 键 | 值 | 依据 |
| --- | --- | --- |
| `frames_per_run` | 5400 | SKILL.md §4.5：60 × 单局目标秒数；本作 easy 局 90s（`start_time_easy=90`）。注意：本版 driver 对 JSON 数值按 float 解析、`is int` 检查不通过，env `GODOT_PLAYTEST_FRAMES` 优先——两档（900/5400）实测均在阈值内 |
| `first_reward_seconds_max` | 5.0 | 实测 0.02~0.43s，余量 ~10×；较内置默认 10s 更严 |
| `feedback_gap_seconds_max` | 6.0 | 实测最差 1.32s，余量 ~4.5×；较内置默认 10s 更严 |
| `feedback_events_min_per_run` | 30 | 实测 71~518；下限钉在「哑游戏」检出量级（900 帧短局实测 ~75 仍满足） |
| `seed_outcomes_min_distinct` | 2 | 开局随机发牌（`types.shuffle()` 无固定种子）= 天然重玩钩子；三局 outcome 签名实测互异 |

## round1 → round2 的修复（implement 节点迭代，commit 7a68d1e）

round1 判读的两条修复输入逐条落地：

1. **点击反馈信号接线（产品缺陷，已修）**——探针实证双重根因：
   - `board._unhandled_input` 读全局鼠标态 `get_global_mouse_position()` 而非事件自带
     position；合成 drag 流（relative ±40 随机）令引擎跟踪的鼠标位 100 帧内漂到
     (6853, 4876)（视口仅 540×960），此后所有指针点击 `cell_from_world` 恒返回界外 →
     `select_cell` 静默 return → 反馈黑洞。**修复**：改读事件 position 并经
     `get_canvas_transform().affine_inverse()` 换算世界系（headless 下根窗口 64×64 +
     stretch 变换把原始注入坐标放大 ~15×，指针路径对 bot 结构性不可达——这也说明
     bot 的可玩通道必须是动作路径）。
   - 玩家光标（confirm 动作的落点）可被方向键走出棋盘，越界后 confirm 落空——round1
     的 6 次反馈（全来自 confirm 路径）1.8s 后归零正因如此。**修复**：player.gd 新增
     `clamp_rect`，main.gd 按当前难度棋盘几何接线（内缩 1px 防 floor 落界外格）。
2. **任意点击必有可见反馈（§3B，已补）**：取消选中（二次点击同格）此前无任何反馈，
   现补 `Juice.sfx(&"confirm", -8.0)`。

## 备注（诚实记录）

- **score=0**：bot 随机游走 + 以 ~4.5 次/s 频率 confirm，配对尝试大多落在同格（deselect）
  或异型邻格（reject），且会按 R 触发重开（重发牌局）；机判协议不断言得分，故不影响判定。
  核心消除闭环另经受控探针实证：满盘 4×4 + 顶行相邻同型，纯输入路径
  （移动光标 → confirm ×2）下 `remaining 16→14、score +10、Juice 反馈齐全`（探针为临时
  场景，实证后删除未入库）。
- 部署后链路：AppHost v4 `cmuwpdpxw004pm9lgt8rljmsz` @ 7a68d1e running；
  `qa/mobile/` 已刷新为 v4 证据（round4，MOBILE_SMOKE PASS 10/10，checkedAt 2026-10-06T13:20Z）。
- 工作流正式结论：调度 API 403（权限）未补齐前，本目录 + `qa/mobile/` 为上一节点 agent
  用仓库自带门禁脚本完成的兜底机判；权限补齐后从 implement 节点补跑工作流即可复现。

## 运行日志

- 门禁默认档：`report.log`（完整 stdout/stderr，含 GODOT_PLAYTEST_METRICS 单行 JSON）
- 全 session 档：`report-full-session.log`
