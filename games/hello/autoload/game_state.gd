extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)

var score: int = 0


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


func reset() -> void:
	score = 0
	score_changed.emit(score)
