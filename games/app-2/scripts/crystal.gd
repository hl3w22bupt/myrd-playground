class_name Crystal
extends Area2D
## 冒烟愿晶：一颗持续冒烟、发光脉动、限时存在的可收集愿晶（「一闪即逝的流星」）。
##
## 规范要点（见 SKILL.md「场景规范」「反馈完备性（Juice）」）：
## - 收集入口唯一：collect()。已收集/已消散/全局终局（胜利或败局）时一律返回 false
##   （不重复计数、终局后交互失效）—— 与 Main 各守一层，双重拦截；
## - 对外只发信号（collected / expired），由 Main 订阅后加分/判负/挂反馈
##   —— 本脚本不写 UI、不写 GameState 状态；
## - 接触收集走 body_entered（Area2D 物理路径），点选收集由 Main 调 collect()，两路同源；
## - 倒计时时限只读 GameState 调参区（crystal_lifetime / lifetime_decay），无散落魔数。

## 收集成功时发出；Main 订阅它统一走「结果事件处理函数」挂反馈。
signal collected(crystal: Crystal)
## 生命耗尽、流星消散时发出；Main 订阅它交由 GameState 判负。
signal expired(crystal: Crystal)

## 生命末期（剩余 ≤ 此秒数）进入「急闪」预警：闪烁加速、透明度下降 —— 时限信号可视化。
const WARNING_SECONDS: float = 3.0
## 末期最暗透明度：保持可辨（玩家要看清它消散的位置），不允许完全隐形。
const MIN_FADE_ALPHA: float = 0.35

## 已收集的愿晶不再响应任何收集（含重复点击/二次接触）。
var is_collected: bool = false
## 已消散（生命耗尽）的愿晶：同样不可收集、不参与「最近愿晶」检索。
var is_expired: bool = false
## 剩余存活秒数；_ready 与 reset_crystal 时从 GameState 调参区取满值。
var remaining: float = 0.0

var _pulse_time: float = 0.0

@onready var glow: Polygon2D = $Glow


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	remaining = GameState.crystal_lifetime


func _process(delta: float) -> void:
	if is_collected or is_expired:
		return
	# 终局（胜利/败局）后时间冻结：胜局里流星不再消散，败局画面保持静止。
	if not GameState.is_won and not GameState.is_lost:
		remaining -= delta
		if remaining <= 0.0:
			_expire()
			return
	_pulse_time += delta
	_update_fade_visual()


## 收集这颗愿晶：返回是否真的发生了收集。
## 重复收集 / 已消散 / 已胜利 / 已败局 → false（不重复计数、终局交互全部失效）。
func collect() -> bool:
	if is_collected or is_expired:
		return false
	if GameState.is_won or GameState.is_lost:
		return false
	is_collected = true
	visible = false
	# 物理回调内改监控状态必须 deferred，避免「flushing queries」报错。
	set_deferred("monitoring", false)
	set_deferred("monitorable", false)
	collected.emit(self)
	return true


## 重开一局：恢复可收集状态、倒计时回满、视觉复原（Main 在 restart 时对每颗愿晶调用）。
func reset_crystal() -> void:
	is_collected = false
	is_expired = false
	visible = true
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	set_deferred("monitoring", true)
	set_deferred("monitorable", true)
	remaining = GameState.crystal_lifetime
	_pulse_time = 0.0
	glow.scale = Vector2.ONE


## 收集一颗愿晶后由 Main 调用：剩余愿晶的倒计时按难度梯度折减重置（越收集越紧）。
## collected_count 传收集后的 GameState.score：score=1 → 12s×0.75=9s，score=2 → 6.75s。
func tighten_deadline(collected_count: int) -> void:
	if is_collected or is_expired:
		return
	remaining = GameState.crystal_lifetime * pow(GameState.lifetime_decay, float(collected_count))


## 生命耗尽：流星消散。与 collect 同样的 deferred 纪律；只发信号，判负由 Main/GameState 决定。
func _expire() -> void:
	is_expired = true
	remaining = 0.0
	visible = false
	set_deferred("monitoring", false)
	set_deferred("monitorable", false)
	expired.emit(self)


## 常亮脉动 + 末期「一闪即逝」预警：剩余越少闪烁越快、越透明。
func _update_fade_visual() -> void:
	var warning: float = clampf(remaining / WARNING_SECONDS, 0.0, 1.0)
	# 闪烁频率 0.8Hz（宽裕）→ 6.8Hz（将逝），玩家凭节奏就能读出紧迫度。
	var speed: float = 0.8 + (1.0 - warning) * 6.0
	var pulse := 1.0 + 0.1 * sin(_pulse_time * TAU * speed)
	glow.scale = Vector2(pulse, pulse)
	modulate.a = lerpf(MIN_FADE_ALPHA, 1.0, warning)


## 接触收集：捕愿人（Player）走进热区即收集成功（消散后热区已关闭，不会误触）。
func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		collect()
