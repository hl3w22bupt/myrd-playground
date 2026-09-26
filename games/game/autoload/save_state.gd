extends Node
## 自动加载单例 SaveState：分数与对局进度的本地持久化（M1 打回项「阻塞#3」落点）。
##
## 注册方式：project.godot 的 [autoload] 段写 `SaveState="*res://autoload/save_state.gd"`。
## 职责边界（对齐 audio_manager.gd 的单例纪律）：
## - 只做「存档读写 + 快照保持」，不持有任何场景节点、不订阅游戏信号；
##   进度由 GameState 在结算/加分的同一调用栈内主动上报（同 tick 落档，无延迟帧）。
## - user:// 在 Web 导出下映射到 IndexedDB（同 audio_manager.gd SETTINGS_PATH 的口径），
##   浏览器「刷新后分数仍在」即由本文件保证；桌面/headless 映射到用户数据目录。
##
## 存档内容（schema 1，两块）：
##   best_score —— 历史最高单局分数（跨局累积，永不因重开丢失）；
##   run        —— 可续局的进度快照（level/score/moves_left/target_score）；
##                 胜利过关 / 失败 / 主动重开都会清掉它，只有「局中离开」留下。

## 存档文件位置（JSON 明文，人工可读可审计）。
const SAVE_PATH: String = "user://pixel-fives-save.json"
## 存档结构版本：字段增删时 +1，读档时对旧版本做缺省补齐（向后兼容）。
const SCHEMA_VERSION: int = 1

## 历史最高分（load 后即为已恢复值；record_settlement 内刷新并落盘）。
var best_score: int = 0
## 可续局快照：{"level":int,"score":int,"moves_left":int,"target_score":int}；空字典 = 无局可续。
## 只在内存里保持「本次启动是否已提供过续玩」的语义由 consume_resume_offer 承担。
var run_snapshot: Dictionary = {}


func _ready() -> void:
	_load_from_disk()


## 对局进行中的进度上报（GameState.add_score / use_move / advance_level 的结算栈内调用）。
## 同步写盘：单局步进频率约 1 次/秒，量级远低于任何掉帧顾虑；换来「任何时刻刷新都不丢进度」。
func record_progress(level: int, score: int, moves_left: int, target_score: int) -> void:
	run_snapshot = {
		"level": level,
		"score": score,
		"moves_left": moves_left,
		"target_score": target_score,
	}
	_write_to_disk()


## 局末结算上报：刷新 best_score（跨局保留）；失败局清快照（没有「续玩一局已输的局」）。
## 胜利局不清 —— 快照会被 advance_level 的新进度立即覆盖，中途离开可从新关卡续玩。
func record_settlement(final_score: int, won: bool) -> void:
	if final_score > best_score:
		best_score = final_score
	if not won:
		run_snapshot = {}
	_write_to_disk()


## 清除可续局快照（主动重开 / 测试复位用）；best_score 保留（历史成绩不属于任何一局）。
func clear_run() -> void:
	if run_snapshot.is_empty():
		return
	run_snapshot = {}
	_write_to_disk()


## 取走续玩快照（启动时的三态之一 RESUME 的数据源）：取走后本侧清引用，
## 保证「继续 / 新开」两条路只会被提供一次，行为可预测。
func consume_resume_offer() -> Dictionary:
	var offer: Dictionary = run_snapshot.duplicate(true)
	run_snapshot = {}
	return offer


## 测试与「新的一局」的硬复位：内存 + 磁盘全部归零（best_score 一并清空，仅测试用）。
func wipe() -> void:
	best_score = 0
	run_snapshot = {}
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))


## 读档：文件缺失 / 损坏 / 版本未知时按「无存档」处理（静默降级，不阻塞开局）。
func _load_from_disk() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var data: Dictionary = parsed
	if int(data.get("schema", -1)) != SCHEMA_VERSION:
		return
	best_score = maxi(int(data.get("best_score", 0)), 0)
	var run: Variant = data.get("run", {})
	if typeof(run) == TYPE_DICTIONARY and not (run as Dictionary).is_empty():
		var snapshot: Dictionary = run
		# 字段缺一即弃用该快照（半截存档不可信，宁可不提供续玩也不恢复出错误状态）。
		var required: Array[String] = ["level", "score", "moves_left", "target_score"]
		for key in required:
			if not snapshot.has(key):
				return
		run_snapshot = snapshot


## 写盘：JSON 序列化整档；写失败（宿主盘满 / 隐私模式）静默返回，不打断对局。
func _write_to_disk() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	var payload: Dictionary = {
		"schema": SCHEMA_VERSION,
		"best_score": best_score,
		"run": run_snapshot,
	}
	file.store_string(JSON.stringify(payload, "  "))
	file.close()
