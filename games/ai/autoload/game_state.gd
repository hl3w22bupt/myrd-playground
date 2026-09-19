extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在下方调参区：变量 + TUNING_META 成对声明（键名与 spec.numeric 对应），
##   消费方（player.gd / ai_girlfriend.gd）只读变量，禁止散落魔数。

## 好感变化：收集到一位 AI 女友的心动对话 / 玩家按 confirm 回应时发出，UI 订阅刷新。
signal affection_changed(affection: int)
## 心动时间（秒）整数部分变化：倒计时 HUD 刷新用（不逐帧刷屏，只在整数秒变化时发）。
signal time_changed(seconds_left: int)
## 章节推进：一章目标好感达成进入下一章后发出，UI 订阅刷新章节标题。
signal chapter_changed(chapter: int)
## 胜负判定结束：outcome 为 "win"（最终章告白成功）或 "lose"（心动时间耗尽）。
signal game_ended(outcome: String)
## 重开完成：状态已复位，场景层订阅后清场（玩家归位、女友重新落位、遮罩关闭）。
signal game_restarted()

## 每章心动时间（秒，可调参）：倒计时归零且好感未达标即失败（生存挑战的压力来源）。
## 实际预算 = time_per_chapter × 章节系数（time_budget_for），章节越深预算越紧。
var time_per_chapter: float = 45.0
## 小李移速（px/s，可调参）：player.gd 只读本变量，禁止在消费方散落魔数。
var player_speed: float = 220.0
## AI 女友基础游走速度（px/s，可调参）：ai_girlfriend.gd 只读本变量 × 章节系数。
var girlfriend_speed: float = 40.0

## 可调键的元数据：键名 → {min, max, step}（SKILL.md §3C 调参工作台对接面）。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"player_speed": {"min": 80.0, "max": 400.0, "step": 10.0},
	&"girlfriend_speed": {"min": 20.0, "max": 200.0, "step": 5.0},
	&"time_per_chapter": {"min": 15.0, "max": 90.0, "step": 5.0},
}

## 最终章：该章目标好感达成 = 告白成功（WIN）。
const FINAL_CHAPTER: int = 3

## ── 难度梯度（生存挑战的节奏曲线）──
## 章节越深：心动时间预算越紧（×系数递减），AI 女友游走越快（×系数递增）——
## 「追人」的边际成本逐章上升，玩家必须更会走位。两表都按 FINAL_CHAPTER 取齐。
const CHAPTER_TIME_SCALE: Dictionary = {1: 1.0, 2: 0.85, 3: 0.7}
const CHAPTER_CHASE_SCALE: Dictionary = {1: 1.0, 2: 1.3, 3: 1.6}
## 章节标题（剧情驱动：三章小剧场，最终章完成即大结局）。
const CHAPTER_TITLES: Dictionary = {
	1: "第1章 初遇",
	2: "第2章 心动",
	3: "第3章 告白",
}

## 对局状态。
enum Outcome { PLAYING, WIN, LOSE }

## 当前好感（本章内累计，进章清零）。
var affection: int = 0
## 当前章节（1 起）。
var chapter: int = 1
## 本章剩余心动时间（秒）：字段默认取基础预算；真实预算由 _ready 按章节系数重算。
var time_left: float = time_per_chapter
var outcome: int = Outcome.PLAYING


## 章节目标好感（纯函数，冒烟可确定性断言单调性）：3 → 4 → 5。
static func target_for_chapter(stage: int) -> int:
	return 2 + stage


## 章节标题查询（未知章节回退到最终章标题，UI 不会拿到空文案）。
static func title_for_chapter(stage: int) -> String:
	return String(CHAPTER_TITLES.get(stage, CHAPTER_TITLES[FINAL_CHAPTER]))


## 本章心动时间预算（秒）：基础预算（可调参变量）× 章节系数，随章节单调递减（难度梯度）。
## 实例方法而非 static：基础预算是可调参的成员变量，调参面板改完立即对后续章节生效。
func time_budget_for(stage: int) -> float:
	var scale: float = float(CHAPTER_TIME_SCALE.get(maxi(stage, 1), CHAPTER_TIME_SCALE[FINAL_CHAPTER]))
	return time_per_chapter * scale


## 本章 AI 女友游走速度系数（纯函数）：随章节单调递增（难度梯度），冒烟确定性断言用。
static func chase_scale_for(stage: int) -> float:
	return float(CHAPTER_CHASE_SCALE.get(maxi(stage, 1), CHAPTER_CHASE_SCALE[FINAL_CHAPTER]))


func is_playing() -> bool:
	return outcome == Outcome.PLAYING


## 开新一局：复位全部状态（玩家归位、女友重新落位由订阅 game_restarted 的场景层负责）。
func start_game() -> void:
	affection = 0
	chapter = 1
	time_left = time_budget_for(chapter)
	outcome = Outcome.PLAYING


## 收集好感；对局结束后不再变化。达到本章目标 → 推进章节或（最终章）告白成功。
func add_affection(amount: int) -> void:
	if not is_playing():
		return
	affection += amount
	affection_changed.emit(affection)
	check_end()


## 胜负判定（收集后与倒计时归零时调用）：先判章节目标，再判时间耗尽。
func check_end() -> void:
	if not is_playing():
		return
	if affection >= target_for_chapter(chapter):
		if chapter >= FINAL_CHAPTER:
			outcome = Outcome.WIN
			game_ended.emit("win")
		else:
			advance_chapter()
	elif time_left <= 0.0:
		outcome = Outcome.LOSE
		game_ended.emit("lose")


## 过关推进：章节 +1、好感清零、心动时间按新章预算重置（梯度收紧），回到对局态。
func advance_chapter() -> void:
	chapter = mini(chapter + 1, FINAL_CHAPTER)
	affection = 0
	time_left = time_budget_for(chapter)
	affection_changed.emit(affection)
	chapter_changed.emit(chapter)


## 心动倒计时：只在对局态推进；整数秒变化才发信号（不逐帧刷屏）；归零立即判负。
func _process(delta: float) -> void:
	if not is_playing():
		return
	var seconds_before: int = int(ceilf(time_left))
	time_left = maxf(time_left - delta, 0.0)
	var seconds_after: int = int(ceilf(time_left))
	if seconds_after != seconds_before:
		time_changed.emit(seconds_after)
	if time_left <= 0.0:
		check_end()


## 重开：复位状态并广播，让场景层各自清场。
func restart() -> void:
	start_game()
	game_restarted.emit()


func _ready() -> void:
	_apply_web_tuning()
	# Web 调参可能在加载前改了基础预算：开局时间按（可能已被调参的）基础值 × 章节系数重算。
	time_left = time_budget_for(chapter)


## 应用调参覆盖（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口，SKILL.md §3C）：
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
## JavaScriptBridge 单例在桌面二进制也存在但 eval 恒为 null —— 判空而非只判注册；
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
