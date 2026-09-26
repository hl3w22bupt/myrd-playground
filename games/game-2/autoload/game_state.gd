extends Node
## 自动加载单例（autoload，注册名 GameState）：跨场景共享的全局状态与玩法状态机。
##
## 数值口径（需求文档）：
## - 收集星尘 +score_per_crystal（配置）；撞陨石 -damage_per_hit（配置）；
## - 初始护盾 initial_shield（配置，默认 3），归 0 瞬间结算并弹出面板；
## - 历史最高分跨局持久化（user:// 在 Web 导出下映射到 IndexedDB，刷新后仍在）。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 不声明 class_name（避免与单例名冲突，preflight P4）。

## 分数变化：场景层订阅刷新 HUD。
signal score_changed(score: int)
## 护盾变化：场景层订阅刷新 HUD / 播放受击反馈。
signal shield_changed(shield: int)
## 护盾归 0：场景层订阅弹出结算面板。
signal game_over(score: int, high_score: int)
## 重开完成：场景层订阅重置战场。
signal game_restarted()

## 历史最高分持久化文件。
const SAVE_PATH: String = "user://stardust_save.cfg"

var score: int = 0
var shield: int = 3
var high_score: int = 0
var is_game_over: bool = false


func _ready() -> void:
	_load_high_score()
	shield = GameConfig.initial_shield


## 收集星尘加分；本局已结算后忽略，实时抬高历史最高分。
func add_score(amount: int) -> void:
	if is_game_over or amount == 0:
		return
	score += amount
	if score > high_score:
		high_score = score
	score_changed.emit(score)


## 撞上陨石扣盾（受击唯一入口：无敌帧在 Player 侧把关，这里只负责数值与结算）。
func apply_hit() -> void:
	if is_game_over:
		return
	shield = maxi(shield - GameConfig.damage_per_hit, 0)
	shield_changed.emit(shield)
	if shield <= 0:
		_finish_game()


## 重开：分数归 0、护盾恢复初始值、退出结算态（需求验收标准 4）。
func start_game() -> void:
	score = 0
	shield = GameConfig.initial_shield
	is_game_over = false
	score_changed.emit(score)
	shield_changed.emit(shield)
	game_restarted.emit()


func _finish_game() -> void:
	is_game_over = true
	_save_high_score()
	game_over.emit(score, high_score)


func _save_high_score() -> void:
	var config := ConfigFile.new()
	config.set_value("stardust", "high_score", high_score)
	config.save(SAVE_PATH)


func _load_high_score() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) == OK:
		high_score = config.get_value("stardust", "high_score", 0)


## 暴露给冒烟/QA：最高分存档是否已落盘（「刷新后仍在」的可判定形态）。
func has_high_score_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)
