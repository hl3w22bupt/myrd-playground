#!/usr/bin/env bash
# verify.sh —— wheat-squad 工程门禁入口（平台门禁/人工/agent 统一复跑口）
#
# 口径：本文件是「薄壳调度」——检查逻辑零复制，全部转发到仓内单一实现，exit code 全透传：
#   ① 统一契约门禁（approved spec 对账，仓根口径）
#   ② 自有契约套件（tests/contract/run-all.mjs）
#   ③ WS-SMOKE headless 全链路（打开→首次核心操作→单局结束→重开 + A1/A4 埋点 + 零 console 错误）
#   ④ SCOPE-GUARD 违规标识符扫描（双模式：本仓零越界 + 父仓足迹白名单）
# 任何一步失败 ⇒ 整体非零退出（fail-closed，不吞错不降级）。
# 环境变量：WS_VERIFY_SKIP_SMOKE=1 可跳过冒烟（仅限无显示环境快速核对；门禁口径默认不跳）。
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GAME="games/wheat-squad"
cd "$ROOT"

FAIL=0
step() { # step <名称> <命令...>
  local name="$1"; shift
  echo "== [verify.sh] $name =="
  if "$@"; then echo "== [verify.sh] $name :: PASS =="
  else echo "== [verify.sh] $name :: FAIL（exit=$?）=="; FAIL=1; fi
  echo ""
}

step "① 统一契约门禁（approved spec 对账）" \
  node scripts/contract-check.mjs --spec .myrd/spec/wheat-squad/design-spec.json --project "$GAME"

step "② 自有契约套件" \
  node "$GAME/tests/contract/run-all.mjs"

if [ "${WS_VERIFY_SKIP_SMOKE:-0}" = "1" ]; then
  echo "== [verify.sh] ③ WS-SMOKE :: SKIP（WS_VERIFY_SKIP_SMOKE=1，非门禁口径）=="
else
  step "③ WS-SMOKE headless 全链路" \
    node "$GAME/tools/smoke.mjs"
fi

step "④ SCOPE-GUARD 违规标识符扫描（本仓）" \
  node "$GAME/ci/guard-repo-scope.mjs"

step "⑤ SCOPE-GUARD 父仓足迹自检" \
  node "$GAME/ci/guard-repo-scope.mjs" --self-check "$ROOT"

if [ "$FAIL" -ne 0 ]; then
  echo "VERIFY: FAIL wheat-squad 门禁存在失败步（见上逐条）"
  exit 1
fi
echo "VERIFY: PASS wheat-squad 契约/冒烟/扫描全绿（exit 0）"
