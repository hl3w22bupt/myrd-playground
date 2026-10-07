class_name Meteor
extends Node2D
## 流星：随机出现、限时存在（转瞬即逝）、超时自动消失且不计入收集进度。
##
## 规范要点（见 SKILL.md「GDScript 规范」「反馈完备性」）：
## - 对外只发信号（expired），不持有 UI/玩家节点；收集由 Main 场景层编排；
## - 生命计时用 _physics_process 的游戏时间 delta 累加（受 time_scale 统一缩放，测试可加速）；
## - 出现即「闪现」挂一条 Juice 反馈（可感知事件），收集反馈由 Main 在结果处理函数挂。

## 流星超时消失时发出（未收集，不计入进度）；订阅方：Main。
signal expired(meteor: Meteor)

## 流星本体半径（px）：供 Main 做距离判定（收集/点击热区）。
const BODY_RADIUS: float = 16.0
## 渐隐消失时长（秒）：出现→渐隐消失的可观察阶段（验收标准 1）。
const FADE_SECONDS: float = 0.25

var _age: float = 0.0
var _collected: bool = false
var _expired: bool = false
var _fading: bool = false
var _fade_left: float = FADE_SECONDS

@onready var _body: Polygon2D = $Body


func _ready() -> void:
	# 出现反馈：流星「闪现」入场（弹跳放大 + 闪光），转瞬即逝的观感来源之一。
	scale = Vector2.ZERO
	Juice.flash(self, Color(1, 1, 1, 0.55), 0.16)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE, 0.2) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _physics_process(delta: float) -> void:
	if _collected:
		return
	_age += delta
	var life: float = GameState.meteor_lifetime
	if not _fading and life - _age <= 0.0:
		_begin_fade()
	if _fading:
		_fade_left -= delta
		modulate.a = clampf(_fade_left / FADE_SECONDS, 0.0, 1.0)
		if _fade_left <= 0.0:
			queue_free()
		return
	# 临近消失时闪烁提示（剩余寿命 < 25% 时高频明暗），强化「转瞬即逝」的紧迫感。
	var remaining := life - _age
	if remaining < life * 0.25:
		_body.self_modulate.a = 0.45 + 0.55 * absf(sin(_age * 14.0))
	else:
		_body.self_modulate.a = 1.0
	rotation += delta * 0.9


## 是否可被收集：存在期内且未进入消失流程。
func is_collectible() -> bool:
	return not _collected and not _expired


## 剩余存在时长（秒）：调用方（冒烟选目标）用它挑寿命最长的一颗，避免注入投递期间过期。
func time_left() -> float:
	return maxf(GameState.meteor_lifetime - _age, 0.0)


## 被收集（Main 在距离判定/点击命中后调用）：弹出放大 + 音效，随后移除。
func collect() -> void:
	if _collected or _expired:
		return
	_collected = true
	set_physics_process(false)
	Juice.pop(self, 1.4, 0.2)
	Juice.sfx(&"score")
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE * 1.7, 0.1)
	tween.tween_property(self, "modulate:a", 0.0, 0.12)
	tween.tween_callback(queue_free)


## 超时未收集：发出 expired（计数不变、不判负）后渐隐消失。
func _begin_fade() -> void:
	_expired = true
	_fading = true
	_fade_left = FADE_SECONDS
	expired.emit(self)
