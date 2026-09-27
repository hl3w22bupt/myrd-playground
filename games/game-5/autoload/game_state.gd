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
signal slow_changed(slow_left: float)

## 连击窗口：以「每次收集成功」为锚点刷新（窗口刷新式，不是固定总窗）。
const COMBO_WINDOW: float = 3.0
## 基础得分：普通水果 +10；窗口内每追加 1 个额外 +5（连击数 - 1，下限 0）。
## 金水果走同一条 add_score 入口，只是基础分不同（+50）—— 连击加成同等生效。
const BASE_POINTS: int = 10
const COMBO_BONUS: int = 5
## 单局时长（需求硬性：60 秒倒计时）。全局唯一事实源，Main / LogSpawner / HUD 都引用这里。
const MATCH_SECONDS: float = 60.0

## 坏水果惩罚：扣分（分数下限 0，不出负分）+ 短暂减速（迭代反馈：金水果高分 / 坏水果扣分或减速）。
const BAD_FRUIT_PENALTY: int = 15
const SLOW_DURATION: float = 2.5
const SLOW_FACTOR: float = 0.5

## 历史最高分存档（user:// 跨刷新持久化，验收 5）。
## Web 端 user:// 由引擎落 IndexedDB；另镜像一份到浏览器 localStorage（同步写，
## 防止 Web 导出 IDBFS 在标签页被直接杀掉时丢档），两处互为兜底。
const SAVE_PATH: String = "user://game_5_save.cfg"
const LOCAL_STORAGE_KEY: String = "game5_best_score"

var score: int = 0
var fruits_collected: int = 0
var combo_count: int = 0
var combo_window_left: float = 0.0
var best_score: int = 0
## 坏水果减速剩余时间；> 0 期间 Player 移速 × SLOW_FACTOR。Player 只读这里，不各自计时。
var slow_left: float = 0.0

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
	if slow_left > 0.0:
		slow_left = maxf(slow_left - delta, 0.0)
		slow_changed.emit(slow_left)


## 唯一计分入口：收集一个好水果。返回本笔实际得分（+10 / 连击中 +15、+20…；
## 金水果基础分 50，连击加成同等生效 —— 计分收口在本函数，UI 层禁止各自算分）。
func add_score(base_points: int = BASE_POINTS) -> int:
	if combo_window_left > 0.0:
		combo_count += 1
	else:
		combo_count = 1
	combo_window_left = COMBO_WINDOW
	var gained: int = base_points + COMBO_BONUS * (combo_count - 1)
	score += gained
	fruits_collected += 1
	score_changed.emit(score)
	fruits_changed.emit(fruits_collected)
	combo_changed.emit(combo_count, combo_window_left)
	return gained


## 坏水果：扣分（下限 0）+ 减速 debuff。不进连击、不清连击、不计入水果数 ——
## 惩罚与奖励是两条独立路径，避免「吃坏果续连击」的套利空间。
func apply_penalty() -> int:
	var lost: int = mini(score, BAD_FRUIT_PENALTY)
	score -= lost
	slow_left = SLOW_DURATION
	score_changed.emit(score)
	slow_changed.emit(slow_left)
	return lost


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
	slow_left = 0.0
	score_changed.emit(score)
	fruits_changed.emit(fruits_collected)
	combo_changed.emit(combo_count, combo_window_left)
	slow_changed.emit(slow_left)


func load_best_score() -> void:
	_loaded = true
	if FileAccess.file_exists(SAVE_PATH):
		var config := ConfigFile.new()
		if config.load(SAVE_PATH) == OK:
			best_score = int(config.get_value("record", "best_score", 0))
			return
	# user:// 存档缺失时兜底读浏览器 localStorage（Web 端标签页直杀后的恢复路径）。
	var mirrored: Variant = _web_storage_get(LOCAL_STORAGE_KEY)
	if mirrored != null:
		best_score = maxi(best_score, str(mirrored).to_int())


func save_best_score() -> void:
	var config := ConfigFile.new()
	config.set_value("record", "best_score", best_score)
	config.save(SAVE_PATH)
	_web_storage_set(LOCAL_STORAGE_KEY, best_score)


## ── Web localStorage 镜像（仅 Web 生效；桌面 headless 空转，JavaScriptBridge 调用安全）──

func _web_storage_get(key: String) -> Variant:
	if not OS.has_feature("web"):
		return null
	return JavaScriptBridge.eval("window.localStorage.getItem(%s)" % JSON.stringify(key))


func _web_storage_set(key: String, value: int) -> void:
	if not OS.has_feature("web"):
		return
	JavaScriptBridge.eval(
		"window.localStorage.setItem(%s, %d)" % [JSON.stringify(key), value])


## 冒烟断言用：从磁盘重读最高分（等价「重启实例后再读取」，验收 5 的无头代理）。
func reload_best_score_from_disk() -> int:
	load_best_score()
	return best_score
