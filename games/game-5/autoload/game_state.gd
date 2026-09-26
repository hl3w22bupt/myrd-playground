extends Node
## 计分唯一入口（autoload GameState）：分数 / 水果数 / 连击状态机 / 历史最高分持久化。
##
## 规范（知识 6e91a11d §三）：所有得分变更必须走 add_score() 同一条路径；连击状态机
## （窗口计时、连击数、清零条件）收口在本文件，UI 层禁止各自算分。
## 信号签名 score_changed(score: int) 是模板协议 —— playtest/smoke 门禁按单参连接，不得改参。

signal score_changed(score: int)
signal fruits_changed(count: int)
signal combo_changed(combo: int, window_left: float)
signal best_changed(best: int)

## 连击窗口：以「每次收集成功」为锚点刷新（窗口刷新式，不是固定总窗）。
const COMBO_WINDOW: float = 3.0
## 基础得分：每个水果 +10；窗口内每追加 1 个额外 +5（连击数 - 1，下限 0）。
const BASE_POINTS: int = 10
const COMBO_BONUS: int = 5
## 单局时长（需求硬性：60 秒倒计时）。全局唯一事实源，Main / LogSpawner / HUD 都引用这里。
const MATCH_SECONDS: float = 60.0

## 历史最高分存档（user:// 跨刷新持久化，验收 5）。
const SAVE_PATH: String = "user://game_5_save.cfg"

var score: int = 0
var fruits_collected: int = 0
var combo_count: int = 0
var combo_window_left: float = 0.0
var best_score: int = 0

var _loaded: bool = false


func _ready() -> void:
	load_best_score()


func _process(delta: float) -> void:
	# 连击窗口逐帧衰减；到 0 清零并广播一次（UI 环形倒计时据此回零）。
	if combo_count > 0:
		combo_window_left = maxf(combo_window_left - delta, 0.0)
		if combo_window_left <= 0.0:
			combo_count = 0
			combo_changed.emit(combo_count, combo_window_left)


## 唯一计分入口：收集一个水果。返回本笔实际得分（+10 / 连击中 +15、+20…）。
func add_score() -> int:
	if combo_window_left > 0.0:
		combo_count += 1
	else:
		combo_count = 1
	combo_window_left = COMBO_WINDOW
	var gained: int = BASE_POINTS + COMBO_BONUS * (combo_count - 1)
	score += gained
	fruits_collected += 1
	score_changed.emit(score)
	fruits_changed.emit(fruits_collected)
	combo_changed.emit(combo_count, combo_window_left)
	return gained


## 结算时提交本局得分：仅在新分数 > 历史最高时覆写（知识 6e91a11d §六）。
func submit_final_score(final_score: int) -> void:
	if final_score > best_score:
		best_score = final_score
		save_best_score()
	best_changed.emit(best_score)


## 重开新局：清零局内状态（历史最高分保留）。
func reset() -> void:
	score = 0
	fruits_collected = 0
	combo_count = 0
	combo_window_left = 0.0
	score_changed.emit(score)
	fruits_changed.emit(fruits_collected)
	combo_changed.emit(combo_count, combo_window_left)


func load_best_score() -> void:
	_loaded = true
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) != OK:
		return
	best_score = int(config.get_value("record", "best_score", 0))


func save_best_score() -> void:
	var config := ConfigFile.new()
	config.set_value("record", "best_score", best_score)
	config.save(SAVE_PATH)


## 冒烟断言用：从磁盘重读最高分（等价「重启实例后再读取」，验收 5 的无头代理）。
func reload_best_score_from_disk() -> int:
	load_best_score()
	return best_score
