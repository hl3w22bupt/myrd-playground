extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 数值调参集中在常量区（与策划案 numeric 对应，改数值只改这里）。

## 分数变化：棋盘收集糖果后加分时发出，UI 订阅刷新。
signal score_changed(score: int)
## 剩余步数变化：每次有效交换消耗一步时发出。
signal moves_changed(moves_left: int)
## 胜负判定结束：outcome 为 "win"（达成目标分）或 "lose"（步数耗尽）。
signal game_ended(outcome: String)
## 重开完成：状态已复位，UI/棋盘订阅后清场。
signal game_restarted()
## 关卡推进完成：过关进入下一关后发出，UI 订阅刷新关卡号与目标分。
signal level_changed(level: int)

## 第 1 关步数：步数耗尽且未达目标分即失败。
const START_MOVES: int = 20
## 第 1 关目标分数：达到即胜利（三消单次交换 3 连 = 3×20 = 60 分，含连锁/四连加成可更高）。
const TARGET_SCORE: int = 600
## 关卡上限：到顶后重复最终关的数值（无限循环模式）。
const MAX_LEVEL: int = 99

## 对局状态。
enum Outcome { PLAYING, WIN, LOSE }

var score: int = 0
var moves_left: int = START_MOVES
var target_score: int = TARGET_SCORE
var outcome: int = Outcome.PLAYING
## 当前关卡（1 起）。难度梯度唯一入参。
var level: int = 1


## 关卡难度阶梯（纯函数，冒烟可确定性断言单调性）：
## 目标分每关 +300（L1 600 → L2 900 → L3 1200 …），步数每关 -2（L1 20 → L2 18 …，下限 12）。
## 目标越垫越高、步数越收越紧 → 同样的棋盘要打出更高的效率，梯度自然形成。
static func target_for_level(stage: int) -> int:
	return TARGET_SCORE + (stage - 1) * 300


static func moves_for_level(stage: int) -> int:
	return maxi(START_MOVES - (stage - 1) * 2, 12)


func is_playing() -> bool:
	return outcome == Outcome.PLAYING


## 开新一局：复位全部状态（棋盘清场由 Board.new_game 负责，本单例不持有节点）。
func start_game() -> void:
	score = 0
	level = 1
	moves_left = moves_for_level(level)
	target_score = target_for_level(level)
	outcome = Outcome.PLAYING


## 收集糖果加分；对局结束后不再变化。
func add_score(amount: int) -> void:
	if not is_playing():
		return
	score += amount
	score_changed.emit(score)


## 一次有效交换消耗一步；无效交换不消耗（与原版一致）。
func use_move() -> void:
	if not is_playing():
		return
	moves_left = maxi(moves_left - 1, 0)
	moves_changed.emit(moves_left)


## 胜负判定（棋盘在每次交换结算完、步数扣完后调用）：
## 先判胜利（分数优先），再判失败（步数耗尽）。
func check_end() -> void:
	if not is_playing():
		return
	if score >= target_score:
		outcome = Outcome.WIN
		game_ended.emit("win")
	elif moves_left <= 0:
		outcome = Outcome.LOSE
		game_ended.emit("lose")


## 重开：复位状态并广播，让场景层各自清场。
func restart() -> void:
	start_game()
	game_restarted.emit()


## 过关推进：关卡 +1，按阶梯重算目标分/步数，分数清零后回到对局态。
## 只改 autoload 自身状态（棋盘清场由订阅 level_changed 的场景层负责）。
func advance_level() -> void:
	level = mini(level + 1, MAX_LEVEL)
	score = 0
	moves_left = moves_for_level(level)
	target_score = target_for_level(level)
	outcome = Outcome.PLAYING
	score_changed.emit(score)
	moves_changed.emit(moves_left)
	level_changed.emit(level)
