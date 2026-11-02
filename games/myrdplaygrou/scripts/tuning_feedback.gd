class_name TuningFeedback
extends RefCounted
## 「试玩反馈四问」回填 → spec.numeric 修订建议 的纯映射逻辑（无场景依赖，可无头机判）。
##
## 职责边界（本节点硬约束）：
## - 只把「用户亲手点选的四问答案」映射成修订建议 —— 不预填任何答案、不改任何默认值；
## - 产出对齐 revisions API 契约（POST /api/v1/game-design-specs/:id/revisions，body = {spec, detail}）
##   的建议载荷，由目标 owner 拍板 tuning_applied 后才正式入链并同步 game_state.gd 默认值；
## - 建议数值一律「从 GameState 当前值（= spec.numeric 现行定稿的工程实现）出发」推导，
##   保持 spec difficulty.curveRule 的单调性硬约束（禁止相邻关卡整体回落）。
##
## 四问口径（面板只收集这四问 + 两个可选项）：
##   Q1 单局时长感受：too_short / just_right / too_long
##   Q2 难度感受：too_easy / just_right / too_hard（可附开始吃力的关卡号 1-8）
##   Q3 音效紧张感：1-5 星
##   Q4 整体好玩度：1-5 星（可附一句话建议）
##
## 建议映射（确定性、可机判，见 tests/smoke.gd::_check_four_questions_contract）：
##   Q1 太短 → 节奏参数上调（首波延迟/波间隔各 +3s，向 durationRule 180s 上限靠）
##   Q1 太长 → 节奏参数下调（各 -3s，向下限 60s 靠）
##   Q2 太难 → 自吃力关卡起 hpScale ×0.85 / speedScale ×0.95（未附关卡号默认自第 2 关起，
##             第 1 关教学入口不动）；Q2 太容易 → 自第 2 关起 ×1.15 / ×1.08；
##             两种方向都强制「逐关严格递增」（curveRule：禁止相邻关卡整体回落）
##   Q3 ≤2 星 → 紧张感不足：v6 已声明的 BGM 加压层提前进入（intenseSwitchRule 阈值下调）
##              + 基础层音量档上调；Q3 ≥4 星 → 加压延后 + 音量档下调
##   Q4 ≤2 星 → 好玩度不足：内容扩容方向建议 + 用户一句话原文透传进修订说明

## ── 答案键名（面板与映射的唯一对接面）──
const Q1_DURATION: StringName = &"q1_duration"
const Q2_DIFFICULTY: StringName = &"q2_difficulty"
const Q2_DIFFICULTY_LEVEL: StringName = &"q2_difficulty_level"
const Q3_TENSION_STARS: StringName = &"q3_tension_stars"
const Q4_FUN_STARS: StringName = &"q4_fun_stars"
const Q4_SUGGESTION: StringName = &"q4_suggestion"

## ── 选项枚举值（面板按钮 value 与此一一对应）──
const DURATION_TOO_SHORT: String = "too_short"
const DURATION_JUST_RIGHT: String = "just_right"
const DURATION_TOO_LONG: String = "too_long"
const DIFFICULTY_TOO_EASY: String = "too_easy"
const DIFFICULTY_JUST_RIGHT: String = "just_right"
const DIFFICULTY_TOO_HARD: String = "too_hard"

## ── 建议基准（本面板随 v6 功能线发布；入链时以平台最新 approved 重算，见 basis 字段）──
## 提交时链上最新 approved：策划案 v6（平台 version=6，spec.meta.title「策划案 v4」线）。
const SPEC_CHAIN_HEAD: String = "cmvyol366005wm9y0kzkdz57d"
const SPEC_VERSION: int = 6

## revisions API 契约（平台唯一策划案修订入口；见 docs/spec-acceptance-mirror.md 纪律段）。
const REVISIONS_ENDPOINT_TEMPLATE: String = "/api/v1/game-design-specs/%s/revisions"
const REVISIONS_METHOD: String = "POST"

## 壳层反馈中继（game-page 同源的相对路径；shell index.ts 提供 POST + GET latest）。
const RELAY_PATH: String = "api/public/feedback/spec-revision"

## ── 映射常量（调参建议档位，全部显式声明、禁止散落魔数）──
const RHYTHM_STEP_SEC: float = 3.0            ## Q1 节奏建议步长（首波延迟/波间隔共用）
const FIRST_WAVE_DELAY_MIN: float = 8.0       ## 首波延迟下限（节奏压缩不得低于此）
const FIRST_WAVE_DELAY_MAX: float = 20.0      ## 首波延迟上限（现表 10-15s，放宽余量）
const WAVE_GAP_MIN: float = 9.0               ## 波间隔下限（L3 全表最短 12s 的压缩空间）
const WAVE_GAP_MAX: float = 24.0              ## 波间隔上限（L1 教学 20s 的放宽余量）
const HP_SCALE_DOWN_FACTOR: float = 0.85      ## Q2 太难：hpScale 建议系数
const HP_SCALE_UP_FACTOR: float = 1.15        ## Q2 太容易：hpScale 建议系数
const SPEED_SCALE_DOWN_FACTOR: float = 0.95   ## Q2 太难：speedScale 建议系数
const SPEED_SCALE_UP_FACTOR: float = 1.08     ## Q2 太容易：speedScale 建议系数
const HP_SCALE_MONO_STEP: float = 0.05        ## 曲线单调性强制的最小级差（hpScale）
const SPEED_SCALE_MONO_STEP: float = 0.02     ## 曲线单调性强制的最小级差（speedScale）
const DIFFICULTY_DEFAULT_START_LEVEL: int = 2 ## Q2 未附关卡号时的建议起点（L1 教学入口不动）
const BGM_VOLUME_CURRENT: float = 0.4         ## spec audio.bgm.volume 现行值（线性）
const BGM_VOLUME_UP: float = 0.45             ## Q3 紧张感不足：基础层音量建议档
const BGM_VOLUME_DOWN: float = 0.32           ## Q3 偏高压：基础层音量建议档
const NOTE_MAX_CHARS: int = 120               ## Q4 一句话建议的长度上限（防滥用）

## Q1/Q2 的合法选项集合（面板按钮与校验共用）。
const DURATION_OPTIONS: PackedStringArray = [DURATION_TOO_SHORT, DURATION_JUST_RIGHT, DURATION_TOO_LONG]
const DIFFICULTY_OPTIONS: PackedStringArray = [DIFFICULTY_TOO_EASY, DIFFICULTY_JUST_RIGHT, DIFFICULTY_TOO_HARD]


## 四问是否全部作答（Q2 关卡号与 Q4 一句话是可选项，不参与完整性判定）。
static func is_complete(answers: Dictionary) -> bool:
	return missing_fields(answers).is_empty()


## 缺答字段清单（空数组 = 完整；面板据此给出「还差几问」提示，杜绝代填）。
static func missing_fields(answers: Dictionary) -> PackedStringArray:
	var missing := PackedStringArray()
	if String(answers.get(Q1_DURATION, "")) not in DURATION_OPTIONS:
		missing.append(String(Q1_DURATION))
	if String(answers.get(Q2_DIFFICULTY, "")) not in DIFFICULTY_OPTIONS:
		missing.append(String(Q2_DIFFICULTY))
	if int(answers.get(Q3_TENSION_STARS, 0)) < 1 or int(answers.get(Q3_TENSION_STARS, 0)) > 5:
		missing.append(String(Q3_TENSION_STARS))
	if int(answers.get(Q4_FUN_STARS, 0)) < 1 or int(answers.get(Q4_FUN_STARS, 0)) > 5:
		missing.append(String(Q4_FUN_STARS))
	return missing


## 主入口：四问答案 → spec.numeric 修订建议载荷。
## 答案不完整时返回空字典（面板在提交前用 is_complete 拦截，此为双保险）。
## 本函数只读 GameState（LEVELS 现行值 = spec.numeric 的工程实现），绝不写回任何状态。
static func derive(answers: Dictionary) -> Dictionary:
	if not is_complete(answers):
		return {}
	var level_count := GameState.LEVELS.size()
	var suggestions: Array[Dictionary] = []

	var duration := String(answers[Q1_DURATION])
	if duration != DURATION_JUST_RIGHT:
		suggestions.append(_duration_suggestion(duration))

	var difficulty := String(answers[Q2_DIFFICULTY])
	if difficulty != DIFFICULTY_JUST_RIGHT:
		var biting := int(answers.get(Q2_DIFFICULTY_LEVEL, 0))
		suggestions.append(_difficulty_suggestion(difficulty, biting, level_count))

	var tension := int(answers[Q3_TENSION_STARS])
	if tension != 3:
		suggestions.append(_tension_suggestion(tension))

	var fun := int(answers[Q4_FUN_STARS])
	var note := _sanitize_note(String(answers.get(Q4_SUGGESTION, "")))
	if fun <= 2:
		suggestions.append(_fun_suggestion(fun, note))

	return {
		"kind": "playtest-four-questions",
		"payload_version": 1,
		"basis": _basis(),
		"answers": _echo_answers(answers),
		"suggestions": suggestions,
		"detail": _detail(duration, difficulty, biting_level(answers), tension, fun, note,
			suggestions.size()),
		"tuning_applied": false,
		"next": "目标 owner 拍板 tuning_applied 后：POST /revisions 入链产生新版本 → 同步 "
			+ "game_state.gd 默认值与 docs/numeric-and-assets.md → 重跑门禁复证",
		"collected_at": Time.get_datetime_string_from_system(true),
	}


## Q2 附注的「开始吃力关卡号」（0 = 未附；1-8 合法，越界归 0）。
static func biting_level(answers: Dictionary) -> int:
	var raw := int(answers.get(Q2_DIFFICULTY_LEVEL, 0))
	return raw if raw >= 1 and raw <= GameState.LEVELS.size() else 0


## 修订建议基准（平台策划案链定位 + revisions API 请求体骨架）。
static func _basis() -> Dictionary:
	return {
		"spec_chain_head": SPEC_CHAIN_HEAD,
		"spec_version": SPEC_VERSION,
		"spec_status": "approved",
		"revisions_endpoint": REVISIONS_ENDPOINT_TEMPLATE % SPEC_CHAIN_HEAD,
		"revisions_method": REVISIONS_METHOD,
		"revisions_body_shape": "{spec: <基于最新 approved 的全量 spec + 本建议修订 numeric>, detail: <本载荷 detail>}",
		"note": "基准为面板发布时链上最新 approved；入链前以平台最新 approved 重算差异",
	}


## 答案原样回显（只透传用户亲手输入的键；杜绝面板/映射层代填的任何字段混入）。
static func _echo_answers(answers: Dictionary) -> Dictionary:
	var echo := {
		String(Q1_DURATION): String(answers[Q1_DURATION]),
		String(Q2_DIFFICULTY): String(answers[Q2_DIFFICULTY]),
		String(Q3_TENSION_STARS): int(answers[Q3_TENSION_STARS]),
		String(Q4_FUN_STARS): int(answers[Q4_FUN_STARS]),
	}
	var biting := biting_level(answers)
	if biting > 0:
		echo[String(Q2_DIFFICULTY_LEVEL)] = biting
	var note := _sanitize_note(String(answers.get(Q4_SUGGESTION, "")))
	if not note.is_empty():
		echo[String(Q4_SUGGESTION)] = note
	return echo


## Q1 时长 → 节奏参数建议（首波延迟 + 波间隔，全表逐关列出 from/to）。
static func _duration_suggestion(duration: String) -> Dictionary:
	var step := RHYTHM_STEP_SEC if duration == DURATION_TOO_SHORT else -RHYTHM_STEP_SEC
	var values: Array[Dictionary] = []
	for i in GameState.LEVELS.size():
		var level: Dictionary = GameState.LEVELS[i]
		values.append({
			"level": i + 1,
			"key": "first_wave_delay",
			"from": float(level.get("first_wave_delay", 15.0)),
			"to": clampf(float(level.get("first_wave_delay", 15.0)) + step,
				FIRST_WAVE_DELAY_MIN, FIRST_WAVE_DELAY_MAX),
		})
		values.append({
			"level": i + 1,
			"key": "wave_gap",
			"from": float(level.get("wave_gap", 20.0)),
			"to": clampf(float(level.get("wave_gap", 20.0)) + step, WAVE_GAP_MIN, WAVE_GAP_MAX),
		})
	var direction := "up" if duration == DURATION_TOO_SHORT else "down"
	var feeling := "偏短（想多守一会）" if duration == DURATION_TOO_SHORT else "偏长（拖沓疲劳）"
	var reason := ("单局时长%s；spec.numeric.difficulty.durationRule 口径 60-180s，"
		+ "节奏参数 %+.0fs/关 后须重算 estimatedDurationSec 并保持全部落在区间内") % [feeling, step]
	return {
		"question": String(Q1_DURATION),
		"answer": duration,
		"target": "levels[].first_wave_delay / levels[].wave_gap（spec levels[].elements[].delaySec）",
		"direction": direction,
		"values": values,
		"reason": reason,
	}


## Q2 难度 → hpScale/speedScale 曲线建议（自吃力关卡起缩放 + 强制逐关严格递增）。
static func _difficulty_suggestion(difficulty: String, biting: int, level_count: int) -> Dictionary:
	var down := difficulty == DIFFICULTY_TOO_HARD
	var hp_values := _scaled_curve_values("hp_scale",
		HP_SCALE_DOWN_FACTOR if down else HP_SCALE_UP_FACTOR,
		HP_SCALE_MONO_STEP, biting, level_count)
	var speed_values := _scaled_curve_values("speed_scale",
		SPEED_SCALE_DOWN_FACTOR if down else SPEED_SCALE_UP_FACTOR,
		SPEED_SCALE_MONO_STEP, biting, level_count)
	var start := maxi(biting, DIFFICULTY_DEFAULT_START_LEVEL) if biting > 0 else DIFFICULTY_DEFAULT_START_LEVEL
	var feeling := ("太难" if down else "太容易")
	if biting > 0:
		feeling += "（自第 %d 关起吃力）" % start
	var hp_factor := HP_SCALE_DOWN_FACTOR if down else HP_SCALE_UP_FACTOR
	var speed_factor := SPEED_SCALE_DOWN_FACTOR if down else SPEED_SCALE_UP_FACTOR
	var reason := ("难度感受%s；建议自第 %d 关起 hpScale ×%.2f / speedScale ×%.2f，"
		+ "并按 curveRule 强制逐关严格递增（第 1 关教学入口保持不动，禁止相邻关卡整体回落）"
		) % [feeling, start, hp_factor, speed_factor]
	return {
		"question": String(Q2_DIFFICULTY),
		"answer": difficulty,
		"target": "levels[].hp_scale / levels[].speed_scale（spec.numeric.difficulty.curveRule）",
		"direction": "down" if down else "up",
		"start_level": start,
		"values": hp_values + speed_values,
		"reason": reason,
	}


## 单曲线缩放建议值：base[i] = 现行值；自 start（0 起）起乘 factor，再强制逐关严格递增。
## start <= 0 时按 DIFFICULTY_DEFAULT_START_LEVEL（第 2 关，0 起索引 1）。
static func _scaled_curve_values(key: String, factor: float, mono_step: float,
		biting: int, level_count: int) -> Array[Dictionary]:
	var start_index := biting - 1 if biting > 0 else DIFFICULTY_DEFAULT_START_LEVEL - 1
	start_index = clampi(start_index, 1, level_count - 1)
	var values: Array[float] = []
	for i in level_count:
		var base := float(GameState.LEVELS[i].get(key, 1.0))
		values.append(base if i < start_index else base * factor)
	for i in range(1, level_count):
		values[i] = maxf(values[i], values[i - 1] + mono_step)
	var entries: Array[Dictionary] = []
	for i in level_count:
		var base := float(GameState.LEVELS[i].get(key, 1.0))
		var suggested := snappedf(values[i], 0.01)
		if not is_equal_approx(base, suggested):
			entries.append({
				"level": i + 1, "key": key,
				"from": snappedf(base, 0.01), "to": suggested,
			})
	return entries


## Q3 音效紧张感 → v6 BGM 加压层（intenseAssetId=bgm-loop-intense + intenseSwitchRule）建议。
static func _tension_suggestion(stars: int) -> Dictionary:
	var lacks := stars <= 2
	var feeling := "偏不足" if lacks else "偏高压"
	var action := "加压提前 + 基础层音量上调" if lacks else "加压延后 + 基础层音量下调"
	var reason := ("紧张感 %d/5 星%s；建议%s（v6 已声明加压层契约，落地时按建议档调整并保持"
		+ "真实出声能量机判 RMS>0.01 达标）") % [stars, feeling, action]
	return {
		"question": String(Q3_TENSION_STARS),
		"answer": stars,
		"target": "numeric.audio.bgm（v6 紧张感音画分层：intenseAssetId + intenseSwitchRule + volume）",
		"direction": "up" if lacks else "down",
		"values": [
			{"key": "intense_switch_rule", "from": "已出场波次 ≥ ceil(总波次/2) 或最后一波",
				"to": "提前进入加压：ceil(总波次/3)" if lacks else "延后进入加压：最后一波前 1 波"},
			{"key": "bgm_volume", "from": BGM_VOLUME_CURRENT,
				"to": BGM_VOLUME_UP if lacks else BGM_VOLUME_DOWN},
		],
		"reason": reason,
	}


## Q4 好玩度 → ≤2 星给内容扩容方向建议并透传用户一句话（原文、不加工）。
static func _fun_suggestion(stars: int, note: String) -> Dictionary:
	var entry := {
		"question": String(Q4_FUN_STARS),
		"answer": stars,
		"target": "numeric.plants / numeric.zombies / content（内容扩容方向，不做数值定稿）",
		"direction": "content",
		"values": [],
		"reason": "整体好玩度 %d/5 星：数值调参不解决内容问题，建议走内容扩容修订" % stars
			+ "（新植物/僵尸种类与机制），由 owner 在 revisions 里一并拍板",
	}
	if not note.is_empty():
		entry["user_note"] = note
	return entry


## 一句话建议净化：去首尾空白 + 长度截断（防滥用；不做任何内容改写，保持用户原话）。
static func _sanitize_note(text: String) -> String:
	var trimmed := text.strip_edges()
	return trimmed.substr(0, NOTE_MAX_CHARS) if trimmed.length() > NOTE_MAX_CHARS else trimmed


## 修订说明（revisions body.detail 的直接素材：汇总四问 + 用户原话 + 建议条数）。
static func _detail(duration: String, difficulty: String, biting: int, tension: int,
		fun: int, note: String, suggestion_count: int) -> String:
	var biting_note := "（开始吃力：第 %d 关）" % biting if biting > 0 else "（未附关卡号）"
	var lines: PackedStringArray = [
		"试玩反馈四问回填（用户亲手点选，未代填）：",
		"Q1 单局时长：%s" % _duration_label(duration),
		"Q2 难度：%s%s" % [_difficulty_label(difficulty), biting_note],
		"Q3 音效紧张感：%d/5 星" % tension,
		"Q4 整体好玩度：%d/5 星" % fun,
		"数值建议 %d 条（见 suggestions，方向与档位由四问答案确定）；tuning_applied=false，"
			% suggestion_count
			+ "待目标 owner 拍板后走 POST /revisions 入链并同步 game_state.gd 默认值。",
	]
	if not note.is_empty():
		lines.append("用户一句话建议（原文）：%s" % note)
	return "\n".join(lines)


static func _duration_label(duration: String) -> String:
	match duration:
		DURATION_TOO_SHORT:
			return "太短"
		DURATION_TOO_LONG:
			return "太长"
		_:
			return "刚好"


static func _difficulty_label(difficulty: String) -> String:
	match difficulty:
		DIFFICULTY_TOO_EASY:
			return "太容易"
		DIFFICULTY_TOO_HARD:
			return "太难"
		_:
			return "刚好"
