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
## v3（spec 版本 4，approved = cmvy3ccqq0010m9y06sz653gh 链上最新 approved）：八关扩容 +
## 难度曲线上调 —— hpScale/speedScale 逐关严格递增（1.00→2.85 / 1.00→1.42，spec
## numeric.difficulty.curveRule），新增坦克巨尸 gargantuar（血量固定 2400 不参与 hpScale、
## 接触植物即碾压）；八关机制差异化（L1 教学引导 / L3 最短波隔 / L4 阳光紧缩+卡槽减员 /
## L5 夜幕迷雾 / L6 混编高压 / L7 boss 关 / L8 终局 + 通关解锁无尽模式）。
## v2 继承：阳光只经三个途径产出且均须点按收集；网格 9×5 / 1024×640。

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
## hp/speed = 该种类绝对基准；出生时再乘关卡 hpScale / speedScale（spec difficulty.curveRule），
## 唯一例外 = boss（gargantuar）：血量固定 2400 不参与 hpScale，速度照常吃 speedScale。
## sun_drop = 击杀掉落的阳光拾取物面额（须点按收集方入账；gargantuar = 100）。
## crush = 接触植物即碾压摧毁（含坚果墙，不进入啃食循环；spec combat.crush）。
const ZOMBIE_KINDS: Dictionary = {
	&"walker": {"hp": 100.0, "speed": 18.0, "sun_drop": 15},
	&"runner": {"hp": 70.0, "speed": 36.0, "sun_drop": 20},
	&"conehead": {"hp": 220.0, "speed": 18.0, "sun_drop": 25},
	&"buckethead": {"hp": 400.0, "speed": 14.0, "sun_drop": 35},
	&"gargantuar": {"hp": 2400.0, "speed": 12.0, "sun_drop": 100,
		"boss": true, "crush": true},
}

## ── 关卡表（对齐 spec.levels 八关：波次脚本化编制 + 每关起始阳光/节奏 + 机制差异）──
## waves[].groups = 本波出怪编制（{kind, count} 顺序展开）；难度机判见 tests/smoke.gd
## （波数/总数/hpScale/speedScale/加权血量/加权速度全部锚定 spec.numeric.difficulty）。
## hp_scale / speed_scale = 本关难度倍率（zombie_hp_of / zombie_speed_of 消费）；
## roster_exclude = 本关移出战卡槽的花色（L4 阳光紧缩：禁用双发射手）；
## sky_drop_interval / sky_drop_yield = 天降阳光覆盖（L4 节流 24s/15，默认 12s/25）；
## night_fog = 夜幕迷雾（L5：第 lit_cols 列及以右遮罩、遮罩内僵尸剪影预显示）；
## chapter_tint = 章节色（晨绿/暮橙/正午暖黄/夜蓝四套，spec acc-flat-palette）。
const LEVELS: Array[Dictionary] = [
	{
		"name": "第 1 关 · 前院晨光（教学）", "start_sun": 100, "first_wave_delay": 15.0,
		"wave_gap": 20.0, "spawn_interval": 6.0, "chapter_tint": Color("d5f0dd"),
		"hp_scale": 1.0, "speed_scale": 1.0, "tutorial": true,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 4}]},
		],
	},
	{
		"name": "第 2 关 · 后院黄昏（标准）", "start_sun": 150, "first_wave_delay": 12.0,
		"wave_gap": 16.0, "spawn_interval": 5.0, "chapter_tint": Color("f7e3c8"),
		"hp_scale": 1.1, "speed_scale": 1.05,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 1},
				{"kind": &"conehead", "count": 2}]},
		],
	},
	{
		"name": "第 3 关 · 屋顶疾风（快速波次）", "start_sun": 150, "first_wave_delay": 10.0,
		"wave_gap": 12.0, "spawn_interval": 4.5, "chapter_tint": Color("f7e3c8"),
		"hp_scale": 1.3, "speed_scale": 1.1,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2}]},
			{"groups": [{"kind": &"runner", "count": 2}, {"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}]},
		],
	},
	{
		"name": "第 4 关 · 温室正午（阳光紧缩）", "start_sun": 100, "first_wave_delay": 12.0,
		"wave_gap": 15.0, "spawn_interval": 5.0, "chapter_tint": Color("fdebd0"),
		"hp_scale": 1.5, "speed_scale": 1.22,
		"sky_drop_interval": 24.0, "sky_drop_yield": 15,
		"roster_exclude": [&"repeater"],
		"waves": [
			{"groups": [{"kind": &"walker", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 3}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 3}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}]},
		],
	},
	{
		"name": "第 5 关 · 后院深夜（夜幕迷雾）", "start_sun": 150, "first_wave_delay": 11.0,
		"wave_gap": 13.0, "spawn_interval": 4.5, "chapter_tint": Color("cfdff2"),
		"hp_scale": 1.75, "speed_scale": 1.25,
		"night_fog": {"lit_cols": 3, "alpha": 0.6, "color": Color("0d1626"),
			"silhouette": Color("6b7f94")},
		"waves": [
			{"groups": [{"kind": &"walker", "count": 4}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 3},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}, {"kind": &"buckethead", "count": 1}]},
		],
	},
	{
		"name": "第 6 关 · 屋顶风暴（混合高压）", "start_sun": 200, "first_wave_delay": 10.0,
		"wave_gap": 12.0, "spawn_interval": 4.0, "chapter_tint": Color("cfdff2"),
		"hp_scale": 2.05, "speed_scale": 1.3,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 4}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 3}]},
			{"groups": [
				{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 3},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 4}]},
			{"groups": [
				{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 3}, {"kind": &"buckethead", "count": 1}]},
		],
	},
	{
		"name": "第 7 关 · 屋顶巨影（坦克巨尸 boss）", "start_sun": 250, "first_wave_delay": 10.0,
		"wave_gap": 11.0, "spawn_interval": 4.0, "chapter_tint": Color("cfdff2"),
		"hp_scale": 2.4, "speed_scale": 1.35,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 4}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
			{"groups": [{"kind": &"gargantuar", "count": 1}, {"kind": &"walker", "count": 2}]},
			{"groups": [{"kind": &"walker", "count": 4}, {"kind": &"runner", "count": 3}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 3},
				{"kind": &"conehead", "count": 2}, {"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"gargantuar", "count": 1}, {"kind": &"walker", "count": 2},
				{"kind": &"runner", "count": 2}, {"kind": &"conehead", "count": 3},
				{"kind": &"buckethead", "count": 1}]},
		],
	},
	{
		"name": "第 8 关 · 终局夜幕（无尽压力）", "start_sun": 250, "first_wave_delay": 10.0,
		"wave_gap": 11.0, "spawn_interval": 3.5, "chapter_tint": Color("cfdff2"),
		"hp_scale": 2.85, "speed_scale": 1.42,
		"waves": [
			{"groups": [{"kind": &"walker", "count": 5}]},
			{"groups": [{"kind": &"walker", "count": 3}, {"kind": &"runner", "count": 3}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 3}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
			{"groups": [{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 4}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 3},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"gargantuar", "count": 1}, {"kind": &"walker", "count": 2},
				{"kind": &"conehead", "count": 1}, {"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"walker", "count": 1}, {"kind": &"runner", "count": 4},
				{"kind": &"conehead", "count": 2}]},
			{"groups": [
				{"kind": &"walker", "count": 2}, {"kind": &"runner", "count": 2},
				{"kind": &"conehead", "count": 2}, {"kind": &"buckethead", "count": 1}]},
			{"groups": [
				{"kind": &"gargantuar", "count": 1}, {"kind": &"walker", "count": 2},
				{"kind": &"runner", "count": 2}, {"kind": &"conehead", "count": 2},
				{"kind": &"buckethead", "count": 1}]},
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
## 无尽模式：通关第 8 关解锁（spec content.replayHooks / acc-playable-loop），会话内记忆。
var endless_unlocked: bool = false
## 无尽模式进行中（start_level(index ≥ LEVELS.size()) 进入；波次无限、不触发胜利终局）。
var endless_active: bool = false
## 各关星级（0 = 未通关；1-3 按剩余生命 1/3/5 对应，spec content.replayHooks 星级结算）。
var level_stars: Array[int] = []

## ── 教学引导（L1 专属，spec levelMechanics.teaching）──
## 目标：首波前建成 ≥2 座布防（向日葵 ≥1 + 射手 ≥1）；完成前 HUD 显示引导提示，完成后淡出。
var tutorial_done: bool = false

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
## 结算浮层防误触窗（毫秒，触屏防连点；ResultOverlay.can_accept 消费）。
## 冒烟在帧预算内要走 8 关「通关 → 下一关」链，经调参通道压缩（生产默认 400ms 不变）。
var overlay_accept_ms: float = 400.0

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


## 本关配置（LEVELS 只读快照；无尽模式返回合成的无尽关配置）。
func level() -> Dictionary:
	if endless_active:
		return _endless_level()
	return LEVELS[clampi(level_index, 0, LEVELS.size() - 1)]


## ── 无尽模式（spec content.replayHooks：通关第 8 关解锁，波次无限、强度按 8% 复合递增
## 并混编坦克巨尸）──
## 复用末关节奏/倍率作底座，血量按 1.08^wave 复合递增；编制由 endless_wave_script 生成。
const ENDLESS_INTENSITY: float = 1.08
const ENDLESS_START_SUN: int = 150


## 无尽关合成配置（借末关章节色/节奏；waves 为空 = 编制走 endless_wave_script）。
func _endless_level() -> Dictionary:
	return {
		"name": "无尽模式", "start_sun": ENDLESS_START_SUN,
		"first_wave_delay": 10.0, "wave_gap": 11.0, "spawn_interval": 3.5,
		"chapter_tint": Color("cfdff2"), "hp_scale": 2.85, "speed_scale": 1.42,
		"waves": [],
	}


## 无尽波次编制（确定性公式，可机判）：基础量随波数缓升，gargantuar 自第 5 波起隔波混编。
func endless_wave_script(wave: int) -> Dictionary:
	var groups: Array[Dictionary] = [
		{"kind": &"walker", "count": 3 + int(float(wave) * 0.5)},
	]
	if wave >= 1:
		groups.append({"kind": &"runner", "count": 1 + wave / 3})
	if wave >= 2:
		groups.append({"kind": &"conehead", "count": 1 + wave / 4})
	if wave >= 3:
		groups.append({"kind": &"buckethead", "count": 1 + (wave - 1) / 4})
	if wave >= 4 and wave % 2 == 0:
		groups.append({"kind": &"gargantuar", "count": 1 + wave / 8})
	return {"groups": groups}


## 无尽强度倍率（血量复合递增；boss 固有血量不参与，见 zombie_hp_of）。
func endless_multiplier() -> float:
	return pow(ENDLESS_INTENSITY, float(maxi(wave_index, 0)))


## ── 出战卡取值（对齐 spec.numeric.plants：造价/血量为卡片绝对值，射击间隔=基准×倍率）──

## 本关出战卡槽（CARDS 按 level().roster_exclude 过滤；L4 阳光紧缩关移除双发射手）。
## 键位 1-5 与 HUD 卡槽都按本表取位 —— 选卡索引 = 本表索引。
var _roster: Array[Dictionary] = []


## 当前卡槽只读快照。
func roster() -> Array[Dictionary]:
	if _roster.is_empty():
		_rebuild_roster()
	return _roster


## 依据当前关重扫卡槽（start_level 调用；选卡/冷却索引随之复位）。
func _rebuild_roster() -> void:
	_roster.clear()
	var exclude: Array = level().get("roster_exclude", [])
	for entry: Dictionary in CARDS:
		if not exclude.has(entry.get("id", &"")):
			_roster.append(entry)


## 当前选中卡的配置（未选卡返回空字典）。
func card() -> Dictionary:
	if selected_card < 0 or selected_card >= roster().size():
		return {}
	return roster()[selected_card]


## 按种类 id 取卡配置（未知 id 回退首卡）。
func card_entry(id: StringName) -> Dictionary:
	for entry: Dictionary in CARDS:
		if entry.get("id", &"") == id:
			return entry
	return CARDS[0]


## 按卡位取卡配置（卡槽表越界返回空字典）。
func card_at(index: int) -> Dictionary:
	if index < 0 or index >= roster().size():
		return {}
	return roster()[index]


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
	if index < 0 or index >= roster().size():
		return "未选卡"
	if card_cooldowns.size() == roster().size() and card_cooldowns[index] > 0.0:
		return "冷却中"
	if sun < card_cost_of(card_at(index).get("id", &"") as StringName):
		return "阳光不足"
	return ""


## 选卡（HUD 点按与键盘 1-5 共用唯一入口）；再点已选卡 = 取消选择（spec input.select-plant）。
func select_card(index: int) -> void:
	if index < 0 or index >= roster().size():
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
	if index < 0 or index >= roster().size():
		return
	var recharge := card_recharge_of(current_card_id())
	if card_cooldowns.size() != roster().size():
		card_cooldowns.resize(roster().size())
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


## 本关总波数（无尽模式返回 0 = 无上限；HUD 按无尽口径显示）。
func wave_count() -> int:
	if endless_active:
		return 0
	return (level().get("waves", []) as Array).size()


## 本关波次脚本（只读快照；无尽模式按 wave_index 生成编制）。
func wave_script(index: int) -> Dictionary:
	if endless_active:
		return endless_wave_script(index)
	var waves: Array = level().get("waves", [])
	if index < 0 or index >= waves.size():
		return {}
	return waves[index]


## ── 关卡难度倍率（spec.numeric.difficulty：hpScale / speedScale 消费口）──

## 本关血量倍率（hpScale：1.00→2.85 逐关严格递增；boss 不参与）。
func level_hp_scale() -> float:
	return float(level().get("hp_scale", 1.0))


## 本关速度倍率（speedScale：1.00→1.42 逐关严格递增；全部僵尸生效）。
func level_speed_scale() -> float:
	return float(level().get("speed_scale", 1.0))


## 僵尸出生血量 = 种类基准 × hpScale（boss 固定血量；无尽再乘 1.08^波复合递增）。
func zombie_hp_of(kind: StringName) -> float:
	var meta: Dictionary = ZOMBIE_KINDS.get(kind, ZOMBIE_KINDS[&"walker"])
	var hp := float(meta.get("hp", 100.0))
	if not bool(meta.get("boss", false)):
		hp *= level_hp_scale()
	if endless_active and not bool(meta.get("boss", false)):
		hp *= endless_multiplier()
	return hp


## 僵尸出生速度 = 种类基准 × speedScale（boss 照常参与速度倍率）。
func zombie_speed_of(kind: StringName) -> float:
	var meta: Dictionary = ZOMBIE_KINDS.get(kind, ZOMBIE_KINDS[&"walker"])
	return float(meta.get("speed", 18.0)) * level_speed_scale()


## 僵尸是否碾压型（gargantuar：接触植物即摧毁，spec combat.crush）。
func zombie_crushes(kind: StringName) -> bool:
	return bool((ZOMBIE_KINDS.get(kind, {}) as Dictionary).get("crush", false))


## 本关僵尸总数（波次编制求和；供冒烟难度机判与 HUD 概览）。
func level_zombie_count() -> int:
	var total := 0
	for wave: Dictionary in level().get("waves", []):
		for group: Dictionary in wave.get("groups", []):
			total += int(group.get("count", 0))
	return total


## 按波次编制加权的平均血量 / 平均速度（spec.numeric.difficulty.avgHp/avgSpeed 的推导口径：
## 编制只数 × 基准值 × hpScale/speedScale 加权求出；坦克巨尸不参与 hpScale（血量固定 2400），
## speedScale 作用于全部僵尸 —— 与 spec 数值逐位吻合，禁止另行缩放）。
func level_avg(kind_key: String) -> float:
	var total := 0
	var acc := 0.0
	for wave: Dictionary in level().get("waves", []):
		for group: Dictionary in wave.get("groups", []):
			var kind := group.get("kind", &"") as StringName
			var count := int(group.get("count", 0))
			total += count
			match kind_key:
				"hp":
					acc += float(count) * zombie_hp_of(kind)
				"speed":
					acc += float(count) * zombie_speed_of(kind)
	return acc / float(maxi(total, 1))


## 击杀掉落阳光面额（economy.killReward：walker 15 / runner 20 / conehead 25 / buckethead 35）。
func kill_reward(kind: StringName) -> int:
	var meta: Dictionary = ZOMBIE_KINDS.get(kind, {})
	return int(meta.get("sun_drop", 10))


## 开局（选关进入或失败/胜利后重开当前关；index ≥ LEVELS.size() = 进入无尽模式）：
## 重置对局状态并广播。
func start_level(index: int) -> void:
	endless_active = index >= LEVELS.size()
	level_index = clampi(index, 0, LEVELS.size() - 1)
	wave_index = 0
	sun = int(level().get("start_sun", 100))
	score = 0
	lives = START_LIVES
	selected_card = 0
	tutorial_done = not tutorial_needed()
	_rebuild_roster()
	card_cooldowns.clear()
	card_cooldowns.resize(roster().size())
	if level_stars.size() != LEVELS.size():
		level_stars.resize(LEVELS.size())
	running = true
	level_started.emit(level_index)
	sun_changed.emit(sun)
	lives_changed.emit(lives)
	wave_changed.emit(wave_index, wave_count())


## 本关是否需要教学引导（第 1 关专属，spec levelMechanics.teaching）。
func tutorial_needed() -> bool:
	return level_index == 0 and bool(LEVELS[0].get("tutorial", false))


## 教学引导完成态评估（布防后由场景层调用）：向日葵 ≥1 + 射手 ≥1 且总数 ≥2 即完成
## （spec acc-resource-loop：首波前建成 ≥2 座豌豆射手，含 1 座向日葵起步）。
func evaluate_tutorial(sunflowers: int, shooters: int, total: int) -> bool:
	if tutorial_done or not tutorial_needed():
		return true
	if sunflowers >= 1 and shooters >= 1 and total >= 2:
		tutorial_done = true
	return tutorial_done


## 重开当前关（playtest 驱动在局间也调用本方法；模板协议保留无参签名）。
## 无尽模式失败重试 = 重新进入无尽（level_index 是被钳制后的 8 关索引，需还原无尽入口）。
func reset() -> void:
	start_level(LEVELS.size() if endless_active else level_index)


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
## 无尽模式：波次无限推进、永不胜利终局（失败仍由生命归零触发）。
func complete_wave() -> void:
	if not running:
		return
	wave_index += 1
	if endless_active:
		wave_changed.emit(wave_index, wave_count())
		return
	if wave_index >= wave_count():
		running = false
		_record_win()
		game_ended.emit(true)
	else:
		wave_changed.emit(wave_index, wave_count())


## 通关结算：星级入档（剩余生命 5/3/1 → 3/2/1 星，spec content.replayHooks）；
## 通关第 8 关解锁无尽模式（acc-playable-loop）。
func _record_win() -> void:
	if level_stars.size() != LEVELS.size():
		level_stars.resize(LEVELS.size())
	var stars := 1
	if lives >= START_LIVES:
		stars = 3
	elif lives >= 3:
		stars = 2
	level_stars[level_index] = maxi(int(level_stars[level_index]), stars)
	if level_index >= LEVELS.size() - 1:
		endless_unlocked = true


## ── 试玩门禁多关轮换（Bug cmvxr1f1a004fm905ua2ua9ir 的试玩侧修复面）──
## 机器人试玩判定器（std-skills/godot-game-dev/scripts/playtest_driver.gd，仓库预置、不可改）
## 按 3 个种子逐局重新实例化主场景。装配根（main.gd::_ready）检测到「本场景由 PlaytestDriver
## 实例化」时读取本游标，把该局对准下一关：3 局种子 → 逐局真实游玩八关表的前 3 关，
## 逐关难度数值（波数/血量/速度/配比）在试玩全程生效，不再只刷第 1 关。
## 边界：正常启动（current_scene == Main）与冒烟（current_scene == Smoke）不读游标；
## 局内重开走 GameState.reset() = 重开当前关，不重建主场景 → 游标不推进，重开语义不变。
var playtest_level_cursor: int = 0


## 试玩驱动上下文取「本局应对准的关」（0 起索引，循环轮换）；仅 main.gd 装配时调用。
func next_playtest_level() -> int:
	var index := playtest_level_cursor % LEVELS.size()
	playtest_level_cursor += 1
	return index


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
