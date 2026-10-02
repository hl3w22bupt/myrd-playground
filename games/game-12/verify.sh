#!/usr/bin/env bash
# game-12 工程门禁入口（人工与 agent 复跑用）。
#
# 原则：本脚本只「调用」仓库 std-skills/godot-game-dev/scripts/ 下的判定脚本
# （resolve-godot.sh / preflight.py / smoke.sh / input-fuzz.sh），
# 不重新实现、不放宽任何检查逻辑 —— 判定器唯一来源是仓库脚本。
#
# 用法：
#   bash games/game-12/verify.sh
# 环境变量：
#   GODOT_SMOKE_FRAMES  冒烟帧预算（默认 240）
#   GODOT_BIN           Godot 可执行文件（默认走 resolve-godot.sh 解析）
#
# 判定协议：任一步退出码非 0 即失败；冒烟通过要求日志含 GODOT_SMOKE: PASS，
# fuzz 通过要求日志含 GODOT_FUZZ: PASS（均由被调用脚本自行断言）。

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GAME_DIR/../.." && pwd)"
SCRIPTS="$REPO_ROOT/std-skills/godot-game-dev/scripts"
FRAMES="${GODOT_SMOKE_FRAMES:-240}"

for required in resolve-godot.sh preflight.py smoke.sh input-fuzz.sh; do
  if [ ! -f "$SCRIPTS/$required" ]; then
    echo "verify: 模板仓库未预置门禁脚本 std-skills/godot-game-dev/scripts/$required" >&2
    echo "       判定脚本只能来自仓库，缺脚本 = 环境缺陷，请运维补模板仓库技能资产。" >&2
    exit 2
  fi
done

GODOT_BIN="$(bash "$SCRIPTS/resolve-godot.sh")"
if [ $? -ne 0 ]; then
  exit 2
fi

echo "verify: [1/3] preflight（静态一致性）"
python3 "$SCRIPTS/preflight.py" "$GAME_DIR" || exit $?

echo "verify: [2/3] headless smoke（GODOT_SMOKE_FRAMES=${FRAMES}）"
GODOT_SMOKE_FRAMES="$FRAMES" GODOT_BIN="$GODOT_BIN" bash "$SCRIPTS/smoke.sh" "$GAME_DIR" || exit $?

echo "verify: [3/3] input fuzz（对抗输入序存活）"
GODOT_BIN="$GODOT_BIN" bash "$SCRIPTS/input-fuzz.sh" "$GAME_DIR" || exit $?

echo "verify: 全部门禁通过（preflight / smoke GODOT_SMOKE: PASS / fuzz GODOT_FUZZ: PASS）"
