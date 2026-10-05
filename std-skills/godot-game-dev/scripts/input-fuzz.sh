#!/usr/bin/env bash
# input-fuzz —— 门禁输入鲁棒性 fuzz（通用层：「任意输入序下进程健康、输入管线不挂死」）
#
# 用法：
#   bash scripts/input-fuzz.sh <工程目录>
#
# 环境变量：
#   GODOT_BIN        Godot 可执行文件（默认 godot；resolve-godot.sh 同源）
#   GODOT_FUZZ_SEED  随机种子（默认固定值 —— 门禁要求可复现，换种子属人工专项）
#   GODOT_FUZZ_FRAMES --quit-after 帧数兜底（默认 400，防驱动自身死循环）
#
# 判定协议：GODOT_FUZZ: PASS / GODOT_FUZZ: FAIL <原因>（退出码 0/1，2 = 环境不可用）
#
# 分工与边界：
#   - 本脚本只管通用鲁棒性：崩溃、脚本错误、主循环挂死、对抗事件序（悬挂手势/孤儿
#     释放/双指抢控）下的存活。「任意输入序后标准滑动必须生效」这类玩法语义不变式
#     由 tests/smoke.gd 的噪声相位覆盖（模板内置）——两层互补，缺一不可。
#   - 驱动脚本在运行时暂存到 <工程>/tests/.fuzz/ 下（res:// 内才能被 Godot 加载），
#     结束后清理；崩溃残留不影响下次运行（目录先删后建）。
#
# 供 .myrd/routines.yaml 的 godot-smoke 门禁调用（step.command 里 bash 本脚本）。

set -uo pipefail

PROJECT_DIR="${1:-.}"
GODOT_BIN="${GODOT_BIN:-godot}"
FRAMES="${GODOT_FUZZ_FRAMES:-400}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE_DIR="$PROJECT_DIR/tests/.fuzz"

say_fail() { echo "godot-fuzz: FAIL $*"; }
say_pass() { echo "godot-fuzz: PASS $*"; }

if [ ! -f "$PROJECT_DIR/project.godot" ]; then
  say_fail "目录 $PROJECT_DIR 下没有 project.godot，不是 Godot 工程"
  exit 2
fi

if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  say_fail "找不到 Godot 可执行文件「${GODOT_BIN}」（resolve-godot.sh 与本脚本同源）"
  exit 2
fi

# 暂存驱动（SceneTree 脚本以 --script 运行不注册 autoload，必须走场景路径）
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp "$SCRIPT_DIR/input_fuzz_driver.gd" "$STAGE_DIR/fuzz_driver.gd"
cat > "$STAGE_DIR/fuzz_driver.tscn" <<'EOF'
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://tests/.fuzz/fuzz_driver.gd" id="1"]

[node name="FuzzDriver" type="Node"]
script = ExtResource("1")
EOF

IMPORT_LOG="$(mktemp -t godot-fuzz-import.XXXXXX)"
LOG="$(mktemp -t godot-fuzz.XXXXXX)"
cleanup() { rm -rf "$STAGE_DIR" "$IMPORT_LOG" "$LOG"; }
trap cleanup EXIT

"$GODOT_BIN" --headless --path "$PROJECT_DIR" --import >>"$IMPORT_LOG" 2>&1 || true

"$GODOT_BIN" --headless --path "$PROJECT_DIR" --quit-after "$FRAMES" \
  res://tests/.fuzz/fuzz_driver.tscn >"$LOG" 2>&1
RUN_EXIT=$?

FUZZ_PASS="$(grep -c 'GODOT_FUZZ: PASS' "$LOG")"
if [ "$FUZZ_PASS" -gt 0 ] && [ "${RUN_EXIT}" -eq 0 ]; then
  # 与 smoke 同标准：断言通过但日志里有脚本错误 = 带病绿灯，照拦
  RUNTIME_ERRORS="$(grep -nE "SCRIPT ERROR|Parse Error" "$LOG" | head -10)"
  RUNTIME_ERROR_COUNT="$(grep -cE "SCRIPT ERROR|Parse Error" "$LOG")"
  if [ -n "$RUNTIME_ERRORS" ]; then
    echo "$RUNTIME_ERRORS"
    say_fail "fuzz 通过但运行日志里有 ${RUNTIME_ERROR_COUNT} 处脚本错误 —— 随机输入触发了真实缺陷（种子见日志 [fuzz] seed=）"
    echo "       修复：用同一 GODOT_FUZZ_SEED 复跑可稳定复现；按行号定位后加回归断言再修。"
    exit 1
  fi
  grep 'GODOT_FUZZ: PASS' "$LOG"
  say_pass "输入鲁棒性 fuzz 通过（退出码 0，日志无脚本错误）"
  exit 0
fi

say_fail "输入鲁棒性 fuzz 未通过（退出码 ${RUN_EXIT}）"
grep -E "GODOT_FUZZ: FAIL|SCRIPT ERROR|Parse Error" "$LOG" | head -10
echo "---- fuzz 日志末尾（最多 20 行）----"
tail -20 "$LOG"
exit 1
