extends Node
## 自动加载单例（autoload）：《冒烟愿晶》全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 玩法规则（需求固化的唯一判定口径）：
## - 收集计数（score）本地维护，胜利阈值固定 3 颗（WIN_THRESHOLD 常量，不可调参）；
## - 计数达到 3 → is_won = true 并发 game_won；计数任何情况下不得超过 3；
## - 未满 3 颗绝不触发胜利；胜利后 add_score 一律拒绝（收集交互全部失效）。

## 收集计数变化信号：场景层订阅它刷新 HUD，机器人试玩门禁（playtest_driver）采样它。
signal score_changed(score: int)
## 达成 3 颗胜利时发出（恰好一次；重开后可再次发出）。
signal game_won(score: int)

## 胜利判定阈值：需求固定 3 颗即胜，不做可调数值。
const WIN_THRESHOLD: int = 3

## 当前已收集愿晶数（0..3，任何路径都不会超过 WIN_THRESHOLD）。
var score: int = 0
## 是否已进入胜利状态；胜利后收集交互全部失效，仅保留重开。
var is_won: bool = false

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
var move_speed: float = 220.0
## 触摸点收集愿晶的判定半径（热区 ≥44 逻辑像素，直径 96px 远超下限）。
var tap_collect_radius: float = 48.0
## confirm 键/按钮「抓取最近愿晶」的判定半径（桌面便捷操作，次要收集路径）。
var confirm_collect_radius: float = 200.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 60.0, "max": 600.0, "step": 10.0},
	&"tap_collect_radius": {"min": 32.0, "max": 96.0, "step": 4.0},
	&"confirm_collect_radius": {"min": 80.0, "max": 320.0, "step": 10.0},
}


func _ready() -> void:
	_apply_web_tuning()


## 收集一次愿晶：计数 +1；恰好达到 3 颗 → 胜利。
## 胜利后拒绝任何加分（不报错、不变化）；amount 只接受正数，计数不可能倒退或越界。
func add_score(amount: int = 1) -> void:
	if is_won:
		return
	if amount <= 0:
		return
	score = mini(score + amount, WIN_THRESHOLD)
	if score >= WIN_THRESHOLD:
		is_won = true
		score_changed.emit(score)
		game_won.emit(score)
	else:
		score_changed.emit(score)


## 重开一局：计数清零、胜利态清除（场景层负责重置愿晶与玩家位置）。
func reset() -> void:
	score = 0
	is_won = false
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
