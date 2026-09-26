#!/usr/bin/env bash
# 《疾风忍者跑》自测门禁：preflight（静态一致性）→ smoke（无头冒烟）→ input-fuzz（输入鲁棒性）→ playtest（机器人试玩）。
#
# 实现不落地在本工程，只复用 Godot 技能包的流水线（SKILL.md §1.1 三步起步的第③步）：
#   std-skills/godot-game-dev/scripts/preflight.py
#   std-skills/godot-game-dev/scripts/smoke.sh
#   std-skills/godot-game-dev/scripts/input-fuzz.sh
#   std-skills/godot-game-dev/scripts/playtest.sh
# 本脚本不重新实现任何检查逻辑，判定器唯一来源是仓库内 std-skills/godot-game-dev/scripts/
#（与 .myrd/routines.yaml 的 godot-smoke routine 同源）。
#
# 注：playtest 判定器已由模板仓库预置（运维提交，逐字节 + sha256 校验），工程侧需提供
# §3B 模板协议（autoload Juice 的 feedback_fired 反馈流 + tests/playtest.json 阈值）。
#
# 用法（仓库根目录或任意目录均可）：
#   bash games/game-3/verify.sh
#   GODOT_BIN=/path/to/Godot bash games/game-3/verify.sh
#   GODOT_PLAYTEST_FRAMES=1200 bash games/game-3/verify.sh   # 试玩每局帧数（默认 1200 = 60×20s 赛道全程）
#
# 退出码（机器可判别，与 .myrd/routines.yaml「以命令退出码判 step」的语义对齐）：
#   0 = 通过
#   1 = smoke / fuzz / playtest 运行期检查未通过（按 error-signatures.md 修复后重跑）
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

echo "==> [1/4] preflight（静态前置一致性检查，13 类）"
python3 "${SKILL_DIR}/scripts/preflight.py" "${GAME_DIR}"
PREFLIGHT_EXIT=$?
if [ "${PREFLIGHT_EXIT}" -ne 0 ]; then
  echo "verify: FAIL preflight 未通过（退出码 ${PREFLIGHT_EXIT}），先修静态问题再跑冒烟"
  exit 3
fi
echo ""

echo "==> [2/4] smoke（godot --headless 无头冒烟门禁）"
# 帧预算 240：冒烟要跑「噪声 → 自动奔跑 → 跳跃/二段跳 → 收集飞镖 → 撞刺失败 → 重开 → 跑底过关」
# 约 92 个物理帧阶段，默认 120 兜底虽够，但 headless 下 process:physics 不严格 1:1；预算对齐
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

echo "==> [3/4] input-fuzz（随机输入序下的进程健康/输入管线鲁棒性）"
GODOT_BIN="${GODOT_BIN}" bash "${SKILL_DIR}/scripts/input-fuzz.sh" "${GAME_DIR}"
FUZZ_EXIT=$?
if [ "${FUZZ_EXIT}" -ne 0 ]; then
  echo "verify: FAIL input-fuzz 未通过（退出码 ${FUZZ_EXIT}），按日志里的 GODOT_FUZZ seed 复现修复后重跑"
  exit 1
fi
echo ""

echo "==> [4/4] playtest（机器人多局试玩：节奏代理指标下限机判）"
# 每局帧数默认 1200 = 60 tick × 20s（赛道全程 4800px ÷ 240px/s），与
# .myrd/routines.yaml godot-smoke 的 playtestFrames 默认同值；阈值见 tests/playtest.json。
GODOT_PLAYTEST_FRAMES="${GODOT_PLAYTEST_FRAMES:-1200}" GODOT_BIN="${GODOT_BIN}" \
	bash "${SKILL_DIR}/scripts/playtest.sh" "${GAME_DIR}"
PLAYTEST_EXIT=$?
if [ "${PLAYTEST_EXIT}" -ne 0 ]; then
  echo "verify: FAIL playtest 未通过（退出码 ${PLAYTEST_EXIT}），按 GODOT_PLAYTEST: FAIL 逐条原因修复后重跑"
  exit 1
fi

echo ""
echo "verify: PASS preflight + smoke + input-fuzz + playtest 全部通过"
echo "verify: 可玩验收覆盖（冒烟断言）：自动奔跑移动 / 跳跃+二段跳 / 收集飞镖加分 / 撞刺失败判定 / 重开复位 / 跑到底过关 / Juice 反馈总线"
echo "verify: 试玩节奏覆盖（playtest 指标）：首次得分时间 / 最长无反馈窗口 / 反馈密度 / 局间结果方差（明细见 GODOT_PLAYTEST_METRICS 行）"
