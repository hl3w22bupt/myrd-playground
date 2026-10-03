#!/usr/bin/env bash
# 门禁一（工程校验）——《测试预算边界》需求固化的第一道门禁。
#
# 校验口径（spec acceptance: acc-godot-project / acc-static-clean）：
#   1. games/game-13/project.godot 存在、config_version=5、features 为 Godot 4.x、主场景指向 scenes/main.tscn
#   2. 全部 .gd 脚本静态解析零报错（godot --check-only --script）
#   3. 场景（.tscn）与导出预设引用的资源路径全部存在，无缺失引用
#
# 输出协议：`GATE1: PASS` / `GATE1: FAIL <原因>`；退出码 0 = 通过，1 = 失败，2 = 环境不可用。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GAME="$ROOT/games/game-13"
GODOT_BIN="${GODOT_BIN:-godot}"
FAILURES=()

fail() { FAILURES+=("$1"); echo "  ✗ $1"; }
pass() { echo "  ✓ $1"; }

echo "== 门禁一（工程校验）：《测试预算边界》games/game-13 =="

# ── 1. project.godot 合法可解析 ─────────────────────────────────────────
if [ ! -f "$GAME/project.godot" ]; then
  fail "games/game-13/project.godot 不存在（工程载体缺失）"
  echo "GATE1: FAIL project.godot 缺失"
  exit 1
fi

grep -q '^config_version=5' "$GAME/project.godot" \
  && pass "project.godot config_version=5（Godot 4.x 配置格式）" \
  || fail "project.godot 缺少 config_version=5（不是 Godot 4 工程配置）"

grep -q 'PackedStringArray("4\.' "$GAME/project.godot" \
  && pass "config/features 声明为 Godot 4.x" \
  || fail "config/features 未声明 Godot 4.x 特性集"

grep -q 'run/main_scene="res://scenes/main.tscn"' "$GAME/project.godot" \
  && pass "主场景指向 res://scenes/main.tscn" \
  || fail "run/main_scene 未指向 res://scenes/main.tscn"

# ── 2. 全部脚本静态解析 ─────────────────────────────────────────────────
if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
  echo "GATE1: FAIL 找不到 Godot 可执行文件「$GODOT_BIN」（GODOT_BIN=/path/to/godot）"
  exit 2
fi

# 先导入资源，否则 class_name 全局类解析不到（godot --import 生成 .godot/ 缓存）
"$GODOT_BIN" --headless --path "$GAME" --import >/dev/null 2>&1 || true

SCRIPT_ERRORS=0
while IFS= read -r script; do
  rel="${script#"$GAME/"}"
  out="$("$GODOT_BIN" --headless --path "$GAME" --check-only --script "res://$rel" 2>&1)"
  if [ -n "$out" ]; then
    echo "$out" | grep -qE "SCRIPT ERROR|Parse Error|ERROR" && { fail "脚本解析失败: $rel"; echo "$out" | sed 's/^/      /'; SCRIPT_ERRORS=$((SCRIPT_ERRORS+1)); }
  fi
done < <(find "$GAME" -name "*.gd" -type f | sort)
[ "$SCRIPT_ERRORS" -eq 0 ] && pass "全部 $(find "$GAME" -name '*.gd' | wc -l | tr -d ' ') 个 .gd 脚本静态解析零报错"

# ── 3. 场景与资源引用完整性 ─────────────────────────────────────────────
MISSING=0
while IFS= read -r res_path; do
  local_path="$GAME/${res_path#res://}"
  if [ ! -f "$local_path" ]; then
    fail "引用缺失: $res_path（被场景/预设引用但文件不存在）"
    MISSING=$((MISSING+1))
  fi
done < <(
  find "$GAME" \( -name "*.tscn" -o -name "*.cfg" \) -type f -print0 |
    xargs -0 grep -hoE 'res://[A-Za-z0-9_./-]+\.(gd|tscn|svg|png|wav|otf|ttf)' |
    sort -u
)
[ "$MISSING" -eq 0 ] && pass "场景/脚本/导出预设引用的资源全部存在，无缺失"

# ── 判定 ────────────────────────────────────────────────────────────────
if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo "GATE1: FAIL 共 ${#FAILURES[@]} 项不通过"
  exit 1
fi
echo "GATE1: PASS project.godot 可解析 / 脚本静态零报错 / 引用完整无缺失"
exit 0
