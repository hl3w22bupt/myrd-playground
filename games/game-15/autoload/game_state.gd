extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（分数 / 提示次数 / 车种图鉴 / 胜负）。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。

## 每消除一对图块的得分。
const SCORE_PER_PAIR: int = 10
## 每局提示次数（需求：提示次数在实现中可配置 —— 调这里即可）。
const TOTAL_HINTS: int = 3

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 剩余对数变化（消除 / 重开 / 洗牌后触发）。
signal progress_changed(remaining_pairs: int, total_pairs: int)
## 图鉴变化（参数：新收入的车种编号、已收集数、车种总数）。
signal collected_changed(type_id: int, collected_count: int, total_types: int)
## 提示次数变化（参数：剩余次数）。
signal hints_changed(hints_left: int)
## 棋盘清空、本局过关。
signal game_won

## 当前分数。
var score: int = 0
## 剩余提示次数。
var hints_left: int = TOTAL_HINTS
## 本局总对数（由棋盘生成时 configure_run 写入）。
var total_pairs: int = 0
## 剩余未消除对数。
var remaining_pairs: int = 0
## 车种总数（图鉴容量）。
var total_types: int = 0
## 图鉴：本局已消除过的车种编号集合（type_id → true）。
var collected: Dictionary = {}
## 本局是否已过关。
var won: bool = false


## 开局（或重开）时由棋盘调用：写入本局容量并清空运行态。
func configure_run(pairs: int, types: int) -> void:
	total_pairs = pairs
	remaining_pairs = pairs
	total_types = types
	reset_run(true)


## 清空本局运行态（分数 / 提示 / 图鉴 / 胜负标记）。
func reset_run(keep_config: bool = false) -> void:
	score = 0
	hints_left = TOTAL_HINTS
	collected = {}
	won = false
	if not keep_config:
		total_pairs = 0
		remaining_pairs = 0
		total_types = 0
	score_changed.emit(score)
	hints_changed.emit(hints_left)
	collected_changed.emit(-1, collected.size(), total_types)


## 消除一对车种为 type_id 的图块：计分 + 计入图鉴 + 扣减剩余对数。
func register_match(type_id: int) -> void:
	if won:
		return
	score += SCORE_PER_PAIR
	remaining_pairs = maxi(remaining_pairs - 1, 0)
	collected[type_id] = true
	score_changed.emit(score)
	progress_changed.emit(remaining_pairs, total_pairs)
	collected_changed.emit(type_id, collected.size(), total_types)
	if remaining_pairs == 0:
		won = true
		game_won.emit()


## 消耗一次提示；返回是否成功（次数用尽返回 false）。
func use_hint() -> bool:
	if hints_left <= 0:
		return false
	hints_left -= 1
	hints_changed.emit(hints_left)
	return true


## 图鉴是否已收齐全部车种（完成态标识的判定依据）。
func collection_complete() -> bool:
	return total_types > 0 and collected.size() >= total_types
