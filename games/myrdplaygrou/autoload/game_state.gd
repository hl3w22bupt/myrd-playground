extends Node
## 自动加载单例（autoload）：全局对局状态 + 内容表（植物/僵尸/关卡）+ 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（defender.gd / zombie.gd 等）只读变量、禁止散落魔数。
##
## v2（spec 版本 2，approved）：阳光只经三个途径产出且均须点按收集（天降 / 向日葵 / 击杀掉落，
## 细流产出废除）；实体 id 对齐 spec.entities（walker/runner/conehead/buckethead +
## sunflower/peashooter/frostpea/repeater/wallnut）；网格 9×5 / 1024×640。

## 阳光余额变化（点按收集入账时发出）；场景层订阅它刷新 HUD。
signal sun_changed(sun: int)
## 本局累计产出（阳光总收入 = score）变化；机器人试玩门禁（playtest）以此锚定「开局正反馈」。
signal score_changed(score: int)
## 生命（防线被突破次数）变化。
signal lives_changed(lives: int)
## 波次推进（wave 为 0 起索引，wave_count 为总数）。
signal wave_changed(wave: int, wave_count: int)
## 选卡变化（HUD 点按卡片 / 键盘 1-5；-1 = 未选卡），订阅方刷新卡片选中态。
signal card_selected(index: int)
## 卡片进入冷却（布防成功后触发；index = 卡位，seconds = 冷却时长）。
signal card_cooldown_started(index: int, seconds: float)
## 对局终局：true = 通关（全部波次守完），false = 失败（生命耗尽）。
signal game_ended(won: bool)
## 开局（选关或重开）。
signal level_started(level_index: int)

## ── 对局常量 ──
## 初始生命（spec.numeric.player.lives = 5）。
const START_LIVES: int = 5

## ── 出战卡（防御单位内容表，对齐 spec.numeric.plants / entities）──
## cost = 造价（阳光）；hp = 单位血量；shots = 每次开火弹数（0 = 不射击）；
## produce = 向日葵类生产单位；interval_mul = 射击间隔倍率（× fire_interval）；
## slow = 命中减速幅度（僵尸速度 ×(1-slow)，寒冰 0.4 = spec freeze.speedFactor 0.6）；
## recharge = 布防后卡片冷却秒数；tag = 卡片短名；name = 全名。
const CARDS: Array[Dictionary] = [
	{"id": &"sunflower", "tag": "向日葵", "name": "阳光花", "cost": 50, "hp": 300.0,
		"shots": 0, "produce": true, "interval_mul": 1.0, "slow": 0.0, "recharge": 7.5},
	{"id": &"peashooter", "tag": "豌豆", "name": "豌豆射手", "cost": 100, "hp": 300.0,
		"shots": 1, "produce": false, "interval_mul": 1.0, "slow": 0.0, "recharge": 7.5},
	{"id": &"frostpea", "tag": "寒冰", "name": "寒冰射手", "cost": 175, "hp": 300.0,
		"shots": 1, "produce": false, "interval_mul": 1.0, "slow": 0.4, "recharge": 8.0},
	{"id": &"repeater", "tag": "双发", "name": "双发射手", "cost": 200, "hp": 300.0,
		"shots": 2, "produce": false, "interval_mul": 0.5, "slow": 0.0, "recharge": 8.0},
	{"id": &"wallnut", "tag": "坚果", "name": "坚果墙", "cost": 50, "hp": 1200.0,
		"shots": 0, "produce": false, "interval_mul": 1.0, "slow": 0.0, "recharge": 20.0},
]

## ── 僵尸种类（绝对数值 + 击杀掉落阳光，对齐 spec.numeric.zombies / economy.killReward）──
## hp/speed = 该种类绝对基准（难度逐关提升靠波次编制加重，不再乘关卡基准倍率）；
## sun_drop = 击杀掉落的阳光拾取物面额（须点按收集方入账）。
const ZOMBIE_KINDS: Dictionary = {
	&"walker": {"hp": 100.0, "speed": 18.0, "sun_drop": 15},
	&"runner": {"hp": 70.0, "speed": 36.0, "sun_drop": 20},
	&"conehead": {"hp": 220.0, "speed": 18.0, "sun_drop": 25},
	&"buckethead": {"hp": 400.0, "speed": 14.0, "sun_drop": 35},
}

## ── 关卡表（对齐 spec.levels：波次脚本化编制 + 每关起始阳光/节奏）──
## waves[].groups = 本波出怪编制（{kind, count} 顺序展开）；难度机判见 tests/smoke.gd。
## chapter_tint = 章节色（晨绿/暮橙/夜蓝，用于 HUD 外的场景底/房屋/提示条，风格卡 palette 段）。
const LEVELS: Array[Dictionary] = [
	{
		"name": "第 1 关 · 前院晨光", "start_sun": 100, "first_wave_delay": 15.0,
		"wave_gap": 20.0, "spawn_interval": 6.0, "chapter_tint": Color("d5f0dd"),
		"waves": [
			{"groups": [{"kind": &"walker", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 4}]},
		],
	},
	{
		"name": "第 2 关 · 后院黄昏", "start_sun": 150, "first_wave_delay": 12.0,
		"wave_gap": 18.0, "spawn_interval": 5.5, "chapter_tint": Color("f7e3c8"),
		"waves": [
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 1}]},
			{"groups": [{"kind": &"conehead", "count": 2}, {"kind": &"walker", "count": 1}]},
		],
	},
	{
		"name": "第 3 关 · 屋顶夜袭", "start_sun": 200, "first_wave_delay": 10.0,
		"wave_gap": 16.0, "spawn_interval": 5.0, "chapter_tint": Color("cfdff2"),
		"waves": [
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 2}]},
			{"groups": [{"kind": &"conehead", "count": 2}, {"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 1},
				{"kind": &"conehead", "count": 1}, {"kind": &"buckethead", "count": 1}]},
		],
	},
]

## ── 对局状态 ──
## 当前阳光余额（布防货币；只经点按收集入账）。
var sun: int = 100
## 本局累计阳光总收入（= score，三个途径的收集入账之和）。
var score: int = 0
## 剩余生命（僵尸突破防线 -1，归零失败）。
var lives: int = START_LIVES
## 当前关卡（LEVELS 的 0 起索引）。
var level_index: int = 0
## 当前波次（0 起索引；wave_count() 为本关总波数）。
var wave_index: int = 0
## 当前选中的出战卡（CARDS 索引；-1 = 未选卡，布防须先选卡）。
var selected_card: int = 0
## 各卡片布防冷却剩余秒数（CARDS 等长；>0 = 冷却中，禁用态）。
var card_cooldowns: Array[float] = []
## 对局进行中（false = 选关界面 / 结算界面）。
var running: bool = false

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 全部用 float：apply_tuning 走 set() + clampf，类型统一避免 set() 的整型转换歧义。
## 战斗（spec.numeric.combat）
var projectile_damage: float = 20.0        # combat.pea.damage
var projectile_speed: float = 480.0        # combat.pea.speedPxPerSec
var fire_interval: float = 1.5             # plants.*.fireIntervalSec 的基准（repeater ×0.5）
var bite_interval: float = 1.0             # combat.bite.intervalSec
var bite_damage: float = 30.0              # combat.bite.damagePerBite
var freeze_duration: float = 2.0           # combat.freeze.durationSec
var freeze_factor: float = 0.6             # combat.freeze.speedFactor（寒冰卡 slow = 1-factor）
## 阳光经济（spec.numeric.economy）
var sky_drop_interval: float = 12.0        # economy.skyDrop.intervalSec
var sky_drop_yield: float = 25.0           # economy.skyDrop.yield
var sunflower_interval: float = 10.0       # economy.sunflower.intervalSec
var sunflower_yield: float = 25.0          # economy.sunflower.yield
var sun_expire_sec: float = 8.0            # clickCollect.expireSec
var sun_fade_sec: float = 2.0              # clickCollect.fadeOutSec
var sun_tap_radius: float = 44.0           # clickCollect.hitRadiusPx（触屏判定半径）
## 输入与提示（工程内校准项）
var cursor_move_speed: float = 520.0
## 开局操作提示的停留秒数（超时淡出 —— 「操作说明不常驻」排版硬底线）。
var hint_show_seconds: float = 3.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"projectile_damage": {"min": 5.0, "max": 60.0, "step": 1.0},
	&"projectile_speed": {"min": 120.0, "max": 900.0, "step": 20.0},
	&"fire_interval": {"min": 0.15, "max": 3.0, "step": 0.05},
	&"bite_interval": {"min": 0.4, "max": 3.0, "step": 0.1},
	&"bite_damage": {"min": 10.0, "max": 90.0, "step": 5.0},
	&"freeze_duration": {"min": 0.5, "max": 5.0, "step": 0.5},
	&"freeze_factor": {"min": 0.2, "max": 0.95, "step": 0.05},
	&"sky_drop_interval": {"min": 4.0, "max": 24.0, "step": 1.0},
	&"sky_drop_yield": {"min": 5.0, "max": 60.0, "step": 5.0},
	&"sunflower_interval": {"min": 1.0, "max": 20.0, "step": 1.0},
	&"sunflower_yield": {"min": 5.0, "max": 60.0, "step": 5.0},
	&"sun_expire_sec": {"min": 3.0, "max": 15.0, "step": 1.0},
	&"sun_fade_sec": {"min": 0.5, "max": 4.0, "step": 0.5},
	&"sun_tap_radius": {"min": 24.0, "max": 80.0, "step": 4.0},
	&"cursor_move_speed": {"min": 120.0, "max": 900.0, "step": 20.0},
	&"hint_show_seconds": {"min": 0.5, "max": 6.0, "step": 0.5},
}


func _ready() -> void:
	_apply_web_tuning()
	_publish_input_profile()


## 卡片布防冷却推进（autoload 每帧；只做数值衰减，不持场景引用）。
func _process(delta: float) -> void:
	for i in card_cooldowns.size():
		if card_cooldowns[i] > 0.0:
			card_cooldowns[i] = maxf(card_cooldowns[i] - delta, 0.0)


## 把输入画像回写页面（window.__INPUT_PROFILE__）：门禁 / 壳层 / 现场诊断都能直读
## 「引擎侧最终判定 + 各原始信号」，触屏措辞不对时不用猜。
func _publish_input_profile() -> void:
	if OS.has_feature("web"):
		var signals: Variant = JavaScriptBridge.eval(
			"JSON.stringify({ontouchstart: ('ontouchstart' in window),"
			+ "maxTouchPoints: navigator.maxTouchPoints,"
			+ "coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),"
			+ "uaTouch: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)})", true)
		var parsed: Variant = JSON.parse_string(str(signals)) if signals != null else {}
		var meta: Dictionary = parsed if parsed is Dictionary else {}
		var profile := {
			"touch": touch_preferred(),
			"engine_web_feature": OS.has_feature("web"),
			"ontouchstart": meta.get("ontouchstart", null),
			"maxTouchPoints": meta.get("maxTouchPoints", null),
			"coarse": meta.get("coarse", null),
			"uaTouch": meta.get("uaTouch", null),
		}
		var bridge: Object = Engine.get_singleton("JavaScriptBridge")
		bridge.call("eval", "window.__INPUT_PROFILE__ = JSON.parse('%s')" % JSON.stringify(profile))


## 本关配置（LEVELS 只读快照）。
func level() -> Dictionary:
	return LEVELS[clampi(level_index, 0, LEVELS.size() - 1)]


## ── 出战卡取值（对齐 spec.numeric.plants：造价/血量为卡片绝对值，射击间隔=基准×倍率）──

## 当前选中卡的配置（未选卡返回空字典）。
func card() -> Dictionary:
	if selected_card < 0 or selected_card >= CARDS.size():
		return {}
	return CARDS[selected_card]


## 按种类 id 取卡配置（未知 id 回退首卡）。
func card_entry(id: StringName) -> Dictionary:
	for entry: Dictionary in CARDS:
		if entry.get("id", &"") == id:
			return entry
	return CARDS[0]


## 按卡位取卡配置（越界返回空字典）。
func card_at(index: int) -> Dictionary:
	if index < 0 or index >= CARDS.size():
		return {}
	return CARDS[index]


## 当前选中卡 id（未选卡返回空 StringName）。
func current_card_id() -> StringName:
	var entry: Dictionary = card()
	return entry.get("id", &"") as StringName


## 卡片造价（spec.numeric.plants.*.cost 绝对值）。
func card_cost_of(id: StringName) -> int:
	return int(card_entry(id).get("cost", 0))


## 当前选中卡造价（未选卡 = 0）。
func card_cost() -> int:
	return card_cost_of(current_card_id())


## 卡片血量（坚果墙 1200 / 其余 300）。
func card_hp_of(id: StringName) -> float:
	return float(card_entry(id).get("hp", 300.0))


## 卡片单发伤害（弹丸伤害全局：combat.pea.damage）。
func card_damage_of(_id: StringName) -> float:
	return projectile_damage


## 卡片射击间隔 = fire_interval × interval_mul（repeater 0.75s = 1.5 × 0.5）。
func card_interval_of(id: StringName) -> float:
	return fire_interval * float(card_entry(id).get("interval_mul", 1.0))


## 卡片每次开火的弹丸数（双发 = 2；生产/肉盾 = 0）。
func card_shots_of(id: StringName) -> int:
	return int(card_entry(id).get("shots", 1))


## 卡片命中减速幅度（寒冰 0.4 = 冻住后速度 ×0.6）。
func card_slow_of(id: StringName) -> float:
	return float(card_entry(id).get("slow", 0.0))


## 卡片是否生产单位（向日葵）。
func card_produces(id: StringName) -> bool:
	return bool(card_entry(id).get("produce", false))


## 卡片布防冷却时长。
func card_recharge_of(id: StringName) -> float:
	return float(card_entry(id).get("recharge", 7.5))


## 该卡位当前能否布防（未冷却且阳光足够）。reason 供 HUD 禁用态显示原因。
func can_place_card(index: int) -> bool:
	return card_block_reason(index) == ""


## 卡位不可布防的原因（"" = 可布防）。
func card_block_reason(index: int) -> String:
	if index < 0 or index >= CARDS.size():
		return "未选卡"
	if card_cooldowns.size() == CARDS.size() and card_cooldowns[index] > 0.0:
		return "冷却中"
	if sun < card_cost_of(card_at(index).get("id", &"") as StringName):
		return "阳光不足"
	return ""


## 选卡（HUD 点按与键盘 1-5 共用唯一入口）；再点已选卡 = 取消选择（spec input.select-plant）。
func select_card(index: int) -> void:
	if index < 0 or index >= CARDS.size():
		return
	if index == selected_card:
		selected_card = -1
	else:
		selected_card = index
	card_selected.emit(selected_card)


## 取消选卡（点已占格位取消选择的第二入口）。
func deselect_card() -> void:
	if selected_card == -1:
		return
	selected_card = -1
	card_selected.emit(-1)


## 布防成功后调用：进入该卡冷却并取消选择（spec：放置后卡片消费 + 冷却）。
func notify_placed() -> void:
	var index := selected_card
	if index < 0 or index >= CARDS.size():
		return
	var recharge := card_recharge_of(current_card_id())
	if card_cooldowns.size() != CARDS.size():
		card_cooldowns.resize(CARDS.size())
	card_cooldowns[index] = recharge
	card_cooldown_started.emit(index, recharge)
	selected_card = -1
	card_selected.emit(-1)


## ── 触屏优先判定（fail-open，结果缓存；只用于提示文案切换）──
## ⚠️ 教训链（game-8 v5→v5.2 线上三连例）：引擎 is_touchscreen_available() 在 web 不可靠，
## 一票否决式判定会把真机提示藏掉 —— Web 直接问浏览器三信号，探测异常一律按触屏处理。

## -1 = 未探测，0/1 = 探测结果缓存。
var _touch_cache: int = -1


func touch_preferred() -> bool:
	if _touch_cache < 0:
		_touch_cache = 1 if _detect_touch_preferred() else 0
	return _touch_cache == 1


func _detect_touch_preferred() -> bool:
	if OS.has_feature("web"):
		# 三信号之外加 UA 兜底：部分移动仿真（CDP 触摸注入但 hasTouch 关闭）探不到
		# ontouchstart/maxTouchPoints，但手机 UA 本身就是「触屏设备」的可靠证据。
		var touch_capable: Variant = JavaScriptBridge.eval(
			"(function(){try{return 'ontouchstart' in window || navigator.maxTouchPoints > 0"
			+ " || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)"
			+ " || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)"
			+ "}catch(e){return true}})()", true)
		# ⚠️ 教训（v4 线上实证）：eval 的 JS 布尔返回会落成 int(0/1)，GDScript 禁止
		# int 与 bool 直接比较（Invalid operands 'int' and 'bool'）——该运行时错误在
		# release 导出里静默成 null，曾让触屏措辞永久回退键盘文案。此处按形态归一。
		if touch_capable is bool:
			return touch_capable
		if touch_capable is int or touch_capable is float:
			return float(touch_capable) > 0.5
		if touch_capable is String:
			return touch_capable == "true"
		return true  # null / 未知返回形态 → fail-open 按触屏处理
	return DisplayServer.is_touchscreen_available()


## 本关总波数。
func wave_count() -> int:
	return (level().get("waves", []) as Array).size()


## 本关波次脚本（只读快照）。
func wave_script(index: int) -> Dictionary:
	var waves: Array = level().get("waves", [])
	if index < 0 or index >= waves.size():
		return {}
	return waves[index]


## 本关僵尸总数（波次编制求和；供冒烟难度机判与 HUD 概览）。
func level_zombie_count() -> int:
	var total := 0
	for wave: Dictionary in level().get("waves", []):
		for group: Dictionary in wave.get("groups", []):
			total += int(group.get("count", 0))
	return total


## 按波次编制加权的平均血量 / 平均速度（spec.numeric.difficulty.avgHp/avgSpeed 的推导口径：
## 由 levels 各波编制与 zombies 基础值加权求出，禁止另行缩放）。
func level_avg(kind_key: String) -> float:
	var total := 0
	var acc := 0.0
	for wave: Dictionary in level().get("waves", []):
		for group: Dictionary in wave.get("groups", []):
			var count := int(group.get("count", 0))
			var meta: Dictionary = ZOMBIE_KINDS.get(group.get("kind", &"") as StringName, {})
			total += count
			acc += float(count) * float(meta.get(kind_key, 0.0))
	return acc / float(maxi(total, 1))


## 击杀掉落阳光面额（economy.killReward：walker 15 / runner 20 / conehead 25 / buckethead 35）。
func kill_reward(kind: StringName) -> int:
	var meta: Dictionary = ZOMBIE_KINDS.get(kind, {})
	return int(meta.get("sun_drop", 10))


## 开局（选关进入或失败/胜利后重开当前关）：重置对局状态并广播。
func start_level(index: int) -> void:
	level_index = clampi(index, 0, LEVELS.size() - 1)
	wave_index = 0
	sun = int(level().get("start_sun", 100))
	score = 0
	lives = START_LIVES
	selected_card = 0
	card_cooldowns.clear()
	card_cooldowns.resize(CARDS.size())
	running = true
	level_started.emit(level_index)
	sun_changed.emit(sun)
	lives_changed.emit(lives)
	wave_changed.emit(wave_index, wave_count())


## 重开当前关（playtest 驱动在局间也调用本方法；模板协议保留无参签名）。
func reset() -> void:
	start_level(level_index)


## 阳光入账（点按收集的唯一入口：天降 / 向日葵 / 击杀掉落的拾取物收集时调用）。
func add_sun(amount: int) -> void:
	if amount <= 0:
		return
	sun += amount
	score += amount
	sun_changed.emit(sun)
	score_changed.emit(score)


## 布防扣费：余额不足返回 false（调用方给失败反馈），成功扣款并广播。
func spend_sun(amount: int) -> bool:
	if amount > sun:
		return false
	sun -= amount
	sun_changed.emit(sun)
	return true


## 防线被突破：生命 -1；归零即失败（running 置否，广播终局）。
func lose_life() -> int:
	if not running:
		return lives
	lives = maxi(lives - 1, 0)
	lives_changed.emit(lives)
	if lives <= 0:
		running = false
		game_ended.emit(false)
	return lives


## 一波守完：推进波次；最后一波守完即通关（running 置否，广播终局）。
func complete_wave() -> void:
	if not running:
		return
	wave_index += 1
	if wave_index >= wave_count():
		running = false
		game_ended.emit(true)
	else:
		wave_changed.emit(wave_index, wave_count())


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
