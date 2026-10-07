extends Node
## 自动加载单例（autoload）：愿晶收集进度 + 胜负状态 + 数值调参区。
##
## 《冒烟愿晶：一闪即逝的流星，收集三颗即胜》核心规则的单一事实源：
## - 每捕捉 1 颗流星（愿晶载体）记 1 颗愿晶，累计收集 3 颗立即判定胜利；
## - 胜利只由收集数达 WIN_TARGET 触发一次（victory_declared 幂等）；
## - 流星出现节奏与捕捉窗口时长全部走调参区（需求验收标准 5：可配置参数）。
##
## 规范（见 std-skills/godot-game-dev/SKILL.md）：autoload 只放状态与纯逻辑；
## 跨场景通信一律走信号；可调数值集中在 TUNING_META，消费方只读变量。

## 得分（愿晶数）变化：playtest 门禁的通用锚点信号，场景层经 wish_count_changed 刷 UI。
signal score_changed(score: int)
## 愿晶收集进度变化：HUD「x/3」订阅。
signal wish_count_changed(count: int)
## 收集数达 WIN_TARGET：本局只发一次。
signal victory_achieved(count: int)

enum Phase { PLAYING, VICTORY }

## 胜利阈值（需求：收集三颗即胜）。
const WIN_TARGET: int = 3

## 已收集愿晶数（= 得分；与 score_changed 参数同源）。
var score: int = 0
## 当前阶段：PLAYING →（收集满 3）→ VICTORY。
var phase: Phase = Phase.PLAYING

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 节奏默认值按「轻量休闲」定稿：生成密、窗口长、捕获半径宽容 ——
## 随机操作的玩家（含试玩 bot）在 15s 内也能稳定捕到第一颗（playtest 门禁
## first_reward ≤ 10s / 反馈 ≥ 2 条/局 的玩法侧保障）。
## 捕手移动速度（px/s）。
var move_speed: float = 240.0
## 流星划过屏幕的速度（px/s）。
var meteor_speed: float = 150.0
## 流星出现间隔下限/上限（秒）——出现频率可配置（验收标准 5）。
var spawn_interval_min: float = 0.45
var spawn_interval_max: float = 1.1
## 捕捉窗口时长（秒）——窗口一过流星即逝、不可再捕（验收标准 2）。
var meteor_window_seconds: float = 3.4
## confirm 动作（键盘捕获）的作用半径（px）：磁吸式宽容捕获。
var capture_radius: float = 160.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
const TUNING_META: Dictionary = {
	&"move_speed": {"min": 80.0, "max": 600.0, "step": 10.0},
	&"meteor_speed": {"min": 60.0, "max": 420.0, "step": 10.0},
	&"spawn_interval_min": {"min": 0.2, "max": 3.0, "step": 0.1},
	&"spawn_interval_max": {"min": 0.4, "max": 6.0, "step": 0.1},
	&"meteor_window_seconds": {"min": 0.8, "max": 6.0, "step": 0.1},
	&"capture_radius": {"min": 40.0, "max": 200.0, "step": 4.0},
}


func _ready() -> void:
	_apply_web_tuning()


## 捕捉成功：愿晶 +1；达到 WIN_TARGET 立即进入胜利（且只判定一次）。
func add_wish_crystal(amount: int = 1) -> void:
	score += amount
	wish_count_changed.emit(score)
	score_changed.emit(score)
	if score >= WIN_TARGET and phase != Phase.VICTORY:
		phase = Phase.VICTORY
		victory_achieved.emit(score)


## 重开一局：清零愿晶与阶段（胜利结算后「再玩一次」共用此入口）。
func reset() -> void:
	score = 0
	phase = Phase.PLAYING
	wish_count_changed.emit(score)
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
