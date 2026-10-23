#!/usr/bin/env bash
# verify.sh —— line3-tower-defense 工程门禁入口（平台门禁/人工/agent 统一复跑口）
#
# 口径：薄壳调度——检查逻辑零复制，全部转发到仓内单一实现，exit code 全透传（wheat-squad 判例）：
#   ① 统一契约门禁（approved spec 对账，仓根口径）
#   ② 自有契约套件（tests/contract/run-all.mjs：14 auto 逐件对账实跑 + a3 真人面单列 PEND）
#   ③ L3-SMOKE headless 全链路（打开→开始→放置→加速→结算→重开 + 构建锚 + 零 console 错误）
#   ④ SCOPE-GUARD 源面纪律（确定性违例扫描：Math.random/Date.now/位图构造，src+tools）
# 任何一步失败 ⇒ 整体非零退出（fail-closed，不吞错不降级）。
# 环境变量：L3_VERIFY_SKIP_SMOKE=1 可跳过冒烟（仅限无显示环境快速核对；门禁口径默认不跳）。
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GAME="games/line3-tower-defense"
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
  node scripts/contract-check.mjs --spec .myrd/spec/line3-tower-defense/design-spec.json --project "$GAME"

step "② 自有契约套件（14 auto + a3 PEND）" \
  node "$GAME/tests/contract/run-all.mjs"

step "⓪ 构建面（确定性产物，冒烟前置）" \
  node "$GAME/tools/build.mjs"

step "⓪+B 部署壳契约（landing.html 缺失即回落 game-9 内置壳，W-3/B-5 收口）" \
  node "$GAME/ci/guard-landing-shell.mjs"

if [ "${L3_VERIFY_SKIP_SMOKE:-0}" = "1" ]; then
  echo "== [verify.sh] ③ L3-SMOKE :: SKIP（L3_VERIFY_SKIP_SMOKE=1，非门禁口径）=="
else
  step "③ L3-SMOKE headless 全链路" \
    node "$GAME/tools/smoke.mjs"
fi

step "④ SCOPE-GUARD 源面纪律扫描（src+tools）" \
  node "$GAME/ci/guard-source-scope.mjs"

if [ "$FAIL" -ne 0 ]; then
  echo "VERIFY: FAIL line3-tower-defense 门禁存在失败步（见上逐条）"
  exit 1
fi
echo "VERIFY: PASS line3-tower-defense 契约/冒烟/扫描全绿（exit 0）"
