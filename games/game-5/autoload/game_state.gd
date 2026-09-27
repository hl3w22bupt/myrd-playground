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
## 金水果：固定高分（不吃连击加成，但仍刷新连击窗口并计入水果数）。
var golden_points: int = 50
## 坏水果：固定扣分（下限 0）；不计水果数、不动连击状态机。
var bad_penalty: int = 15
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
## Web 端 localStorage 镜像键（用户反馈口径「localStorage 最佳成绩」；
## user:// 在 Web 落 IndexedDB，镜像到 localStorage 双保险，两处取 max）。
const LOCAL_STORAGE_KEY: String = "game-5-best"

var score: int = 0
var fruits_collected: int = 0
var combo_count: int = 0
var combo_window_left: float = 0.0
var best_score: int = 0
## 坏水果减速剩余时间；> 0 期间 Player 移速 × SLOW_FACTOR。Player 只读这里，不各自计时。
var slow_left: float = 0.0

## ── 数值调参区（SKILL.md §3C 调参工作台的对接面）──
## 默认值 = 知识 6e91a11d §一/§四 的建议基线；试玩调参经 apply_tuning 覆盖，
## 定稿回写 spec 后更新这里。需求硬性口径（60s / +10 / +5 / 2~4s 间隔）不进调参区。
var player_speed: float = 240.0
var log_speed_start: float = 120.0
var log_speed_end_factor: float = 1.8

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
const TUNING_META: Dictionary = {
	&"player_speed": {"min": 120.0, "max": 480.0, "step": 10.0},
	&"log_speed_start": {"min": 60.0, "max": 300.0, "step": 10.0},
	&"log_speed_end_factor": {"min": 1.0, "max": 3.0, "step": 0.1},
	&"golden_points": {"min": 20.0, "max": 100.0, "step": 5.0},
	&"bad_penalty": {"min": 5.0, "max": 40.0, "step": 5.0},
}

var _loaded: bool = false


func _ready() -> void:
	_apply_web_tuning()
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


## 金水果收集（固定 golden_points 高分，不吃连击加成）：
## 同样是「一次成功收集」—— 计入水果数、刷新连击窗口（连击数 +1，与普通水果同口径）。
func add_golden_score() -> int:
	if combo_window_left > 0.0:
		combo_count += 1
	else:
		combo_count = 1
	combo_window_left = COMBO_WINDOW
	var gained: int = golden_points
	score += gained
	fruits_collected += 1
	score_changed.emit(score)
	fruits_changed.emit(fruits_collected)
	combo_changed.emit(combo_count, combo_window_left)
	return gained


## 坏水果惩罚：扣 bad_penalty 分（下限 0）。不计水果数、不动连击状态机
##（连击只按「成功收集」锚定，坏水果不是收集 —— 清零口径仍归窗口超时/终局）。
func apply_bad_fruit() -> int:
	var penalty: int = mini(bad_penalty, score)
	score -= penalty
	score_changed.emit(score)
	return penalty


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
	# Web 端 localStorage 镜像：与 user://（IndexedDB）两处取 max，任一幸存即可恢复。
	var mirrored := _read_local_storage_best()
	if mirrored > best_score:
		best_score = mirrored


func save_best_score() -> void:
	var config := ConfigFile.new()
	config.set_value("record", "best_score", best_score)
	config.save(SAVE_PATH)
	_write_local_storage_best(best_score)


## ── localStorage 镜像（Web 专用；桌面/无头环境 JavaScriptBridge.eval 恒 null，自动跳过）──
## JavaScriptBridge 单例在桌面二进制也存在但 eval 不可用 —— 判空而非只判注册；
## 经 Engine.get_singleton 动态取用，不做编译期平台引用。任何异常按「无镜像」处理。

func _read_local_storage_best() -> int:
	if not Engine.has_singleton("JavaScriptBridge"):
		return 0
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval",
		"parseInt(localStorage.getItem('%s') || '0', 10) || 0" % LOCAL_STORAGE_KEY)
	if result == null:
		return 0
	return maxi(int(str(result).to_int()), 0)


func _write_local_storage_best(value: int) -> void:
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	bridge.call("eval", "try{localStorage.setItem('%s','%d')}catch(e){}" % [LOCAL_STORAGE_KEY, value])


## 冒烟断言用：从磁盘重读最高分（等价「重启实例后再读取」，验收 5 的无头代理）。
func reload_best_score_from_disk() -> int:
	load_best_score()
	return best_score


## 应用调参覆盖（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口）：
## 只认 TUNING_META 声明的键、按 min/max 钳制；返回实际生效的键名列表。
func apply_tuning(overrides: Dictionary) -> PackedStringArray:
	var applied := PackedStringArray()
	for key: String in overrides:
		var meta: Dictionary = TUNING_META.get(StringName(key), {})
		if meta.is_empty() or get(key) == null:
			continue
		var raw: Variant = overrides[key]
		if not (raw is float or raw is int):
			continue
		set(key, clampf(float(raw), meta["min"], meta["max"]))
		applied.append(key)
	return applied


## Web 调参桥读入：壳页面在引擎加载前把 URL ?tuning=<JSON> 解析到 window.__GAME_TUNING__，
## 这里在启动时应用。桌面/无头环境桥不工作（eval 返回 null），自动跳过（冒烟不受影响）。
## 注意：JavaScriptBridge 单例在桌面二进制也存在但 eval 恒为 null —— 判空而非只判注册；
## 经 Engine.get_singleton 动态取用，不做编译期平台引用。
func _apply_web_tuning() -> void:
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", "JSON.stringify(window.__GAME_TUNING__ || null)")
	if result == null:
		return
	var raw := str(result)
	if raw.is_empty() or raw == "null":
		return
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary:
		apply_tuning(parsed)
