#!/usr/bin/env bash
# repo-preflight —— 直通车（express lane）开发前置检查：仓库可达 + godot 门禁脚本齐备可用。
#
# 为什么需要它：开发节点开工前，「仓库拉不到」「门禁脚本缺失/不可用」属于必然返工的
# 阻塞项 —— 与 preflight.py 拦「工程起不来」同理，这里拦「工具链起不来」。
# 原则一致：能在运行前拦下的，绝不留到运行后；缺失即 blocked（fail-closed）。
#
# 用法：
#   bash std-skills/godot-game-dev/scripts/repo-preflight.sh [--full]
#
#   默认快检（秒级）：A1 git 可达 / A2 脚本齐备 / A3 docs 镜像一致 / A4 工具链 /
#   A5 preflight 自测有效性。
#   --full 追加运行期验证（约 2-3 分钟）：对 templates/minimal-2d 跑 smoke.sh +
#   gate-selftest.sh（注入缺陷验证门禁不空转）+ mobile_smoke_selftest.mjs。
#
# 判定协议：REPO-PREFLIGHT: OK / BLOCKED <原因>（逐项打印），末行汇总。
# 退出码：0 = 全部通过（可进入开发节点）；1 = 有阻塞项（blocked，禁止放行）。
#
# 供 .myrd/routines.yaml 或工作流 preHook 调用；全部检查从仓库根以
# std-skills/godot-game-dev/scripts/… 路径口径执行（与 routines 同源）。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
GATE_DIR="${SCRIPT_DIR}"
MIRROR_DIR="${REPO_ROOT}/docs/skills/godot-game-dev/scripts"
TEMPLATE_DIR="${REPO_ROOT}/std-skills/godot-game-dev/templates/minimal-2d"

FULL=0
[ "${1:-}" = "--full" ] && FULL=1

FAILS=0
ok()      { echo "REPO-PREFLIGHT: OK      $*"; }
blocked() { echo "REPO-PREFLIGHT: BLOCKED $*"; FAILS=$((FAILS + 1)); }

run_with_timeout() {
  # 非交互 + 可用则带超时，避免凭据提示/网络挂起把预检本身挂死（反卡死纪律）
  if command -v timeout >/dev/null 2>&1; then
    timeout "$1" "${@:2}"
  else
    "${@:2}"
  fi
}

echo "REPO-PREFLIGHT: 仓库根 = ${REPO_ROOT}"
echo "REPO-PREFLIGHT: 模式   = $([ "$FULL" -eq 1 ] && echo full || echo quick)"

# ---- A1 仓库可达（origin 已配置且远端可访问，全程非交互 + 3 次退避重试）----
# github.com 的 git 传输端点在部分网络下间歇性不可达（DNS/api 正常但 443 TCP 超时），
# 属瞬时阻塞：重试 3 次（5s/15s 退避）仍不通才判 blocked，并给出重试口径。
export GIT_TERMINAL_PROMPT=0
if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  blocked "A1 当前目录不是 git 工作区"
elif ! git -C "$REPO_ROOT" remote get-url origin >/dev/null 2>&1; then
  blocked "A1 未配置 origin 远端（git remote add origin <url>）"
else
  A1_OK=0
  for attempt in 1 2 3; do
    if run_with_timeout 45 git -C "$REPO_ROOT" ls-remote --heads origin >/dev/null 2>&1; then
      A1_OK=1
      break
    fi
    [ "$attempt" -lt 3 ] && sleep $((attempt * 5))
  done
  if [ "$A1_OK" -eq 1 ]; then
    ok "A1 origin 可达：$(git -C "$REPO_ROOT" remote get-url origin)"
  else
    blocked "A1 origin 远端不可达（git ls-remote --heads origin 3 次重试均超时）——" \
      "DNS 可能正常而 443 传输被间歇阻断，属瞬时阻塞：稍后重跑本预检，或改用代理网络"
  fi
fi

# ---- A2 门禁脚本齐备（清单即 routines.yaml 的全部调用面）----
REQUIRED_SCRIPTS=(
  preflight.py preflight_selftest.py
  smoke.sh resolve-godot.sh gate-selftest.sh input-fuzz.sh input_fuzz_driver.gd
  mobile-web-smoke.mjs mobile_smoke_selftest.mjs
)
MISSING=()
NOT_EXEC=()
for f in "${REQUIRED_SCRIPTS[@]}"; do
  [ -f "${GATE_DIR}/${f}" ] || MISSING+=("$f")
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  blocked "A2 门禁脚本缺失：${MISSING[*]}（权威原件目录 std-skills/godot-game-dev/scripts/）"
else
  for f in "${REQUIRED_SCRIPTS[@]}"; do
    case "$f" in
      *.sh|*.py) [ -x "${GATE_DIR}/${f}" ] || NOT_EXEC+=("$f") ;;
    esac
  done
  if [ "${#NOT_EXEC[@]}" -gt 0 ]; then
    blocked "A2 脚本缺可执行位：${NOT_EXEC[*]}（chmod +x std-skills/godot-game-dev/scripts/<file>）"
  else
    ok "A2 门禁脚本齐备且可执行：${#REQUIRED_SCRIPTS[@]} 个全部在位"
  fi
fi

# ---- A3 docs 只读镜像逐字节一致（docs/skills README 的同步契约）----
MIRROR_SCRIPTS=(preflight.py smoke.sh resolve-godot.sh)
if [ ! -d "$MIRROR_DIR" ]; then
  blocked "A3 docs 镜像目录缺失：docs/skills/godot-game-dev/scripts/"
else
  DIFFED=()
  for f in "${MIRROR_SCRIPTS[@]}"; do
    if [ ! -f "${MIRROR_DIR}/${f}" ]; then
      DIFFED+=("${f}(镜像缺文件)")
    elif ! diff -q "${GATE_DIR}/${f}" "${MIRROR_DIR}/${f}" >/dev/null 2>&1; then
      DIFFED+=("${f}(内容漂移)")
    fi
  done
  if [ "${#DIFFED[@]}" -gt 0 ]; then
    blocked "A3 docs 镜像与原件不一致：${DIFFED[*]} —— cp -p std-skills/godot-game-dev/scripts/<file> docs/skills/godot-game-dev/scripts/"
  else
    ok "A3 docs 镜像逐字节一致：${MIRROR_SCRIPTS[*]}"
  fi
fi

# ---- A4 工具链：python3(3.8+) / node / Godot（经 resolve-godot.sh 同源解析）----
PY_OK=0
if command -v python3 >/dev/null 2>&1; then
  PY_VER="$(python3 -c 'import sys;print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo 0)"
  PY_MAJOR="${PY_VER%%.*}"; PY_MINOR="${PY_VER#*.}"
  if [ "${PY_MAJOR:-0}" -ge 3 ] && [ "${PY_MINOR:-0}" -ge 8 ]; then
    PY_OK=1
  fi
fi
[ "$PY_OK" -eq 1 ] && ok "A4 python3 ${PY_VER}（preflight/selftest 需要 3.8+）" \
  || blocked "A4 python3 缺失或版本低于 3.8"

if command -v node >/dev/null 2>&1; then
  ok "A4 node $(node --version)（mobile-web-smoke 契约门禁需要）"
else
  blocked "A4 node 缺失（mobile-web-smoke.mjs / 契约测试无法运行）"
fi

if GODOT_RESOLVED="$(bash "${GATE_DIR}/resolve-godot.sh" 2>/dev/null)" && [ -n "${GODOT_RESOLVED}" ]; then
  ok "A4 Godot 可用：$("$GODOT_RESOLVED" --version 2>/dev/null | head -1)（${GODOT_RESOLVED}）"
else
  blocked "A4 找不到 Godot 可执行文件（resolve-godot.sh 退出 2）—— 无头冒烟/门禁自检均无法运行"
fi

# ---- A5 门禁自测有效性：证明 preflight.py「该拦的拦、不该拦的不误报」----
if SELFTEST_LOG="$(cd "${GATE_DIR}" && python3 preflight_selftest.py 2>&1)"; then
  ok "A5 preflight 自测：$(echo "$SELFTEST_LOG" | tail -1)"
else
  blocked "A5 preflight 自测失败（验证器自身缺陷，门禁不可信）：$(echo "$SELFTEST_LOG" | tail -3 | tr '\n' ' ')"
fi

# ---- A6（--full）运行期验证：门禁真的跑得通、真的拦得住 ----
if [ "$FULL" -eq 1 ]; then
  if SMOKE_LOG="$(bash "${GATE_DIR}/smoke.sh" "${TEMPLATE_DIR}" 2>&1)"; then
    ok "A6 smoke 门禁（模板工程）：$(echo "$SMOKE_LOG" | grep -o 'godot-smoke: PASS[^，。]*' | head -1)"
  else
    blocked "A6 smoke 门禁失败：$(echo "$SMOKE_LOG" | tail -2 | tr '\n' ' ')"
  fi

  if GATE_LOG="$(bash "${GATE_DIR}/gate-selftest.sh" "${TEMPLATE_DIR}" 2>&1)"; then
    ok "A6 gate-selftest（注入缺陷全被拦）：$(echo "$GATE_LOG" | grep -c 'gate-selftest: PASS') 项 PASS"
  else
    blocked "A6 gate-selftest 失败（门禁空转/误放行）：$(echo "$GATE_LOG" | tail -2 | tr '\n' ' ')"
  fi

  if MOBILE_LOG="$(cd "${GATE_DIR}" && node mobile_smoke_selftest.mjs 2>&1)"; then
    ok "A6 mobile-web-smoke 自测：$(echo "$MOBILE_LOG" | tail -1)"
  else
    blocked "A6 mobile-web-smoke 自测失败：$(echo "$MOBILE_LOG" | tail -2 | tr '\n' ' ')"
  fi
fi

echo "----"
if [ "$FAILS" -gt 0 ]; then
  echo "REPO-PREFLIGHT: FAIL ${FAILS} 项阻塞 —— blocked，禁止进入开发节点"
  exit 1
fi
echo "REPO-PREFLIGHT: PASS 仓库可达、godot 门禁脚本齐备且可用 —— 可进入开发节点"
exit 0
