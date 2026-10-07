class_name Crystal
extends Area2D
## 冒烟愿晶：一颗持续冒烟、发光脉动的可收集愿晶。
##
## 规范要点（见 SKILL.md「场景规范」「反馈完备性（Juice）」）：
## - 收集入口唯一：collect()。已收集后重复调用直接返回 false（不重复计数）；
## - 对外只发 collected 信号，由 Main 订阅后加分/挂反馈 —— 本脚本不碰 UI、不碰 GameState；
## - 接触收集走 body_entered（Area2D 物理路径），点选收集由 Main 调 collect()，两路同源。

## 收集成功时发出；Main 订阅它统一走「结果事件处理函数」挂反馈。
signal collected(crystal: Crystal)

## 已收集的愿晶不再响应任何收集（含重复点击/二次接触）。
var is_collected: bool = false

var _pulse_time: float = 0.0

@onready var glow: Polygon2D = $Glow


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if is_collected:
		return
	# 冒烟粒子持续发射（Smoke 在场景里配置），发光体做缓慢脉动提示可点。
	_pulse_time += delta
	var pulse := 1.0 + 0.1 * sin(_pulse_time * TAU * 0.8)
	glow.scale = Vector2(pulse, pulse)


## 收集这颗愿晶：返回是否真的发生了收集（重复收集返回 false，不重复计数）。
func collect() -> bool:
	if is_collected:
		return false
	is_collected = true
	visible = false
	# 物理回调内改监控状态必须 deferred，避免「flushing queries」报错。
	set_deferred("monitoring", false)
	set_deferred("monitorable", false)
	collected.emit(self)
	return true


## 重开一局：恢复可收集状态（Main 在 restart 时对每颗愿晶调用）。
func reset_crystal() -> void:
	is_collected = false
	visible = true
	set_deferred("monitoring", true)
	set_deferred("monitorable", true)
	_pulse_time = 0.0


## 接触收集：捕愿人（Player）走进热区即收集成功。
func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		collect()
