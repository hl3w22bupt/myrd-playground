class_name EvidenceArchive
extends RefCounted
## 真机取证与试玩量表的「通道层」：只采集原始读数、只拼装用户本人填写的结论，
## 自身不产生任何验收结论（需求红线：不代做、不伪造）。
##
## 三个出口：
##   1. collect_device_data / build_evidence_markdown —— 设备数据一键归档（每项带来源标记）；
##   2. survey 完整性校验 + build_survey_markdown —— 五维量表回填文档（空缺一律拒绝导出）；
##   3. save_markdown —— Web 端触发浏览器下载、桌面端落 user://qa/（路径回显给用户）。
## 归档去向：用户把下载文件放入仓库 games/game-5/qa/（见 qa/README.md 的命名与来源约定）。

const QA_DIR_HINT: String = "games/game-5/qa/"
const GAME_ID: String = "game-5"
const REQUIREMENT_ID: String = "cmujot5ys0051m99i5t96onmo"

## 五维试玩量表维度（需求《game-5 真机验收与试玩回填》§二-1，固定维度 1~5 分 + 一句理由）。
const SURVEY_DIMENSIONS: Array[String] = [
	"移动操控手感",
	"音效体验",
	"难度曲线（原木速度递增）",
	"连击反馈清晰度",
	"整体可玩性",
]

## 结论禁用词：通道产出的文档里不允许出现这些判定性措辞（冒烟机判）。
const CONCLUSION_WORDS: Array[String] = [
	"正常", "流畅", "优秀", "通过", "合格", "完美", "没问题", "符合预期", "结论", "验收通过",
]

const MISSING: String = "未采集（需在真机浏览器打开本页后重新导出）"


## ── 设备数据采集：engine 侧恒可采；Web 侧经桥读 navigator/screen/AudioContext ──
static func collect_device_data(live_url: String) -> Dictionary:
	var fields: Array = []
	fields.append({"key": "采集时间(UTC)", "value": Time.get_datetime_string_from_system(true), "source": "engine:Time"})
	fields.append({"key": "游戏标识", "value": GAME_ID, "source": "常量"})
	fields.append({"key": "来源需求", "value": REQUIREMENT_ID, "source": "常量"})
	fields.append({"key": "当前页面URL", "value": live_url, "source": "location / 常量"})
	fields.append({"key": "引擎平台", "value": OS.get_name(), "source": "engine:OS.get_name"})
	fields.append({"key": "引擎版本", "value": str(Engine.get_version_info().get("string", "")), "source": "engine:Engine.get_version_info"})
	fields.append({"key": "视口尺寸", "value": str(get_viewport_size()), "source": "engine:get_viewport().get_visible_rect"})
	fields.append({"key": "触屏可用", "value": str(DisplayServer.is_touchscreen_available()), "source": "engine:DisplayServer.is_touchscreen_available"})
	fields.append({"key": "系统语言", "value": OS.get_locale(), "source": "engine:OS.get_locale"})
	fields.append({"key": "历史最高分", "value": str(GameState.best_score), "source": "engine:GameState(best_score)"})
	fields.append({"key": "音频已解锁", "value": str(Juice.audio_unlocked), "source": "engine:Juice(audio_unlocked)"})
	fields.append({"key": "静音开关", "value": str(Juice.muted), "source": "engine:Juice(muted)"})
	var tuning := {}
	for key: StringName in GameState.TUNING_META:
		tuning[String(key)] = GameState.get(String(key))
	fields.append({"key": "当前调参值", "value": JSON.stringify(tuning), "source": "engine:GameState(TUNING_META)"})
	# Web 侧原始读数（桌面/无头 eval 恒 null → 标 MISSING，绝不编值）。
	for entry: Dictionary in _collect_web_data():
		fields.append(entry)
	return {"fields": fields}


## Web 侧读数：单条 eval 取回 JSON；任何一项取不到都如实标 MISSING。
static func _collect_web_data() -> Array:
	var js_expr := """
	JSON.stringify((function () {
		var out = {};
		function put(k, v) { try { out[k] = (v === undefined || v === null) ? null : String(v); } catch (e) { out[k] = null; } }
		put('userAgent', navigator.userAgent);
		put('platform', navigator.platform);
		put('language', navigator.language);
		put('maxTouchPoints', navigator.maxTouchPoints);
		put('screen', screen.width + 'x' + screen.height);
		put('devicePixelRatio', window.devicePixelRatio);
		put('viewport', window.innerWidth + 'x' + window.innerHeight);
		try { put('audioContext', window.__audioDebug__ ? JSON.stringify(window.__audioDebug__()) : 'window.__audioDebug__ 未挂载'); } catch (e) { put('audioContext', '取证口调用失败: ' + e); }
		return out;
	})())
	"""
	var parsed := _eval_json(js_expr)
	var labels := {
		"userAgent": "navigator.userAgent",
		"platform": "navigator.platform",
		"language": "navigator.language",
		"maxTouchPoints": "navigator.maxTouchPoints",
		"screen": "screen.width/height",
		"devicePixelRatio": "window.devicePixelRatio",
		"viewport": "window.innerWidth/Height",
		"audioContext": "window.__audioDebug__()",
	}
	var fields: Array = []
	if parsed.is_empty():
		for key: String in labels:
			fields.append({"key": labels[key], "value": MISSING, "source": "%s（Web-only 读数）" % key})
		return fields
	for key: String in labels:
		var raw: Variant = parsed.get(key)
		var value := MISSING if raw == null else str(raw)
		fields.append({"key": labels[key], "value": value, "source": key})
	return fields


static func get_viewport_size() -> Vector2:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return Vector2.ZERO
	return tree.root.get_visible_rect().size


## ── 归档文档（仅原始读数；每项带来源；无任何结论措辞）──
static func build_evidence_markdown(data: Dictionary) -> String:
	var lines := PackedStringArray()
	lines.append("# game-5 设备数据归档（自动采集原始读数）")
	lines.append("")
	lines.append("> 性质：本文件由游戏内「验收中枢页」一键导出，**只含设备原始读数**；")
	lines.append("> 读数如何解读由用户本人在真机实测后另行记录，本文档不作任何判定。")
	lines.append("> 归档方式：下载后放入仓库 `%s`（文件名建议 `%s`）。" % [QA_DIR_HINT, suggested_filename("device-evidence")])
	lines.append("")
	lines.append("| 字段 | 读数 | 来源 |")
	lines.append("| --- | --- | --- |")
	for field: Dictionary in data["fields"]:
		lines.append("| %s | %s | %s |" % [_md_escape(String(field["key"])), _md_escape(String(field["value"])), _md_escape(String(field["source"]))])
	lines.append("")
	return "\n".join(lines)


## ── 五维量表：完整性校验 + 文档拼装（空缺拒绝导出，保证文档只出自用户之手）──
static func survey_complete(answers: Dictionary) -> bool:
	for dimension: String in SURVEY_DIMENSIONS:
		var entry: Variant = answers.get(dimension, {})
		if not (entry is Dictionary):
			return false
		var score: Variant = entry.get("score", 0)
		var reason := str(entry.get("reason", "")).strip_edges()
		if not (score is int or score is float) or int(score) < 1 or int(score) > 5:
			return false
		if reason.is_empty():
			return false
	return str(answers.get("author", "")).strip_edges() != ""


static func build_survey_markdown(answers: Dictionary, live_url: String, tuning_url: String) -> String:
	var author := str(answers.get("author", "")).strip_edges()
	var device := str(answers.get("device", "")).strip_edges()
	var tuning_feedback := str(answers.get("tuning_feedback", "")).strip_edges()
	var played_at := str(answers.get("played_at", "")).strip_edges()
	var lines := PackedStringArray()
	lines.append("# game-5 试玩量表回填（用户本人产出）")
	lines.append("")
	lines.append("| 项 | 值 |")
	lines.append("| --- | --- |")
	lines.append("| 署名（试玩人） | %s |" % _md_escape(author))
	lines.append("| 试玩设备 | %s |" % (_md_escape(device) if not device.is_empty() else "未填写"))
	lines.append("| 试玩时间 | %s |" % (_md_escape(played_at) if not played_at.is_empty() else "未填写"))
	lines.append("| 试玩地址 | %s |" % _md_escape(live_url))
	lines.append("| 调参地址 | %s |" % _md_escape(tuning_url))
	lines.append("")
	lines.append("## 五维量表（1~5 分 + 一句理由）")
	lines.append("")
	lines.append("| 维度 | 分 | 理由 |")
	lines.append("| --- | --- | --- |")
	for dimension: String in SURVEY_DIMENSIONS:
		var entry: Dictionary = answers.get(dimension, {})
		lines.append("| %s | %d | %s |" % [
			_md_escape(dimension), int(entry.get("score", 0)), _md_escape(str(entry.get("reason", ""))),
		])
	lines.append("")
	lines.append("## 调参反馈（对照 GameState.TUNING_META 五键；可留空）")
	lines.append("")
	if tuning_feedback.is_empty():
		lines.append("（未填写）")
	else:
		lines.append(tuning_feedback)
	lines.append("")
	lines.append("> 本文档由用户本人在验收中枢页逐项填写后导出；agent 只提供通道，不代填、不修改。")
	lines.append("> 归档方式：下载后放入仓库 `%s`。" % QA_DIR_HINT)
	lines.append("")
	return "\n".join(lines)


## 落盘：Web 触发浏览器下载；桌面/无头写 user://qa/ 并回显绝对路径。返回给 UI 的提示文本。
static func save_markdown(filename: String, content: String) -> String:
	if Engine.has_singleton("JavaScriptBridge"):
		var bridge: Object = Engine.get_singleton("JavaScriptBridge")
		var payload := JSON.stringify(content)
		var set_result: Variant = bridge.call("eval", "window.__QA_EXPORT__ = %s; 'ok'" % payload)
		if set_result != null and str(set_result) == "ok":
			var js := "(function () { try { var blob = new Blob([window.__QA_EXPORT__], { type: 'text/markdown' });"
			js += " var a = document.createElement('a'); a.href = URL.createObjectURL(blob);"
			js += " a.download = '%s'; document.body.appendChild(a); a.click(); a.remove(); return 'ok'; } catch (e) { return String(e); } })()" % filename
			var dl_result: Variant = bridge.call("eval", js)
			if dl_result != null and str(dl_result) == "ok":
				return "已触发浏览器下载：%s —— 请放入仓库 %s" % [filename, QA_DIR_HINT]
	var dir := "user://qa/"
	DirAccess.make_dir_recursive_absolute(dir)
	var path := dir + filename
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return "导出失败：无法写入 %s" % path
	file.store_string(content)
	file.close()
	return "已写入本机存档：%s（请把该文件放入仓库 %s）" % [ProjectSettings.globalize_path(path), QA_DIR_HINT]


static func suggested_filename(kind: String) -> String:
	var now := Time.get_datetime_dict_from_system()
	return "game5-%s-%04d%02d%02d-%02d%02d.md" % [kind, now["year"], now["month"], now["day"], now["hour"], now["minute"]]


## 结论禁用词自检（冒烟机判：通道产出不得含结论措辞；用户填写内容不受此限）。
static func contains_conclusion(text: String) -> bool:
	for word: String in CONCLUSION_WORDS:
		if text.contains(word):
			return true
	return false


static func _eval_json(js_expr: String) -> Dictionary:
	if not Engine.has_singleton("JavaScriptBridge"):
		return {}
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", js_expr)
	if result == null:
		return {}
	var raw := str(result)
	if raw.is_empty() or raw == "null":
		return {}
	var parsed: Variant = JSON.parse_string(raw)
	return parsed if parsed is Dictionary else {}


static func _md_escape(text: String) -> String:
	return text.replace("|", "\\|").replace("\n", " ")
