extends Node
## 自动加载单例（autoload）：计数页的全局状态 + 连点防重纯逻辑。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 防重判定做成「注入时间戳的纯函数」try_count(now_ms)：
##   无头冒烟可以传合成时间逐毫秒断言，不依赖真实帧间隔（可复现、零抖动）。

## 计数变化信号：UI 订阅它刷新数字，而不是主动轮询。
signal count_changed(count: int)
## 局内状态变化信号（PLAYING -> WON；reset 回 PLAYING）。
signal state_changed(state: int)
## 连点被防重窗口拦截时发出；参数 = 距下次可计数还剩的毫秒数。
signal click_rejected(remaining_ms: int)

## 局内状态：PLAYING = 进行中；WON = 已达标（胜利）。
enum State { PLAYING, WON }

## 胜利目标：计数达到该值即胜。
const TARGET_COUNT: int = 10
## 连点防重窗口（毫秒）：窗口内的重复点击只计一次。
const DEBOUNCE_MS: int = 300

var count: int = 0
var state: int = State.PLAYING
## 上一次有效计数的时间戳（毫秒）。初值取 -DEBOUNCE_MS：开局第一击立即有效。
var _last_count_ms: int = -DEBOUNCE_MS


## 尝试计数：返回是否为有效计数。
## - 非进行中（已胜）：忽略，返回 false；
## - 距上次有效计数不足 DEBOUNCE_MS：拦截，发 click_rejected，返回 false；
## - 否则计数 +1、发 count_changed，达标时切到 WON 并发 state_changed。
func try_count(now_ms: int) -> bool:
	if state != State.PLAYING:
		return false
	if now_ms - _last_count_ms < DEBOUNCE_MS:
		click_rejected.emit(DEBOUNCE_MS - (now_ms - _last_count_ms))
		return false
	_last_count_ms = now_ms
	count += 1
	count_changed.emit(count)
	if count >= TARGET_COUNT:
		state = State.WON
		state_changed.emit(state)
	return true


## 重开：计数归零、回到进行中、防重窗口清零（重开后第一击立即有效）。
func reset() -> void:
	count = 0
	state = State.PLAYING
	_last_count_ms = -DEBOUNCE_MS
	count_changed.emit(count)
	state_changed.emit(state)
