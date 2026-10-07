extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + 数值调参区。
##
## 《冒烟愿晶》核心状态机：
##   流星限时闪现 → 收集 1 颗愿晶（score +1）→ 集齐 WIN_TARGET 颗立即胜利（单局仅一次）
##   → 重开归零、流星重新生成。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（player.gd / meteor.gd / main.gd）只读变量、禁止散落魔数。

## 愿晶计数变化信号（模板协议锚点：smoke / playtest 门禁按它采样得分事件）。
signal score_changed(score: int)

## 胜利信号：score 首次达到 WIN_TARGET 时发出，单局仅一次（won 门闩保证不可重复触发）。
signal game_won(score: int)

## 愿晶计数（收集 1 颗流星 = 1 愿晶）。命名沿用模板协议的 score —— 它就是本作的分数。
var score: int = 0

## 胜利门闩：true 后 add_score 一律忽略（胜利状态不可重复触发），直到 reset()。
var won: bool = false

## ── 胜利规则（需求固化，非调参数）──
## 集齐 3 颗愿晶立即判定胜利。
const WIN_TARGET: int = 3

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 玩家移动速度（px/s）。
var move_speed: float = 220.0
## 流星单次闪现时长下界（秒）。需求：约 3 秒。
var meteor_lifetime_min: float = 3.0
## 流星单次闪现时长上界（秒）。需求硬约束：≤ 5 秒（冒烟会机判此上界）。
var meteor_lifetime_max: float = 5.0
## 流星生成间隔（秒）：闪现消失/被收集后按此节奏补位（playtest 实测 1.6s 偏稀，开局正反馈迟）。
var meteor_spawn_interval: float = 1.2
## 场上同时闪现的流星数上限。
var max_alive_meteors: int = 4
## 许愿波收集半径（px）：confirm 触发的范围收集，以玩家为圆心。
var pulse_radius: float = 200.0
## 点击判定热区半径（px）：点按中心距流星中心小于该值即命中（研究文档口径：判定热区放宽到可指）。
var tap_radius: float = 48.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 60.0, "max": 600.0, "step": 10.0},
	&"meteor_lifetime_min": {"min": 1.0, "max": 5.0, "step": 0.5},
	&"meteor_lifetime_max": {"min": 1.0, "max": 5.0, "step": 0.5},
	&"meteor_spawn_interval": {"min": 0.6, "max": 4.0, "step": 0.1},
	&"max_alive_meteors": {"min": 1.0, "max": 6.0, "step": 1.0},
	&"pulse_radius": {"min": 60.0, "max": 300.0, "step": 10.0},
	&"tap_radius": {"min": 24.0, "max": 96.0, "step": 4.0},
}


func _ready() -> void:
	_apply_web_tuning()


## 收集愿晶：胜利后一律忽略（不重复计分、不重复触发胜利）。
## score 达到 WIN_TARGET 时先发 score_changed 再立即闩上 won 并发 game_won —— 「立即判定胜利」。
func add_score(amount: int = 1) -> void:
	if won:
		return
	score += amount
	score_changed.emit(score)
	if score >= WIN_TARGET:
		won = true
		game_won.emit(score)


## 重开一局：计数归零、胜利门闩复位；流星重新生成由场景层（main.gd restart）负责。
func reset() -> void:
	score = 0
	won = false
	score_changed.emit(score)


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
