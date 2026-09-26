#!/usr/bin/env bash
# playtest —— 机器人试玩门禁（通用层：节奏类代理指标的下限机判）
#
# 用法：
#   bash scripts/playtest.sh <工程目录>
#
# 环境变量：
#   GODOT_BIN              Godot 可执行文件（默认 godot；resolve-godot.sh 同源）
#   GODOT_PLAYTEST_SEEDS   逗号分隔种子列表（默认 20260913,20260914,20260915 —— 门禁可复现）
#   GODOT_PLAYTEST_FRAMES  每局物理帧数（60 tick = 1 秒；默认 900 = 15 秒/局；
#                          建议 ≈ 60 × spec.content.sessionSeconds，调参轮可拉满）
#
# 阈值：工程内 tests/playtest.json（frames_per_run + thresholds）覆盖内置默认，
#       键集与语义见 scripts/playtest_driver.gd 头注释与 SKILL.md §4.5。
#
# 判定协议：GODOT_PLAYTEST: PASS / GODOT_PLAYTEST: FAIL <原因>（退出码 0/1，2 = 环境不可用）；
#           GODOT_PLAYTEST_METRICS: <单行 JSON> = 指标明细（工作流 / 调参轮可消费）。
#
# 与 fuzz / smoke 的分工：
#   - smoke：模板接线与行为断言（能跑 + 信号到 + 反馈挂了 + 调参协议成立）
#   - input-fuzz：任意输入序下的进程健康（不崩溃 / 不挂死）
#   - 本脚本：bot 多局游玩下的节奏代理指标（首次奖励 / 无反馈窗口 / 反馈密度 / 局间方差）
#     —— 「好玩下限」的机器可判部分；「好不好玩」留给人（playtest 验收节点）。
#
# 供 .myrd/routines.yaml 的 godot-smoke 门禁调用（step.command 里 bash 本脚本）。

set -uo pipefail

PROJECT_DIR="${1:-.}"
GODOT_BIN="${GODOT_BIN:-godot}"
SEEDS="${GODOT_PLAYTEST_SEEDS:-20260913,20260914,20260915}"
FRAMES="${GODOT_PLAYTEST_FRAMES:-900}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE_DIR="$PROJECT_DIR/tests/.playtest"

say_fail() { echo "godot-playtest: FAIL $*"; }
say_pass() { echo "godot-playtest: PASS $*"; }

if [ ! -f "$PROJECT_DIR/project.godot" ]; then
  say_fail "目录 $PROJECT_DIR 下没有 project.godot，不是 Godot 工程"
  exit 2
fi

if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  say_fail "找不到 Godot 可执行文件「${GODOT_BIN}」（resolve-godot.sh 与本脚本同源）"
  exit 2
fi

# 暂存驱动（res:// 内才能被 Godot 加载；目录先删后建，崩溃残留不影响下次运行）
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp "$SCRIPT_DIR/playtest_driver.gd" "$STAGE_DIR/playtest_driver.gd"
cat > "$STAGE_DIR/playtest_driver.tscn" <<'EOF'
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://tests/.playtest/playtest_driver.gd" id="1"]

[node name="PlaytestDriver" type="Node"]
script = ExtResource("1")
EOF

# --quit-after 兜底预算：局数 × (局帧数 + 换局过渡) + 导入/首帧余量
SEED_COUNT="$(awk -F',' '{print NF}' <<< "$SEEDS")"
QUIT_AFTER=$(( SEED_COUNT * (FRAMES + 20) + 200 ))

IMPORT_LOG="$(mktemp -t godot-playtest-import.XXXXXX)"
LOG="$(mktemp -t godot-playtest.XXXXXX)"
cleanup() { rm -rf "$STAGE_DIR" "$IMPORT_LOG" "$LOG"; }
trap cleanup EXIT

"$GODOT_BIN" --headless --path "$PROJECT_DIR" --import >>"$IMPORT_LOG" 2>&1 || true

"$GODOT_BIN" --headless --path "$PROJECT_DIR" --quit-after "$QUIT_AFTER" \
  res://tests/.playtest/playtest_driver.tscn >"$LOG" 2>&1
RUN_EXIT=$?

PLAYTEST_PASS="$(grep -c 'GODOT_PLAYTEST: PASS' "$LOG")"
if [ "$PLAYTEST_PASS" -gt 0 ] && [ "${RUN_EXIT}" -eq 0 ]; then
  # 与 smoke / fuzz 同标准：断言通过但日志里有脚本错误 = 带病绿灯，照拦
  RUNTIME_ERRORS="$(grep -nE "SCRIPT ERROR|Parse Error" "$LOG" | head -10)"
  RUNTIME_ERROR_COUNT="$(grep -cE "SCRIPT ERROR|Parse Error" "$LOG")"
  if [ -n "$RUNTIME_ERRORS" ]; then
    echo "$RUNTIME_ERRORS"
    say_fail "试玩通过但运行日志里有 ${RUNTIME_ERROR_COUNT} 处脚本错误 —— bot 游玩触发了真实缺陷"
    echo "       修复：用同一 GODOT_PLAYTEST_SEEDS 复跑可稳定复现；按行号定位后加回归断言再修。"
    exit 1
  fi
  grep -E 'GODOT_PLAYTEST: PASS|GODOT_PLAYTEST_METRICS' "$LOG"
  say_pass "机器人试玩通过（${SEED_COUNT} 局，每局 ${FRAMES} 帧，节奏代理指标在阈值内）"
  exit 0
fi

say_fail "机器人试玩未通过（退出码 ${RUN_EXIT}）"
grep -E "GODOT_PLAYTEST: FAIL|SCRIPT ERROR|Parse Error" "$LOG" | head -10
echo "---- 试玩指标（如有）----"
grep 'GODOT_PLAYTEST_METRICS' "$LOG" | head -1
echo "---- 试玩日志末尾（最多 20 行）----"
tail -20 "$LOG"
exit 1
