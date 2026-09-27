class_name ScoreSettleContract
extends RefCounted
## acc-05 得分与结算契约：得分公式 = ⌊距离 m⌋×2 + 金币×10 + 碾怪×30；
## 结算页金币数与本局实际拾取数完全一致；点击「重新开始」立即开始新局（状态清零）。

var _captured: Dictionary = {"coins": -1, "score": -1, "distance": -1.0}
var _repeat_count: Dictionary = {"count": 0}


## ctx 键：flags（smoke 实测：settle_coins_shown == run_coins_actual、restart_cleared）。
static func run(flags: Dictionary = {}) -> PackedStringArray:
	return ScoreSettleContract.new()._run(flags)


func _run(flags: Dictionary) -> PackedStringArray:
	var failures: PackedStringArray = []

	# 公式验证：走公共 API 累计，断言 score 与公式一致（acc-05 数值口径）。
	GameState.start_run()
	GameState.set_distance(100.0)
	for _i: int in 5:
		GameState.add_coin()
	for _i: int in 2:
		GameState.add_smash()
	var expected: int = 100 * GameState.SCORE_PER_METER \
		+ 5 * GameState.SCORE_PER_COIN + 2 * GameState.SCORE_PER_OBSTACLE_SMASH
	if GameState.score != expected:
		failures.append("得分公式不符：distance=100 coins=5 smashes=2 → %d ≠ %d" % [
			GameState.score, expected,
		])
	# 结算页金币与实际拾取同源（run_ended 携带的 coins == GameState.coins）。
	GameState.run_ended.connect(_capture_run_ended)
	GameState.end_run(false)
	GameState.run_ended.disconnect(_capture_run_ended)
	if int(_captured["coins"]) != GameState.coins:
		failures.append("run_ended 携带金币 %d 与实际拾取 %d 不一致" % [
			int(_captured["coins"]), GameState.coins,
		])
	if int(_captured["score"]) != GameState.score:
		failures.append("run_ended 携带得分 %d 与状态得分 %d 不一致" % [
			int(_captured["score"]), GameState.score,
		])
	if not is_equal_approx(float(_captured["distance"]), GameState.distance_m):
		failures.append("run_ended 携带距离 %.1f 与状态距离 %.1f 不一致" % [
			float(_captured["distance"]), GameState.distance_m,
		])
	# 幂等：重复 end_run 不重复结算。
	GameState.run_ended.connect(_count_run_ended)
	GameState.end_run(false)
	GameState.run_ended.disconnect(_count_run_ended)
	if int(_repeat_count["count"]) != 0:
		failures.append("end_run 不幂等：已结束后再次结算仍发信号")

	# 行为证据：结算页展示金币 == 本局实际拾取；重开清零（冒烟阶段实测）。
	if not bool(flags.get("settle_coins_match", false)):
		failures.append("结算页金币与本局实际拾取数未验证一致（冒烟阶段缺证据）")
	if not bool(flags.get("restart_cleared", false)):
		failures.append("重开未清零金币/得分（「立即开始新局」缺证据）")
	return failures


func _capture_run_ended(_win: bool, score: int, coins: int, distance_m: float) -> void:
	_captured["coins"] = coins
	_captured["score"] = score
	_captured["distance"] = distance_m


func _count_run_ended(_win: bool, _score: int, _coins: int, _distance_m: float) -> void:
	_repeat_count["count"] += 1
