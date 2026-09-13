#!/usr/bin/env bash
# gate-selftest —— 门禁自检：证明 godot-smoke 门禁「不空转」。
#
# 为什么需要它：门禁最危险的不是「误报」，是「假阴性」—— 工程能启动、日志零报错、
# 冒烟场景的断言却从未真正执行过，绿灯照样放行一个玩不了的游戏。
# 静态检查（preflight）与「跑一遍冒烟看 PASS」都证明不了断言本身有效：
# 唯一的办法是注入必然缺陷，看门禁是否真的拦得下来、原因是否可读。
#
# 做法：把参照工程复制到临时目录，注入 8 类缺陷，逐一跑 smoke.sh，
# 断言「必须 FAIL 且失败原因包含预期的根因描述」。任一负例漏网 → 门禁退化，本脚本退出码 1。
#
# 注入分两层：
#   D1-D5（基础层）锚定在 templates/minimal-2d 的接线契约上（主场景实例名 / autoload GameState /
#        InputMap 动作 / Player.moved 信号 / SPEED 常量），对模板派生的任何工程都成立；
#   D6-D8（工程层）锚定参照工程自身新增的契约（视觉↔判定半径 / 生成失败必须响 / 币位一触双收上界），
#        参照工程缺该锚点时自动 SKIP（不算失败）—— 换一个工程跑自检时不会误报。
# 工程自身的玩法差异（金币数、胜利条件等）不影响 D1-D5 的注入。
#
# 用法：
#   bash std-skills/godot-game-dev/scripts/gate-selftest.sh [参照工程目录]
#   # 默认参照工程 games/godot-coin-rush；传 templates/minimal-2d 亦可
#
# 环境变量：GODOT_BIN（可选；缺省时由 resolve-godot.sh 按候选清单解析）
#
# 退出码：0 = 注入的缺陷全部被拦（SKIP 的不适用于当前参照工程，门禁有效）；
#         1 = 有负例漏网（门禁失效，禁止放行）；
#         2 = 环境不可用（找不到 Godot / 参照工程没有 tests/smoke.tscn）

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW_REFERENCE="${1:-}"
REFERENCE="$RAW_REFERENCE"

say_fail() { echo "gate-selftest: FAIL $*"; }
say_pass() { echo "gate-selftest: PASS $*"; }

if [ -z "$REFERENCE" ]; then
  # scripts → godot-game-dev → std-skills → 仓库根（技能包自 docs/skills 迁入 std-skills 后少了一级）
  REFERENCE="${SCRIPT_DIR}/../../../games/godot-coin-rush"
fi
REFERENCE="$(cd "$REFERENCE" 2>/dev/null && pwd)" || { say_fail "参照工程目录不存在：${RAW_REFERENCE}"; exit 2; }

if [ ! -f "$REFERENCE/tests/smoke.tscn" ]; then
  say_fail "参照工程 $REFERENCE 没有 tests/smoke.tscn，无法作为门禁自检的注入基底"
  exit 2
fi

# Godot 解析同源：不在这里再养一份候选清单（那会是第 4 份实现，PATH 里没 godot 时
# 就各说各话——审查 R1），与 smoke.sh / verify.sh / routine 一样从 resolve-godot.sh 取。
# 语义对齐：resolve-godot.sh 找不到 Godot 时退出码 2 = 本脚本「环境不可用」，
# 安装指引由它打到 stderr。
if ! GODOT_BIN="$(bash "${SCRIPT_DIR}/resolve-godot.sh")" || [ -z "${GODOT_BIN}" ]; then
  say_fail "找不到 Godot 可执行文件（resolve-godot.sh 已给安装指引），或显式 GODOT_BIN=/path/to/Godot 指定"
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  say_fail "找不到 python3（注入用）；macOS / 主流 Linux 均内置"
  exit 2
fi

WORK="$(mktemp -d -t godot-gate-selftest.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

# 建案例目录：复制参照工程（去掉导入缓存，让冒烟自己重新 --import，注入才真实生效）。
prep_case_dir() {
  local dir="${WORK}/${1}"
  cp -R "$REFERENCE" "$dir"
  rm -rf "${dir}/.godot"
  echo "$dir"
}

# 注入缺陷并跑冒烟，返回 0 = 门禁按预期拦下（日志含预期根因 + 退出码 1）。
#   $1 案例名  $2 预期根因子串  $3 注入函数名（在 case_<name> 中定义）
run_case() {
  local name="$1" expect="$2" mutator="$3"
  local dir
  dir="$(prep_case_dir "$name")"

  "case_${mutator}" "$dir" || { say_fail "${name} 注入脚本自身出错（自检脚本 bug，非门禁问题）"; return 1; }

  local log exit_code
  log="$(mktemp -t gate-selftest.XXXXXX)"
  GODOT_BIN="$GODOT_BIN" bash "${SCRIPT_DIR}/smoke.sh" "$dir" >"$log" 2>&1
  exit_code=$?

  if [ "$exit_code" -ne 1 ]; then
    say_fail "${name} 期望退出码 1（冒烟失败），实际 ${exit_code} —— 门禁未拦下该缺陷"
    echo "       ---- 日志摘录 ----"
    grep -E "GODOT_SMOKE|godot-smoke" "$log" | head -5 | sed 's/^/       /'
    rm -f "$log"
    return 1
  fi
  # 用固定子串匹配（-F）：预期根因会带冒烟阶段的「A3 移动：」等前缀，且含正则元字符
  # expect 支持「|」分隔多个候选锚定（仍逐个按 -F 精确匹配，不退化成正则）——
  # 同一事实在不同工程里措辞可能不同：MVP 的 A3 断言从「标量位移」收紧为「x 增量」后，
  # 消息由「位移 0.00px」变成「x 增量 0.00px」，单一锚定让 D5 在门禁完全正常时误报
  # 「失败原因不是预期根因」（实测：gate-selftest 整体退出 1，把可用门禁判成不可放行）。
  local matched=0
  local anchor
  local IFS='|'
  read -ra expect_anchors <<< "$expect"
  unset IFS
  for anchor in "${expect_anchors[@]}"; do
    if grep -qF -- "$anchor" "$log"; then
      matched=1
      expect="$anchor"
      break
    fi
  done
  if ! grep -qF -- "GODOT_SMOKE: FAIL" "$log" || [ "$matched" -ne 1 ]; then
    say_fail "${name} 退出码正确，但失败原因不是预期根因「${expect}」"
    echo "       ---- 实际输出 ----"
    grep -E "GODOT_SMOKE|godot-smoke" "$log" | head -5 | sed 's/^/       /'
    rm -f "$log"
    return 1
  fi
  say_pass "${name} → ${expect}"
  rm -f "$log"
  return 0
}

# 游戏进程层负例（run_project_case 专用）：这类缺陷会让游戏进程在冒烟断言层**之前**
# 就自己退出，而 smoke.sh 的 stdout 只回显断言行、不透传游戏日志（内部临时日志即抛），
# 所以必须直接跑主场景，断言「游戏进程自身以非零退出码收场 + 根因文案可读」。
# 这验证的正是「运行期症状与门禁信号对齐」：push_error 只打 `ERROR:` 前缀、
# 不命中冒烟门禁的 SCRIPT ERROR 扫描，进程退出码才是不会伪装成健康的信号（审查 R-5）。
run_game_case() {
  local name="$1" expect="$2" mutator="$3"
  local dir
  dir="$(prep_case_dir "$name")"

  "case_${mutator}" "$dir" || { say_fail "${name} 注入脚本自身出错（自检脚本 bug，非门禁问题）"; return 1; }

  local log exit_code
  log="$(mktemp -t gate-selftest-game.XXXXXX)"
  "$GODOT_BIN" --headless --path "$dir" --import >>"$log" 2>&1 || true
  "$GODOT_BIN" --headless --path "$dir" --quit-after 120 >>"$log" 2>&1
  exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    say_fail "${name} 游戏进程退出码 0 —— 带病可跑：生成失败被静默吞掉，运行期症状与门禁信号不对齐"
    echo "       ---- 日志摘录 ----"
    grep -E "ERROR|SCRIPT" "$log" | head -5 | sed 's/^/       /'
    rm -f "$log"
    return 1
  fi
  if ! grep -qF -- "${expect}" "$log"; then
    say_fail "${name} 游戏进程退出码 ${exit_code}，但日志缺少根因「${expect}」"
    echo "       ---- 日志摘录 ----"
    grep -E "ERROR|SCRIPT" "$log" | head -5 | sed 's/^/       /'
    rm -f "$log"
    return 1
  fi
  say_pass "${name} → 游戏进程退出码 ${exit_code} + 根因「${expect}」"
  rm -f "$log"
  return 0
}

# 工程层负例（D6/D7）：锚点在参照工程自身的 scenes/coin.tscn 上。
# 锚点缺失 → 该注入对当前参照工程不适用，SKIP 并放行（不算失败），
# 保证本脚本对「模板派生的任何工程」仍可用（与 D1-D5 的通用性承诺不冲突）。
run_project_case() {
  local name="$1" expect="$2" mutator="$3" runner="$4" anchor_file="$5" anchor="$6"
  if [ ! -f "$REFERENCE/${anchor_file}" ] || ! grep -qF -- "${anchor}" "$REFERENCE/${anchor_file}"; then
    say_pass "${name} → SKIP（参照工程无 ${anchor_file} 或缺锚点，本注入不适用）"
    return 0
  fi
  "$runner" "$name" "$expect" "$mutator"
}

# ---- 注入器：每个只改一处，且保证改完 GDScript/.tscn 仍合法（不让缺陷退化成解析错误）----

# D1 场景实例化断裂：从 main.tscn 摘掉 Player 实例（接线断裂的最小充分形态）。
#    不用「改 smoke.tscn 里主场景节点名」的注入法 —— 有的冒烟场景按 Main 查、
#    有的直接按 Player 查（模板与 MVP 就不一致），改名只对前者生效。
#    摘掉 Player 则对两种写法都成立：实例化真的断了，玩家必然找不到。
case_main_scene() {
  python3 - "$1" <<'PY'
import sys
p = sys.argv[1] + '/scenes/main.tscn'
lines = open(p).read().split('\n')
start = [i for i, l in enumerate(lines) if l.startswith('[node name="Player"')]
assert start, 'main.tscn 缺少 Player 实例节点（模板契约被改）'
i = start[0]
j = i + 1
while j < len(lines) and not lines[j].startswith('['):
    j += 1
del lines[i:j]
open(p, 'w').write('\n'.join(lines))
PY
}

# D2 autoload 断裂：注册名不变、脚本指向不存在的文件，
#    autoload 节点不会进树，命中 get_node_or_null("GameState") 断言。
case_autoload() {
  python3 - "$1" <<'PY'
import sys
p = sys.argv[1] + '/project.godot'
s = open(p).read()
anchor = 'GameState="*res://autoload/game_state.gd"'
assert anchor in s, 'project.godot 缺少 GameState autoload（模板契约被改）'
open(p, 'w').write(s.replace(
    anchor, 'GameState="*res://autoload/game_state_MISSING.gd"', 1))
PY
}

# D3 InputMap 注入失效：删掉 move_right 动作注册，命中 InputMap.has_action 断言。
case_inputmap() {
  python3 - "$1" <<'PY'
import re, sys
p = sys.argv[1] + '/project.godot'
s = open(p).read()
new, n = re.subn(r'move_right=\{[^}]*\}\n', '', s, count=1)
assert n == 1, 'project.godot 缺少 move_right 动作（模板契约被改）'
open(p, 'w').write(new)
PY
}

# D4 信号到达断裂：GDScript 仍合法解析、引擎零报错，但 Player.moved 不再 emit，
#    命中「信号未到达订阅方」断言。
case_signal() {
  python3 - "$1" <<'PY'
import sys
p = sys.argv[1] + '/scripts/player.gd'
s = open(p).read()
anchor = 'moved.emit(global_position)'
assert anchor in s, 'player.gd 缺少 moved.emit（模板契约被改）'
open(p, 'w').write(s.replace(
    anchor, 'pass  # moved.emit(global_position) —— gate-selftest 注入：不再发出信号', 1))
PY
}

# D5 静默逻辑 bug：SPEED=0，零报错、能启动、玩家按住方向键也一动不动，
#    命中位移阈值断言（这是退出码/日志都扫不出来、只能靠行为断言拦截的一类）。
case_silent_logic() {
  python3 - "$1" <<'PY'
import re, sys
p = sys.argv[1] + '/scripts/player.gd'
s = open(p).read()
new, n = re.subn(r'const SPEED: float = [0-9.]+', 'const SPEED: float = 0.0', s, count=1)
assert n == 1, 'player.gd 缺少 const SPEED（模板契约被改）'
open(p, 'w').write(new)
PY
}

# D6 视觉↔判定漂移（审查 R-4 的判别力负例）：六边形顶点整体缩到外接圆半径 7，
#    .tscn 仍合法、碰撞圆与常量都不动 —— 引擎零报错、玩法照常，
#    只有「视觉多边形 ↔ 碰撞形状」这条机判契约拦得住（_check_visual_contract：
#    判定可比视觉宽、但宽不得超过 VISUAL_FORGIVENESS_MAX —— 视觉 7 vs 判定 12 已超豁免）。
case_visual_drift() {
  python3 - "$1" <<'PY'
import re, sys
p = sys.argv[1] + '/scenes/coin.tscn'
s = open(p).read()
new, n = re.subn(
    r'polygon = PackedVector2Array\([^)]*\)',
    'polygon = PackedVector2Array(7, 0, 3.5, -6.0622, -3.5, -6.0622, -7, 0, -3.5, 6.0622, 3.5, 6.0622)',
    s, count=1)
assert n == 1, 'coin.tscn 缺少 polygon 行（参照工程契约被改）'
open(p, 'w').write(new)
PY
}

# D7 实例化静默减员（审查 R-5 的判别力负例）：摘掉 coin.tscn 根节点的 script 绑定，
#    instantiate() 返回普通 Area2D、`as Coin` 得 null —— 资源路径仍有效、无解析错误。
#    门禁必须以「进程非零退出 + 根因可读」收场（Main 的生成守卫在 headless 下 quit(1)），
#    而不是 push_error 后 continue 留一个「能跑但永远赢不了」的半局。
#    该缺陷走不到冒烟断言层（游戏进程在 smoke 打印标记前就退出了），
#    所以改断 smoke.sh 自己的 FAIL 行 + push_error 的根因文案。
case_coin_spawn_failure() {
  python3 - "$1" <<'PY'
import sys
p = sys.argv[1] + '/scenes/coin.tscn'
lines = open(p).read().split('\n')
idx = [i for i, l in enumerate(lines) if l.startswith('script = ExtResource')]
assert idx, 'coin.tscn 缺少 script 绑定行（参照工程契约被改）'
del lines[idx[0]]
open(p, 'w').write('\n'.join(lines))
PY
}

# D8 一触双收币位（第十五轮 T-9/R15-1 的判别力负例）：把 coins[4] 的 x 440 → 280，
#    与 coins[3] (240,270) 的圆心距变成 40px —— 大于旧阈值 2 × PICKUP_RADIUS(24px)
#    （视觉六边形不粘连），小于一触双收几何上界 2 × (PLAYER_HALF_DIAGONAL + PICKUP_RADIUS)
#    （≈57.94px；45° 斜向币对时玩家单侧余量最大 = 半对角线 + 判定半径，玩家站到两点中点
#    两枚币判定圆同时重叠，一次接触吃两币、画面一币加 2 分）。
#    布币契约必须拦下：旧门禁对这类变异全绿放行（修前基线探针实测 EXIT=0），
#    正是「失败信息承诺的比阈值兑现的多」那一半盲区。
case_one_touch_double_collect() {
  python3 - "$1" <<'PY'
import sys, re
p = sys.argv[1] + '/scripts/main.gd'
s = open(p).read()
new, n = re.subn(r'\tVector2\(440\.0, 270\.0\),', '\tVector2(280.0, 270.0),', s, count=1)
assert n == 1, 'main.gd 缺少币位 (440, 270)（参照工程契约被改）'
open(p, 'w').write(new)
PY
}

echo "gate-selftest: 参照工程 = ${REFERENCE}"
echo "gate-selftest: Godot    = $("$GODOT_BIN" --version 2>/dev/null | head -1)"
echo "gate-selftest: 对参照工程注入 8 类必然缺陷（D1-D5 模板层 + D6-D8 参照工程层），逐一验证门禁必须拦下且原因可读"
echo ""

FAILED=0
run_case "D1 场景实例化断裂"      "找不到 Player"                            main_scene    || FAILED=1
run_case "D2 autoload 未注册"     "autoload GameState 未注册"                autoload      || FAILED=1
run_case "D3 InputMap 缺动作"     "InputMap 缺少动作 move_right"             inputmap      || FAILED=1
run_case "D4 信号未到达订阅方"    "信号 Player.moved 未到达订阅方"           signal        || FAILED=1
# 「玩家没动」这个事实在不同工程里措辞不同：模板断言标量位移（「位移 0.00px」），
# MVP 的 A3 按 GOAL.md 收紧为「x 增量 ≥ 100px」（「增量 0.00px」）——
# 两个候选都锚定「0.00px」零位移事实，措辞漂移不再把正常门禁误判成不可放行。
run_case "D5 静默逻辑 bug(SPEED=0)" "位移 0.00px|增量 0.00px"               silent_logic  || FAILED=1
# 工程层负例（D6/D7，审查 R-4/R-5 判别力）：锚点缺失时自动 SKIP（见 run_project_case）；
# runner 决定在门禁的哪一层断言（D6 走冒烟断言层 run_case，D7 走游戏进程层 run_game_case）。
# D6 锚点用交替候选：视觉契约断言的实现文案有两个变体——
# 「视觉↔判定不一致」（外接圆 ↔ 命名常量逐值比对）与「视觉/判定脱节」
# （_check_visual_gap 按「判定可比视觉宽、上限 VISUAL_FORGIVENESS_MAX」判超限），
# 半径漂移注入走哪条实现都必须拦下，两个候选都锚定同一条「视觉/判定脱节」事实。
run_project_case "D6 视觉↔判定漂移" "视觉↔判定不一致|视觉/判定脱节"          visual_drift      run_case \
  scenes/coin.tscn "polygon = PackedVector2Array" || FAILED=1
run_project_case "D7 实例化静默减员" "金币场景实例化失败"                     coin_spawn_failure run_game_case \
  scenes/coin.tscn "script = ExtResource" || FAILED=1
# D8 锚定「一触双收」缺陷注入点：币位 (440, 270)（与 coins[3] 相距 200px）平移到 (280, 270)
# 后与 coins[3] 间距 40px。走冒烟断言层（游戏仍可跑完、只是手感被破坏），由布币契约拦截。
run_project_case "D8 一触双收币位"   "币位契约"                               one_touch_double_collect run_case \
  scripts/main.gd "Vector2(440.0, 270.0)" || FAILED=1

echo ""
if [ "$FAILED" -ne 0 ]; then
  say_fail "门禁自检未通过：有缺陷类别漏网，godot-smoke 门禁当前不可作为放行依据"
  exit 1
fi
say_pass "必然缺陷全部被拦（SKIP 的注入不适用于当前参照工程）、失败原因均可读 —— godot-smoke 门禁断言有效（非空转）"
exit 0
