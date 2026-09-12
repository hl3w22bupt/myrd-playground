#!/usr/bin/env bash
# Soccer 自测门禁：preflight（静态一致性）→ smoke（无头运行）。
#
# 实现不落地在本工程，而是复用 Godot 技能包的流水线（SKILL.md §1.1 三步起步的第③步）：
#   std-skills/godot-game-dev/scripts/preflight.py
#   std-skills/godot-game-dev/scripts/smoke.sh
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/soccer/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/soccer/verify.sh
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = smoke 冒烟失败（按 error-signatures.md 修复后重跑）
#   2 = 环境不可用（找不到 Godot / 技能包脚本，装环境而不是改代码）
#   3 = preflight 静态一致性检查未通过（先修静态问题，不必跑冒烟）

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"

# 技能包门禁脚本的存在性守卫：缺任何一个都属「环境不可用」，必须以退出码 2 报告，
# 不能让它掉进下游的非零退出码里被误判成 3（静态不一致 → 诱导修复节点去改游戏代码）。
for gate_script in preflight.py smoke.sh resolve-godot.sh; do
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

echo "==> [1/2] preflight（静态前置一致性检查，13 类）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/2] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240：本工程的冒烟要跑「设置注入 + 开球等待 + 移动 + 传球 + 抢断/拿球 + 射门进球 +
# 重新开球 + 界外球/角球/球门球三次死球重发 + 全场终场 + 结算面板 + 重开」约 205 个物理帧，
# 默认 120 的兜底余量太薄 —— headless 下 process:physics 接近 1:1 但不严格相等，
# 一旦协程没跑完就被兜底杀掉，日志会既无 PASS 也无 FAIL。预算只放宽兜底，不改变判定语义。
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/smoke.sh" "${GAME_DIR}"
SMOKE_EXIT=$?
if [ "${SMOKE_EXIT}" -ne 0 ]; then
  echo "verify: FAIL smoke 未通过（退出码 ${SMOKE_EXIT}），按 error-signatures.md 修复后重跑"
  exit 1
fi

echo ""
echo "verify: PASS preflight + smoke 全部通过（GOAL.md 验收标准 A1/A2/A3/A4/A6 满足）"
