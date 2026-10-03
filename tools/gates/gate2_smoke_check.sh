#!/usr/bin/env bash
# 门禁二（运行冒烟）——《测试预算边界》需求固化的第二道门禁。
#
# 冒烟口径（spec acceptance: acc-collect-loop / acc-budget-state-machine / acc-perfect-boundary /
# acc-progress-persist / acc-casual-session / acc-double-gate）：
#   游戏可启动至主场景，真实注入输入事件完整跑通收集循环：
#   收集 → 计数 → 预算扣减 → 边界三分支结算（CLEARED / PERFECT / FAILED）→ 暂停存档还原。
#
# 前置：门禁一必须先过（任一门禁失败均不得进入验收）。
# 输出协议：`GATE2: PASS` / `GATE2: FAIL <原因>`；退出码 0 = 通过，1 = 失败，2 = 环境不可用。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GAME="$ROOT/games/game-13"
GODOT_BIN="${GODOT_BIN:-godot}"
SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-1800}"

echo "== 门禁二（运行冒烟）：《测试预算边界》games/game-13 =="

if [ ! -f "$GAME/tests/smoke.tscn" ]; then
  echo "GATE2: FAIL 缺少无头冒烟场景 tests/smoke.tscn"
  exit 2
fi
if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  echo "GATE2: FAIL 找不到 Godot 可执行文件「$GODOT_BIN」（GODOT_BIN=/path/to/godot）"
  exit 2
fi

LOG="$(mktemp -t game13-smoke.XXXXXX)"
trap 'rm -f "$LOG"' EXIT

# ① 资源导入（首次运行生成 .godot/ 缓存；缺失会让 class_name 解析失败）
"$GODOT_BIN" --headless --path "$GAME" --import >"$LOG" 2>&1 || true

# ② 无头冒烟：断言场景自身打印 GODOT_SMOKE 标记并决定退出码
"$GODOT_BIN" --headless --path "$GAME" --quit-after "$SMOKE_FRAMES" tests/smoke.tscn >>"$LOG" 2>&1
EXIT_CODE=$?

grep -E "GODOT_SMOKE|✓|✗|· 用例" "$LOG" | sed 's/^/  | /'

if ! grep -q "GODOT_SMOKE: PASS" "$LOG"; then
  echo "GATE2: FAIL 冒烟场景未给出通过标记（退出码 ${EXIT_CODE}）"
  grep -E "GODOT_SMOKE: FAIL" "$LOG" | sed 's/^/  | /'
  exit 1
fi
if [ "${EXIT_CODE}" -ne 0 ]; then
  echo "GATE2: FAIL 冒烟断言通过但进程退出码为 ${EXIT_CODE}（标记与退出码必须一致）"
  exit 1
fi
# PASS 也要扫日志：每帧刷屏型运行期错误会伪装成健康（SCRIPT ERROR / Parse Error 判 FAIL）
if grep -qE "SCRIPT ERROR|Parse Error|ERROR:" "$LOG"; then
  echo "GATE2: FAIL 冒烟通过但日志含脚本错误："
  grep -E "SCRIPT ERROR|Parse Error|ERROR:" "$LOG" | head -10 | sed 's/^/  | /'
  exit 1
fi

echo "GATE2: PASS 启动至主场景并完整跑通 收集→计数→完成反馈（含边界三分支与暂停存档）"
exit 0
