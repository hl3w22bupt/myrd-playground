class_name SaveContract
extends RefCounted
## acc-06 持久化契约：最高分 / 累计金币 / 最远距离写入本地存储（key=game6_save_v1），
## 「关闭再打开」（load_progress 重建状态）后不丢失。测试后恢复原存档，不污染真实进度。


static func run() -> PackedStringArray:
	var failures: PackedStringArray = []
	# 备份当前真实存档状态。
	var backup_score: int = GameState.best_score
	var backup_coins: int = GameState.total_coins
	var backup_distance: float = GameState.best_distance_m

	GameState.best_score = 4321
	GameState.total_coins = 77
	GameState.best_distance_m = 876.5
	if not GameState.save_progress():
		failures.append("save_progress() 写盘失败（user://%s.cfg）" % GameState.SAVE_KEY)
	# 模拟「关闭再打开」：直接改内存 → load_progress 重建。
	GameState.best_score = 0
	GameState.total_coins = 0
	GameState.best_distance_m = 0.0
	GameState.load_progress()
	if GameState.best_score != 4321:
		failures.append("最高分未跨会话保留：%d ≠ 4321" % GameState.best_score)
	if GameState.total_coins != 77:
		failures.append("累计金币未跨会话保留：%d ≠ 77" % GameState.total_coins)
	if not is_equal_approx(GameState.best_distance_m, 876.5):
		failures.append("最远距离未跨会话保留：%.1f ≠ 876.5" % GameState.best_distance_m)

	# end_run 结算路径也要落盘（结算页展示的最高分来自刚写入的存档）。
	GameState.run_active = true
	GameState.score = 9999
	GameState.distance_m = 1234.0
	GameState.end_run(false)
	GameState.best_score = 0
	GameState.best_distance_m = 0.0
	GameState.load_progress()
	if GameState.best_score < 9999:
		failures.append("end_run 后最高分未持久化：%d < 9999" % GameState.best_score)
	if GameState.best_distance_m < 1234.0:
		failures.append("end_run 后最远距离未持久化：%.1f < 1234" % GameState.best_distance_m)

	# 恢复备份（真实进度不被测试覆盖）。
	GameState.best_score = backup_score
	GameState.total_coins = backup_coins
	GameState.best_distance_m = backup_distance
	GameState.save_progress()
	GameState.score = 0
	GameState.coins = 0
	GameState.smashes = 0
	GameState.distance_m = 0.0
	GameState.run_active = false
	return failures
