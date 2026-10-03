class_name BudgetLedger
extends RefCounted
## 预算账本 —— 每一次扣减（收集 / 误触 / 回扣点击）后立刻给出剩余预算。
## 数值口径取策划案 numeric.budget：collectCostPerItem=1、misclickCost=1、
## refundCrystalCost=1 / refundCrystalRefund=2、cap=30、floor=0。

signal budget_changed(remaining: int, delta: int, reason: String)
signal budget_exhausted

const COLLECT_COST: int = 1
const MISCLICK_COST: int = 1
const REFUND_CRYSTAL_COST: int = 1
const REFUND_CRYSTAL_REFUND: int = 2
const CAP: int = 30
const FLOOR: int = 0

var start_budget: int = 0
var remaining: int = 0


func setup(budget: int) -> void:
	start_budget = clampi(budget, FLOOR, CAP)
	remaining = start_budget
	budget_changed.emit(remaining, 0, "setup")


## 通用扣减：返回是否扣成功（预算为 0 时不能再扣）。
func spend(cost: int, reason: String) -> bool:
	if remaining < cost:
		return false
	remaining -= cost
	budget_changed.emit(remaining, -cost, reason)
	if remaining == FLOOR:
		budget_exhausted.emit()
	return true


## 收集一件目标（扣 1）。
func spend_collect() -> bool:
	return spend(COLLECT_COST, "collect")


## 误触（点空 / 点到诱饵石）扣 1。
func spend_misclick() -> bool:
	return spend(MISCLICK_COST, "misclick")


## 回扣晶体：扣 1 返 2（净 +1），受 CAP 约束。
func spend_refund_crystal() -> int:
	if not spend(REFUND_CRYSTAL_COST, "refund_crystal_cost"):
		return 0
	var refunded: int = mini(REFUND_CRYSTAL_REFUND, CAP - remaining)
	if refunded > 0:
		remaining += refunded
		budget_changed.emit(remaining, refunded, "refund_crystal_refund")
	return refunded


func spent_total() -> int:
	return start_budget - remaining
