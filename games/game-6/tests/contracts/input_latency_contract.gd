class_name InputLatencyContract
extends RefCounted
## acc-08 手感预算契约：输入到角色状态变化 ≤ inputLatencyBudgetFrames 帧
## （60FPS 下 50ms ≤ 需求 100ms 上限）。实测帧差由冒烟阶段跳跃注入记录。


static func run(flags: Dictionary = {}) -> PackedStringArray:
	var failures: PackedStringArray = []
	var budget: int = int(GameState.tuning_value(&"inputLatencyBudgetFrames"))
	var latency: int = int(flags.get("jump_latency_frames", -1))
	if latency < 0:
		failures.append("输入延迟未实测（flags.jump_latency_frames 缺失）")
		return failures
	if latency > budget:
		failures.append("输入延迟 %d 帧 > 预算 %d 帧（acc-08：≤3 帧 @60FPS）" % [latency, budget])
	return failures
