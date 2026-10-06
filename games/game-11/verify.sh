#!/usr/bin/env bash
# 《做一个线上抓娃娃游戏，支持多种夹爪，多种娃娃。夹爪和娃娃的美》(game-11) 自测门禁：
# preflight（静态一致性）→ smoke（无头冒烟，GODOT_SMOKE_FRAMES=240）→ input-fuzz（输入鲁棒性）→ playtest（机器人试玩）。
#
# 本脚本只「调用」仓库技能包的判定脚本，不重新实现任何检查逻辑；
# 判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/（与 .myrd/routines.yaml 同源）。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/game-11/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/game-11/verify.sh
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = 冒烟/门禁失败（按 error-signatures.md 修复后重跑）
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
for gate_script in preflight.py smoke.sh resolve-godot.sh input-fuzz.sh playtest.sh; do
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

echo "==> [1/4] preflight（静态前置一致性检查，14 类）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/4] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240：冒烟要跑「噪声 → 移动 → 下爪抓取周期 → 胜负 → 重开」约 150 个物理帧阶段，
# 预算对齐 .myrd/routines.yaml godot-smoke 的 smokeFrames 默认值（240），两边同值不各说各话。
# 预算只放宽兜底，不改变判定语义。
GODOT_SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/smoke.sh" "${GAME_DIR}"
SMOKE_EXIT=$?
if [ "${SMOKE_EXIT}" -ne 0 ]; then
  echo "verify: FAIL smoke 未通过（退出码 ${SMOKE_EXIT}），按 error-signatures.md 修复后重跑"
  exit 1
fi
echo ""

echo "==> [3/4] input-fuzz（输入鲁棒性 fuzz：对抗事件序下的存活判定）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/input-fuzz.sh" "${GAME_DIR}"
FUZZ_EXIT=$?
if [ "${FUZZ_EXIT}" -ne 0 ]; then
  echo "verify: FAIL input-fuzz 未通过（退出码 ${FUZZ_EXIT}），按失败日志定位后重跑"
  exit 1
fi
echo ""

echo "==> [4/4] playtest（机器人试玩门禁：节奏类代理指标下限）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/playtest.sh" "${GAME_DIR}"
PLAYTEST_EXIT=$?
if [ "${PLAYTEST_EXIT}" -ne 0 ]; then
  echo "verify: FAIL playtest 未通过（退出码 ${PLAYTEST_EXIT}），按 GODOT_PLAYTEST: FAIL 原因修复后重跑"
  exit 1
fi

echo ""
echo "verify: PASS preflight + smoke + fuzz + playtest 全部通过"
