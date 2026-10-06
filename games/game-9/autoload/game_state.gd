extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（分数 / 倒计时 / 胜负状态机）。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。

## 一局总时长（秒）：scaffold 先按 4x4 小棋盘给 90 秒，调难度时再收紧。
const START_TIME: float = 90.0
## 每对消除的基础分。
const MATCH_POINTS: int = 10

enum State { PLAYING, WON, LOST }

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 剩余时间变化信号（float 秒）。
signal time_changed(time_left: float)
## 胜负状态切换信号（PLAYING → WON / LOST）。
signal state_changed(new_state: State)

var score: int = 0
var time_left: float = START_TIME
var state: State = State.PLAYING


## 每物理帧由主场景驱动一次；只在 PLAYING 状态倒计时。
func tick(delta: float) -> void:
	if state != State.PLAYING:
		return
	time_left = maxf(time_left - delta, 0.0)
	time_changed.emit(time_left)
	if time_left <= 0.0:
		lose_game()


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


## 全部卡片消除完毕时由棋盘调用；只在 PLAYING 状态生效（幂等）。
func win_game() -> void:
	if state != State.PLAYING:
		return
	state = State.WON
	state_changed.emit(state)


## 倒计时归零时由 tick() 调用；只在 PLAYING 状态生效（幂等）。
func lose_game() -> void:
	if state != State.PLAYING:
		return
	state = State.LOST
	state_changed.emit(state)


## 重开：分数清零、时间回满、状态回到 PLAYING，三个信号各发一次让 UI 整体刷新。
func reset() -> void:
	score = 0
	time_left = START_TIME
	state = State.PLAYING
	score_changed.emit(score)
	time_changed.emit(time_left)
	state_changed.emit(state)
