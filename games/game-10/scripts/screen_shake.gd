class_name ScreenShake
extends Camera2D
## 屏幕晃动的唯一实现点：参数全部来自 GameState.SHAKE_CONFIG（集中配置，调参不改代码）。
##
## 两种互斥的晃动源（同一帧内终局单晃优先，二者绝不叠加放大）：
## - 加速微抖（rumble）：加速特效生效期间的持续小幅度低频抖动；
##   game over 时先被关闭，再进入终局单晃 —— 满足「两场景互不干扰、无叠加」。
## - 终局单晃（terminal）：game over 沿状态边沿请求，只播放一次短促晃动，
##   播放结束后 offset 被**显式置为 Vector2.ZERO** 并保持 —— 之后每帧都写入精确零向量，
##   不存在衰减尾迹、不存在二次触发（request 在终局晃动进行中会被忽略）。

## 终局单晃已启动次数（冒烟断言「精确晃一次」用；一次 game over 恰好 +1）。
var terminal_shake_count: int = 0

## 只读视图（冒烟断言用）：终局单晃是否仍在播放。
var terminal_active: bool:
	get: return _terminal_left_s > 0.0

## 只读视图（冒烟断言用）：加速微抖是否生效。
var rumble_active: bool:
	get: return _rumble_active

var _rumble_active: bool = false
var _time_s: float = 0.0
var _terminal_left_s: float = 0.0
var _terminal_total_s: float = 0.0


func _ready() -> void:
	make_current()


## 加速微抖开关（由 Main 订阅 GameState.speed_changed 后驱动）。
func set_rumble(active: bool) -> void:
	_rumble_active = active


## 请求终局单晃。进行中重复请求被忽略 → 一次 game over 至多晃一次。
func request_terminal_shake() -> void:
	if _terminal_left_s > 0.0:
		return
	var params := GameState.shake_params(&"game_over")
	_terminal_total_s = maxf(float(params.get("duration_s", 0.3)), 0.01)
	_terminal_left_s = _terminal_total_s
	terminal_shake_count += 1


## 立即静止（重开/通关时调用）：清掉一切晃动并归零。
func settle() -> void:
	_rumble_active = false
	_terminal_left_s = 0.0
	_terminal_total_s = 0.0
	offset = Vector2.ZERO


func _process(delta: float) -> void:
	_time_s += delta
	var target := Vector2.ZERO
	if _terminal_left_s > 0.0:
		_terminal_left_s = maxf(_terminal_left_s - delta, 0.0)
		if _terminal_left_s > 0.0:
			var params := GameState.shake_params(&"game_over")
			var amplitude: float = float(params.get("amplitude_px", 0.0))
			var frequency: float = float(params.get("frequency_hz", 0.0))
			# 线性衰减包络：起振最响、收尾趋零，短促干脆。
			var envelope: float = _terminal_left_s / _terminal_total_s
			target = _wave(frequency, amplitude * envelope)
		# else：单晃自然结束，本帧起 target 保持精确零向量（残余抖动为零）。
	elif _rumble_active:
		var rumble_params := GameState.shake_params(&"accel")
		target = _wave(
			float(rumble_params.get("frequency_hz", 0.0)),
			float(rumble_params.get("amplitude_px", 0.0)),
		)
	# 终局单晃进行中不允许微抖叠加（elif 已保证）；无任何活动晃动源时 offset 恒为零。
	offset = target


## 有界谐波位移：x/y 用不同谐波相位错开，峰值恒等于幅度（不超调）。
func _wave(frequency: float, amplitude: float) -> Vector2:
	return Vector2(
		sin(_time_s * TAU * frequency),
		sin(_time_s * TAU * frequency * 1.7 + 0.9),
	) * amplitude
