class_name Hud
extends CanvasLayer
## 局内 HUD（spec entity: hud）：距离/金币/得分/最高分实时显示、道具剩余时间、
## 得分飘字挂点（spec fx：金币 +10 飘字等）。独立 CanvasLayer，订阅 GameState 信号。

## 飘字上浮时长（秒）与高度（px）。
const FLOAT_DURATION: float = 0.9
const FLOAT_RISE_PX: float = 56.0

## 飘字样式：反馈种类 → 文案与颜色。
const FLOAT_STYLES: Dictionary = {
	&"coin": {"text": "+%d", "color": Color(0.78, 0.55, 0.05)},
	&"powerup_magnet": {"text": "磁铁！", "color": Color(0.9, 0.3, 0.35)},
	&"powerup_shield": {"text": "护盾！", "color": Color(0.25, 0.6, 1.0)},
	&"powerup_dash": {"text": "冲刺！", "color": Color(0.95, 0.7, 0.1)},
	&"smash": {"text": "+%d 碾怪", "color": Color(1.0, 0.45, 0.3)},
	&"smash_air": {"text": "咚！", "color": Color(1.0, 0.55, 0.35)},
	&"shield_break": {"text": "护盾破碎", "color": Color(0.5, 0.75, 1.0)},
	&"death": {"text": "啊！", "color": Color(0.6, 0.6, 0.65)},
}

## 世界坐标 → 屏幕坐标的换算基准（相机中心 ≈ 玩家 x、固定 y 偏移）。
var camera: Camera2D = null

var _hint_label: Label
var _float_anchor: Control
var _distance_label: Label
var _coin_label: Label
var _score_label: Label
var _best_label: Label
## 道具槽位表：kind → {panel, timer, lit}（拾取点亮 / 倒计时 / 归零熄灭，迭代需求 ①）。
var _powerup_slots: Dictionary = {}


func _ready() -> void:
	_distance_label = $TopBar/DistanceLabel
	_coin_label = $TopBar/CoinLabel
	_score_label = $TopBar/ScoreLabel
	_best_label = $TopBar/BestLabel
	_hint_label = %HintLabel
	_float_anchor = %FloatAnchor
	_build_powerup_bar()
	GameState.score_changed.connect(_on_score_changed)
	GameState.coins_changed.connect(_on_coins_changed)
	GameState.feedback.connect(_on_feedback)
	GameState.run_ended.connect(_on_run_ended)
	refresh_best()


func _process(_delta: float) -> void:
	_distance_label.text = "距离 %dm" % int(GameState.distance_m)
	_update_powerup_label()


## 底部操作提示按输入设备切换（SKILL §3A-5）。
func set_move_hint(text: String) -> void:
	_hint_label.text = text


func refresh_best() -> void:
	_best_label.text = "最高分 %d · 累计金币 %d · 最远 %dm" % [
		GameState.best_score, GameState.total_coins, int(GameState.best_distance_m),
	]


func _update_powerup_label() -> void:
	var player: Player = get_tree().get_first_node_in_group(&"player") as Player
	if player == null:
		return
	_set_slot_state(&"magnet", player.magnet_timer > 0.0, "%.1fs" % player.magnet_timer)
	_set_slot_state(&"dash", player.is_dashing(), "%.1fs" % player.dash_timer)
	var shield_active: bool = player.shield_charges > 0
	_set_slot_state(&"shield", shield_active,
		"×%d" % player.shield_charges if shield_active else "")


## kind 槽位当前是否点亮（冒烟断言「拾取瞬间 HUD 图标点亮 / 归零熄灭」用）。
func is_powerup_lit(kind: StringName) -> bool:
	var slot: Dictionary = _powerup_slots.get(kind, {})
	return bool(slot.get("lit", false))


## 拼装三个道具槽位（代码构建：圆角面板 + 图标字 + 倒计时字，色系与道具一致）。
func _build_powerup_bar() -> void:
	var bar: HBoxContainer = %PowerupBar
	var kinds: Array[StringName] = [&"magnet", &"shield", &"dash"]
	for kind: StringName in kinds:
		var style: Dictionary = PickupBox.KIND_STYLE[kind]
		var panel := Panel.new()
		panel.custom_minimum_size = Vector2(92.0, 40.0)
		var box := StyleBoxFlat.new()
		box.bg_color = Color(style["color"].r, style["color"].g, style["color"].b, 0.22)
		box.border_color = style["color"]
		box.set_border_width_all(2)
		box.set_corner_radius_all(10)
		panel.add_theme_stylebox_override("panel", box)
		bar.add_child(panel)
		var glyph := Label.new()
		glyph.text = String(style["glyph"])
		glyph.add_theme_font_size_override("font_size", 20)
		glyph.add_theme_color_override("font_color", style["color"])
		glyph.position = Vector2(10.0, 8.0)
		panel.add_child(glyph)
		var timer_label := Label.new()
		timer_label.text = ""
		timer_label.add_theme_font_size_override("font_size", 15)
		timer_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.95))
		timer_label.position = Vector2(40.0, 11.0)
		panel.add_child(timer_label)
		_powerup_slots[kind] = {"panel": panel, "timer": timer_label, "box": box, "lit": false}


## 槽位状态机：点亮 = 满透明度 + 倒计时字；熄灭 = 暗淡 + 清空。
## 熄→亮瞬间做一次弹跳（拾取「图标点亮」的肉眼反馈）。
func _set_slot_state(kind: StringName, lit: bool, countdown_text: String) -> void:
	var slot: Dictionary = _powerup_slots.get(kind, {})
	if slot.is_empty():
		return
	var panel: Panel = slot["panel"]
	var timer_label: Label = slot["timer"]
	var was_lit: bool = bool(slot["lit"])
	if lit != was_lit:
		slot["lit"] = lit
		panel.modulate = Color(1, 1, 1, 1.0) if lit else Color(1, 1, 1, 0.32)
		if lit:
			panel.pivot_offset = panel.custom_minimum_size / 2.0
			var tween := panel.create_tween()
			tween.tween_property(panel, "scale", Vector2.ONE * 1.18, 0.1)
			tween.tween_property(panel, "scale", Vector2.ONE, 0.16)
	elif not lit:
		panel.modulate = Color(1, 1, 1, 0.32)
	timer_label.text = countdown_text if lit else ""


## 结果性反馈统一入口：飘字（spec fx：金色圈扩散 + 飘字 +10）。
func _on_feedback(kind: StringName, world_position: Vector2) -> void:
	var style: Dictionary = FLOAT_STYLES.get(kind, {"text": "+", "color": Color(1, 1, 1)})
	var label := Label.new()
	var text_template: String = style["text"]
	if text_template.contains("%d"):
		var amount: int = GameState.tuning_value(&"scorePerCoin") if kind == &"coin" \
			else GameState.tuning_value(&"scorePerObstacleSmash")
		label.text = text_template % amount
	else:
		label.text = text_template
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", style["color"])
	label.position = _world_to_screen(world_position) + Vector2(-24.0, -60.0)
	label.z_index = 20
	_float_anchor.add_child(label)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - FLOAT_RISE_PX, FLOAT_DURATION)
	tween.tween_property(label, "modulate:a", 0.0, FLOAT_DURATION).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(label.queue_free)


## 世界 → HUD 屏幕：相机有效位置取「玩家 x + 前视偏移、固定 y」，与 player.tscn 相机一致。
func _world_to_screen(world_position: Vector2) -> Vector2:
	if camera != null:
		return world_position - (camera.get_screen_center_position() - Vector2(480.0, 270.0))
	return world_position


func _on_score_changed(score: int) -> void:
	_score_label.text = "得分 %d" % score


func _on_coins_changed(coins: int) -> void:
	_coin_label.text = "金币 %d" % coins


func _on_run_ended(_win: bool, _score: int, _coins: int, _distance_m: float) -> void:
	refresh_best()
	for kind: StringName in [&"magnet", &"shield", &"dash"]:
		_set_slot_state(kind, false, "")
