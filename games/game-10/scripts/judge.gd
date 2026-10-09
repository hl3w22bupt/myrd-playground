class_name BeatJudge
extends RefCounted
## 节拍判定器（纯逻辑，无头可判）：把「输入时刻 − 音符时刻」的差值分类成三档判定。
##
## 判定必须基于时间差计算，禁止以渲染帧时间近似（需求 AC1 口径）：
##   PERFECT 窗口 ±50ms，GOOD 窗口 ±100ms，超出窗口记 MISS。
## 窗口数值来自 GameState 调参区（可调参、可校准），本类只做纯分类，不持有任何节点。

enum Judgment { PERFECT = 0, GOOD = 1, MISS = 2 }


## 把时间差（毫秒，正 = 按晚了，负 = 按早了）分类成 Judgment。
## 带符号差值取绝对值后与窗口比较；PERFECT 优先于 GOOD。
static func classify(delta_ms: float, perfect_window_ms: float, good_window_ms: float) -> Judgment:
	var magnitude := absf(delta_ms)
	if magnitude <= perfect_window_ms:
		return Judgment.PERFECT
	if magnitude <= good_window_ms:
		return Judgment.GOOD
	return Judgment.MISS


## 判定档位 → 中文显示名（HUD/结算页用）。
static func label(judgment: Judgment) -> String:
	match judgment:
		Judgment.PERFECT:
			return "PERFECT"
		Judgment.GOOD:
			return "GOOD"
		_:
			return "MISS"
