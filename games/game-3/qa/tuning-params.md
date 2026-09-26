# 调参 URL 参数用法（《疾风忍者跑》§3C 调参桥）

> 结论先行：**工程已支持**，无需改代码。壳页（`server/src/game-page.ts`）在引擎加载前把
> URL `?tuning=<urlencoded json>` 解析进 `window.__GAME_TUNING__`；游戏侧
> `games/game-3/autoload/game_state.gd` 的 `TUNING_META` 只认下表 8 个键并按 min/max 钳制。
> 2026-09-26 已在部署环境实测注入链路（`cdp-precheck/precheck-log.md` §P5）。

## 参数表（权威来源：`game_state.gd` TUNING_META，勿在本表改数值）

| 键 | 含义 | 默认值* | min | max | 消费方 |
|---|---|---|---|---|---|
| `run_speed` | 自动奔跑速度（px/s） | 240 | 120 | 480 | `player.gd` live_run_speed |
| `jump_velocity_abs` | 起跳初速度大小（px/s，方向恒向上） | 520 | 260 | 900 | `player.gd` live_jump_velocity |
| `gravity` | 重力加速度（px/s²） | 1400 | 700 | 2800 | `player.gd` live_gravity |
| `max_jumps` | 最大跳跃段数（2 = 地面跳 + 二段跳） | 2 | 1 | 3 | `player.gd` live_max_jumps |
| `coyote_frames` | 土狼时间（物理帧，60fps 下 6 ≈ 0.10s） | 6 | 0 | 20 | `player.gd` live_coyote_frames |
| `jump_buffer_frames` | 跳跃缓冲（物理帧） | 6 | 0 | 20 | `player.gd` live_jump_buffer_frames |
| `dart_score` | 每枚飞镖得分 | 1 | 1 | 10 | `game_state.gd` dart_score_value() |
| `win_bonus` | 跑到底过关奖励分 | 10 | 0 | 50 | `game_state.gd` win_bonus_value() |

\* 默认值 = `scripts/player.gd` / `game_state.gd` 同名常量，即**关卡设计与冒烟断言的唯一口径**；
URL 只覆盖运行期值（`live_*`），不改常量，所以调参永远不会破坏 `tests/smoke.gd` 的可达性断言。

不开放调参：`MAX_FALL_SPEED`（下落上限，防深坑穿透的安全阀，与手感无关，恒用常量）。

## 行为规则

1. **钳制**：越界值按 min/max 收敛（`run_speed:600` → 480）。CDP 探针只能看到壳层透传的原始
   注入值，钳制发生在引擎内部。如实声明：当前 `tests/smoke.gd` **没有** tuning 相关断言
   （冒烟走常量口径），钳制正确性目前只有代码审读 + 壳层注入实测背书；后续给
   `_apply_tuning` 补冒烟断言属低成本增强，不阻塞本包。
2. **过滤**：表外键一律丢弃（`evil_key:42` 无效），JSON 非法/非对象时整包忽略（照常进游戏）。
3. **缺省合并**：只传部分键时，未传键用常量默认（不用上一个 URL 的残留——参数只活在当次加载）。
4. **重开不清除**：调参作用于整个页面生命周期；按 R 重开一局仍保持调参值。
5. **无头/桌面直开不受影响**：无壳页时 `__GAME_TUNING__` 不存在，全部走常量默认。

## 用法

```
https://leomac-studio.tail49399e.ts.net/apps/game-3/?tuning=<urlencoded json>
```

生成（任选其一）：

```bash
# 方法一：命令行直接生成完整 URL
BASE="https://leomac-studio.tail49399e.ts.net/apps/game-3/"
python3 -c "import urllib.parse,sys;print('$BASE?tuning='+urllib.parse.quote(sys.argv[1]))" \
  '{"run_speed":300,"coyote_frames":10,"jump_buffer_frames":10}'

# 方法二：浏览器控制台
location.href = location.origin + location.pathname + "?tuning=" +
  encodeURIComponent(JSON.stringify({run_speed:300, coyote_frames:10}))
```

## 真机调参建议组合（配合 `../ios-safari-checklist.md` C4–C7）

| 症状 | 先试这组 URL | 判读 |
|---|---|---|
| 按了偶尔没反应 | `{"coyote_frames":12,"jump_buffer_frames":12}` | 有效 → 数值问题（窗口太小）；无效 → 链路问题，报 bug |
| 跳得太飘/太空 | `{"gravity":1800,"jump_velocity_abs":560}` | 提高重力压缩滞空，落点更跟手 |
| 跳不过宽坑 | `{"jump_velocity_abs":600}` 或 `{"max_jumps":3}`（仅体验用） | 前者改力学，后者放开段数；定稿后应改坑宽而不是放段数 |
| 整体节奏太快 | `{"run_speed":200}` | 注意低于 200 时坑宽余量变小，跨坑难度反向上升 |

**定稿流程**：真机上试出满意参数 → 回写 `../artifacts/` 结果表 → 若要成为默认手感，由后续
实现节点把值改进 `scripts/player.gd` 常量区并跑 `bash games/game-3/verify.sh` 门禁提交——
本文件只记录用法，不承担常量变更。
