extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + 数值调参区 + key 探测取证记录。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（player.gd / main.gd）只读变量，禁止散落魔数。
##
## 取证探针职责（需求 id=cmupslvp7002gm9dh42h3maq5，不计入三样例）：
## - 每次 key 校验都产出可检索的取证标记：日志行 `OAK_KEY_PROBE oak_key_probe=valid|invalid ...`
##   + 存档字段（user://oak_key_probe.json 的 `oak_key_probe` 键）。

## ── 对外信号（场景层订阅，autoload 只 emit 不引用节点）──────────────
signal score_changed(score: int)
signal fragment_collected(count: int, required: int)
signal probe_finished(result: Dictionary)
signal wave_changed(wave: int, wave_count: int)
signal credibility_changed(credibility: int, max_credibility: int)
signal run_finished(outcome: StringName)

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）────────
## 默认值 = 玩法定稿数值；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 探针移动速度（px/s），Player 每物理帧读取。
var move_speed: float = 220.0
## 波次时限缩放（1.0 = 使用 WAVES 里的标称时限；调参面板可整体加速/减速）。
var wave_time_scale: float = 1.0
## 伪造片段巡逻速度缩放（1.0 = WAVES 里的标称频率；难度梯度的一部分）。
var decoy_speed: float = 1.0
## 每局初始「探针信度」：探测无效 / 超时各扣 1，扣到 0 判失败结算。
## （float 存储：调参键统一走 clampf，读取处显式 int() 取整，避免窄化赋值歧义。）
var probe_credits: float = 3.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 60.0, "max": 600.0, "step": 10.0},
	&"wave_time_scale": {"min": 0.05, "max": 2.0, "step": 0.05},
	&"decoy_speed": {"min": 0.0, "max": 3.0, "step": 0.1},
	&"probe_credits": {"min": 1.0, "max": 5.0, "step": 1.0},
}

## ── 波次配置（难度梯度的事实源；scenes 由 main.gd 按它生成片段）────────
## time_seconds = 本波时限；decoys = 伪造片段数量；decoy_amplitude/decoy_frequency =
## 伪造片段水平巡逻的振幅(px)与频率(rad/s) —— 第 1 波静止，越往后越多越快，构成难度梯度。
const WAVES: Array[Dictionary] = [
	{"time_seconds": 25.0, "decoys": 1, "decoy_amplitude": 0.0, "decoy_frequency": 0.0},
	{"time_seconds": 20.0, "decoys": 2, "decoy_amplitude": 40.0, "decoy_frequency": 1.0},
	{"time_seconds": 15.0, "decoys": 3, "decoy_amplitude": 60.0, "decoy_frequency": 1.6},
]
## 过波基础分与时间奖励系数（剩余 1 秒 = 5 分）。
const WAVE_CLEAR_SCORE: int = 100
const TIME_BONUS_PER_SECOND: int = 5

## ── 运行状态 ──────────────────────────────────────────────────────
## 取证存档落点（Web 导出沙箱内也可写）。
const FORENSIC_SAVE_PATH: String = "user://oak_key_probe.json"
## 取证日志前缀：冒烟/部署日志里 grep 这个词即可检索全部探测记录。
const FORENSIC_LOG_TAG: String = "OAK_KEY_PROBE"

var score: int = 0
## 本局已拾取的真实片段数。
var collected_fragments: int = 0
## 本局是否拾到伪造片段（拾到 = 组装出的 key 必然校验失败）。
var decoy_collected: bool = false
## 全部探测记录（跨局累计，供取证检索）。
var probe_history: Array[Dictionary] = []
## 当前波次（1 起）。
var wave: int = 1
## 当前波次剩余时间（秒）；Main 每物理帧 tick_wave() 驱动，UI 直读刷新倒计时。
var wave_time_left: float = 0.0
## 当前探针信度（探测无效 / 超时 -1，0 = 失败结算）。
var credibility: int = 3
## 本局是否已结束（胜利 / 失败结算面板弹出后，探测与计时都停）。
var run_over: bool = false
## 结局："victory" / "defeat"；未结束为空。
var run_outcome: StringName = &""


func _ready() -> void:
	_apply_web_tuning()


## ── 数值调参（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口）────────
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
		# 时限缩放即时生效（调参面板「拖动即改」语义）：当前波剩余时间按新缩放重推。
		if StringName(key) == &"wave_time_scale" and not run_over:
			wave_time_left = wave_time_budget()
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


## ── 局内状态流转 ──────────────────────────────────────────────────
func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


## 拾取一个片段。is_decoy = true 表示伪造片段（计入 decoy_collected，不计入有效片段数）。
func register_fragment(is_decoy: bool) -> void:
	if is_decoy:
		decoy_collected = true
	else:
		collected_fragments += 1
	fragment_collected.emit(collected_fragments, _required_fragments())


## 当前波次需要的有效片段数（= 校验器白名单长度，单一片事实源）。
func _required_fragments() -> int:
	return OakKeyValidator.VALID_CHUNKS.size()


## 当前波次标称时限（缩放后的实际时限，Main 生成波次时用它）。
func wave_time_budget() -> float:
	var config: Dictionary = WAVES[wave - 1]
	return float(config["time_seconds"]) * wave_time_scale


## 开新一局（第一次进入或结算后重开）：波次/信度/拾取状态全部复位。
func start_run() -> void:
	wave = 1
	run_over = false
	run_outcome = &""
	credibility = int(probe_credits)
	wave_time_left = wave_time_budget()
	_reset_pickup_state()
	wave_changed.emit(wave, WAVES.size())
	credibility_changed.emit(credibility, int(probe_credits))


## 清掉当前波（探测有效时调用）：加分（含时间奖励）并推进波次 / 判胜利。
func clear_wave() -> void:
	var bonus: int = int(ceili(maxf(wave_time_left, 0.0)) * float(TIME_BONUS_PER_SECOND))
	score += WAVE_CLEAR_SCORE + bonus
	score_changed.emit(score)
	if wave >= WAVES.size():
		run_over = true
		run_outcome = &"victory"
		run_finished.emit(&"victory")
		return
	wave += 1
	wave_time_left = wave_time_budget()
	_reset_pickup_state()
	wave_changed.emit(wave, WAVES.size())


## 波次计时（Main 每物理帧调用；run_over 后不再驱动）。
## 返回 true 表示本帧恰好计时归零（超时事件，Main 据此扣信度并重铺当前波）。
func tick_wave(delta: float) -> bool:
	if run_over:
		return false
	var before: float = wave_time_left
	wave_time_left = maxf(wave_time_left - delta, 0.0)
	return before > 0.0 and wave_time_left <= 0.0


## 信度 -1（探测无效 / 波次超时共用一条路径）；扣到 0 判失败结算。
func penalize() -> void:
	if run_over:
		return
	credibility = maxi(credibility - 1, 0)
	credibility_changed.emit(credibility, probe_credits)
	if credibility <= 0:
		run_over = true
		run_outcome = &"defeat"
		run_finished.emit(&"defeat")


## 记录一次 key 探测结果：写取证日志 + 取证存档，并向场景层广播。
## result 约定字段：valid(bool) / reason(String) / key(String)。
func record_probe(result: Dictionary) -> void:
	var marker: String = "valid" if bool(result.get("valid", false)) else "invalid"
	var record: Dictionary = {
		"oak_key_probe": marker,
		"reason": String(result.get("reason", "")),
		"key": String(result.get("key", "")),
		"fragments": int(result.get("fragments", collected_fragments)),
		"decoy_collected": decoy_collected,
		"wave": wave,
		"credibility_after": credibility,
		"probe_count": probe_history.size() + 1,
	}
	probe_history.append(record)
	_write_forensic_record(record)
	probe_finished.emit(record)


## 取证落盘：日志一行 + JSON 存档一份。两者都失败也不抛错（取证失败不阻塞玩法）。
func _write_forensic_record(record: Dictionary) -> void:
	print("%s oak_key_probe=%s probe_count=%d wave=%d/%d fragments=%d/%d decoy=%s credibility=%d key=%s reason=%s" % [
		FORENSIC_LOG_TAG,
		String(record["oak_key_probe"]),
		int(record["probe_count"]),
		wave,
		WAVES.size(),
		collected_fragments,
		_required_fragments(),
		"true" if decoy_collected else "false",
		credibility,
		String(record["key"]),
		String(record["reason"]),
	])
	var file: FileAccess = FileAccess.open(FORENSIC_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		print("%s WARN 取证存档写入失败(%s)：%s" % [
			FORENSIC_LOG_TAG, FORENSIC_SAVE_PATH, error_string(FileAccess.get_open_error()),
		])
		return
	file.store_string(JSON.stringify(record, "  "))
	file.close()


## 重开一局：清空本局拾取状态（取证历史跨局保留，供审计）。
func reset_run() -> void:
	_reset_pickup_state()


## 只清拾取进度（保留分数与波次）—— 波次超时重铺用：本波白收的片段不作数。
func reset_pickup() -> void:
	collected_fragments = 0
	decoy_collected = false
	fragment_collected.emit(collected_fragments, _required_fragments())


func _reset_pickup_state() -> void:
	score = 0
	collected_fragments = 0
	decoy_collected = false
	score_changed.emit(score)
	fragment_collected.emit(collected_fragments, _required_fragments())
