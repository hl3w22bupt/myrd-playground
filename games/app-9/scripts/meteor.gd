class_name Meteor
extends Node2D
## 流星：短时间窗口出现的可收集目标（需求口径：单次出现仅持续一个可配置短窗口，
## 默认 2 秒；窗口结束流星消失且不可再点击；窗口期内点击/脉冲收集成功）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 全工程唯一（Meteor），文件名与类职责一致；
## - 窗口时长只读 GameState 调参区（meteor_window_seconds），禁止散落魔数；
## - 对外只发信号（collected / expired），由主场景订阅处理 —— 流星不操作 UI、不改全局状态。

## 收集成功信号：主场景订阅后挂反馈（pop + 音效）并给 GameState 计数。
signal collected(meteor: Meteor)
## 窗口结束信号：流星消失（不可再点击）；主场景订阅用于簿记。
signal expired(meteor: Meteor)

## 点击命中半径（像素）：移动端手指命中的宽松判定（“点击流星”的容差）。
const CLICK_RADIUS: float = 56.0
## 星体本体半径（像素）：视觉尺寸基准。
const BODY_RADIUS: float = 14.0
## 过期消失动画时长（秒）：淡出期间已不可点击（active 立即置假）。
const FADE_SECONDS: float = 0.22

## 窗口剩余时长（秒）：≤0 即过期。冒烟用例断言它逐帧递减（窗口机制可判定）。
var window_left: float = 0.0
## 是否仍在窗口期内（可点击/可脉冲收集）。过期或被收集后立即置假。
var active: bool = false

## 呼吸高亮相位：流星出现提示（视觉高亮）——窗口越接近结束闪烁越急。
var _phase: float = 0.0
var _glow: Polygon2D
var _star: Polygon2D


func _ready() -> void:
	window_left = GameState.meteor_window_seconds
	active = true
	_glow = get_node("Glow") as Polygon2D
	_star = get_node("Star") as Polygon2D
	# 出现提示（SKILL.md §3B：结果性事件挂反馈；流星出现是可感知事件）：
	# 弹跳放大 + 高亮闪白 + 专属音效，保证玩家能在短窗口内注意到它。
	scale = Vector2(0.2, 0.2)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE, 0.24) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Juice.pop(self)
	Juice.sfx(&"spawn")


func _process(delta: float) -> void:
	if not active:
		return
	# 短窗口倒计时：窗口结束流星消失且不可再点击（需求验收第 1 条的可判定载体）。
	window_left -= delta
	if window_left <= 0.0:
		expire()
		return
	# 呼吸高亮：临期闪烁加速，提示窗口将尽（4Hz 起步，临期 8Hz）。
	_phase += delta * (4.0 + 4.0 * (1.0 - clampf(window_left / GameState.meteor_window_seconds, 0.0, 1.0)))
	var pulse: float = 0.55 + 0.45 * absf(sin(_phase * PI))
	if _glow != null:
		_glow.modulate.a = 0.25 + 0.55 * pulse
	if _star != null:
		_star.rotation += delta * 1.5


## 点击命中判定：仅窗口期内生效（active=false 一律 miss —— 「窗口外点击不产生收集效果」）。
func contains_point(world_pos: Vector2) -> bool:
	return active and world_pos.distance_to(global_position) <= CLICK_RADIUS


## 祈愿脉冲命中判定：confirm 以玩家为圆心、pulse_radius 为半径的收集路径。
func within_pulse(player_pos: Vector2, radius: float) -> bool:
	return active and player_pos.distance_to(global_position) <= radius


## 收集成功：立即失效（防同帧双收）→ 发信号 → 播放消失动画后自毁。
func collect() -> void:
	if not active:
		return
	active = false
	collected.emit(self)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2(1.6, 1.6), FADE_SECONDS) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(self, "modulate:a", 0.0, FADE_SECONDS)
	tween.tween_callback(queue_free)


## 窗口结束：立即失效 → 发信号 → 缩小淡出后自毁（未被收集不计失败，安静离场）。
func expire() -> void:
	if not active:
		return
	active = false
	window_left = 0.0
	expired.emit(self)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2(0.1, 0.1), FADE_SECONDS) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(self, "modulate:a", 0.0, FADE_SECONDS)
	tween.tween_callback(queue_free)
