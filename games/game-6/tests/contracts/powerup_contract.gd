class_name PowerupContract
extends RefCounted
## acc-04 道具契约：磁铁（8s/200px 吸附）、护盾（抵挡 1 次 + 1s 无敌）、冲刺
## （4s × 1.8 倍速无敌碾怪 +30 分）—— 拾取效果数值与 spec.numeric 一致；
## 行为证据（真实吸附/破盾/碾怪）由冒烟阶段实测后经 ctx 传入。

## ctx 键：player（Player 实例）、flags（smoke 实测标志字典，可缺省）。
static func run(ctx: Dictionary = {}) -> PackedStringArray:
	var failures: PackedStringArray = []
	var player: Player = ctx.get("player", null)

	# 数值一致性：效果时长/半径直接来自调参区（spec.numeric 定稿值）。
	if not is_equal_approx(GameState.tuning_value(&"magnetDurationSeconds"), GameState.MAGNET_DURATION_SECONDS):
		failures.append("磁铁时长代码常量与 spec.numeric 不一致")
	if not is_equal_approx(GameState.tuning_value(&"magnetRadiusPx"), GameState.MAGNET_RADIUS_PX):
		failures.append("磁铁半径代码常量与 spec.numeric 不一致")
	if not is_equal_approx(GameState.tuning_value(&"dashDurationSeconds"), GameState.DASH_DURATION_SECONDS):
		failures.append("冲刺时长代码常量与 spec.numeric 不一致")
	if not is_equal_approx(GameState.tuning_value(&"dashSpeedMultiplier"), GameState.DASH_SPEED_MULTIPLIER):
		failures.append("冲刺倍率代码常量与 spec.numeric 不一致")
	if int(GameState.tuning_value(&"shieldCharges")) != GameState.SHIELD_CHARGES:
		failures.append("护盾充能代码常量与 spec.numeric 不一致")

	if player == null:
		failures.append("powerup_contract 缺少 player 实例（无法断言拾取效果）")
		return failures

	# 磁铁：拾取后 is_attracting 且持续磁铁时长；结束时停止吸附。
	player.apply_powerup(Player.POWERUP_MAGNET)
	if not player.is_attracting():
		failures.append("拾取磁铁后 is_attracting() 为 false（吸附未生效）")
	if not is_equal_approx(player.magnet_timer, GameState.tuning_value(&"magnetDurationSeconds")):
		failures.append("磁铁时长 %.2fs ≠ spec %.2fs" % [
			player.magnet_timer, GameState.tuning_value(&"magnetDurationSeconds"),
		])

	# 护盾：拾取后充能 = shieldCharges；裁决一次碰撞 → 破盾 + 无敌帧（不死）。
	player.apply_powerup(Player.POWERUP_SHIELD)
	if player.shield_charges != int(GameState.tuning_value(&"shieldCharges")):
		failures.append("护盾充能 %d ≠ spec %d" % [
			player.shield_charges, int(GameState.tuning_value(&"shieldCharges")),
		])
	var verdict: StringName = player.hit_hazard()
	if verdict != &"shield_break":
		failures.append("带盾碰撞裁决应为 shield_break，实际 %s" % verdict)
	if player.shield_charges != 0:
		failures.append("破盾后充能未清零：%d" % player.shield_charges)
	if player.hurt_invincible_timer <= 0.0:
		failures.append("破盾后未进入无敌帧")
	if not player.active:
		failures.append("破盾不应致死（护盾抵挡一次碰撞）")
	player.hurt_invincible_timer = 0.0

	# 冲刺：拾取后 is_dashing + 时长；裁决 → smash（碾怪不伤己）。
	player.apply_powerup(Player.POWERUP_DASH)
	if not player.is_dashing():
		failures.append("拾取冲刺后 is_dashing() 为 false")
	if not is_equal_approx(player.dash_timer, GameState.tuning_value(&"dashDurationSeconds")):
		failures.append("冲刺时长 %.2fs ≠ spec %.2fs" % [
			player.dash_timer, GameState.tuning_value(&"dashDurationSeconds"),
		])
	if player.hit_hazard() != &"smash":
		failures.append("冲刺期碰撞裁决应为 smash（碾毁障碍）")
	player.dash_timer = 0.0
	player.magnet_timer = 0.0  # 本契约前段施加的磁铁时长清零，再断言吸附态归零
	if player.is_attracting():
		failures.append("磁铁/冲刺都结束后仍处于吸附态")

	# 行为证据（冒烟阶段实测，缺省视为未验证即失败）。
	var flags: Dictionary = ctx.get("flags", {})
	for expected: String in ["magnet_pulled_coin", "shield_blocked_hazard", "dash_speed_up", "dash_smashed_obstacle"]:
		if not bool(flags.get(expected, false)):
			failures.append("行为证据缺失：%s（冒烟阶段未实测到）" % expected)
	return failures
