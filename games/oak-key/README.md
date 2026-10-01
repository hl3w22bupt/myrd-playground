# 《探针：验证 oak key 有效性（取证用，不计入三样例）》

> **取证探针（forensic probe）**：本工程是「游戏工程 → godot-smoke 门禁 → AppHost 部署」
> 全链路健康的取证工具，**不计入主项目三样例的数量与质量统计**。
> 需求 id：`cmupslvp7002gm9dh42h3maq5` · 目标 id：`cmupsfn0q001um9dhlko9t5e0`
> · AppHost id：`cmupsflsj001sm9dhxt6w1oal`（slug: `oak-key`）
> · 统计口径：三样例统计（脚本/看板）不得包含 `games/oak-key`。

- 引擎：Godot 4.3（`config/features=PackedStringArray("4.3")`），工程根固定 `games/oak-key`
- 类型：休闲收集 · 一句话玩法：拾取 key 片段 → 本地校验 → 反馈「有效 / 无效」并落取证标记

## 玩法（三波难度梯度的取证收集）

每波生成按白名单顺序（`OA → K7 → 42`）排布的真实片段与若干巡逻的伪造片段（`X9`）；
集齐 3 片按「探测」发起本地校验：

- **有效** → 过波（+100 分 + 剩余时间奖励），片段重新布点，伪造片段更多、巡逻更快、时限更短；
- **无效**（拾到伪造 / 片段不足 / 顺序错）→ 探针信度 -1，已拾片段保留可调整重试；
- **超时** → 信度 -1，本波片段重铺、组装序列清空；
- 信度归零 → **失败结算**；三波全过 → **胜利结算**（面板给出波次/总分/探测统计）；
- `R` / 触摸「重开」随时重开一局。

| 环节 | 落点 |
| --- | --- |
| 输入 | WASD / 方向键移动，空格（或回车）探测，R 重开；触摸端摇杆 + 按钮 |
| 波次/难度梯度 | `autoload/game_state.gd::WAVES`（时限/伪造片段数/巡逻幅度逐波递增）+ `scripts/main.gd::WAVE_LAYOUTS`（布点） |
| 拾取 | `scripts/key_fragment.gd`（Area2D 覆盖检测，拾取包络 28px = 片段半径 16 + 玩家半宽 12；伪造片段水平巡逻，出生/重铺带 2 物理帧武装延迟） |
| 登记 | `autoload/game_state.gd::register_fragment()` / `reset_pickup()`（超时重铺只清拾取进度、保留分数） |
| 校验 | `scripts/oak_key_validator.gd::validate()`（白名单 + 顺序敏感的本地校验逻辑） |
| 信度/结算 | `game_state.gd::penalize()/clear_wave()/tick_wave()` → `run_finished(victory\|defeat)` → `main.gd::_on_run_finished()` 结算面板 |
| 取证 | `game_state.gd::record_probe()`：日志行 `OAK_KEY_PROBE oak_key_probe=valid\|invalid ... wave=N/3 ...` + 存档字段 `user://oak_key_probe.json` |
| 反馈 | Juice 全局反馈单例（`autoload/juice.gd`）：拾取=弹跳+音效、有效=确认音、无效/超时=闪红+震动+音效、结算=弹跳（SKILL §3B） |
| 调参 | `game_state.gd` 调参区（`move_speed`/`wave_time_scale`/`decoy_speed`/`probe_credits` + `TUNING_META`）；网页 `?tuning=` 即时生效（SKILL §3C，调参面板 `scripts/tuning_panel.gd`） |

## 门禁（验收标准 2）

```bash
bash games/oak-key/verify.sh          # preflight(13类) + smoke(240帧) + input-fuzz
```

判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（模板仓库预置，本工程不自带、
不改写）。冒烟断言见 `tests/smoke.gd`（相位机 229 物理帧完成，预算 240 帧）：
静态接线 + 键位契约 + 难度梯度不变式 + 调参协议 → 噪声相位（对抗输入后重开净局）→
超时扣信度/重铺 → 三波拾取与有效探测/过波 → 胜利结算 → 重开 → 连续无效探测 → 失败结算 →
反馈（Juice.events 非空）。取证日志可直接 `grep OAK_KEY_PROBE`。
