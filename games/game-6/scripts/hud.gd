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

var _powerup_label: Label
var _hint_label: Label
var _float_anchor: Control
var _distance_label: Label
var _coin_label: Label
var _score_label: Label
var _best_label: Label


func _ready() -> void:
	_distance_label = $TopBar/DistanceLabel
	_coin_label = $TopBar/CoinLabel
	_score_label = $TopBar/ScoreLabel
	_best_label = $TopBar/BestLabel
	_powerup_label = %PowerupLabel
	_hint_label = %HintLabel
	_float_anchor = %FloatAnchor
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
	var parts: PackedStringArray = []
	if player.shield_charges > 0:
		parts.append("护盾 ×%d" % player.shield_charges)
	if player.magnet_timer > 0.0:
		parts.append("磁铁 %.1fs" % player.magnet_timer)
	if player.is_dashing():
		parts.append("冲刺 %.1fs" % player.dash_timer)
	_powerup_label.text = " · ".join(parts)


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
	_powerup_label.text = ""
