extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板七项 + 需求 AC1–AC5 的无头代理断言）：
##   1. 主场景可实例化（main.tscn 接线未断裂，conductor/四轨装配完成）
##   2. autoload 已注册且带约定信号（GameState / Juice）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键核对）
##   4. 玩家能玩：谱面真的在滚动（音符随歌曲时钟下落）——「能动」的游戏侧等价断言
##   5. 核心交互生效：注入轨道按键 → PERFECT 判定落定 + 分数/连击/判定信号全到达
##   6. 胜负可达：时钟快进到谱面终点 → 整局结束信号 + 结算面板可见
##   7. 重开可用：restart 动作 → 状态全部清零、新谱面开跑、结算面板收起
##   8. 结果性事件真的挂了反馈（Juice.events 非空，SKILL.md §3B）
##   9. 调参协议可判（TUNING_META 非空、apply_tuning 钳制与未知键拒绝，§3C）
##  10. 谱面校验通过（时间升序/轨道合法/同轨最小间隔，AC3 代理断言）
##  11. AC1 四轨判定：1000 组带时间戳的模拟输入与窗口定义 100% 一致（独立 oracle 交叉
##      验证）+ ±50/±100 边界精确值 + 轨道级「相邻音符互不吞噬/超窗不吞音符」
##  12. AC2 连击：命中序列逐事件重放，max_combo/得分与重放计算 0 误差；
##      MISS 后 combo 立即归零（打印日志佐证），终局收口 MISS 同样归零
##  13. AC3 难度分级：config/difficulties.json 配置表与代码表逐档奇偶校验、速度/密度
##      单调梯度、每档谱面生成+校验通过；结算页切档生效、重开后按新难度加载谱面
##  14. AC4 移动端触控：四轨分区齐全且沿底部连续铺满、工具按钮与分区零重叠、
##      触控层可见性纪律；延迟校准步长 10ms / ±300 钳制 / 持久化往返
##  15. AC5 结算数据：结算页总分 = PERFECT×100 + GOOD×60 可复算，各判定计数、
##      最大连击与页面文本逐项一致
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   噪声相位只投原始事件（Key/Mouse/Touch），动作级断言在噪声之后的独立相位做。

## ── 噪声相位：正式断言前注入确定种子的对抗输入（悬挂手势/孤儿释放/乱键）──
const NOISE_FRAMES: int = 30

## 各阶段帧号（物理帧，60Hz；Engine.max_fps=60 让 process:physics ≈ 1:1）。
const AC1_FRAME: int = NOISE_FRAMES + 1             # 判定窗口契约（纯逻辑）
const AC2_FRAME: int = AC1_FRAME + 1                # 连击重放一致性（纯逻辑）
const AC3_FRAME: int = AC2_FRAME + 1                # 难度配置表 + 每档谱面校验（纯逻辑）
const AC4_FRAME: int = AC3_FRAME + 1                # 触控分区结构 + 校准持久化
const SCROLL_START_FRAME: int = AC4_FRAME + 2       # 把时钟拨到首个音符下落途中
const SCROLL_END_FRAME: int = SCROLL_START_FRAME + 10   # 记录两次音符 y，断言下落
const HIT_SETUP_FRAME: int = SCROLL_END_FRAME + 1   # 冻结时钟到首个音符判定点
const HIT_INJECT_FRAME: int = HIT_SETUP_FRAME + 1   # 注入轨道按键
const HIT_ASSERT_FRAME: int = HIT_INJECT_FRAME + 4  # 断言判定/分数/连击/反馈
const FINISH_SETUP_FRAME: int = HIT_ASSERT_FRAME + 2  # 时钟拨到谱面终点并解除冻结
const FINISH_ASSERT_FRAME: int = FINISH_SETUP_FRAME + 3  # 断言结束 + 结算数据（AC2/AC5）
const DIFF_SWITCH_FRAME: int = FINISH_ASSERT_FRAME + 2   # 结算页注入难度切换动作
const DIFF_ASSERT_FRAME: int = DIFF_SWITCH_FRAME + 2     # 断言难度已切换且标题刷新
const RESTART_FRAME: int = DIFF_ASSERT_FRAME + 1    # 注入 restart 动作
const TOTAL_FRAMES: int = RESTART_FRAME + 6         # 重开断言（含换档谱面奇偶校验）+ 报告

## 判定「谱面真的在滚动」的最小位移（像素；10 物理帧 × 380px/s ≈ 63px，留余量）。
const MIN_FALL_DISTANCE: float = 30.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"lane_1", &"lane_2", &"lane_3", &"lane_4",
	&"confirm", &"restart", &"diff_prev", &"diff_next",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（AND 语义，见模板 smoke 说明）。
const KEY_CONTRACT: Dictionary = {
	&"lane_1": [KEY_D],
	&"lane_2": [KEY_F],
	&"lane_3": [KEY_J],
	&"lane_4": [KEY_K],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
	&"diff_prev": [KEY_LEFT],
	&"diff_next": [KEY_RIGHT],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: Node2D
var _conductor: Conductor
var _scroll_note: RhythmNote
var _scroll_origin_y: float = 0.0
var _judgment_seen: bool = false
var _score_zero_seen: bool = false
var _noise_rng := RandomNumberGenerator.new()
## 难度切换相位：注入前记录的原始难度与期望切换结果（测完还原，不污染持久化设置）。
var _difficulty_original: int = 0
var _difficulty_expected: int = 0


func _ready() -> void:
	# headless 没有垂直同步：限帧让 process:physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	_difficulty_original = GameState.difficulty
	_check_input_map()
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "combo_changed", "judgment_recorded", "game_finished"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.judgment_recorded.connect(_on_judgment_recorded)
		game_state.score_changed.connect(_on_score_changed)
		_check_tuning_protocol(game_state)
	if get_tree().root.get_node_or_null("Juice") == null:
		_failures.append("autoload Juice 未注册（反馈单例缺失，SKILL.md §3B）")
	if GameState.DIFFICULTY_TABLE.size() < 4:
		_failures.append("难度分级：DIFFICULTY_TABLE 只有 %d 档（需求要求 ≥4 档）" % GameState.DIFFICULTY_TABLE.size())
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（main.tscn 未被 smoke.tscn 实例化）")
		_finished = true
		_report()
		return
	_conductor = _main.get("conductor") as Conductor
	if _conductor == null:
		_failures.append("Main.conductor 未装配（歌曲时钟缺失，玩法无从运行）")
	elif _conductor.lanes.size() != 4:
		_failures.append("轨道装配：%d 条 ≠ 4 条（Main._build_stage 未建满四轨）" % _conductor.lanes.size())


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == AC1_FRAME:
			_run_ac1_judgment_suite()
		elif _frames == AC2_FRAME:
			_run_ac2_combo_replay()
		elif _frames == AC3_FRAME:
			_run_ac3_difficulty_suite()
		elif _frames == AC4_FRAME:
			_run_ac4_touch_suite()
		elif _frames == SCROLL_START_FRAME:
			_setup_scroll_phase()
		elif _frames == SCROLL_END_FRAME:
			_assert_chart_scrolling()
		elif _frames == HIT_SETUP_FRAME:
			_setup_hit_phase()
		elif _frames == HIT_INJECT_FRAME:
			_inject_lane_hit()
		elif _frames == HIT_ASSERT_FRAME:
			_assert_hit_registered()
		elif _frames == FINISH_SETUP_FRAME:
			_setup_finish_phase()
		elif _frames == FINISH_ASSERT_FRAME:
			_assert_game_finished()
		elif _frames == DIFF_SWITCH_FRAME:
			_setup_diff_switch()
		elif _frames == DIFF_ASSERT_FRAME:
			_assert_diff_switched()
		elif _frames == RESTART_FRAME:
			_inject_action(&"restart")
		elif _frames == TOTAL_FRAMES:
			_assert_restarted()
	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## ── 相位 AC1：四轨判定窗口契约（纯逻辑，无头可判）──

func _run_ac1_judgment_suite() -> void:
	# 窗口默认值必须就是需求口径（±50ms / ±100ms；调参可改但出厂值不可偏）。
	if not is_equal_approx(GameState.perfect_window_ms, 50.0) \
			or not is_equal_approx(GameState.good_window_ms, 100.0):
		_failures.append("AC1 判定窗口：出厂窗口 P%.1f/G%.1f ≠ 需求口径 ±50/±100ms" % [
			GameState.perfect_window_ms, GameState.good_window_ms])
	# ① 1000 组带时间戳的模拟输入（±300ms 均匀扫窗 + 随机取反方向）与独立 oracle 对拍。
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261010
	var mismatches := 0
	var seen := {0: false, 1: false, 2: false}
	for i in 1000:
		var delta_ms := -300.0 + 600.0 * float(i) / 999.0
		if rng.randf() < 0.5:
			delta_ms = -delta_ms
		var expected := _oracle_classify(delta_ms, GameState.perfect_window_ms,
			GameState.good_window_ms)
		var actual := int(BeatJudge.classify(delta_ms, GameState.perfect_window_ms,
			GameState.good_window_ms))
		seen[actual] = true
		if actual != expected:
			mismatches += 1
			if mismatches <= 3:
				printerr("AC1 样本：Δ=%.3fms 期望判定 %d 实际 %d" % [delta_ms, expected, actual])
	if mismatches > 0:
		_failures.append("AC1 判定一致性：1000 组模拟输入中 %d 组与窗口定义不一致（要求 100%% 一致）"
			% mismatches)
	if not (seen[0] and seen[1] and seen[2]):
		_failures.append("AC1 判定一致性：三档判定未全部出现（分类器退化）%s" % [seen])
	# ② 边界精确值：≤ 窗口边界判入档、略超即降档（含负方向 = 提前按）。
	for case: Array in [[0.0, 0], [50.0, 0], [-50.0, 0], [50.001, 1], [-50.001, 1],
			[100.0, 1], [-100.0, 1], [100.001, 2], [-100.001, 2], [300.0, 2]]:
		var got := int(BeatJudge.classify(float(case[0]), GameState.perfect_window_ms,
			GameState.good_window_ms))
		if got != int(case[1]):
			_failures.append("AC1 边界：Δ=%sms 判定 %d ≠ %d（±50/±100 窗口边界违约）" % [
				case[0], got, case[1]])
	_run_ac1_lane_suite()


## oracle：需求窗口定义的直译（独立于 BeatJudge 的第二实现，交叉验证防同源盲区）。
func _oracle_classify(delta_ms: float, perfect_ms: float, good_ms: float) -> int:
	var magnitude := absf(delta_ms)
	if magnitude <= perfect_ms:
		return 0
	if magnitude <= good_ms:
		return 1
	return 2


## 轨道级判定：同轨相邻音符互不吞噬、超窗按键不吞音符（AC1 判定口径的集成面）。
func _run_ac1_lane_suite() -> void:
	var chart: Array[Dictionary] = [
		{"time": 10.0, "lane": 0}, {"time": 10.24, "lane": 0},
	]
	# 相邻两音符先后各自命中：都 PERFECT 且互不吞噬。
	var lane := _make_probe_lane(chart)
	var got_first := lane.press(9.96, 0.0)
	var got_second := lane.press(10.20, 0.0)
	if got_first != BeatJudge.Judgment.PERFECT or got_second != BeatJudge.Judgment.PERFECT:
		_failures.append("AC1 轨道判定：相邻两音符连续命中得 %d/%d ≠ PERFECT/PERFECT（互吞或窗口错判）" % [
			got_first, got_second])
	lane.free()
	# 超窗早按（-200ms）：返回 -1（不惩罚）、不吞音符，随后正点仍可 PERFECT。
	lane = _make_probe_lane(chart)
	var early := lane.press(9.80, 0.0)
	var remaining := lane.active_notes_snapshot().size()
	if early != -1 or remaining != 2:
		_failures.append("AC1 轨道判定：超窗早按应返回 -1 且不吞音符（实际 %d，剩余 %d 个）" % [
			early, remaining])
	var late_hit := lane.press(10.0, 0.0)
	if late_hit != BeatJudge.Judgment.PERFECT:
		_failures.append("AC1 轨道判定：早按被拒后正点命中未得 PERFECT（实际 %d）" % late_hit)
	lane.free()


## 构造脱树探针轨道（不进场景树：_physics_process/_draw 不运行，纯判定路径）。
func _make_probe_lane(chart: Array[Dictionary]) -> Lane:
	var lane := Lane.new()
	lane.load_chart(chart)
	for i in chart.size():
		lane.activate_note(i)
	return lane


## ── 相位 AC2：连击收集契约（命中序列逐事件重放，0 误差；MISS 归零有日志佐证）──

## 确定性命中/MISS 序列（P=PREFECT、G=GOOD、M=MISS）：
## P P G M P G M M P P G P → combo 路径 1,2,3,0,1,2,0,0,1,2,3,4；max_combo=4。
const AC2_SCRIPT: Array[int] = [
	BeatJudge.Judgment.PERFECT, BeatJudge.Judgment.PERFECT, BeatJudge.Judgment.GOOD,
	BeatJudge.Judgment.MISS, BeatJudge.Judgment.PERFECT, BeatJudge.Judgment.GOOD,
	BeatJudge.Judgment.MISS, BeatJudge.Judgment.MISS, BeatJudge.Judgment.PERFECT,
	BeatJudge.Judgment.PERFECT, BeatJudge.Judgment.GOOD, BeatJudge.Judgment.PERFECT,
]


func _run_ac2_combo_replay() -> void:
	GameState.reset()
	var expected_combo := 0
	var expected_max := 0
	var expected_score := 0
	var expected := {0: 0, 1: 0, 2: 0}
	var miss_resets := 0
	for judgment in AC2_SCRIPT:
		expected[int(judgment)] += 1
		if judgment == BeatJudge.Judgment.MISS:
			GameState.register_miss(judgment)
			expected_combo = 0
			# MISS 后 combo 必须立即归零 —— 逐条打印日志佐证（AC2 验收口径）。
			if GameState.combo != 0:
				_failures.append("AC2 连击：MISS 后 combo=%d 未立即归零" % GameState.combo)
			else:
				miss_resets += 1
				print("AC2 日志佐证：MISS 落定 → combo 立即归零（第 %d 次）" % miss_resets)
		else:
			GameState.register_hit(int(judgment))
			expected_combo += 1
			expected_max = maxi(expected_max, expected_combo)
			if judgment == BeatJudge.Judgment.PERFECT:
				expected_score += GameState.SCORE_PERFECT
			else:
				expected_score += GameState.SCORE_GOOD
		if GameState.combo != expected_combo:
			_failures.append("AC2 连击：序列重放 combo=%d ≠ 逐步计算 %d（误差≠0）" % [
				GameState.combo, expected_combo])
	# 重放终局对账：最大连击 / 总分 / 各判定计数与逐事件重放计算完全一致（误差 0）。
	if GameState.max_combo != expected_max:
		_failures.append("AC2 连击：最大连击 %d ≠ 重放计算 %d（结算与命中序列不一致）" % [
			GameState.max_combo, expected_max])
	if GameState.score != expected_score:
		_failures.append("AC2 连击：总分 %d ≠ 重放计算 %d（计分与命中序列不一致）" % [
			GameState.score, expected_score])
	if GameState.perfect_count != expected[0] or GameState.good_count != expected[1] \
			or GameState.miss_count != expected[2]:
		_failures.append("AC2 连击：判定计数 P%d/G%d/M%d ≠ 重放计算 P%d/G%d/M%d" % [
			GameState.perfect_count, GameState.good_count, GameState.miss_count,
			expected[0], expected[1], expected[2]])
	print("AC2 日志佐证：重放 %d 事件 → max_combo=%d score=%d（P%d G%d M%d），与逐帧重放计算一致（误差 0）" % [
		AC2_SCRIPT.size(), GameState.max_combo, GameState.score,
		GameState.perfect_count, GameState.good_count, GameState.miss_count])
	GameState.reset()  # 还原干净状态给后续「真实游玩」相位（AC1/AC2 为纯逻辑注入）


## ── 相位 AC3：难度分级契约（配置表奇偶校验 + 梯度 + 每档谱面校验，纯逻辑）──

func _run_ac3_difficulty_suite() -> void:
	var file := FileAccess.open("res://config/difficulties.json", FileAccess.READ)
	if file == null:
		_failures.append("AC3 配置表：res://config/difficulties.json 读取失败（配置表未随需求交付）")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not (parsed is Dictionary) or not ((parsed as Dictionary).has("difficulties")):
		_failures.append("AC3 配置表：difficulties.json 缺少 difficulties 数组（不是合法配置表）")
		return
	var rows: Array = (parsed as Dictionary)["difficulties"]
	if rows.size() != GameState.DIFFICULTY_COUNT:
		_failures.append("AC3 配置表：配置 %d 档 ≠ 代码表 %d 档（两头脱节）" % [
			rows.size(), GameState.DIFFICULTY_COUNT])
		return
	# ⓪ 判定权重奇偶校验（AC5 权重契约：配置表交付值 = 代码生效值）。
	var meta: Dictionary = (parsed as Dictionary).get("meta", {})
	var weights: Dictionary = meta.get("score_weights", {})
	if not weights.is_empty():
		if int(weights.get("perfect", -1)) != GameState.SCORE_PERFECT \
				or int(weights.get("good", -1)) != GameState.SCORE_GOOD:
			_failures.append("AC3 配置表：判定权重 代码 P%d/G%d ≠ 配置表 %s（两头脱节）" % [
				GameState.SCORE_PERFECT, GameState.SCORE_GOOD, weights])
	# ⓪' 判定窗口奇偶校验（AC1 窗口契约的配置表交付面）。
	var windows: Dictionary = meta.get("judge_windows_ms", {})
	if not windows.is_empty():
		if not is_equal_approx(float(windows.get("perfect", -1.0)), GameState.perfect_window_ms) \
				or not is_equal_approx(float(windows.get("good", -1.0)), GameState.good_window_ms):
			_failures.append("AC3 配置表：判定窗口 代码 P%s/G%s ≠ 配置表 %s（两头脱节）" % [
				GameState.perfect_window_ms, GameState.good_window_ms, windows])
	var prev_speed := -1.0
	var prev_interval := INF
	var prev_note_count := -1
	for row: Dictionary in rows:
		var idx := int(row["index"])
		if idx < 0 or idx >= GameState.DIFFICULTY_COUNT:
			_failures.append("AC3 配置表：index %d 越界" % idx)
			return
		var entry: Dictionary = GameState.DIFFICULTY_TABLE[idx]
		var speed_meta: Dictionary = row["fall_speed_px_s"]
		var interval_meta: Dictionary = row["note_interval_s"]
		var speed := float(speed_meta["value"])
		var interval := float(interval_meta["value"])
		# ① 代码表 ↔ 配置表逐档奇偶校验（名字/速度/密度三处一致）。
		if String(entry["name"]) != String(row["name"]):
			_failures.append("AC3 配置表：第 %d 档名称 %s ≠ 配置表 %s" % [
				idx, String(entry["name"]), String(row["name"])])
		if not is_equal_approx(float(entry["fall_speed_px_s"]), speed):
			_failures.append("AC3 配置表：第 %d 档下落速度 %s ≠ 配置表 %s" % [
				idx, String(entry["fall_speed_px_s"]), speed])
		if not is_equal_approx(float(entry["note_interval_s"]), interval):
			_failures.append("AC3 配置表：第 %d 档 note 间隔 %s ≠ 配置表 %s" % [
				idx, String(entry["note_interval_s"]), interval])
		# ② 生效数值落在配置表声明的数值区间内（AC3「落在交付配置表数值区间」口径）。
		if speed < float(speed_meta["min"]) or speed > float(speed_meta["max"]):
			_failures.append("AC3 配置表：第 %d 档速度 %s 越出声明的数值区间 [%s, %s]" % [
				idx, speed, String(speed_meta["min"]), String(speed_meta["max"])])
		if interval < float(interval_meta["min"]) or interval > float(interval_meta["max"]):
			_failures.append("AC3 配置表：第 %d 档间隔 %s 越出声明的数值区间 [%s, %s]" % [
				idx, interval, String(interval_meta["min"]), String(interval_meta["max"])])
		# ③ 梯度：速度严格递增、间隔严格递减（档位间可感知的难度差）。
		if speed <= prev_speed:
			_failures.append("AC3 难度梯度：第 %d 档速度 %s 未严格大于前一档 %s" % [
				idx, speed, prev_speed])
		if interval >= prev_interval:
			_failures.append("AC3 难度梯度：第 %d 档间隔 %s 未严格小于前一档 %s" % [
				idx, interval, prev_interval])
		# ④ 每档谱面独立生成并通过校验（与 conductor.start 同参数同路径）。
		var chart := ChartGen.generate(Conductor.SONG_DURATION_S, interval,
			Conductor.SEED_BASE + idx)
		var chart_error := ChartGen.validate(chart, Conductor.SONG_DURATION_S)
		if not chart_error.is_empty():
			_failures.append("AC3 谱面校验：第 %d 档（%s）校验失败：%s" % [idx, String(row["name"]), chart_error])
		if chart.size() <= prev_note_count:
			_failures.append("AC3 难度梯度：第 %d 档音符数 %d 未严格多于前一档 %d（密度无梯度）" % [
				idx, chart.size(), prev_note_count])
		# 密度上界：生成器不得比声明间隔更密（下界放宽一倍容许同轨顺延损耗）。
		var notes_per_sec := float(chart.size()) / Conductor.SONG_DURATION_S
		if notes_per_sec > 1.0 / interval + 0.01 or notes_per_sec < 0.5 / interval - 0.01:
			_failures.append("AC3 密度区间：第 %d 档密度 %.3f 音符/秒越出 [%.3f, %.3f]（配置表 %.2fs 间隔）" % [
				idx, notes_per_sec, 0.5 / interval, 1.0 / interval, interval])
		prev_speed = speed
		prev_interval = interval
		prev_note_count = chart.size()
	# ⑤ 生效公式：轨道实际下落速度 = 表值 × 调参倍率（当前档位抽查）。
	var entry_now: Dictionary = GameState.DIFFICULTY_TABLE[GameState.difficulty]
	if not is_equal_approx(GameState.fall_speed_px_s(),
			float(entry_now["fall_speed_px_s"]) * GameState.note_speed_scale):
		_failures.append("AC3 生效速度：fall_speed_px_s()=%s ≠ 表值 %s × 倍率 %s" % [
			GameState.fall_speed_px_s(), String(entry_now["fall_speed_px_s"]),
			GameState.note_speed_scale])


## ── 相位 AC4：移动端触控契约（分区结构 + 校准步长/钳制/持久化）──

func _run_ac4_touch_suite() -> void:
	var touch_ui: CanvasLayer = _main.get("touch_ui")
	if touch_ui == null:
		_failures.append("AC4 触控：TouchUI CanvasLayer 未装配（main._build_touch_ui 缺失）")
		return
	# 可见性纪律：只由 is_touchscreen_available() 决定（SKILL.md §3A，禁用平台特征代替）。
	if touch_ui.visible != DisplayServer.is_touchscreen_available():
		_failures.append("AC4 触控：TouchUI 可见性未按 is_touchscreen_available() 决定（实际 %s）" % [
			str(touch_ui.visible)])
	# ① 四轨分区齐全、矩形热区有效、沿底部连续铺满不重叠。
	var lane_rects: Array[Rect2] = []
	var lane_actions: Dictionary = {}
	for child in touch_ui.get_children():
		var button := child as TouchActionButton
		if button == null:
			continue
		var action := String(button.action_name)
		if not action.begins_with("lane_"):
			continue
		var shape := button.shape as RectangleShape2D
		if shape == null:
			_failures.append("AC4 触控：分区 %s 缺少矩形热区" % action)
			continue
		lane_rects.append(Rect2(button.position, shape.size))
		lane_actions[action] = true
	for i in Conductor.LANE_COUNT:
		if not lane_actions.has("lane_%d" % (i + 1)):
			_failures.append("AC4 触控：缺少轨道分区 lane_%d（四轨触控分区不全，多点并发无从谈起）" % (i + 1))
	if lane_rects.size() == Conductor.LANE_COUNT:
		lane_rects.sort_custom(func(a: Rect2, b: Rect2) -> bool: return a.position.x < b.position.x)
		var cursor := 0.0
		var band_ok := true
		for rect in lane_rects:
			if not is_equal_approx(rect.position.x, cursor) or rect.position.y < 1100.0:
				band_ok = false
				break
			cursor = rect.end.x
		if not band_ok or cursor < 719.0:
			_failures.append("AC4 触控：四轨分区未沿屏幕底部连续铺满 0..720（游标终点 %.0f）" % cursor)
		# ② 工具按钮（重开/校准/难度）热区不得与四轨分区重叠（重叠 = 击打误触）。
		for child in touch_ui.get_children():
			var button2 := child as TouchActionButton
			if button2 == null:
				continue
			if String(button2.action_name).begins_with("lane_"):
				continue
			var shape2 := button2.shape as RectangleShape2D
			if shape2 == null:
				continue
			var utility := Rect2(button2.position, shape2.size)
			for rect in lane_rects:
				if utility.intersects(rect):
					_failures.append("AC4 触控：按钮 %s 热区 %s 与轨道分区 %s 重叠（移动端会误触）" % [
						String(button2.name), utility, rect])
	_run_ac4_calibration_suite()


## 延迟校准契约：步长 10ms、±300ms 钳制、保存后重读恢复（重启仍生效的代理断言）。
## 测完还原原始值，不污染本机持久化设置。
func _run_ac4_calibration_suite() -> void:
	var original := GameState.calibration_offset_ms
	GameState.calibration_offset_ms = 0.0
	GameState.add_calibration(5.0)  # 不足一步 → 就近取整到 10ms 步长
	if not is_equal_approx(GameState.calibration_offset_ms, 10.0):
		_failures.append("AC4 校准：+5ms 应按步长取整为 +10ms，实际 %s" % [
			GameState.calibration_offset_ms])
	GameState.add_calibration(3000.0)
	if not is_equal_approx(GameState.calibration_offset_ms, 300.0):
		_failures.append("AC4 校准：+3000ms 未钳制在上界 +300ms（实际 %s）" % [
			GameState.calibration_offset_ms])
	GameState.add_calibration(-3000.0)
	if not is_equal_approx(GameState.calibration_offset_ms, -300.0):
		_failures.append("AC4 校准：−3000ms 未钳制在下界 −300ms（实际 %s）" % [
			GameState.calibration_offset_ms])
	# 持久化往返：写盘 → 篡改内存态 → 重读恢复（等价「重启 App 后设置仍生效」）。
	GameState.calibration_offset_ms = 40.0
	GameState.save_settings()
	GameState.calibration_offset_ms = 999.0
	GameState._load_settings()
	if not is_equal_approx(GameState.calibration_offset_ms, 40.0):
		_failures.append("AC4 校准：设置保存后重读未恢复 40ms（持久化断裂，实际 %s）" % [
			GameState.calibration_offset_ms])
	GameState.calibration_offset_ms = original
	GameState.save_settings()


## ── 相位 4：谱面滚动（「玩家能玩」的运动断言）──

func _setup_scroll_phase() -> void:
	if _conductor == null or _conductor.lanes.is_empty():
		return
	_conductor.song_time = 3.0  # 拨到首个音符（3.8s）下落途中，激活循环下帧生效


func _assert_chart_scrolling() -> void:
	if _conductor == null:
		return
	if not _conductor.validation_error.is_empty():
		_failures.append(_conductor.validation_error)
	var note0_lane: int = int(_conductor.get_note(0)["lane"])
	var notes: Array[RhythmNote] = _conductor.lanes[note0_lane].active_notes_snapshot()
	if notes.is_empty():
		_failures.append("谱面滚动断言：轨道 %d 在时钟 %.2fs 时没有活跃音符（激活循环未生效）" % [
			note0_lane, _conductor.song_time])
		return
	_scroll_note = notes[0]
	_scroll_origin_y = _scroll_note.position.y
	if _scroll_note.position.y >= Conductor.JUDGMENT_Y:
		_failures.append("谱面滚动断言：音符 y=%.0f 不在判定线上方（时钟与位置关系断裂）" % _scroll_note.position.y)


## ── 相位 5：核心交互（轨道按键 → 判定）──

func _setup_hit_phase() -> void:
	if _conductor == null or _scroll_note == null:
		return
	_conductor.paused = true          # 冻结歌曲时钟（结算页同款暂停语义）
	var note0: Dictionary = _conductor.get_note(0)
	_conductor.song_time = float(note0["time"])  # 时钟正对首个音符 → 理应 PERFECT
	# 滚动相位通常已激活该音符；万一没有（极端帧序）才手动补激活，保持 conductor 状态一致。
	var lane: Lane = _conductor.lanes[int(note0["lane"])]
	if lane.active_notes_snapshot().is_empty():
		lane.activate_note(0)


func _inject_lane_hit() -> void:
	if _conductor == null:
		return
	_inject_action(StringName("lane_%d" % (int(_conductor.get_note(0)["lane"]) + 1)))


func _assert_hit_registered() -> void:
	if not _judgment_seen:
		_failures.append("核心交互断言：正对音符按键未产生任何判定（lane.press → judgment_recorded 链路断裂）")
	if GameState.perfect_count < 1:
		_failures.append("核心交互断言：PERFECT 计数 %d < 1（±50ms 窗口内按键未记 PERFECT）" % GameState.perfect_count)
	if GameState.score < GameState.SCORE_PERFECT:
		_failures.append("核心交互断言：分数 %d < %d（PERFECT 未按权重计分）" % [GameState.score, GameState.SCORE_PERFECT])
	if GameState.combo != 1:
		_failures.append("核心交互断言：连击 %d ≠ 1（首次命中未累计 combo）" % GameState.combo)
	if Juice.events.is_empty():
		_failures.append("反馈断言：命中结果事件没有触发任何 Juice 反馈（SKILL.md §3B，如确实移除反馈请同步更新本断言）")


## ── 相位 6：胜负可达 ──

func _setup_finish_phase() -> void:
	if _conductor == null:
		return
	_conductor.song_time = _conductor.song_end_time() + 0.1
	_conductor.paused = false  # 解除冻结，下一物理帧触发终局收口 + finished


func _assert_game_finished() -> void:
	if _conductor != null and _conductor.playing:
		_failures.append("胜负可达断言：时钟已过谱面终点但局未结束（conductor.finished 链路断裂）")
	var results: PanelContainer = _main.get("results_panel")
	if results == null or not results.visible:
		_failures.append("胜负可达断言：整局结束后结算面板未显示（game_finished → results_panel 断裂）")
	# AC2：终局收口把未命中音符按 MISS 结算 → combo 必须归零（最大连击保留）。
	if GameState.combo != 0:
		_failures.append("AC2 连击：终局收口 MISS 后 combo=%d 未归零（漏按未清零）" % GameState.combo)
	else:
		print("AC2 日志佐证：终局收口 MISS → combo 归零（最大连击保留 %d）" % GameState.max_combo)
	# AC5：总分按判定权重可人工复算（Perfect=100 / Good=60），结算页逐项一致。
	var expected_score: int = GameState.perfect_count * GameState.SCORE_PERFECT \
		+ GameState.good_count * GameState.SCORE_GOOD
	if GameState.score != expected_score:
		_failures.append("AC5 结算：总分 %d ≠ PERFECT%d×100 + GOOD%d×60 = %d（权重复算不一致）" % [
			GameState.score, GameState.perfect_count, GameState.good_count, expected_score])
	var results_label := _main.get("results_label") as Label
	if results_label == null:
		_failures.append("AC5 结算：结算页文本节点缺失（results_label 未装配）")
	else:
		var text := results_label.text
		for needle: String in [
			"总分 %d\n" % GameState.score,
			"最大连击 %d\n" % GameState.max_combo,
			"PERFECT %d ·" % GameState.perfect_count,
			"GOOD %d ·" % GameState.good_count,
			"MISS %d\n" % GameState.miss_count,
		]:
			if not text.contains(needle):
				_failures.append("AC5 结算：结算页缺少数据「%s」（实际文本：%s）" % [
					needle.strip_edges(), text.replace("\n", " / ")])


## ── 相位 AC3-切档：结算页切换难度（真实输入路径 diff_prev/diff_next）──

func _setup_diff_switch() -> void:
	var before := GameState.difficulty
	var step := 1 if before < GameState.DIFFICULTY_COUNT - 1 else -1
	_difficulty_expected = before + step
	_inject_action(&"diff_next" if step == 1 else &"diff_prev")


func _assert_diff_switched() -> void:
	if GameState.difficulty != _difficulty_expected:
		_failures.append("AC3 难度切换：难度 %d ≠ 期望 %d（结算页 diff_prev/diff_next 切换断裂）" % [
			GameState.difficulty, _difficulty_expected])
	var title := _main.get("title_label") as Label
	if title != null and not title.text.contains(GameState.difficulty_name()):
		_failures.append("AC3 难度切换：标题未刷新为新难度「%s」（实际「%s」）" % [
			GameState.difficulty_name(), title.text])
	var results := _main.get("results_panel") as PanelContainer
	if results != null and not results.visible:
		_failures.append("AC3 难度切换：切档后结算面板意外收起（切档入口只在结算页开放）")


## ── 相位 7：重开可用 ──

func _assert_restarted() -> void:
	if GameState.score != 0 or GameState.combo != 0 or GameState.max_combo != 0:
		_failures.append("重开断言：restart 后 score/combo/max_combo = %d/%d/%d 未清零" % [
			GameState.score, GameState.combo, GameState.max_combo])
	if GameState.perfect_count != 0 or GameState.miss_count != 0:
		_failures.append("重开断言：restart 后判定计数未清零（P%d M%d）" % [
			GameState.perfect_count, GameState.miss_count])
	if _conductor != null and not _conductor.playing:
		_failures.append("重开断言：restart 后新谱面未开跑（conductor.restart 未复位 playing）")
	# AC3：换档重开后，谱面按新难度参数加载且校验通过（配置表 → 生成 → 生效 全链一致）。
	if _conductor != null:
		if not _conductor.validation_error.is_empty():
			_failures.append("AC3 切档后谱面校验失败：%s" % _conductor.validation_error)
		var expected_count := ChartGen.generate(Conductor.SONG_DURATION_S,
			GameState.note_interval_s(), Conductor.SEED_BASE + GameState.difficulty).size()
		if _conductor.notes.size() != expected_count:
			_failures.append("AC3 换档加载：重开后音符数 %d ≠ 新难度配置生成 %d（谱面未按难度切换加载）" % [
				_conductor.notes.size(), expected_count])
	if not _score_zero_seen:
		_failures.append("重开断言：未收到复位后的 score_changed(0) 信号（GameState.reset 广播断裂）")
	var results: PanelContainer = _main.get("results_panel")
	if results != null and results.visible:
		_failures.append("重开断言：restart 后结算面板未收起")


## ── 通用注入与契约断言 ──

func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


func _check_input_map() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）" % [
				action, _key_labels(expected), _key_labels(bound)])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）——模板同款。
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 3)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 3)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 3)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.80:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 调参协议（SKILL.md §3C）：检查完必须恢复原状，不得污染被测状态。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键）")
		return
	var original: Variant = game_state.get("perfect_window_ms")
	var applied: PackedStringArray = game_state.call("apply_tuning",
		{"perfect_window_ms": 99999.0, "tuning_bogus_key": 1})
	if not applied.has("perfect_window_ms"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 perfect_window_ms（应用逻辑断裂）")
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var window: Variant = game_state.get("perfect_window_ms")
	if not (window is float or window is int) or float(window) > 80.0:
		_failures.append("调参协议：perfect_window_ms=%s 超出 TUNING_META.max=80（钳制缺失）" % [window])
	if applied.has("perfect_window_ms") and original != null:
		game_state.set("perfect_window_ms", original)


func _report() -> void:
	# 还原被切档相位改动的难度偏好（冒烟不得污染本机持久化设置）。
	if GameState.difficulty != _difficulty_original:
		GameState.set_difficulty(_difficulty_original)
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/InputMap+键位契约/谱面滚动/轨道判定/胜负可达/重开/反馈/调参/谱面校验/AC1判定窗口(1000组+边界+互吞)/AC2连击重放+归零日志/AC3配置表奇偶+梯度+切档加载/AC4触控分区+校准持久化/AC5结算复算 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_judgment_recorded(_judgment: int) -> void:
	_judgment_seen = true


func _on_score_changed(score: int) -> void:
	if score == 0 and _frames > RESTART_FRAME - 4:
		_score_zero_seen = true
