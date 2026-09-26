# QA 轮次记录 · 验收标准 6 音效反馈落地（2026-09-27）

## 结论（TL;DR）
- 四类音效（收集 / 受击 / 结算 / 重开）已实现：**AudioStreamPlayer × 4 + 程序化生成的 AudioStreamWAV**（GDScript 运行时合成 16-bit PCM，无二进制音频资产），`qa/measured-evidence.md` §5 与 `qa/ios-checklist.md` C4 记录的「0 SFX 节点」差距已消除。
- 门禁：`PREFLIGHT: PASS`（13 类 / 62 文件）、`GODOT_SMOKE: PASS`（240 帧，含新增 G 段音效四类接线断言）、`GODOT_FUZZ: PASS`（seed=20260913，6 批次 239 帧）。
- `playtest.sh` 模板仓库仍未预置（既有 Bug cmuimz29u0014m9l6t0cp1hpt 跟进中），本节点不依赖、不自行补造判定器。

## 实现形态（验收标准 6 ↔ 代码对照）
| 音效 | 触发点 | 音色 | 代码位置 |
| --- | --- | --- | --- |
| collect | `StarDust.collected` → `main._on_crystal_collected` | 上行双音「叮」（B5→E6 正弦） | `Sfx.play_collect()` |
| hit | `Player.hit_taken` → `main._on_player_hit_taken` | 下行锯齿闷响（220→62Hz）+ 25% 白噪声颗粒 | `Sfx.play_hit()` |
| game_over | `_show_settlement`（护盾耗尽 / 达标胜利共用结算面板） | 下行三连音「落幕」（A4→E4→C4 三角波） | `Sfx.play_game_over()` |
| restart | 「重新开始」按钮 / confirm 动作 → `_on_restart_pressed` | 上行扫频「启动」（C5→C6 正弦） | `Sfx.play_restart()` |

- 单例：`autoload/sfx.gd`（注册名 `Sfx`），采样率 22050Hz、16-bit 单声道、峰值钳制 0.8 防叠音削波；四播放器相互独立，连续收集/受击音效可叠加不互掐。
- 合成失败降级为静音占位流：音效缺席不构成启动/运行故障。
- iOS 自动播放策略：引擎在首次用户手势后恢复 AudioContext（壳页已有 AudioContext 手势解锁器 ×13），C4 听感项据此可在真机复测。

## 冒烟断言（tests/smoke.gd G 段，机判）
1. 结构契约：`Sfx` 单例注册；`AudioStreamPlayer` 节点数 = 4；每条 stream 为非空 16-bit PCM 的 `AudioStreamWAV` 且采样率与合成一致；`play()` 后播放器进入播放态、`play_counts` 递增。
2. 接线契约（静态「有节点」不算数）：collect/hit/game_over/restart 四键在真实玩法相位里各至少触发 1 次（收集判定达成 / 受击判定达成 / 护盾归 0 结算 / confirm 重开 四处复查）。

## 门禁取证（本地，与门禁同源命令）
```
$ python3 std-skills/godot-game-dev/scripts/preflight.py games/game-2
PREFLIGHT: PASS 13 类前置一致性检查全部通过（62 个工程文件，不含 .godot/ 导入缓存）

$ GODOT_SMOKE_FRAMES=240 ... bash std-skills/godot-game-dev/scripts/smoke.sh games/game-2
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
（场景直跑日志）GODOT_SMOKE: PASS 方向语义(move_right/move_left)/收集/受击无敌帧/结算/重开/里程碑/胜利结算/难度梯度/音效四类接线 全部通过

$ ... bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/game-2
godot-fuzz: PASS 输入鲁棒性 fuzz 通过（退出码 0，日志无脚本错误）
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
```

## 待办（移交真机/红队）
- C4 听感复测（iOS Safari：首次手势后收一颗星尘能听到收集音效；横竖屏切换、切后台往返后音效仍响）。
- `playtest.sh` 由运维补模板仓库后，再补机器人试玩门禁结论。
