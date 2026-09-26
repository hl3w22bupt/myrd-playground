#!/usr/bin/env bash
# 《星尘收集者》本地门禁入口 —— 供人工与 agent 复跑。
#
# 本脚本只「调用」仓库级判定脚本（std-skills/godot-game-dev/scripts/），不自己实现任何检查逻辑；
# 判定协议与 .myrd/routines.yaml 的 godot-smoke routine 同源：
#   preflight → PREFLIGHT: PASS（退出码 0）
#   smoke     → GODOT_SMOKE: PASS（退出码 0，GODOT_SMOKE_FRAMES=3000 帧预算；
#               与 smoke.sh 兜底默认 / .myrd/routines.yaml smokeFrames 三处同值 ——
#               帧预算是机器相关量，3000 为慢机安全量级，见 qa/round-20260927-smoke-frame-budget.md）
#   fuzz      → GODOT_FUZZ: PASS（退出码 0）
# 退出码 2 = 环境不可用（先装 Godot，不要改代码）。

set -euo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$GAME_DIR" rev-parse --show-toplevel)"
SCRIPTS="$REPO_ROOT/std-skills/godot-game-dev/scripts"

echo "== [1/4] Godot 环境解析（resolve-godot.sh） =="
GODOT_BIN="$(bash "$SCRIPTS/resolve-godot.sh")"
echo "GODOT_BIN=$GODOT_BIN"

echo "== [2/4] 前置一致性静态检查（preflight.py） =="
python3 "$SCRIPTS/preflight.py" "$GAME_DIR"

echo "== [3/4] 无头冒烟（smoke.sh, GODOT_SMOKE_FRAMES=3000） =="
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-3000}" GODOT_BIN="$GODOT_BIN" \
	bash "$SCRIPTS/smoke.sh" "$GAME_DIR"

echo "== [4/4] 输入鲁棒性 fuzz（input-fuzz.sh） =="
GODOT_BIN="$GODOT_BIN" bash "$SCRIPTS/input-fuzz.sh" "$GAME_DIR"

echo "verify.sh：全部门禁通过 ✅"
