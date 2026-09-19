#!/usr/bin/env bash
# 《我被ai女友包围了》自测门禁：preflight（静态一致性）→ smoke（无头运行）。
#
# 实现不落地在本工程，只复用 Godot 技能包的流水线（SKILL.md §1.1 三步起步的第③步）：
#   std-skills/godot-game-dev/scripts/preflight.py
#   std-skills/godot-game-dev/scripts/smoke.sh
# 本脚本不重新实现任何检查逻辑，判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/ai/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/ai/verify.sh
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = smoke 冒烟失败（按 error-signatures.md 修复后重跑）
#   2 = 环境不可用（找不到 Godot / 技能包脚本 / python3，装环境而不是改代码）
#   3 = preflight 静态一致性检查未通过（先修静态问题，不必跑冒烟）

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
# 技能包目录解析：仓库内实际落点优先（std-skills/，.myrd/routines.yaml 同源引用），
# 兼容文档约定的 docs/skills/ 落点 —— 两处都没有才报「环境不可用」。
SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"
if [ ! -f "${SKILL_DIR}/scripts/smoke.sh" ] && [ -f "${REPO_ROOT}/docs/skills/godot-game-dev/scripts/smoke.sh" ]; then
  SKILL_DIR="${REPO_ROOT}/docs/skills/godot-game-dev"
fi

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
# 帧预算 240：冒烟要跑「噪声相位 → 移动 → 收集对话 → 换位重生 → confirm 回应 →
# 章节推进 → 胜利/失败判定 → 键盘重开 → 遮罩重开」约 92 个物理帧阶段
# （调参协议/难度梯度/反馈接线三组断言无帧依赖，_ready 与既有阶段内判定），
# 默认 120 兜底虽够，但 headless 下 process:physics 不严格 1:1；预算对齐
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
echo "verify: PASS preflight + smoke 全部通过（可玩验收：移动/收集对话/换位重生/回应加成/反馈接线/调参协议/难度梯度/章节推进/胜负可达/重开双通道）"
