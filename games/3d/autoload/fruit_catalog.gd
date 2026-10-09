class_name FruitCatalog
extends Object
## 水果目录（需求「玩法设定 1」：每局出现 ≥5 种水果，各水果外观可辨识、不混同）。
##
## 纯静态数据 + 纯函数（无状态、无场景引用），供 fruit.gd（程序化造型）与
## main.gd（随机投放）共同消费。口味口径（需求「验收 6」）：
## - 果皮/果肉配色贴近对应真实水果且互不雷同（smoke 断言 peel 色两两间距）；
## - 切面细节按种类可辨识：籽（seed_color + seed_count）与果心（flesh 亮色圆盘）；
## - 汁液粒子颜色 = flesh_juice（与被切水果的果肉对应）。
##
## 形状差异：radius（视觉半径）× squash（y 压扁系数）× stretch（x 拉长系数）——
## 西瓜大而圆、柠檬椭圆、桃子略扁、猕猴桃小，运动中旋转即可见体积差异。
## 碰撞体统一用 fruit.tscn 的 SphereShape3D（0.42）：切割包络推导见 blade.gd CUT_THICKNESS
## ——西瓜视觉半径 0.55 > 碰撞 0.42，但判定带半厚 0.8 完全覆盖差值，不会「看着切到了没反应」。

const KINDS: Array[StringName] = [
	&"watermelon", &"orange", &"apple", &"lemon", &"kiwi", &"peach",
]

## 逐水果定义（键名即字段契约，fruit.gd 按键消费）。
const DEFS: Dictionary = {
	&"watermelon": {
		"label": "西瓜",
		"radius": 0.55, "squash": 1.0, "stretch": 1.0,
		"peel_color": Color(0.13, 0.42, 0.16), "peel_roughness": 0.35,
		"flesh_color": Color(0.98, 0.28, 0.3), "flesh_juice": Color(0.95, 0.2, 0.24),
		"seed_color": Color(0.08, 0.1, 0.08), "seed_count": 6,
	},
	&"orange": {
		"label": "橙子",
		"radius": 0.42, "squash": 1.05, "stretch": 1.0,
		"peel_color": Color(0.95, 0.5, 0.08), "peel_roughness": 0.55,
		"flesh_color": Color(1.0, 0.62, 0.15), "flesh_juice": Color(1.0, 0.58, 0.1),
		"seed_color": Color(0.95, 0.93, 0.8), "seed_count": 2,
	},
	&"apple": {
		"label": "苹果",
		"radius": 0.42, "squash": 0.92, "stretch": 1.0,
		"peel_color": Color(0.82, 0.14, 0.1), "peel_roughness": 0.25,
		"flesh_color": Color(0.95, 0.92, 0.78), "flesh_juice": Color(0.93, 0.86, 0.45),
		"seed_color": Color(0.25, 0.16, 0.08), "seed_count": 2,
	},
	&"lemon": {
		"label": "柠檬",
		"radius": 0.36, "squash": 0.82, "stretch": 1.28,
		"peel_color": Color(0.98, 0.85, 0.1), "peel_roughness": 0.4,
		"flesh_color": Color(0.99, 0.93, 0.5), "flesh_juice": Color(0.99, 0.9, 0.3),
		"seed_color": Color(0.93, 0.9, 0.72), "seed_count": 2,
	},
	&"kiwi": {
		"label": "猕猴桃",
		"radius": 0.34, "squash": 1.0, "stretch": 1.0,
		"peel_color": Color(0.42, 0.3, 0.16), "peel_roughness": 0.8,
		"flesh_color": Color(0.55, 0.78, 0.2), "flesh_juice": Color(0.6, 0.8, 0.2),
		"seed_color": Color(0.05, 0.05, 0.05), "seed_count": 6,
	},
	&"peach": {
		"label": "桃子",
		"radius": 0.45, "squash": 0.88, "stretch": 1.0,
		"peel_color": Color(0.98, 0.6, 0.55), "peel_roughness": 0.65,
		"flesh_color": Color(0.99, 0.85, 0.6), "flesh_juice": Color(0.99, 0.7, 0.4),
		"seed_color": Color(0.35, 0.22, 0.1), "seed_count": 1,
	},
}


## 水果种类数（需求验收 3：单局 ≥5 种 —— 目录本身 6 种，随机投放保证单局覆盖）。
static func kind_count() -> int:
	return KINDS.size()


## 按种类取定义（未知种类回退苹果 —— 防御老存档/手输 tuning 串）。
static func def(kind: StringName) -> Dictionary:
	return DEFS.get(kind, DEFS[&"apple"])


## 随机挑一种水果（main.gd 非炸弹抛出用）。
static func random_kind(rng: RandomNumberGenerator) -> StringName:
	return KINDS[rng.randi_range(0, KINDS.size() - 1)]
