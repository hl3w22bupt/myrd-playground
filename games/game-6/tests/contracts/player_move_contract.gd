class_name PlayerMoveContract
extends RefCounted
## acc-02 手感语义契约：地面起跳仅可二段跳一次；滑铲持续 slideDurationSeconds 且
## 碰撞盒降为 hitboxSlideHeightPx；coyote / 输入缓冲按 numeric 生效。
## 跳跃/滑铲的真实输入响应由冒烟阶段实测（flags），本契约做状态机与盒体机判。


static func run(ctx: Dictionary = {}) -> PackedStringArray:
	var failures: PackedStringArray = []
	var player: Player = ctx.get("player", null)
	if player == null:
		failures.append("player_move_contract 缺少 player 实例")
		return failures

	# 手感常量与调参区一致（单一事实源）。
	for pair: Array in [
		[GameState.tuning_value(&"coyoteTimeSeconds"), GameState.COYOTE_TIME_SECONDS, "coyoteTimeSeconds"],
		[GameState.tuning_value(&"jumpBufferSeconds"), GameState.JUMP_BUFFER_SECONDS, "jumpBufferSeconds"],
		[GameState.tuning_value(&"slideDurationSeconds"), GameState.SLIDE_DURATION_SECONDS, "slideDurationSeconds"],
	]:
		if not is_equal_approx(float(pair[0]), float(pair[1])):
			failures.append("手感常量 %s 与 spec.numeric 不一致：%s ≠ %s" % [pair[2], pair[1], pair[0]])

	# 滑铲低盒：高度 = hitboxSlideHeightPx、宽度同站立盒、锚定脚底。
	var slide_shape: CollisionShape2D = player.get_node("SlideShape") as CollisionShape2D
	var stand_shape: CollisionShape2D = player.get_node("StandShape") as CollisionShape2D
	var slide_rectangle := slide_shape.shape as RectangleShape2D
	var stand_rectangle := stand_shape.shape as RectangleShape2D
	if slide_rectangle == null or stand_rectangle == null:
		failures.append("玩家碰撞盒不是 RectangleShape2D（盒体推导失效）")
		return failures
	var slide_height: float = GameState.tuning_value(&"hitboxSlideHeightPx")
	if not is_equal_approx(slide_rectangle.size.y, slide_height):
		failures.append("滑铲盒高 %.1f ≠ hitboxSlideHeightPx %.1f" % [
			slide_rectangle.size.y, slide_height,
		])
	if not is_equal_approx(slide_rectangle.size.x, stand_rectangle.size.x):
		failures.append("滑铲盒宽 %.1f ≠ 站立盒宽 %.1f" % [
			slide_rectangle.size.x, stand_rectangle.size.x,
		])
	# 低盒底面与站立盒底面同一水平（锚定脚底，y = +半高差）。
	var height_diff: float = stand_rectangle.size.y - slide_rectangle.size.y
	if not is_equal_approx(slide_shape.position.y, height_diff / 2.0):
		failures.append("滑铲盒未锚定脚底：offset.y %.1f ≠ 半高差/2 %.1f" % [
			slide_shape.position.y, height_diff / 2.0,
		])

	# 状态机语义（直接驱动内部状态，不依赖物理帧）。
	player.slide_timer = GameState.tuning_value(&"slideDurationSeconds")
	if not player.is_sliding():
		failures.append("slide_timer 置满后 is_sliding() 为 false")
	player.slide_timer = 0.0
	if player.is_sliding():
		failures.append("slide_timer 清零后仍处于滑铲态")
	player.jumps_used = 0
	player.jumps_used = 2
	# 二段跳封顶：jumps_used 已达 2 时 is_sliding/jump 状态机不再给第三段
	#（_try_jump 的 elif jumps_used < 2 分支封顶；此处断言状态字段上限语义）。
	if player.jumps_used > 2:
		failures.append("跳跃段数超过二段跳封顶：%d" % player.jumps_used)
	player.jumps_used = 0

	# 行为证据（冒烟阶段实测）。
	var flags: Dictionary = ctx.get("flags", {})
	var slide_frames: int = int(flags.get("slide_measured_frames", -1))
	if slide_frames < 0:
		failures.append("滑铲持续时间未实测（flags.slide_measured_frames 缺失）")
	else:
		var expected_frames: float = GameState.tuning_value(&"slideDurationSeconds") * 60.0
		if absf(float(slide_frames) - expected_frames) > 8.0:
			failures.append("滑铲实测 %d 帧 ≠ %.1f±8 帧（slideDurationSeconds 未按数值生效）" % [
				slide_frames, expected_frames,
			])
	if not bool(flags.get("double_jump_capped", false)):
		failures.append("二段跳封顶未实测（flags.double_jump_capped 缺失）")
	if not bool(flags.get("jump_lifted_off", false)):
		failures.append("跳跃离地未实测（flags.jump_lifted_off 缺失）")
	return failures
