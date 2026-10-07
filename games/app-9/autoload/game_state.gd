extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件的调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（player.gd 等）只读变量、禁止散落魔数。

## 收集数变化信号：场景层订阅它刷新 HUD 进度（x/3），而不是主动轮询。
signal score_changed(score: int)
## 胜利信号：收集数达到 WIN_COUNT 时发出一次（重开复位后可再次触发）。
signal won
## 重开信号：reset() 复位完成时发出，场景层据此清场归位。
signal restarted

## 胜利所需收集数（需求口径：集齐三颗即胜；计数不足 3 不得触发胜利）。
const WIN_COUNT: int = 3

## 场地尺寸（设计分辨率常量）：玩家活动范围与流星派发区域的共同基准。
const FIELD_WIDTH: float = 640.0
const FIELD_HEIGHT: float = 360.0

var score: int = 0
## 本局是否已达成胜利（win 后收集输入冻结、派发停止，只剩重开入口）。
var won_state: bool = false

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
var move_speed: float = 220.0
## 流星短窗口时长（秒）：窗口结束流星消失且不可再点击。需求口径默认 2 秒、1.5~3 秒可配置。
var meteor_window_seconds: float = 2.0
## 祈愿脉冲半径（像素）：confirm 动作以玩家为圆心收集此范围内的可收集流星。
var pulse_radius: float = 150.0
## 流星派发间隔（秒）：单局持续派发，直至集齐 WIN_COUNT。
var spawn_interval_seconds: float = 1.1

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 60.0, "max": 600.0, "step": 10.0},
	&"meteor_window_seconds": {"min": 1.5, "max": 3.0, "step": 0.1},
	&"pulse_radius": {"min": 80.0, "max": 240.0, "step": 10.0},
	&"spawn_interval_seconds": {"min": 0.6, "max": 2.0, "step": 0.1},
}


func _ready() -> void:
	_apply_web_tuning()


## 收集一颗流星：计数 +1 并广播；**恰好达到 WIN_COUNT 时**判胜（不足 3 不得触发胜利，
## 胜后计数冻结 —— 重开是唯一复位路径，防止胜利后误操作继续累加）。
func add_score(amount: int = 1) -> void:
	if won_state:
		return
	score += amount
	score_changed.emit(score)
	if score >= WIN_COUNT:
		won_state = true
		won.emit()


## 重开：全部对局状态复位并广播 restarted（playtest 驱动每局开始也会调用本方法）。
func reset() -> void:
	score = 0
	won_state = false
	score_changed.emit(score)
	restarted.emit()


## 应用调参覆盖（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口）：
## 只认 TUNING_META 声明的键、按 min/max 钳制；返回实际生效的键名列表。
func apply_tuning(overrides: Dictionary) -> PackedStringArray:
	var applied := PackedStringArray()
	for key: String in overrides:
		var meta: Dictionary = TUNING_META.get(StringName(key), {})
		if meta.is_empty() or get(key) == null:
			continue
		var raw: Variant = overrides[key]
		if not (raw is float or raw is int):
			continue
		set(key, clampf(float(raw), meta["min"], meta["max"]))
		applied.append(key)
	return applied


## Web 调参桥读入：壳页面在引擎加载前把 URL ?tuning=<JSON> 解析到 window.__GAME_TUNING__，
## 这里在启动时应用。桌面/无头环境桥不工作（eval 返回 null），自动跳过（冒烟不受影响）。
## 注意：JavaScriptBridge 单例在桌面二进制也存在但 eval 恒为 null —— 判空而非只判注册；
## 经 Engine.get_singleton 动态取用，不做编译期平台引用。
func _apply_web_tuning() -> void:
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", "JSON.stringify(window.__GAME_TUNING__ || null)")
	if result == null:
		return
	var raw := str(result)
	if raw.is_empty() or raw == "null":
		return
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary:
		apply_tuning(parsed)
