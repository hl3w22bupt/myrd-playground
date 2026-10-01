class_name OakKeyValidator
extends RefCounted
## 本地 key 校验逻辑（取证探针核心）：纯函数、无节点依赖、可无头机判。
##
## 校验规则（全部确定性，冒烟门禁据此断言「有效 / 无效」两条路都可达）：
##   1. 拾到伪造片段（DECOY_CHUNK）→ 无效；
##   2. 有效片段数量不足 → 无效；
##   3. 片段顺序与白名单不一致 → 无效（HUD 会提示目标顺序，玩家可照做）；
##   4. 全部通过 → 有效。
## 「有效 key」只有一个事实来源：VALID_CHUNKS 派生出的 expected_key()，
## 不另设硬编码常量，避免两处漂移。

## key 前缀（不含连接符，连接符由 CHUNK_SEPARATOR 统一负责，避免出现重复「--」）。
const KEY_PREFIX: String = "oak"
const CHUNK_SEPARATOR: String = "-"
## 有效片段白名单（顺序敏感）。片段文本不得包含 CHUNK_SEPARATOR，
## 否则组装出的 key 会出现「--」并让白名单比对失效。
const VALID_CHUNKS: Array[String] = ["OA", "K7", "42"]
## 伪造片段：混进组装序列就必然校验失败。
const DECOY_CHUNK: String = "X9"
## 未集齐时用于展示的占位符。
const MISSING_PLACEHOLDER: String = "??"

## 未拾取任何片段时的占位 key（HUD 初始显示）。
static func placeholder_key() -> String:
	var parts: PackedStringArray = PackedStringArray()
	for chunk in VALID_CHUNKS:
		parts.append(MISSING_PLACEHOLDER)
	return assemble(parts)


## 权威有效 key（由白名单派生）。
static func expected_key() -> String:
	return assemble(PackedStringArray(VALID_CHUNKS))


## 把片段序列组装成 key 串（已拾取片段数不足时用占位符补齐，便于 HUD 展示进度）。
static func assemble(chunks: PackedStringArray) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for index in VALID_CHUNKS.size():
		parts.append(chunks[index] if index < chunks.size() else MISSING_PLACEHOLDER)
	return KEY_PREFIX + CHUNK_SEPARATOR + CHUNK_SEPARATOR.join(parts)


## 校验一次 key 组装结果。返回 {valid: bool, reason: String, key: String}。
static func validate(chunks: PackedStringArray, decoy_collected: bool) -> Dictionary:
	var key: String = assemble(chunks)
	if decoy_collected:
		return {"valid": false, "reason": "检出伪造片段 %s" % DECOY_CHUNK, "key": key}
	if chunks.size() < VALID_CHUNKS.size():
		return {
			"valid": false,
			"reason": "片段不足（%d/%d）" % [chunks.size(), VALID_CHUNKS.size()],
			"key": key,
		}
	for index in VALID_CHUNKS.size():
		if chunks[index] != VALID_CHUNKS[index]:
			return {
				"valid": false,
				"reason": "片段顺序错误（第 %d 位应为 %s）" % [index + 1, VALID_CHUNKS[index]],
				"key": key,
			}
	return {"valid": true, "reason": "校验通过", "key": key}
