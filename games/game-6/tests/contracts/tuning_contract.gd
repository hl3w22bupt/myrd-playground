class_name TuningContract
extends RefCounted
## acc-09 调参协议契约：TUNING_META 键集 == spec.numeric 键集（39 键）；
## apply_tuning 应用已声明键、按 min/max 钳制、拒绝未声明键。
## 跑完恢复默认值（spec.numeric 定稿值），不污染后续断言。

## spec.numeric 键集（.myrd/spec/design-spec.json v1，39 键；增删必须先走 revisions）。
const SPEC_NUMERIC_KEYS: Array[StringName] = [
	&"pixelsPerMeter", &"chunkWidthPx", &"chunkSafetyMarginPx",
	&"runSpeedBasePxPerSec", &"runSpeedGainPerMeter", &"runSpeedMaxPxPerSec",
	&"gravityPxPerSec2", &"jumpVelocityPxPerSec", &"doubleJumpVelocityPxPerSec",
	&"coyoteTimeSeconds", &"jumpBufferSeconds", &"slideDurationSeconds",
	&"hitboxStandWidthPx", &"hitboxStandHeightPx", &"hitboxSlideHeightPx",
	&"pitWidthMinPx", &"pitWidthMaxPx", &"pitLandingBufferPx", &"reactionGapMinPx",
	&"coinValue", &"scorePerMeter", &"scorePerCoin", &"scorePerObstacleSmash",
	&"magnetDurationSeconds", &"magnetRadiusPx", &"shieldCharges",
	&"hurtInvincibleSeconds", &"dashDurationSeconds", &"dashSpeedMultiplier",
	&"powerupBoxCooldownChunks", &"deathFallPx", &"deathSlowMotionSeconds",
	&"inputLatencyBudgetFrames", &"fpsTarget", &"fpsFloor", &"sessionTargetSeconds",
	&"acceptanceDistanceMeters", &"passabilitySampleSeeds", &"saveKey",
]


static func run() -> PackedStringArray:
	var failures: PackedStringArray = []
	var meta_keys: Array = GameState.TUNING_META.keys()
	if meta_keys.size() != SPEC_NUMERIC_KEYS.size():
		failures.append("TUNING_META 键数 %d ≠ spec.numeric 键数 %d" % [
			meta_keys.size(), SPEC_NUMERIC_KEYS.size(),
		])
	for key: StringName in SPEC_NUMERIC_KEYS:
		if not GameState.TUNING_META.has(key):
			failures.append("TUNING_META 缺少 spec.numeric 键 %s" % key)
	for key: Variant in meta_keys:
		if not (key in SPEC_NUMERIC_KEYS):
			failures.append("TUNING_META 多出 spec 之外的键 %s" % key)

	# apply_tuning：已声明键生效 + max 钳制；未声明键拒绝（不在返回列表）。
	var applied: Array[StringName] = GameState.apply_tuning({
		&"runSpeedBasePxPerSec": 99999.0,
		&"magnetRadiusPx": 150.0,
		&"not_a_key": 1.0,
	})
	if not (applied.has(&"runSpeedBasePxPerSec") and applied.has(&"magnetRadiusPx")):
		failures.append("apply_tuning 未应用已声明键（applied=%s）" % [applied])
	if applied.has(&"not_a_key"):
		failures.append("apply_tuning 应拒绝未声明键 not_a_key")
	if not is_equal_approx(GameState.tuning_value(&"runSpeedBasePxPerSec"), 480.0):
		failures.append("apply_tuning 未按该键 max 钳制 runSpeedBasePxPerSec=%s（期望 480）" % [
			GameState.tuning_value(&"runSpeedBasePxPerSec"),
		])
	if not is_equal_approx(GameState.tuning_value(&"magnetRadiusPx"), 150.0):
		failures.append("apply_tuning 未写回区间内值 magnetRadiusPx=%s" % [
			GameState.tuning_value(&"magnetRadiusPx"),
		])
	# min 钳制（负向值 → min）。
	GameState.apply_tuning({&"magnetRadiusPx": -5.0})
	if not is_equal_approx(GameState.tuning_value(&"magnetRadiusPx"), 120.0):
		failures.append("apply_tuning 未按 min 钳制 magnetRadiusPx=%s" % [
			GameState.tuning_value(&"magnetRadiusPx"),
		])

	# 恢复 spec.numeric 定稿默认值（钳制后遗留值不得外泄到其它契约）。
	GameState.apply_tuning({
		&"runSpeedBasePxPerSec": GameState.RUN_SPEED_BASE_PX_PER_SEC,
		&"magnetRadiusPx": GameState.MAGNET_RADIUS_PX,
	})
	return failures
