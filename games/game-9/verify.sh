#!/usr/bin/env bash
# game-9《推箱子点亮方块解谜》自测门禁：preflight（静态一致性）→ smoke（无头冒烟）→ input-fuzz（输入鲁棒性）。
#
# 本脚本只「调用」仓库内技能包的判定脚本，不重新实现任何检查逻辑；
# 判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/（.myrd/routines.yaml 的
# godot-smoke routine 同源引用，两边不会各说各话）。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/game-9/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/game-9/verify.sh
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = smoke / input-fuzz 运行期判定未通过（按 references/error-signatures.md 修复后重跑）
#   2 = 环境不可用（找不到 Godot / 技能包脚本 / python3，装环境而不是改代码）
#   3 = preflight 静态一致性检查未通过（先修静态问题，不必跑冒烟）

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"

# 技能包门禁脚本的存在性守卫：缺任何一个都属「环境不可用」，必须以退出码 2 报告，
# 不能让它掉进下游的非零退出码里被误判成 3（静态不一致 → 诱导修复节点去改游戏代码）。
for gate_script in preflight.py smoke.sh input-fuzz.sh resolve-godot.sh; do
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
# 解析逻辑唯一实现在技能包 scripts/resolve-godot.sh（routine 各步同源，不会各说各话）。
GODOT_BIN="$(bash "${SKILL_DIR}/scripts/resolve-godot.sh")"
if [ $? -ne 0 ] || [ -z "${GODOT_BIN}" ]; then
  echo "verify: FAIL 环境不可用（找不到可执行的 Godot），安装后重跑"
  exit 2
fi
echo "verify: Godot = $("$GODOT_BIN" --version 2>/dev/null | head -1)（${GODOT_BIN}）"
echo "verify: 工程 = ${GAME_DIR}"
echo ""

echo "==> [1/3] preflight（静态前置一致性检查，13 类）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/3] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240：冒烟要跑「噪声注入 → 移动步进 → 推动规则 → 点亮通关 → Undo/Restart →
# 关卡切换 → 通关弹层 → confirm 下一关」约 110 个物理帧阶段；预算对齐
# .myrd/routines.yaml godot-smoke 的 smokeFrames 默认值（240），两边同值不各说各话。
# 预算只放宽兜底，不改变判定语义。
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/smoke.sh" "${GAME_DIR}"
SMOKE_EXIT=$?
if [ "${SMOKE_EXIT}" -ne 0 ]; then
  echo "verify: FAIL smoke 未通过（退出码 ${SMOKE_EXIT}），按 error-signatures.md 修复后重跑"
  exit 1
fi
echo ""

echo "==> [3/3] input-fuzz（任意输入序下进程健康、输入管线不挂死）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/input-fuzz.sh" "${GAME_DIR}"
FUZZ_EXIT=$?
if [ "${FUZZ_EXIT}" -ne 0 ]; then
  echo "verify: FAIL input-fuzz 未通过（退出码 ${FUZZ_EXIT}），按日志里的 GODOT_FUZZ_SEED 复现修复后重跑"
  exit 1
fi

echo ""
echo "verify: PASS preflight + smoke + input-fuzz 全部通过"
echo "verify: 冒烟断言覆盖（AC1–AC4）：角色移动 / 推动规则（推墙·顶方块无效、不可拉动）/ 点亮与通关判定 / Undo·Restart / 关卡切换与通关弹层"
echo "verify: 关卡可解性证据：python3 ${GAME_DIR}/tools/level_solver.py ${GAME_DIR}"
