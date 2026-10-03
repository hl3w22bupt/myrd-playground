class_name GameStateMachine
extends Node
## 全局状态机 —— 七态十转移（策划案 GameDesignSpec v0 的状态机段）。
##
## BOOT → PLAYING → (PAUSED ⇄ PLAYING) → SETTLING → {CLEARED | PERFECT | FAILED}
## 任意结算态可经 restart 回到 PLAYING；PAUSED 下退出游戏即存档。
## 非法转移一律拒绝并告警（不静默），门禁冒烟会断言转移表行为。

enum State {
	BOOT,      ## 启动中：主场景尚未就绪
	PLAYING,   ## 玩法中：可点击/拖拽收集
	PAUSED,    ## 暂停：树暂停，仅暂停层响应
	SETTLING,  ## 结算过渡：settleDelaySeconds 的缓冲窗
	CLEARED,   ## 集齐且剩余预算 > 0（2 星）
	PERFECT,   ## 集齐且剩余预算 == 0（3 星，贴线）
	FAILED,    ## 预算归零仍未集齐，或硬上限超时（0 星）
}

signal state_changed(from: State, to: State)

const LEGAL_TRANSITIONS: Dictionary = {
	State.BOOT: [State.PLAYING],
	State.PLAYING: [State.PAUSED, State.SETTLING],
	State.PAUSED: [State.PLAYING, State.SETTLING],
	State.SETTLING: [State.CLEARED, State.PERFECT, State.FAILED],
	State.CLEARED: [State.PLAYING],
	State.PERFECT: [State.PLAYING],
	State.FAILED: [State.PLAYING],
}

var state: State = State.BOOT


func transition(to: State) -> bool:
	if to == state:
		return true
	var allowed: Array = LEGAL_TRANSITIONS.get(state, [])
	if not (to in allowed):
		push_warning("[state-machine] 非法转移 %s → %s（允许：%s）" % [
			_state_name(state), _state_name(to), _state_name(allowed[0]) if not allowed.is_empty() else "无",
		])
		return false
	var previous := state
	state = to
	state_changed.emit(previous, to)
	return true


func is_settled() -> bool:
	return state in [State.CLEARED, State.PERFECT, State.FAILED]


func is_playing() -> bool:
	return state == State.PLAYING


func _state_name(value: Variant) -> String:
	return State.keys()[value] if value is State else str(value)
