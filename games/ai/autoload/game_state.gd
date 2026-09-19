extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 数值调参集中在常量区（与策划案 numeric 对应，改数值只改这里）。

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

## 每章心动时间（秒）：倒计时归零且好感未达标即失败（生存挑战的压力来源）。
const TIME_PER_CHAPTER: float = 45.0
## 最终章：该章目标好感达成 = 告白成功（WIN）。
const FINAL_CHAPTER: int = 3
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
## 本章剩余心动时间（秒）。
var time_left: float = TIME_PER_CHAPTER
var outcome: int = Outcome.PLAYING


## 章节目标好感（纯函数，冒烟可确定性断言单调性）：3 → 4 → 5。
static func target_for_chapter(stage: int) -> int:
	return 2 + stage


## 章节标题查询（未知章节回退到最终章标题，UI 不会拿到空文案）。
static func title_for_chapter(stage: int) -> String:
	return String(CHAPTER_TITLES.get(stage, CHAPTER_TITLES[FINAL_CHAPTER]))


func is_playing() -> bool:
	return outcome == Outcome.PLAYING


## 开新一局：复位全部状态（玩家归位、女友重新落位由订阅 game_restarted 的场景层负责）。
func start_game() -> void:
	affection = 0
	chapter = 1
	time_left = TIME_PER_CHAPTER
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


## 过关推进：章节 +1、好感清零、心动时间重置，回到对局态。
func advance_chapter() -> void:
	chapter = mini(chapter + 1, FINAL_CHAPTER)
	affection = 0
	time_left = TIME_PER_CHAPTER
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
