#!/usr/bin/env bash
# 接苹果（game-11）本地门禁入口 —— 供人工与 agent 复跑，与 .myrd/routines.yaml 的
# godot-smoke routine 同源。
#
# 纪律：本脚本只「调用」仓库 std-skills/godot-game-dev/scripts/ 里的判定脚本
# （resolve-godot.sh / preflight.py / smoke.sh / input-fuzz.sh），不重新实现任何检查逻辑；
# 判定器的唯一来源是仓库内 std-skills/，缺失时按工作流规范上报 blocked，不得现场补。
#
# 用法：bash games/game-11/verify.sh
# 退出码：0 通过；1 门禁失败（reject 打回）；2 环境不可用（先装 Godot，不要改代码）

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GAME_PATH="games/game-11"
SCRIPTS="${REPO_ROOT}/std-skills/godot-game-dev/scripts"
# 与 .myrd/routines.yaml 的 godot-smoke.params.smokeFrames 同值：冒烟协程要跑完
# 「开局 → 移动 → 接住 → 漏接 → 胜负 → 重开」全部相位。
FRAMES="${GODOT_SMOKE_FRAMES:-240}"

cd "${REPO_ROOT}"

echo "== [1/4] Godot 可用性（resolve-godot.sh）=="
GODOT_BIN="$(bash "${SCRIPTS}/resolve-godot.sh")"
if [ $? -ne 0 ]; then
  echo "verify: 环境不可用 —— 先装 Godot（resolve-godot.sh 已给安装指引），不要改代码"
  exit 2
fi
echo "godot: ${GODOT_BIN}"

echo "== [2/4] preflight 静态一致性检查 =="
python3 "${SCRIPTS}/preflight.py" "${GAME_PATH}" || exit $?

echo "== [3/4] 无头冒烟（GODOT_SMOKE_FRAMES=${FRAMES}）=="
GODOT_SMOKE_FRAMES="${FRAMES}" GODOT_BIN="${GODOT_BIN}" bash "${SCRIPTS}/smoke.sh" "${GAME_PATH}" || exit $?

echo "== [4/4] 输入鲁棒性 fuzz =="
GODOT_BIN="${GODOT_BIN}" bash "${SCRIPTS}/input-fuzz.sh" "${GAME_PATH}" || exit $?

echo "verify: PASS preflight + smoke + input-fuzz 全部通过（games/game-11）"
