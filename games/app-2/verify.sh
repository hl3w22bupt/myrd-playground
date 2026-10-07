#!/usr/bin/env bash
# verify —— 《冒烟愿晶》本地门禁入口（人工与 agent 复跑用）。
#
# 与 .myrd/routines.yaml 的 godot-smoke routine 同源：本脚本只【调用】仓库内判定脚本
# （std-skills/godot-game-dev/scripts/），不重新实现任何检查逻辑、不自造判定器。
#
# 用法：
#   bash games/app-2/verify.sh
#
# 环境变量：
#   GODOT_BIN              Godot 可执行文件（缺省经 resolve-godot.sh 解析）
#   GODOT_SMOKE_FRAMES     冒烟帧预算（默认 240）
#
# 判定协议：全部步骤退出码 0，且日志含 GODOT_SMOKE: PASS / GODOT_FUZZ: PASS /
# GODOT_PLAYTEST: PASS → 打印 VERIFY: ALL PASS；任一失败即非零退出。

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GAME_DIR/../.." && pwd)"
SCRIPTS="$REPO_ROOT/std-skills/godot-game-dev/scripts"
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}"

fail() { echo "verify: FAIL $*"; exit 1; }

echo "== [0/4] 解析 Godot 可执行文件 =="
GODOT_BIN_RESOLVED="$(bash "$SCRIPTS/resolve-godot.sh")" || {
  echo "verify: 环境不可用（resolve-godot.sh 退出码 $?）：安装 Godot 或设 GODOT_BIN 后重跑"
  exit 2
}
echo "GODOT_BIN=$GODOT_BIN_RESOLVED"

echo "== [1/4] preflight（前置一致性静态检查）=="
python3 "$SCRIPTS/preflight.py" "$GAME_DIR" || fail "preflight 未通过（按 P 编号修复）"

echo "== [2/4] headless smoke（GODOT_SMOKE_FRAMES=${GODOT_SMOKE_FRAMES}）=="
GODOT_SMOKE_FRAMES="$GODOT_SMOKE_FRAMES" GODOT_BIN="$GODOT_BIN_RESOLVED" \
  bash "$SCRIPTS/smoke.sh" "$GAME_DIR" || fail "smoke 未通过（缺 GODOT_SMOKE: PASS 或带脚本错误）"

echo "== [3/4] input fuzz（任意输入序下的进程健康）=="
GODOT_BIN="$GODOT_BIN_RESOLVED" bash "$SCRIPTS/input-fuzz.sh" "$GAME_DIR" || fail "input-fuzz 未通过（缺 GODOT_FUZZ: PASS）"

echo "== [4/4] bot playtest（机器人试玩节奏代理指标）=="
GODOT_BIN="$GODOT_BIN_RESOLVED" bash "$SCRIPTS/playtest.sh" "$GAME_DIR" || fail "playtest 未通过（缺 GODOT_PLAYTEST: PASS）"

echo "VERIFY: ALL PASS（preflight / smoke / fuzz / playtest 全绿）"
