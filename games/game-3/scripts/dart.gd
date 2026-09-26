class_name Dart
extends Area2D
## 可收集飞镖：跑酷途中的加分拾取物。
##
## 规范要点：本节点只管自己的「外观与可收集状态」，加分由 Main 在收到
## Level.dart_collected 信号后调用 GameState.add_score（谁 emit、谁订阅，单向依赖）。

## 是否已被收集（收集后隐藏并停用碰撞，重开时由 Level 复位）。
var collected: bool = false


## 收集：隐藏 + 关闭监视（set_deferred 避开物理锁帧内改状态的报错）。
func collect() -> void:
	collected = true
	visible = false
	set_deferred("monitoring", false)


## 重开复位：恢复可见与监视。
func respawn() -> void:
	collected = false
	visible = true
	set_deferred("monitoring", true)
