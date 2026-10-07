extends Node
## 自动加载单例（autoload）：流星收集的全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件的调参区：变量 + TUNING_META 成对声明，
##   消费方（player.gd / main.gd 等）只读变量、禁止散落魔数。

## 收集进度变化信号：场景层订阅它刷新 UI；也是 playtest 门禁的得分事件锚点。
signal score_changed(score: int)
## 托管（AI 代玩）开关变化信号。
signal autopilot_changed(enabled: bool)

## 胜利目标：收集三颗即胜（需求固定规则，不是可调参数，故不进 TUNING_META）。
const WIN_TARGET: int = 3

## 已收集流星数（0..WIN_TARGET）。
var score: int = 0
## 是否已达成胜利（收集满三颗后为 true，重开时复位）。
var won: bool = false
## 托管模式：开启后由游戏自动操纵玩家收集流星（无人干预可达成胜利）。
var autopilot: bool = false

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = 当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 玩家移动速度（px/s，游戏时间）。
var move_speed: float = 260.0
## 流星存在时长（秒）：转瞬即逝，超时未收集自动消失且不计入进度。
var meteor_lifetime: float = 3.0
## 流星生成间隔（秒）。
var spawn_interval: float = 1.1
## 收集半径（px）：玩家中心与流星中心小于该值即收集成功。
var collect_radius: float = 46.0
## 磁吸半径（px）：进入该范围的流星被缓慢吸向玩家（休闲收集的容错手感）。
var magnet_radius: float = 150.0
## 磁吸速度（px/s）：流星被吸向玩家的速度。
var magnet_pull: float = 120.0
## 托管模式的操纵速度（px/s）。
var autopilot_speed: float = 360.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 60.0, "max": 600.0, "step": 10.0},
	&"meteor_lifetime": {"min": 1.0, "max": 8.0, "step": 0.5},
	&"spawn_interval": {"min": 0.4, "max": 3.0, "step": 0.1},
	&"collect_radius": {"min": 20.0, "max": 120.0, "step": 2.0},
	&"magnet_radius": {"min": 0.0, "max": 400.0, "step": 10.0},
	&"magnet_pull": {"min": 0.0, "max": 300.0, "step": 10.0},
	&"autopilot_speed": {"min": 120.0, "max": 600.0, "step": 10.0},
}


func _ready() -> void:
	_apply_web_tuning()


## 收集进度 +1（每次收集恰好一颗流星）。
func add_score(amount: int = 1) -> void:
	score += amount
	score_changed.emit(score)


## 重开一局：进度归零、胜利复位（流星由场景层清理，autoload 不持有节点）。
func reset() -> void:
	score = 0
	won = false
	score_changed.emit(score)


## 切换托管模式；状态变化只发信号，场景层自行订阅。
func set_autopilot(enabled: bool) -> void:
	if autopilot == enabled:
		return
	autopilot = enabled
	autopilot_changed.emit(enabled)


## 胜利判定：收集满 WIN_TARGET 即胜（需求规则 3：立即判定胜利）。
func is_victory() -> bool:
	return score >= WIN_TARGET


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
