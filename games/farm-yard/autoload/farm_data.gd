extends Node
## 数值配置表（autoload FarmData）：田园小院全部核心数值的唯一来源。
##
## 与 .myrd/spec/design-spec.json 的 numeric 段一一对应（spec 是事实源，这里同步落码）；
## 试玩调参走 GameState.TUNING_META（可调键），定稿回写 spec 后同步本表默认值。
## 消费方（game_state.gd / yard_view.gd / ui_layer.gd）只读表，禁止散落魔数。

## ── 作物（菜园）：seedCost 种子价 / sellPrice 售价 / growSec 生长秒 / xp 收获经验 ──
const CROPS: Dictionary = {
	"wheat": {"name": "小麦", "seed_cost": 2, "sell_price": 6, "grow_sec": 10.0, "xp": 2},
	"carrot": {"name": "胡萝卜", "seed_cost": 4, "sell_price": 12, "grow_sec": 18.0, "xp": 3},
	"tomato": {"name": "番茄", "seed_cost": 8, "sell_price": 22, "grow_sec": 30.0, "xp": 5},
	"pumpkin": {"name": "南瓜", "seed_cost": 15, "sell_price": 42, "grow_sec": 45.0, "xp": 8},
	"corn": {"name": "玉米", "seed_cost": 25, "sell_price": 70, "grow_sec": 60.0, "xp": 12},
}

## ── 花卉（小花园）：收获后进仓库，同样可出售 ──
const FLOWERS: Dictionary = {
	"daisy": {"name": "雏菊", "seed_cost": 3, "sell_price": 9, "grow_sec": 12.0, "xp": 2},
	"tulip": {"name": "郁金香", "seed_cost": 6, "sell_price": 18, "grow_sec": 22.0, "xp": 4},
	"sunflower": {"name": "向日葵", "seed_cost": 12, "sell_price": 36, "grow_sec": 40.0, "xp": 7},
}

## ── 果树（果园）：buildCost 栽种价（0 = 初始已有），周期结果可采摘 ──
const TREES: Dictionary = {
	"apple": {"name": "苹果树", "build_cost": 0, "fruit": "apple", "fruit_name": "苹果", "fruit_price": 14, "cycle_sec": 22.0, "xp": 4},
	"pear": {"name": "梨树", "build_cost": 60, "fruit": "pear", "fruit_name": "梨", "fruit_price": 24, "cycle_sec": 32.0, "xp": 6},
	"peach": {"name": "桃树", "build_cost": 110, "fruit": "peach", "fruit_name": "桃", "fruit_price": 40, "cycle_sec": 45.0, "xp": 9},
}

## ── 养殖舍（鸡鸭鹅舍）：按周期自动产蛋，点击收取 ──
const COOPS: Dictionary = {
	"chicken": {"name": "鸡舍", "build_cost": 0, "product": "egg", "product_name": "鸡蛋", "product_price": 8, "interval_sec": 12.0, "xp": 2},
	"duck": {"name": "鸭舍", "build_cost": 80, "product": "duck_egg", "product_name": "鸭蛋", "product_price": 15, "interval_sec": 20.0, "xp": 4},
	"goose": {"name": "鹅舍", "build_cost": 140, "product": "goose_egg", "product_name": "鹅蛋", "product_price": 26, "interval_sec": 30.0, "xp": 7},
}

## ── 工坊食谱：inputs 原料 → output 商品（售价高于原料合计 = 加工溢价）──
const RECIPES: Dictionary = {
	"bread": {"name": "面包", "inputs": {"wheat": 2}, "output": "bread", "output_name": "面包", "sell_price": 18, "craft_sec": 8.0, "xp": 4},
	"cake": {"name": "蛋糕", "inputs": {"egg": 2, "wheat": 1}, "output": "cake", "output_name": "蛋糕", "sell_price": 45, "craft_sec": 12.0, "xp": 8},
	"apple_pie": {"name": "苹果派", "inputs": {"apple": 2, "wheat": 1}, "output": "apple_pie", "output_name": "苹果派", "sell_price": 52, "craft_sec": 15.0, "xp": 10},
}

## ── 建造与升级 ──
const PLOT_COUNT: int = 6
const PLOT_UNLOCK_COSTS: Array[int] = [0, 0, 0, 40, 80, 150]
const BED_COUNT: int = 4
const BED_UNLOCK_COSTS: Array[int] = [0, 0, 60, 120]
const WORKSHOP_BUILD_COST: int = 80
const WORKSHOP_UPGRADE_COSTS: Array[int] = [80, 130, 200]
const COOP_UPGRADE_COSTS: Array[int] = [60, 120]
const FOUNTAIN_BUILD_COST: int = 60
const FOUNTAIN_UPGRADE_COSTS: Array[int] = [100, 160]
const SWING_BUILD_COST: int = 100
const SWING_UPGRADE_COSTS: Array[int] = [150, 240]
const MAX_FACILITY_LEVEL: int = 3
## 每级售价加成（%）：喷泉/秋千各 3 级，满级合计 +8%
const PRICE_BONUS_PER_LEVEL_PCT: int = 4

## ── 经济与成长曲线 ──
const START_COINS: int = 30
const CRAFT_SPEED_PER_LEVEL: float = 0.75   # 工坊每级 crafting 周期 ×0.75
const COOP_SPEED_PER_LEVEL: float = 0.8     # 养殖舍每级产出周期 ×0.8
const ORDER_PRICE_FACTOR: float = 1.35      # 订单售价 = 商品基础价 ×1.35
const ORDER_BONUS_COINS: int = 8
const ORDER_BASE_XP: int = 6
const XP_TO_NEXT_BASE: int = 25             # 升到下一级所需经验 = base + step ×(level-1)
const XP_TO_NEXT_STEP: int = 15
const LEVEL_UP_COIN_REWARD: int = 15
const DAY_CYCLE_SEC: float = 90.0           # 昼夜循环周期（治愈系视觉，不影响数值）
const ACTIVE_ORDER_COUNT: int = 3
const SAVE_PATH: String = "user://farm_save.json"
const SAVE_VERSION: int = 1

## ── 任务链（7 阶段，覆盖新手引导首个完整闭环）──
## target 为状态机事件名；quest_progress(target) 命中即完成当前阶段。
const QUESTS: Array[Dictionary] = [
	{"id": "q1", "name": "种下第一株作物", "target": "plant_crop", "reward_coins": 10, "reward_xp": 5},
	{"id": "q2", "name": "收获第一份作物", "target": "harvest_crop", "reward_coins": 15, "reward_xp": 5},
	{"id": "q3", "name": "在集市卖出任意商品", "target": "sell_item", "reward_coins": 20, "reward_xp": 8},
	{"id": "q4", "name": "建造工坊", "target": "build_workshop", "reward_coins": 30, "reward_xp": 10},
	{"id": "q5", "name": "制作一份面包", "target": "craft_bread", "reward_coins": 40, "reward_xp": 10},
	{"id": "q6", "name": "完成一张订单", "target": "deliver_order", "reward_coins": 50, "reward_xp": 12},
	{"id": "q7", "name": "等级达到 3 级", "target": "reach_level_3", "reward_coins": 60, "reward_xp": 0},
]

## ── 订单生成：从可售商品池按权重抽取（确定种子，存档可复现）──
## 每张订单 = 1~2 种商品 × 各 1~3 件；奖励 = 基础价合计 ×1.35 + 8 金币 + 经验。
const ORDER_ITEM_POOL: Array[String] = [
	"wheat", "carrot", "tomato", "pumpkin", "corn",
	"daisy", "tulip", "sunflower",
	"apple", "pear", "peach",
	"egg", "duck_egg", "goose_egg",
	"bread", "cake", "apple_pie",
]

## 商品中文名统一出口：作物/花卉/果品/蛋品/工坊品拼一张表（yard_view / ui_layer 显示用）。
static func item_catalog() -> Dictionary:
	var catalog: Dictionary = {}
	for table in [CROPS, FLOWERS]:
		for id: String in table:
			catalog[id] = {"name": table[id]["name"], "sell_price": int(table[id]["sell_price"])}
	for id: String in TREES:
		var tree: Dictionary = TREES[id]
		catalog[tree["fruit"]] = {"name": tree["fruit_name"], "sell_price": int(tree["fruit_price"])}
	for id: String in COOPS:
		var coop: Dictionary = COOPS[id]
		catalog[coop["product"]] = {"name": coop["product_name"], "sell_price": int(coop["product_price"])}
	for id: String in RECIPES:
		var recipe: Dictionary = RECIPES[id]
		catalog[recipe["output"]] = {"name": recipe["output_name"], "sell_price": int(recipe["sell_price"])}
	return catalog

## 设施等级 → 周期缩放（养殖舍/工坊共用一套折算）。
static func level_speed(level: int, per_level: float) -> float:
	return pow(per_level, float(maxi(level - 1, 0)))

## 休闲设施总加成（%）：等级 0 = 未建造不计入，1 级 = +0%，每升 1 级 +4%。
static func price_bonus_pct(fountain_level: int, swing_level: int) -> int:
	var levels := maxi(fountain_level - 1, 0) + maxi(swing_level - 1, 0)
	return levels * PRICE_BONUS_PER_LEVEL_PCT
