class_name Dart
extends Area2D
## 可收集飞镖：跑酷途中的加分拾取物。
##
## 规范要点：本节点只管自己的「外观与可收集状态」，加分由 Main 在收到
## Level.dart_collected 信号后调用 GameState.add_score（谁 emit、谁订阅，单向依赖）。
## 收集瞬间自带一条表现反馈（放大 + 淡出）—— 结果性事件必须有可感知反馈，
## 否则「拿到了但没感觉」（tests/smoke.gd 对淡出过程有断言）。

## 淡出时长（秒）：收集后飞镖先弹大再消失，期间 modulate.a < 1（冒烟断言反馈已接线）。
const POP_DURATION: float = 0.14
## 弹大目标倍数。
const POP_SCALE: float = 1.6

## 是否已被收集（收集后停用碰撞并播放消失反馈，重开时由 Level 复位）。
var collected: bool = false

## 收集反馈的补间（重开时若仍在播，先杀掉再复位，避免残留动画吞掉复位外观）。
var _pop_tween: Tween


## 收集：停用监视（set_deferred 避开物理锁帧内改状态的报错）+ 播放「弹大 → 淡出 → 隐藏」。
func collect() -> void:
	collected = true
	set_deferred("monitoring", false)
	_kill_pop_tween()
	_pop_tween = create_tween()
	_pop_tween.set_parallel(true)
	_pop_tween.tween_property(self, "scale", Vector2.ONE * POP_SCALE, POP_DURATION)
	_pop_tween.tween_property(self, "modulate:a", 0.0, POP_DURATION)
	_pop_tween.chain().tween_callback(_hide_after_pop)


## 重开复位：恢复可见、外观与监视。
func respawn() -> void:
	collected = false
	_kill_pop_tween()
	visible = true
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	scale = Vector2.ONE
	set_deferred("monitoring", true)


## 反馈播完后的收尾：隐藏节点并把外观归位（下次 respawn 不被残留状态污染）。
func _hide_after_pop() -> void:
	visible = false
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	scale = Vector2.ONE


func _kill_pop_tween() -> void:
	if _pop_tween != null and _pop_tween.is_valid():
		_pop_tween.kill()
	_pop_tween = null
