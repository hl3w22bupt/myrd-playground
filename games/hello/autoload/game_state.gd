extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（《hello》收集计数 + 胜负判定）。
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
## 收集目标全部达成（一局胜利）时发出；订阅方（Main）展示胜利文案与重开提示。
signal game_won(score: int)

## 数值调参集中区（对应需求「单局短平快」：一局收集 4 件即胜）。
const WIN_SCORE: int = 4

var score: int = 0
var won: bool = false


## 收集到物品时由场景层调用；达到 WIN_SCORE 触发一次胜利（won 后不再累计）。
func add_score(amount: int) -> void:
	if won:
		return
	score += amount
	score_changed.emit(score)
	if score >= WIN_SCORE:
		won = true
		game_won.emit(score)


## 重开一局：清零计数与胜负标记，并广播初始分数（场景层据此复活收集物）。
func reset() -> void:
	score = 0
	won = false
	score_changed.emit(score)
