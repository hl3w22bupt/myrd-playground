#!/usr/bin/env bash
# godot-smoke —— 无头冒烟门禁（「游戏能不能跑」的机器判定通道）
#
# 用法：
#   bash scripts/smoke.sh <工程目录> [场景路径]
#
# 环境变量：
#   GODOT_BIN          Godot 可执行文件（默认 godot；本机装在别处时用 GODOT_BIN=/path/to/Godot）
#   GODOT_SMOKE_FRAMES --quit-after 的帧数兜底（默认 240，防止冒烟场景死循环；
#                      与 .myrd/routines.yaml godot-smoke 的 smokeFrames 默认值同源 ——
#                      120 帧只够单屏小游戏的冒烟（如 Coin Rush ≈132 物理帧），剧情/多链路工程
#                      冒烟在 Engine.max_fps=60 限速下需要 ≈200+ process 帧才跑得完，
#                      裸跑（不带该变量）会在协程结束前被杀 → 既无 PASS 也无 FAIL → 误判 FAIL）。
#   GODOT_SMOKE_SCENE  冒烟场景（默认自动：有 tests/smoke.tscn 就跑它，否则跑 run/main_scene）
#   GODOT_SMOKE_ALLOW_WEAK=1  找不到断言场景时不判 FAIL，退回「能启动即通过」的宽松判定（勿用于门禁）
#   GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1  冒烟断言通过但日志里有 SCRIPT ERROR/Parse Error 时不判 FAIL
#                             （仅当错误确属外部噪声时用；勿用于门禁）
#
# 判定协议（与 templates/minimal-2d/tests/smoke.gd 约定一致）：
#   GODOT_SMOKE: PASS  → 通过（但仍要扫日志：SCRIPT ERROR / Parse Error 判 FAIL ——
#                         每帧刷屏型运行期错误会伪装成健康，见 error-signatures E-16）
#   GODOT_SMOKE: FAIL  → 失败（逐条打印原因）
#   无标记             → 默认 FAIL；按 SCENE_ARG 是否为空区分两种原因：
#                         没有断言场景（弱判定需 GODOT_SMOKE_ALLOW_WEAK=1 显式开启）；
#                         有场景但帧预算内没跑完（提示 Engine.max_fps / GODOT_SMOKE_FRAMES）
#
# 退出码：0 = 通过；1 = 冒烟失败；2 = 环境不可用（找不到 Godot / 不是 Godot 工程）
#
# 供 .myrd/routines.yaml 的 godot-smoke 门禁直接调用（step.command 里 bash 本脚本）。

set -uo pipefail

PROJECT_DIR="${1:-.}"
SCENE_ARG="${2:-${GODOT_SMOKE_SCENE:-}}"
FRAMES="${GODOT_SMOKE_FRAMES:-240}"
GODOT_BIN="${GODOT_BIN:-godot}"

say_fail() { echo "godot-smoke: FAIL $*"; }
say_pass() { echo "godot-smoke: PASS $*"; }

if [ ! -f "$PROJECT_DIR/project.godot" ]; then
  say_fail "目录 $PROJECT_DIR 下没有 project.godot，不是 Godot 工程"
  exit 2
fi

if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  say_fail "找不到 Godot 可执行文件「${GODOT_BIN}」。安装方式：brew install --cask godot，或下载后 GODOT_BIN=/path/to/Godot 指定"
  exit 2
fi

IMPORT_LOG="$(mktemp -t godot-import.XXXXXX)"
LOG="$(mktemp -t godot-smoke.XXXXXX)"
trap 'rm -f "$IMPORT_LOG" "$LOG"' EXIT

# ① 资源导入：首次运行需要生成 .godot/ 导入缓存，否则贴图等资源会加载失败。
#    失败不在此处判死，交给运行阶段判定 —— 导入日志单独落盘，运行失败而运行日志
#    干净时（典型：导入期就坏了，进程秒退）还能把导入期根因带出来，不被覆盖丢掉。
"$GODOT_BIN" --headless --path "$PROJECT_DIR" --import >>"$IMPORT_LOG" 2>&1 || true

# ② 选定冒烟场景：显式指定 > tests/smoke.tscn > run/main_scene
if [ -z "$SCENE_ARG" ]; then
  if [ -f "$PROJECT_DIR/tests/smoke.tscn" ]; then
    SCENE_ARG="tests/smoke.tscn"
  else
    SCENE_ARG=""
  fi
fi

RUN_ARGS=(--headless --path "$PROJECT_DIR" --quit-after "$FRAMES")
[ -n "$SCENE_ARG" ] && RUN_ARGS+=("$SCENE_ARG")
"$GODOT_BIN" "${RUN_ARGS[@]}" >"$LOG" 2>&1
RUN_EXIT=$?

# ③ 双断言：退出码 + 日志标记
if grep -q "GODOT_SMOKE: FAIL" "$LOG"; then
  grep "GODOT_SMOKE: FAIL" "$LOG" | head -10
  say_fail "冒烟场景断言未通过（退出码 ${RUN_EXIT}）"
  exit 1
fi

if grep -q "GODOT_SMOKE: PASS" "$LOG"; then
  if [ "${RUN_EXIT}" -ne 0 ]; then
    say_fail "冒烟场景打印了 PASS 但进程退出码为 ${RUN_EXIT}（见日志末尾）"
    tail -15 "$LOG"
    exit 1
  fi
  # 断言全过 ≠ 日志干净：每帧刷屏的 SCRIPT ERROR（如 _process 里字典越界）不影响断言结果，
  # 却是真实的运行期缺陷 —— 必须拦下，否则门禁给「带病的绿灯」（实测见 error-signatures E-16）。
  RUNTIME_ERRORS="$(grep -nE "SCRIPT ERROR|Parse Error" "$LOG" | head -10)"
  RUNTIME_ERROR_COUNT="$(grep -cE "SCRIPT ERROR|Parse Error" "$LOG")"
  if [ -n "$RUNTIME_ERRORS" ] && [ "${GODOT_SMOKE_IGNORE_RUNTIME_ERRORS:-0}" != "1" ]; then
    echo "$RUNTIME_ERRORS"
    say_fail "冒烟断言通过，但运行日志里有 ${RUNTIME_ERROR_COUNT} 处脚本错误（退出码 0）"
    echo "       修复：按上方行号定位 SCRIPT ERROR / Parse Error（每帧刷屏型 bug 常藏在 _process/_physics_process）。"
    echo "       确属外部噪声时可用 GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1 显式豁免（勿用于门禁）。"
    exit 1
  fi
  if [ -n "$RUNTIME_ERRORS" ]; then
    say_pass "冒烟场景通过：${SCENE_ARG}（退出码 0，断言标记齐全；${RUNTIME_ERROR_COUNT} 处脚本错误已按 GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1 豁免）"
    echo "godot-smoke: WARN 豁免了 ${RUNTIME_ERROR_COUNT} 处脚本错误 —— 勿用于门禁"
  else
    say_pass "冒烟场景通过：${SCENE_ARG}（退出码 0，断言标记齐全，日志无脚本错误）"
  fi
  exit 0
fi

# ④ 无标记 → 无断言场景。默认判 FAIL：引擎「能启动」不等于「游戏成立」。
#    实测（4.3.stable）：一个只 print 一行、玩家不能动也收不到金币的工程，
#    --headless 退出码 0、日志零报错 —— 退出码与日志扫不出这类「静默逻辑 bug」，
#    唯一能拦住它的就是 tests/smoke.tscn 里的行为断言。门禁对假阳性的容忍度必须是 0：
#    绿灯放行一个玩不了的游戏，比拦下一个能跑的半成品代价大得多。
#    GODOT_SMOKE_ALLOW_WEAK=1 可显式退回旧的宽松行为（仅限本地快速迭代，勿用于门禁）。
HARD_ERRORS="$(grep -nE "SCRIPT ERROR|Parse Error|Cannot open file|Failed loading resource" "$LOG" | head -10)"
if [ "${RUN_EXIT}" -eq 0 ] && [ -z "$HARD_ERRORS" ]; then
  # 无标记分两种原因，诊断不能混为一谈（把帧预算不足误报成「找不到场景」会带偏修复方向）
  if [ -z "$SCENE_ARG" ]; then
    # 原因一：没有 tests/smoke.tscn → 工程能启动但没有任何行为断言
    if [ "${GODOT_SMOKE_ALLOW_WEAK:-0}" = "1" ]; then
      say_pass "主场景无头运行通过（退出码 0，无脚本错误）"
      echo "godot-smoke: WARN 弱判定已启用（GODOT_SMOKE_ALLOW_WEAK=1）：未断言输入/信号/物理，仅证明引擎能启动"
      exit 0
    fi
    say_fail "工程能启动，但找不到 tests/smoke.tscn，没有任何行为断言 —— 无法证明游戏成立"
    echo "       静默逻辑 bug（零报错、玩家不能动/收不到东西）在这一步必然漏网，实测见可行性验证报告。"
    echo "       修复：按技能包规范补 tests/smoke.tscn（模板 templates/minimal-2d/tests/），"
    echo "            或临时 GODOT_SMOKE_ALLOW_WEAK=1 显式接受弱判定。"
    exit 1
  fi
  # 原因二：断言场景存在，但没在 --quit-after 的帧预算内打出标记（协程没跑完就退出）
  say_fail "冒烟场景 ${SCENE_ARG} 在 --quit-after ${FRAMES} 帧内没有打出 GODOT_SMOKE: PASS/FAIL 标记"
  echo "       headless 无垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz；"
  echo "       --quit-after 数的是 process 帧，协程没跑完进程就被兜底杀掉 → 既无 PASS 也无 FAIL。"
  echo "       修复：在冒烟场景 _ready() 里加 Engine.max_fps = 60（模板 tests/smoke.gd 已有），"
  echo "            或加大预算 GODOT_SMOKE_FRAMES=<更大的帧数> 后重跑。"
  exit 1
fi

say_fail "无头运行失败（退出码 ${RUN_EXIT}）"
[ -n "$HARD_ERRORS" ] && echo "$HARD_ERRORS"
if [ ! -s "$LOG" ] && [ -s "$IMPORT_LOG" ]; then
  # 运行日志为空 = 进程在跑起来之前就退了，真实根因在导入期日志里（E-05 类）
  echo "---- 运行日志为空，改看导入日志末尾（最多 20 行）----"
  tail -20 "$IMPORT_LOG"
else
  echo "---- 日志末尾（最多 20 行）----"
  tail -20 "$LOG"
fi
exit 1
