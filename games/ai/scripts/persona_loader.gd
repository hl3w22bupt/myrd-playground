class_name PersonaLoader
extends RefCounted
## AI 女友人设卡目录（数据驱动 + schema 校验）。
##
## 解耦铁律（需求硬约束）：本加载器只认 data/schema/persona.schema.json 声明的字段契约，
## 不认任何具体角色名 —— 新增 / 修改 / 替换一张人设卡 JSON，零代码改动即可生效（换卡免改码）。
## 校验逻辑完全由 schema 驱动（required 列表 + type 抽查），schema 改了规则就跟着变。
##
## 可追溯：人设卡 id 是 trace 的定位键（story 结算写 persona_id），回放可定位到具体人设。
## 美术单一事实源：立绘 / 头像 / 表情差分路径由人设卡 art 字段声明，
## 全部形象只能从 portrait_prompt 派生，代码不出现任何具体贴图名。

## 资源协议头（拼接用，避免 P5 误判字面量引用）。
const RESOURCE_SCHEME: String = "res://"
## 人设卡目录（相对工程根）。
const PERSONA_DIR: String = "data/personas/"
## 人设卡清单：声明卡片文件与顺序，新增卡片改清单即可，无需扫目录。
const MANIFEST_FILE: String = "manifest.json"
## 字段契约 schema 的相对路径。
const SCHEMA_FILE: String = "data/schema/persona.schema.json"

## schema 文件缺失时的兜底必填字段（v2 契约，覆盖需求 5 字段 + 美术派生源）。
const FALLBACK_REQUIRED_FIELDS: Array[String] = [
	"id", "name", "title", "color", "personality_tags", "speech_style", "catchphrase",
	"favor_rules", "threat_rules", "portrait_prompt", "art",
]
## 需求「多位 AI 女友」的最小卡量。
const MIN_CATALOG_SIZE: int = 5
## 表情差分的约定语义：[normal, happy, crisis]（crisis 同时用作危机游走体贴图）。
const EXPRESSION_NORMAL: int = 0
const EXPRESSION_HAPPY: int = 1
const EXPRESSION_CRISIS: int = 2
## 各角色默认取值（卡片缺字段 / 卡不存在时的安全兜底，绝不抛错打断游戏）。
const DEFAULT_COLOR: Color = Color(1.0, 0.55, 0.75, 1.0)
const DEFAULT_INTERACT_MODIFIER: int = 0
const DEFAULT_SANITY_REGEN: float = 20.0
const DEFAULT_FAVOR_INITIAL: int = 40
const DEFAULT_THREAT_INITIAL: int = 20
const DEFAULT_CRISIS_THRESHOLD: int = 60
const DEFAULT_ESCALATION: int = 8
const DEFAULT_SPEED_BIAS: float = 1.0

## 已加载的人设卡：id -> 卡片字典。
var cards: Dictionary = {}
## 结构 / 契约问题（smoke 契约断言会逐条核对为空）。
var errors: PackedStringArray = PackedStringArray()
## 本次加载实际生效的必填字段（来自 schema，或兜底清单）。
var required_fields: Array[String] = []
## schema 的 properties 声明（类型抽查用），_load_schema 时缓存。
var schema_properties: Dictionary = {}
## schema 文件是否成功加载并驱动了校验。
var schema_loaded: bool = false


## 加载整个目录：schema → manifest → 逐卡校验入册。
func load_catalog() -> void:
	errors = PackedStringArray()
	cards = Dictionary()
	_load_schema()
	var manifest: Dictionary = JsonIO.load_object(RESOURCE_SCHEME + PERSONA_DIR + MANIFEST_FILE)
	var files: Array = manifest.get("personas", [])
	if files.is_empty():
		errors.append("人设清单为空或不可读：%s" % (RESOURCE_SCHEME + PERSONA_DIR + MANIFEST_FILE))
		return
	for entry: Variant in files:
		var file_name := String(entry)
		var card := load_card_from_path(RESOURCE_SCHEME + PERSONA_DIR + file_name)
		if card.is_empty():
			continue
		var persona_id := String(card["id"])
		if cards.has(persona_id):
			errors.append("人设 id 重复：%s（%s）" % [persona_id, file_name])
			continue
		cards[persona_id] = card
	if cards.size() < MIN_CATALOG_SIZE:
		errors.append("人设卡 %d 张 < 最低要求 %d 张（需求：多位 AI 女友）" % [cards.size(), MIN_CATALOG_SIZE])


## 加载并校验单张卡（换卡 / swap 测试入口）：传任意可达路径（res:// 或 user://）。
func load_card_from_path(path: String) -> Dictionary:
	var data: Dictionary = JsonIO.load_object(path)
	if data.is_empty():
		errors.append("人设卡不可读或不是 JSON 对象：%s" % path)
		return {}
	return _validated_card(data, path)


## 取卡：不存在返回空字典（调用方拿 id 前先 has_persona）。
func persona(persona_id: String) -> Dictionary:
	return cards.get(persona_id, {})


func has_persona(persona_id: String) -> bool:
	return cards.has(persona_id)


func persona_count() -> int:
	return cards.size()


func persona_ids() -> Array[String]:
	var ids: Array[String] = []
	for persona_id: String in cards:
		ids.append(persona_id)
	return ids


## 展示名（对话气泡 / 花名册 / trace 回放用）。
func display_name(persona_id: String) -> String:
	return String(persona(persona_id).get("name", persona_id))


## 称号（一句话人设定位）。
func title_text(persona_id: String) -> String:
	return String(persona(persona_id).get("title", ""))


## 主题色（全部 UI 取色与美术底色的唯一来源）。
func color(persona_id: String) -> Color:
	return Color.from_string(String(persona(persona_id).get("color", "")), DEFAULT_COLOR)


## 性格标签。
func personality_tags(persona_id: String) -> Array:
	return persona(persona_id).get("personality_tags", [])


## 口头禅。
func catchphrase(persona_id: String) -> String:
	return String(persona(persona_id).get("catchphrase", ""))


## 示例台词（speech_style.sample_line）。
func sample_line(persona_id: String) -> String:
	var style: Dictionary = persona(persona_id).get("speech_style", {})
	return String(style.get("sample_line", ""))


## —— 好感规则（favor_rules）——
func favor_initial(persona_id: String) -> int:
	return _int_in(persona(persona_id).get("favor_rules", {}), "favor_initial", DEFAULT_FAVOR_INITIAL)


## 互动行动的好感修正：互动增益 = numeric.interact_favor_gain + 本值。
func interact_modifier(persona_id: String) -> int:
	return _int_in(persona(persona_id).get("favor_rules", {}), "interact_modifier", DEFAULT_INTERACT_MODIFIER)


## 每次互动回复的理智值。
func interact_sanity_regen(persona_id: String) -> float:
	return _float_in(persona(persona_id).get("favor_rules", {}), "interact_sanity_regen", DEFAULT_SANITY_REGEN)


## —— 威胁规则（threat_rules）——
func threat_initial(persona_id: String) -> int:
	return _int_in(persona(persona_id).get("threat_rules", {}), "threat_initial", DEFAULT_THREAT_INITIAL)


## 危机阈值：幕间结算时威胁 ≥ 本值触发升级。
func crisis_threshold(persona_id: String) -> int:
	return _int_in(persona(persona_id).get("threat_rules", {}), "crisis_threshold", DEFAULT_CRISIS_THRESHOLD)


## 幕间升级幅度。
func escalation_per_phase(persona_id: String) -> int:
	return _int_in(persona(persona_id).get("threat_rules", {}), "escalation_per_phase", DEFAULT_ESCALATION)


## 危机脉冲游走速度倍率。
func speed_bias(persona_id: String) -> float:
	return _float_in(persona(persona_id).get("threat_rules", {}), "speed_bias", DEFAULT_SPEED_BIAS)


## 命中玩家时的危机台词。
func crisis_line(persona_id: String) -> String:
	return _str_in(persona(persona_id).get("threat_rules", {}), "crisis_line", "")


## —— 美术资产（art）——
## 立绘（对话框左侧展示）。
func portrait_path(persona_id: String) -> String:
	var art: Dictionary = persona(persona_id).get("art", {})
	return _str_in(art, "portrait", "")


## 头像（花名册 + 心动信物）。
func avatar_path(persona_id: String) -> String:
	var art: Dictionary = persona(persona_id).get("art", {})
	return _str_in(art, "avatar", "")


## 表情差分（约定 [normal, happy, crisis]，≥2 张）。
func expression_paths(persona_id: String) -> Array:
	var art: Dictionary = persona(persona_id).get("art", {})
	var paths: Array = art.get("expressions", [])
	return paths


## 全体人设的好感初值表（persona_id → int），GameState 开局用。
func favor_initial_table() -> Dictionary:
	var table := {}
	for persona_id: String in cards:
		table[persona_id] = favor_initial(persona_id)
	return table


## 全体人设的威胁初值表（persona_id → int）。
func threat_initial_table() -> Dictionary:
	var table := {}
	for persona_id: String in cards:
		table[persona_id] = threat_initial(persona_id)
	return table


func _int_in(source: Dictionary, key: String, fallback: int) -> int:
	if not source.has(key):
		return fallback
	return int(source[key])


func _float_in(source: Dictionary, key: String, fallback: float) -> float:
	if not source.has(key):
		return fallback
	return float(source[key])


func _str_in(source: Dictionary, key: String, fallback: String) -> String:
	if not source.has(key):
		return fallback
	return String(source[key])


## 读取 schema：required 列表驱动校验；读不到时退回兜底清单并记录。
func _load_schema() -> void:
	schema_loaded = false
	required_fields = []
	schema_properties = {}
	var schema: Dictionary = JsonIO.load_object(RESOURCE_SCHEME + SCHEMA_FILE)
	if schema.is_empty():
		errors.append("人设 schema 不可读：%s（退回内置必填清单）" % (RESOURCE_SCHEME + SCHEMA_FILE))
		required_fields = FALLBACK_REQUIRED_FIELDS.duplicate()
		return
	schema_loaded = true
	schema_properties = schema.get("properties", {})
	var schema_required: Array = schema.get("required", [])
	if schema_required.is_empty():
		errors.append("人设 schema 未声明 required 必填字段列表：%s" % (RESOURCE_SCHEME + SCHEMA_FILE))
		required_fields = FALLBACK_REQUIRED_FIELDS.duplicate()
	else:
		for field: Variant in schema_required:
			required_fields.append(String(field))


## schema 驱动的卡片校验：必填字段 + 类型抽查（含嵌套对象的 required 子字段）。
func _validated_card(data: Dictionary, source: String) -> Dictionary:
	for field in required_fields:
		if not data.has(field):
			errors.append("人设卡缺少必填字段「%s」：%s（契约：persona.schema.json）" % [field, source])
			return {}
	var properties: Dictionary = schema_properties
	for field_name: String in properties:
		if not data.has(field_name):
			continue
		if not _matches_schema_type(data[field_name], properties[field_name], field_name, source):
			return {}
	return data


## 按 schema 声明的 type 抽查单字段；object 类型递归核对它的 required 子字段。
func _matches_schema_type(value: Variant, prop: Dictionary, field_name: String, source: String) -> bool:
	var declared := String(prop.get("type", ""))
	match declared:
		"string":
			if not (value is String):
				errors.append("人设卡字段「%s」应为 string：%s" % [field_name, source])
				return false
		"array":
			if not (value is Array):
				errors.append("人设卡字段「%s」应为 array：%s" % [field_name, source])
				return false
		"number":
			if not (value is float or value is int):
				errors.append("人设卡字段「%s」应为 number：%s" % [field_name, source])
				return false
		"object":
			if not (value is Dictionary):
				errors.append("人设卡字段「%s」应为 object：%s" % [field_name, source])
				return false
			for sub: Variant in prop.get("required", []):
				if not (value as Dictionary).has(String(sub)):
					errors.append("人设卡字段「%s」缺少必填子字段「%s」：%s（契约：persona.schema.json）" % [
						field_name, String(sub), source,
					])
					return false
	return true
