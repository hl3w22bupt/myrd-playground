#!/usr/bin/env bash
# 《复刻天天酷跑》自测门禁：preflight（静态一致性）→ smoke（无头冒烟）→ input-fuzz（输入鲁棒性）。
#
# 本脚本只是 .myrd/routines.yaml「godot-smoke」routine 的本地复跑入口：
# 不实现任何检查逻辑，判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/
# （与 routine step 命令同源同路径），缺任何一个都属「环境不可用」，不得现场补写。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/game-6/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/game-6/verify.sh
#
# 退出码（机器可判别，与 routine「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = smoke 冒烟失败（按 error-signatures.md 修复后重跑）
#   2 = 环境不可用（找不到 Godot / 技能包脚本 / python3，装环境而不是改代码）
#   3 = preflight 静态一致性检查未通过（先修静态问题，不必跑冒烟）
#   4 = input-fuzz 未通过（输入鲁棒性缺陷，按失败摘要修复）

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
# 判定脚本目录：仓库内 std-skills/godot-game-dev/（.myrd/routines.yaml 同源引用）。
SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"

for gate_script in preflight.py smoke.sh input-fuzz.sh resolve-godot.sh; do
  if [ ! -f "${SKILL_DIR}/scripts/${gate_script}" ]; then
    echo "verify: FAIL 环境不可用（找不到判定脚本 ${SKILL_DIR}/scripts/${gate_script}），请运维补齐模板仓库技能资产"
    exit 2
  fi
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "verify: FAIL 环境不可用（找不到 python3，preflight 无法运行），安装后重跑"
  exit 2
fi

# Godot 解析唯一实现 = resolve-godot.sh（与 routine 的 availability / headless-smoke 同源）。
GODOT_BIN="$(bash "${SKILL_DIR}/scripts/resolve-godot.sh")"
if [ $? -ne 0 ] || [ -z "${GODOT_BIN}" ]; then
  echo "verify: FAIL 环境不可用（找不到可执行的 Godot），安装后重跑"
  exit 2
fi
echo "verify: Godot = $("$GODOT_BIN" --version 2>/dev/null | head -1)（${GODOT_BIN}）"
echo "verify: 工程 = ${GAME_DIR}"
echo ""

echo "==> [1/3] preflight（静态前置一致性检查）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/3] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240：冒烟要跑「噪声相位 30 帧 + 负向局(撞障碍) + 按钮重开 + 正向局(跳跃越障+收集达标)」，
# 预算对齐 .myrd/routines.yaml godot-smoke 的 smokeFrames 默认值（240），两边同值不各说各话。
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/smoke.sh" "${GAME_DIR}"
SMOKE_EXIT=$?
if [ "${SMOKE_EXIT}" -ne 0 ]; then
  echo "verify: FAIL smoke 未通过（退出码 ${SMOKE_EXIT}），按 error-signatures.md 修复后重跑"
  exit 1
fi
echo ""

echo "==> [3/3] input-fuzz（确定种子随机事件序的输入鲁棒性门禁）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/input-fuzz.sh" "${GAME_DIR}"
FUZZ_EXIT=$?
if [ "${FUZZ_EXIT}" -ne 0 ]; then
  echo "verify: FAIL input-fuzz 未通过（退出码 ${FUZZ_EXIT}），按失败摘要修复后重跑"
  exit 4
fi

echo ""
echo "verify: PASS preflight + smoke + input-fuzz 全部通过（可玩骨架四项：移动/收集交互/胜负可达/重开可用）"
