#!/usr/bin/env bash
# 冒烟愿晶：一闪即逝的流星，收集三颗即胜（game-10）自测门禁：
# preflight（静态一致性）→ smoke（无头冒烟）→ input-fuzz（输入鲁棒性）→ playtest（机器人试玩）。
#
# 实现不落地在本工程，只复用 Godot 技能包的流水线（SKILL.md §1.1 三步起步 + §4 无头验证协议）：
#   std-skills/godot-game-dev/scripts/preflight.py
#   std-skills/godot-game-dev/scripts/smoke.sh
#   std-skills/godot-game-dev/scripts/input-fuzz.sh
#   std-skills/godot-game-dev/scripts/playtest.sh
# 本脚本不重新实现任何检查逻辑，判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/game-10/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/game-10/verify.sh
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过（四道判定全部 PASS）
#   1 = smoke 冒烟失败（按 error-signatures.md 修复后重跑）
#   2 = 环境不可用（找不到 Godot / 技能包脚本 / python3，装环境而不是改代码）
#   3 = preflight 静态一致性检查未通过（先修静态问题，不必跑冒烟）
#   4 = input-fuzz 输入鲁棒性失败
#   5 = playtest 机器人试玩节奏指标未达标

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
# 技能包目录解析：仓库内实际落点优先（std-skills/，.myrd/routines.yaml 同源引用）。
SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"

# 技能包门禁脚本的存在性守卫：缺任何一个都属「环境不可用」，必须以退出码 2 报告。
for gate_script in preflight.py smoke.sh input-fuzz.sh playtest.sh resolve-godot.sh; do
  if [ ! -f "${SKILL_DIR}/scripts/${gate_script}" ]; then
    echo "verify: FAIL 环境不可用（找不到技能包脚本 ${SKILL_DIR}/scripts/${gate_script}），安装后重跑"
    exit 2
  fi
done

# python3 是 preflight 的解释器：缺失属「环境不可用」，必须以退出码 2 报告。
if ! command -v python3 >/dev/null 2>&1; then
  echo "verify: FAIL 环境不可用（找不到 python3，preflight 无法运行），安装后重跑"
  exit 2
fi

# 解析 Godot 可执行文件：显式 GODOT_BIN > PATH > 常见安装位置。
# 解析逻辑唯一实现在技能包 scripts/resolve-godot.sh（routine 两步同源，不会各说各话）。
GODOT_BIN="$(bash "${SKILL_DIR}/scripts/resolve-godot.sh")"
if [ $? -ne 0 ] || [ -z "${GODOT_BIN}" ]; then
  echo "verify: FAIL 环境不可用（找不到可执行的 Godot），安装后重跑"
  exit 2
fi
echo "verify: Godot = $("$GODOT_BIN" --version 2>/dev/null | head -1)（${GODOT_BIN}）"
echo "verify: 工程 = ${GAME_DIR}"
echo ""

echo "==> [1/4] preflight（静态前置一致性检查）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/4] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240（.myrd/routines.yaml godot-smoke 的 smokeFrames 同值）：冒烟脚本内部
# 以 TEST_TIME_SCALE=4 压缩等待，230 帧内自行收口，240 为兜底。
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/smoke.sh" "${GAME_DIR}"
SMOKE_EXIT=$?
if [ "${SMOKE_EXIT}" -ne 0 ]; then
  echo "verify: FAIL smoke 未通过（退出码 ${SMOKE_EXIT}），按 error-signatures.md 修复后重跑"
  exit 1
fi
echo ""

echo "==> [3/4] input-fuzz（输入鲁棒性 fuzz）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/input-fuzz.sh" "${GAME_DIR}"
FUZZ_EXIT=$?
if [ "${FUZZ_EXIT}" -ne 0 ]; then
  echo "verify: FAIL input-fuzz 未通过（退出码 ${FUZZ_EXIT}）"
  exit 4
fi
echo ""

echo "==> [4/4] playtest（机器人试玩节奏门禁）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/playtest.sh" "${GAME_DIR}"
PLAYTEST_EXIT=$?
if [ "${PLAYTEST_EXIT}" -ne 0 ]; then
  echo "verify: FAIL playtest 未通过（退出码 ${PLAYTEST_EXIT}）"
  exit 5
fi

echo ""
echo "verify: PASS preflight + smoke + input-fuzz + playtest 全部通过（验收五项：限时消失不计数/点击收集实时进度/满三颗即胜/漏收不判负可继续/托管无人干预取胜 + 重开可用）"
