class_name QrCodec
extends RefCounted
## 极简 QR Code 编码器（ISO/IEC 18004，Byte 模式，纠错级 M，版本 1~10）。
##
## 用途（验收中枢页）：把 liveUrl 编成模块矩阵，供 AcceptanceHub 用 draw_rect 画成
## 可被 iPhone 相机扫开的二维码；不引第三方资产，纯计算可无头断言。
## 正确性锚点：tests/smoke.gd 内置 3 条黄金向量（v1/v4/v9 × 掩码 0/3），
## 与独立参考实现（Python qrcode）逐模块比对 md5 —— 编码器改动必须保持全绿。
## 只支持 Byte 模式：URL/文本载荷均为 ASCII（中文请先 encodeURIComponent）。

const EC_M_FORMAT_BITS: int = 0  ## 纠错级 M 的 2 位标识（L=01 M=00 Q=11 R=10）
const FORMAT_GEN_POLY: int = 0x537  ## 格式信息 BCH(15,5) 生成多项式
const FORMAT_MASK_XOR: int = 0x5412
const VERSION_GEN_POLY: int = 0x1F25  ## 版本信息 BCH(18,6) 生成多项式（v≥7）
const PAD_BYTES: Array[int] = [0xEC, 0x11]

## 每版本总码字；v2~v6 数据区尾部余 7 个冗余位，其余为 0。
const TOTAL_CODEWORDS: Array[int] = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const REMAINDER_BITS: Array[int] = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0]
## 校正图形中心坐标（跳过与定位图形重叠的 [6,6]）。
const ALIGNMENT_CENTERS: Array = [
	[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
	[6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
]
## 纠错级 M 的分块表：每项是若干 [块数, 每块总码字, 每块数据码字]。
const RS_BLOCKS_M: Array = [
	[[1, 26, 16]], [[1, 44, 28]], [[1, 70, 44]], [[2, 50, 32]], [[2, 67, 43]],
	[[4, 43, 27]], [[4, 49, 31]], [[2, 60, 38], [2, 61, 39]],
	[[3, 58, 36], [2, 59, 37]], [[4, 69, 43], [1, 70, 44]],
]

var _gf_exp: PackedInt32Array = PackedInt32Array()
var _gf_log: PackedInt32Array = PackedInt32Array()


func _init() -> void:
	# GF(256)，本原多项式 0x11D；exp 表扩到 511 免乘法回绕判断。
	_gf_exp.resize(512)
	_gf_log.resize(256)
	var x: int = 1
	for i in range(255):
		_gf_exp[i] = x
		_gf_log[x] = i
		x <<= 1
		if x & 0x100:
			x ^= 0x11D
	for i in range(255, 512):
		_gf_exp[i] = _gf_exp[i - 255]


func _gf_mul(a: int, b: int) -> int:
	if a == 0 or b == 0:
		return 0
	return _gf_exp[_gf_log[a] + _gf_log[b]]


## 编码入口：text → 矩阵。返回 {} 或 {size, modules, version, mask}；
## modules 为行优先 0/1（PackedByteArray），供绘制与测试逐模块比对。
## forced_mask 传 -1 = 按规范罚分自动选掩码；测试向量传固定掩码保证与参考实现逐位可比。
func encode(text: String, forced_mask: int = -1) -> Dictionary:
	var payload := text.to_utf8_buffer()
	if payload.size() > 214:
		return {}
	var data_codewords := _build_data_codewords(payload)
	if data_codewords.is_empty():
		return {}
	var all_codewords := _add_error_correction(data_codewords)
	var version: int = data_codewords[&"version"]
	var best := {}
	var best_penalty: int = 1 << 30
	for mask in range(8):
		if forced_mask != -1 and mask != forced_mask:
			continue
		var matrix := _build_matrix(version, all_codewords, mask)
		if forced_mask != -1:
			return {"size": matrix.size(), "modules": _flatten(matrix), "version": version, "mask": mask}
		var penalty := _penalty(matrix)
		if best.is_empty() or penalty < best_penalty:
			best_penalty = penalty
			best = {"size": matrix.size(), "modules": _flatten(matrix), "version": version, "mask": mask}
	return best


## 矩阵 → 行优先 "1"/"0" 字符串（冒烟黄金向量比对的规范化形态）。
static func modules_to_string(result: Dictionary) -> String:
	var out := ""
	var modules: PackedByteArray = result["modules"]
	for i in range(modules.size()):
		out += "1" if modules[i] == 1 else "0"
	return out


## ── 数据码字：模式头 + 长度 + 载荷 + 终止符 + 补位 ──
func _build_data_codewords(payload: PackedByteArray) -> Dictionary:
	for version in range(1, 11):
		var data_total: int = 0
		for block: Array in RS_BLOCKS_M[version - 1]:
			data_total += int(block[0]) * int(block[2])
		var count_bits: int = 8 if version < 10 else 16
		if 4 + count_bits + payload.size() * 8 > data_total * 8:
			continue
		var bits := PackedByteArray()
		bits.resize(data_total)
		var bit_writer := _BitWriter.new(bits)
		bit_writer.append(0x4, 4)  # Byte 模式指示符 0100
		bit_writer.append(payload.size(), count_bits)
		for byte in payload:
			bit_writer.append(byte, 8)
		# 终止符（最多 4 位补齐字节边界），再按 0xEC/0x11 交替填满。
		bit_writer.append(0, mini(4, data_total * 8 - bit_writer.length))
		while bit_writer.length % 8 != 0:
			bit_writer.append(0, 1)
		var byte_index: int = bit_writer.length / 8
		var pad := 0
		while byte_index < data_total:
			bits[byte_index] = PAD_BYTES[pad % 2]
			pad += 1
			byte_index += 1
		return {&"version": version, &"bytes": bits}
	return {}


## ── 纠错：按分块表做 RS 纠错码字，再按块交错 ──
func _add_error_correction(data: Dictionary) -> PackedByteArray:
	var version: int = data[&"version"]
	var bytes: PackedByteArray = data[&"bytes"]
	var blocks: Array = RS_BLOCKS_M[version - 1]
	var data_chunks: Array[PackedByteArray] = []
	var ec_chunks: Array[PackedByteArray] = []
	var offset := 0
	for block: Array in blocks:
		var count: int = block[0]
		var data_len: int = block[2]
		var ec_len: int = block[1] - data_len
		for _i in range(count):
			var chunk := bytes.slice(offset, offset + data_len)
			offset += data_len
			data_chunks.append(chunk)
			ec_chunks.append(_rs_ec(chunk, ec_len))
	var out := PackedByteArray()
	var max_data: int = 0
	for chunk in data_chunks:
		max_data = maxi(max_data, chunk.size())
	for column in range(max_data):
		for chunk in data_chunks:
			if column < chunk.size():
				out.append(chunk[column])
	for column in range(ec_chunks[0].size()):
		for chunk in ec_chunks:
			out.append(chunk[column])
	return out


## RS 纠错码字：数据多项式对生成多项式做 GF(256) 余式。
## 生成多项式按 x^0 系数在前的布局存储（首项系数恒 1，位于末位）。
func _rs_ec(data: PackedByteArray, ec_len: int) -> PackedByteArray:
	var divisor := _rs_divisor(ec_len)
	var remainder := PackedInt32Array()
	remainder.resize(ec_len)
	for byte in data:
		var factor: int = byte ^ remainder[0]
		for j in range(ec_len - 1):
			remainder[j] = remainder[j + 1]
		remainder[ec_len - 1] = 0
		for j in range(ec_len):
			remainder[j] ^= _gf_mul(divisor[j], factor)
	var out := PackedByteArray()
	for value in remainder:
		out.append(value)
	return out


## 生成多项式：∏(x - α^i)，i ∈ [0, ec_len)；返回 x^0 在前的系数数组（长度 ec_len）。
func _rs_divisor(ec_len: int) -> PackedInt32Array:
	var divisor := PackedInt32Array()
	divisor.resize(ec_len)
	divisor[ec_len - 1] = 1
	var root: int = 1
	for i in range(ec_len):
		for j in range(ec_len):
			var coeff := _gf_mul(divisor[j], root)
			if j + 1 < ec_len:
				divisor[j] = coeff ^ divisor[j + 1]
			else:
				divisor[j] = coeff
		root = _gf_mul(root, 2)
	return divisor


## ── 功能图形 + 数据 + 掩码 + 格式/版本信息 ──
func _build_matrix(version: int, codewords: PackedByteArray, mask: int) -> Array:
	var size: int = 21 + 4 * (version - 1)
	var modules: Array = []
	var is_function: Array = []
	for _row in range(size):
		var row := PackedByteArray()
		row.resize(size)
		modules.append(row)
		var fn_row := PackedByteArray()
		fn_row.resize(size)
		is_function.append(fn_row)
	_draw_function_patterns(modules, is_function, version)
	_draw_codewords(modules, is_function, codewords, REMAINDER_BITS[version - 1])
	_apply_mask(modules, is_function, mask, size)
	_draw_format_info(modules, is_function, mask)
	if version >= 7:
		_draw_version_info(modules, is_function, version)
	return modules


func _set_function(module: Array, fn_map: Array, row: int, col: int, dark: bool) -> void:
	module[row][col] = 1 if dark else 0
	fn_map[row][col] = 1


func _draw_function_patterns(module: Array, fn_map: Array, version: int) -> void:
	var size: int = module.size()
	# 定位图形 + 分隔符（三只角）。分隔符（dy/dx ∈ {-1,7}）恒亮，不参与图形边缘判定。
	for corner: Vector2i in [Vector2i(0, 0), Vector2i(size - 7, 0), Vector2i(0, size - 7)]:
		for dy in range(-1, 8):
			for dx in range(-1, 8):
				var r: int = corner.y + dy
				var c: int = corner.x + dx
				if r < 0 or r >= size or c < 0 or c >= size:
					continue
				var separator: bool = dy == -1 or dy == 7 or dx == -1 or dx == 7
				var edge: bool = dy == 0 or dy == 6 or dx == 0 or dx == 6
				var inner: bool = dy >= 2 and dy <= 4 and dx >= 2 and dx <= 4
				_set_function(module, fn_map, r, c, (not separator) and (edge or inner))
	# 时序图形（第 6 行 / 第 6 列交替）。
	for i in range(8, size - 8):
		_set_function(module, fn_map, 6, i, i % 2 == 0)
		_set_function(module, fn_map, i, 6, i % 2 == 0)
	# 校正图形（5×5，中心暗点）。规格：与三只定位图形重叠的组合不画 ——
	# 即两坐标同为 6（左上），或一为 6 另一为 size-7（右上/左下）。
	var size2: int = module.size()
	var corner_far: int = size2 - 7
	for center: int in ALIGNMENT_CENTERS[version - 1]:
		for other: int in ALIGNMENT_CENTERS[version - 1]:
			var overlaps_finder: bool = (center == 6 and other == 6) \
				or (center == 6 and other == corner_far) \
				or (center == corner_far and other == 6)
			if overlaps_finder:
				continue
			for dy in range(-2, 3):
				for dx in range(-2, 3):
					var edge: bool = absi(dy) == 2 or absi(dx) == 2
					var mid: bool = dy == 0 and dx == 0
					_set_function(module, fn_map, center + dy, other + dx, edge or mid)
	# 校正模块（规格钉死的恒暗点）。
	_set_function(module, fn_map, size - 8, 8, true)
	# 格式信息位先按功能位占住（值稍后按掩码回填）；(6,8)/(8,6) 是时序位不预留。
	for i in range(6):
		_set_function(module, fn_map, i, 8, false)
	_set_function(module, fn_map, 7, 8, false)
	_set_function(module, fn_map, 8, 8, false)
	_set_function(module, fn_map, 8, 7, false)
	for i in range(9, 15):
		_set_function(module, fn_map, 8, 14 - i, false)
	for i in range(8):
		_set_function(module, fn_map, 8, size - 1 - i, false)
	for i in range(8, 15):
		_set_function(module, fn_map, size - 15 + i, 8, false)
	# 版本信息（v≥7）：右上 3×6 与左下 6×3 两块先占位（值稍后由 _draw_version_info 回填）。
	if version >= 7:
		for i in range(18):
			var a: int = size - 11 + i % 3
			var b: int = i / 3
			_set_function(module, fn_map, b, a, false)
			_set_function(module, fn_map, a, b, false)


func _draw_codewords(module: Array, fn_map: Array, codewords: PackedByteArray, remainder: int) -> void:
	var size: int = module.size()
	var bit_index := 0
	var right := size - 1
	while right >= 1:
		if right == 6:
			right = 5  # 跳过垂直时序列
		for vertical in range(size):
			for offset in range(2):
				var col: int = right - offset
				# 规范：列对自右向左；方向按 (right+1)&2 交替向上/向下。
				var upward: bool = (right + 1) & 2 == 0
				var row: int = size - 1 - vertical if upward else vertical
				if fn_map[row][col] == 1:
					continue
				var dark := false
				if bit_index < codewords.size() * 8:
					dark = (codewords[bit_index >> 3] >> (7 - (bit_index & 7))) & 1 == 1
				module[row][col] = 1 if dark else 0
				bit_index += 1
		right -= 2


func _mask_bit(mask: int, row: int, col: int) -> bool:
	match mask:
		0: return (row + col) % 2 == 0
		1: return row % 2 == 0
		2: return col % 3 == 0
		3: return (row + col) % 3 == 0
		4: return (row / 2 + col / 3) % 2 == 0
		5: return (row * col) % 2 + (row * col) % 3 == 0
		6: return ((row * col) % 2 + (row * col) % 3) % 2 == 0
		_: return ((row + col) % 2 + (row * col) % 3) % 2 == 0


func _apply_mask(module: Array, fn_map: Array, mask: int, size: int) -> void:
	for row in range(size):
		for col in range(size):
			if fn_map[row][col] == 1:
				continue
			if _mask_bit(mask, row, col):
				module[row][col] = 1 - module[row][col]


## 格式信息：EC 级 M（00）+ 掩码 3 位 → BCH(15,5) → 异或 0x5412，两处冗余放置。
## 坐标已对独立参考实现逐格核对：第一份 = 左上角周围（b0 起点在 (0,8)，沿列向下，
## 转角后沿行 8 向左，b14 落在 (8,0)）；第二份 = 右上横条（b0 在 (8,size-1)）+
## 左下竖条（b8 在 (size-7,8)）。
func _draw_format_info(module: Array, fn_map: Array, mask: int) -> void:
	var size: int = module.size()
	var data: int = EC_M_FORMAT_BITS << 3 | mask
	var rem: int = data
	for _i in range(10):
		rem = (rem << 1) ^ (FORMAT_GEN_POLY if (rem >> 9 & 1) == 1 else 0)
	var bits: int = (data << 10 | rem) ^ FORMAT_MASK_XOR
	# 第一份：列 8 竖条（b0~b6）+ 行 8 横条（b7~b14，向左）。
	for i in range(6):
		_set_function(module, fn_map, i, 8, _get_bit(bits, i))
	_set_function(module, fn_map, 7, 8, _get_bit(bits, 6))
	_set_function(module, fn_map, 8, 8, _get_bit(bits, 7))
	_set_function(module, fn_map, 8, 7, _get_bit(bits, 8))
	for i in range(9, 15):
		_set_function(module, fn_map, 8, 14 - i, _get_bit(bits, i))
	# 第二份：行 8 右侧横条（b0~b7）+ 列 8 底部竖条（b8~b14）。
	for i in range(8):
		_set_function(module, fn_map, 8, size - 1 - i, _get_bit(bits, i))
	for i in range(8, 15):
		_set_function(module, fn_map, size - 15 + i, 8, _get_bit(bits, i))
	_set_function(module, fn_map, size - 8, 8, true)  # 恒暗模块


func _draw_version_info(module: Array, fn_map: Array, version: int) -> void:
	var size: int = module.size()
	var rem: int = version
	for _i in range(12):
		rem = (rem << 1) ^ (VERSION_GEN_POLY if (rem >> 11 & 1) == 1 else 0)
	var bits: int = version << 12 | rem
	for i in range(18):
		var bit := _get_bit(bits, i)
		var a: int = size - 11 + i % 3
		var b: int = i / 3
		_set_function(module, fn_map, b, a, bit)
		_set_function(module, fn_map, a, b, bit)


## 规范 N1~N4 罚分（自动选掩码用；黄金向量用固定掩码，不依赖此打分）。
func _penalty(module: Array) -> int:
	var size: int = module.size()
	var result := 0
	for row in range(size):
		var run_color: int = module[row][0]
		var run_len := 1
		for col in range(1, size):
			if module[row][col] == run_color:
				run_len += 1
			else:
				result += _n1(run_len)
				run_color = module[row][col]
				run_len = 1
		result += _n1(run_len)
	for col in range(size):
		var run_color: int = module[0][col]
		var run_len := 1
		for row in range(1, size):
			if module[row][col] == run_color:
				run_len += 1
			else:
				result += _n1(run_len)
				run_color = module[row][col]
				run_len = 1
		result += _n1(run_len)
	for row in range(size - 1):
		for col in range(size - 1):
			var color: int = module[row][col]
			if module[row][col + 1] == color and module[row + 1][col] == color and module[row + 1][col + 1] == color:
				result += 3
	var dark: int = 0
	for row in range(size):
		for col in range(size):
			dark += module[row][col]
	result += 10 * int(absi(dark * 20 - size * size * 10) / (size * size) - 1) if dark > 0 else 10
	return result


func _n1(run_len: int) -> int:
	return 3 + run_len - 5 if run_len >= 5 else 0


func _get_bit(value: int, index: int) -> bool:
	return (value >> index) & 1 == 1


func _flatten(module: Array) -> PackedByteArray:
	var size: int = module.size()
	var out := PackedByteArray()
	out.resize(size * size)
	for row in range(size):
		for col in range(size):
			out[row * size + col] = module[row][col]
	return out


## 轻量位写入器（数据段编码用）。
class _BitWriter:
	var buffer: PackedByteArray
	var length: int = 0

	func _init(target: PackedByteArray) -> void:
		buffer = target

	func append(value: int, bit_count: int) -> void:
		for i in range(bit_count - 1, -1, -1):
			var byte_index := length >> 3
			if byte_index < buffer.size() and (value >> i) & 1 == 1:
				buffer[byte_index] |= 0x80 >> (length & 7)
			length += 1
