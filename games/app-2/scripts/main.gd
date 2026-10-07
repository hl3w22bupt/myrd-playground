class_name GameMain
extends Node2D
## 主场景控制器：《冒烟愿晶》—— 走近或点触冒烟愿晶完成收集，集齐 3 颗即胜。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/收集按钮）只在有触摸屏时显示，桌面键盘环境完全不可见；
## - 结果性事件的反馈挂在结果处理函数上（_on_crystal_collected / _on_game_won），
##   不挂在输入处理上 —— 三条收集路径（接触/点触/confirm）汇到同一处挂反馈；
## - 胜利后收集交互全部失效（try_collect_at 与 GameState.add_score 双重拦截），仅保留重开。

@onready var player: Player = $Player
@onready var crystals: Node2D = $Crystals
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var win_ui: CanvasLayer = %WinUI
@onready var game_over_ui: CanvasLayer = %GameOverUI

var _move_hint: String = "WASD / 方向键移动 · 空格抓取愿晶"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 点触冒烟愿晶收集"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / crystal / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	if not GameState.game_lost.is_connected(_on_game_lost):
		GameState.game_lost.connect(_on_game_lost)
	for crystal in crystals.get_children():
		if crystal is Crystal:
			var node := crystal as Crystal
			if not node.collected.is_connected(_on_crystal_collected):
				node.collected.connect(_on_crystal_collected)
			if not node.expired.is_connected(_on_crystal_expired):
				node.expired.connect(_on_crystal_expired)
	_refresh_hud()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		collect_nearest_to_player()
	elif event.is_action_pressed("restart"):
		restart_game()
	elif event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			try_collect_at(touch.position)
	elif event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		if click.button_index == MOUSE_BUTTON_LEFT and click.pressed:
			try_collect_at(click.position)


## 点触收集：命中愿晶热区（直径 ≥88 逻辑像素，远超 44px 下限）即收集。
## 胜利/败局后返回 false —— 收集交互全部失效，愿晶不消失、计数不变化。
func try_collect_at(tap_pos: Vector2) -> bool:
	if GameState.is_won or GameState.is_lost:
		return false
	var best: Crystal = _nearest_crystal(tap_pos, GameState.tap_collect_radius)
	if best == null:
		return false
	return best.collect()


## confirm 便捷收集：抓取离玩家最近的一颗愿晶（桌面键位路径，次要交互）。
func collect_nearest_to_player() -> bool:
	if GameState.is_won or GameState.is_lost:
		return false
	var best: Crystal = _nearest_crystal(player.global_position, GameState.confirm_collect_radius)
	if best == null:
		return false
	return best.collect()


## 重开一局：计数清零、愿晶重置、玩家回中场、胜利画面收起。
func restart_game() -> void:
	GameState.reset()
	player.global_position = _player_spawn()
	for crystal in crystals.get_children():
		if crystal is Crystal:
			(crystal as Crystal).reset_crystal()
	win_ui.visible = false
	game_over_ui.visible = false
	_refresh_hud()
	Juice.sfx(&"confirm")


func _nearest_crystal(from: Vector2, max_distance: float) -> Crystal:
	var best: Crystal = null
	var best_distance: float = max_distance
	for crystal in _active_crystals():
		var distance: float = crystal.global_position.distance_to(from)
		if distance <= best_distance:
			best_distance = distance
			best = crystal
	return best


func _active_crystals() -> Array[Crystal]:
	var active: Array[Crystal] = []
	for child in crystals.get_children():
		var crystal := child as Crystal
		if crystal != null and not crystal.is_collected and not crystal.is_expired:
			active.append(crystal)
	return active


func _player_spawn() -> Vector2:
	return get_viewport_rect().size / 2.0


## 倒计时 HUD：流星时限逐帧变化，走 _process 刷新（文本赋值廉价，360x640 无压力）。
func _process(_delta: float) -> void:
	_refresh_hud()


func _refresh_hud() -> void:
	if GameState.is_lost:
		hud_label.text = "%s · 愿晶消散，愿望落空" % [_move_hint]
		return
	var soonest: float = _soonest_expiry_seconds()
	if soonest < INF:
		hud_label.text = "%s · 愿晶 %d/%d · 最近流星 %.1fs" % [
			_move_hint, GameState.score, GameState.WIN_THRESHOLD, soonest]
	else:
		hud_label.text = "%s · 愿晶 %d/%d" % [_move_hint, GameState.score, GameState.WIN_THRESHOLD]


## 场上最快消散的流星剩余秒数（无在野流星返回 INF，HUD 退化为纯进度显示）。
func _soonest_expiry_seconds() -> float:
	var soonest: float = INF
	for crystal in _active_crystals():
		soonest = minf(soonest, crystal.remaining)
	return soonest


func _on_player_moved(_position: Vector2) -> void:
	_refresh_hud()


## 结果性事件（收集成功）的处理函数：加分 + 反馈都挂这里，三条收集路径同源。
func _on_crystal_collected(_crystal: Crystal) -> void:
	GameState.add_score(1)
	Juice.sfx(&"collect")
	# 难度梯度：每收一颗，剩余愿晶的倒计时按 lifetime_decay 折减重置（越收集越紧）。
	if not GameState.is_won:
		for crystal in _active_crystals():
			crystal.tighten_deadline(GameState.score)


## 结果性事件（流星消散）的处理函数：交由 GameState 判负（流星全散 = 3 颗不可集齐）。
func _on_crystal_expired(_crystal: Crystal) -> void:
	GameState.lose()


## 败局：亮出失败画面与失败音效；此后收集交互全部失效，仅保留「再来一局」。
func _on_game_lost() -> void:
	game_over_ui.visible = true
	Juice.sfx(&"fail")
	Juice.flash(%LoseLabel)
	Juice.shake(3.0)


func _on_score_changed(score: int) -> void:
	_refresh_hud()
	# 结果性反馈：计数弹跳 + 收集音效（_on_crystal_collected 已放音效，这里只做 UI 弹跳）。
	if score > 0:
		Juice.pop(hud_label)


func _on_game_won(_score: int) -> void:
	# 胜利状态：亮出胜利画面与胜利音效；此后收集交互全部失效，仅保留「再来一局」。
	win_ui.visible = true
	Juice.sfx(&"win")
	Juice.shake(4.0)
