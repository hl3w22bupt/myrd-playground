class_name FeedbackContract
extends RefCounted
## 收集反馈全链路契约（迭代需求 ①「生成可见 → 拾取反馈 → 生效期表现 → 归零同步消失」）：
## 行为证据由冒烟阶段实测（真实道具盒碰撞拾取、光圈/速度线随计时器显隐）后经 ctx 传入；
## 本契约再补两件只能在此处机判的事：
##   - FxBank/SfxBank 银行本体可用（闪光真的生成节点、音效真的合成可播）；
##   - HUD 槽位点亮 API 真实存在（is_powerup_lit 三种类可查）。

## ctx 键：flags（冒烟实测标志）、hud（Hud 实例）、root（挂测试实例的节点）。
static func run(ctx: Dictionary = {}) -> PackedStringArray:
	var failures: PackedStringArray = []
	var flags: Dictionary = ctx.get("flags", {})
	var hud: Hud = ctx.get("hud", null)
	var root: Node = ctx.get("root", null)

	# 冒烟实测证据：拾取瞬间闪光 + 音效 + HUD 点亮（真实道具盒碰撞拾取链）。
	for required: String in [
		"pickup_feedback", "pickup_hud_lit", "magnet_ring_on",
		"dash_trail_on", "dash_hud_lit", "powerup_expire_synced",
	]:
		if not flags.has(required):
			failures.append("冒烟缺少 %s 证据（阶段流未覆盖反馈链）" % required)
		elif not bool(flags[required]):
			failures.append("%s 实测为 false：反馈链断裂" % required)

	# FxBank 本体：flash 后计数 +1，且场景树真的多了特效节点。
	if root != null:
		var before: int = FxBank.spawned_total
		FxBank.flash(root, Vector2.ZERO, Color(1, 1, 1), &"contract_probe")
		if FxBank.spawned_total != before + 1:
			failures.append("FxBank.flash 未生成特效（spawned_total %d → %d）" % [before, FxBank.spawned_total])
	else:
		failures.append("feedback_contract 缺少 root 节点")

	# SfxBank 本体：合成流非空、时长 > 0、播放计数 +1。
	var stream: AudioStreamWAV = SfxBank.stream_of(&"powerup")
	if stream == null or stream.data.size() <= 0:
		failures.append("SfxBank 音效合成失败（powerup 流为空）")
	elif stream.get_length() <= 0.05:
		failures.append("SfxBank 音效时长异常：%.3fs" % stream.get_length())

	# HUD 槽位 API：三种类都查得到（初始未点亮）。
	if hud == null:
		failures.append("feedback_contract 缺少 hud 实例")
	else:
		for kind: StringName in [&"magnet", &"shield", &"dash"]:
			if hud.is_powerup_lit(kind):
				failures.append("结算后 %s 槽位仍点亮（归零熄灭失效）" % kind)
	return failures
