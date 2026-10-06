#!/usr/bin/env bash
# verify.sh —— 本工程门禁入口（供人工与 agent 复跑）。
#
# 只调用仓库内判定脚本（std-skills/godot-game-dev/scripts/），不重新实现任何检查逻辑：
#   ① resolve-godot.sh  定位 Godot 可执行文件
#   ② preflight.py      静态一致性检查（P1..P13）
#   ③ smoke.sh          无头冒烟（GODOT_SMOKE_FRAMES=240，断言 GODOT_SMOKE: PASS）
#   ④ input-fuzz.sh     输入鲁棒性 fuzz（断言 GODOT_FUZZ: PASS）
#
# 判定协议：全部通过退出码 0；preflight/smoke/fuzz 失败退出码 1；环境不可用退出码 2。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GATE_DIR="${REPO_ROOT}/std-skills/godot-game-dev/scripts"

if [ ! -d "${GATE_DIR}" ]; then
  echo "verify: FAIL 找不到门禁脚本目录 ${GATE_DIR}" >&2
  exit 2
fi

GODOT_BIN="$(bash "${GATE_DIR}/resolve-godot.sh")"
if [ -z "${GODOT_BIN}" ] || ! command -v "${GODOT_BIN}" >/dev/null 2>&1; then
  echo "verify: FAIL Godot 不可用（resolve-godot.sh 返回「${GODOT_BIN}」）" >&2
  exit 2
fi

echo "== preflight =="
python3 "${GATE_DIR}/preflight.py" "${SCRIPT_DIR}" || exit $?

echo "== headless smoke（GODOT_SMOKE_FRAMES=240）=="
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
  bash "${GATE_DIR}/smoke.sh" "${SCRIPT_DIR}" || exit $?

echo "== input fuzz =="
GODOT_BIN="${GODOT_BIN}" bash "${GATE_DIR}/input-fuzz.sh" "${SCRIPT_DIR}" || exit $?

echo "verify: PASS preflight + smoke + fuzz 全部通过"
