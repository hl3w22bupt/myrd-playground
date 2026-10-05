extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（分数 / 提示次数 / 车种图鉴 / 胜负）。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = 定稿数值；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 每消除一对图块的得分（需求：得分节奏可配置）。
var score_per_pair: int = 10
## 每局提示次数（需求：提示次数/消耗在实现中可配置）。
var total_hints: int = 3

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"score_per_pair": {"min": 5.0, "max": 50.0, "step": 5.0},
	&"total_hints": {"min": 1.0, "max": 9.0, "step": 1.0},
}

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
## 关卡推进（难度梯度：棋盘尺寸 / 车种数随关卡上探）。
signal level_changed(level: int)

## 当前分数。
var score: int = 0
## 当前关卡（难度梯度：1 起步，过关后 +1）。
var level: int = 1
## 剩余提示次数。
var hints_left: int = total_hints
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


## 开局（或重开 / 进入下一关）时由棋盘调用：写入本局容量并清空运行态。
## keep_score=true 供「下一关」使用：分数跨关累计，仅重置提示 / 图鉴 / 进度 / 胜负标记。
func configure_run(pairs: int, types: int, keep_score: bool = false) -> void:
	total_pairs = pairs
	remaining_pairs = pairs
	total_types = types
	reset_run(true, keep_score)


## 清空本局运行态（提示 / 图鉴 / 胜负标记；分数按 keep_score 决定是否保留）。
## 关卡号不重置（显式走 start_from_level）。
func reset_run(keep_config: bool = false, keep_score: bool = false) -> void:
	if not keep_score:
		score = 0
	hints_left = total_hints
	collected = {}
	won = false
	if not keep_config:
		total_pairs = 0
		remaining_pairs = 0
		total_types = 0
	score_changed.emit(score)
	hints_changed.emit(hints_left)
	collected_changed.emit(-1, collected.size(), total_types)


## 回到第 1 关（整段玩法从头开始时使用；普通重开保留当前关卡）。
func start_from_level(fallback: int = 1) -> void:
	level = fallback
	level_changed.emit(level)


## 过关后推进到下一关（难度梯度），由 main 层在过关覆盖层的「下一关」入口调用。
func level_up() -> void:
	level += 1
	level_changed.emit(level)


## 消除一对车种为 type_id 的图块：计分 + 计入图鉴 + 扣减剩余对数。
func register_match(type_id: int) -> void:
	if won:
		return
	score += score_per_pair
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


func _ready() -> void:
	_apply_web_tuning()


## 应用调参覆盖（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口）：
## 只认 TUNING_META 声明的键、按 min/max 钳制；整型变量取整后写回。
## 返回实际生效的键名列表（冒烟据此断言「应用已声明键 / 拒绝未声明键」）。
func apply_tuning(overrides: Dictionary) -> PackedStringArray:
	var applied := PackedStringArray()
	for key: String in overrides:
		var meta: Dictionary = TUNING_META.get(StringName(key), {})
		if meta.is_empty() or get(key) == null:
			continue
		var raw: Variant = overrides[key]
		if not (raw is float or raw is int):
			continue
		var clamped := clampf(float(raw), float(meta["min"]), float(meta["max"]))
		set(key, roundi(clamped) if get(key) is int else clamped)
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
