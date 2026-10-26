#!/usr/bin/env bash
# verify.sh —— line4-unblock-jam 工程门禁入口（平台门禁/人工/agent 统一复跑口）
#
# 口径：薄壳调度——检查逻辑零复制，全部转发到仓内单一实现，exit code 全透传（wheat-squad 判例同型）：
#   ① 统一契约门禁（approved spec 对账，仓根口径；draft 态 fail-closed exit 1 = 红线预期行为）
#   ② 自有契约套件（8 条 acceptance auto check + ac-template，逐件透传 exit）
#   ③ SCAFFOLD-SMOKE headless 冒烟（内核确定性 / 计数控名人+pending 恒等 / telemetry 单一出口 / 构建指纹）
#   ④ PORT-GATE 移植门禁（web 口径；wx 口径经 WX=1 触发，P-06-wx 预检提示非阻塞）
# 任何一步失败 ⇒ 整体非零退出（fail-closed，不吞错不降级）。
# 证据落盘：设 GATE_LOG_DIR=<dir> 时，每步输出 tee 进 <dir>/NN-<步名>.log 并写 manifest（命令原文+时刻+exit）。
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GAME="games/line4-unblock-jam"
cd "$ROOT"

EV="${GATE_LOG_DIR:-}"
if [ -n "$EV" ]; then mkdir -p "$EV"; : > "$EV/manifest.txt"; fi

FAIL=0
step() { # step <编号-名称> <命令...>
  local name="$1"; shift
  echo "== [verify.sh] $name =="
  local rc=0
  if [ -n "$EV" ]; then
    { echo "== 命令原文：$*"; echo "== 时刻：$(date '+%F %T')"; echo "== 输出："; } > "$EV/$name.log"
    "$@" >> "$EV/$name.log" 2>&1 || rc=$?
    echo "== exit=$rc ==" >> "$EV/$name.log"
    { echo "$name | $* | $(date '+%F %T') | exit=$rc"; } >> "$EV/manifest.txt"
  else
    "$@" || rc=$?
  fi
  if [ "$rc" -eq 0 ]; then echo "== [verify.sh] $name :: PASS =="
  else echo "== [verify.sh] $name :: FAIL（exit=$rc）=="; FAIL=1; fi
  echo ""
}

step "01-contract-unified" \
  node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project "$GAME"

for f in "$GAME"/tests/contract/checks/*.mjs "$GAME"/tests/contract/ac-template.spec.mjs; do
  step "02-check-$(basename "$f" .mjs)" node "$f"
done

step "03-scaffold-smoke" node "$GAME/tools/smoke.mjs"

step "04-port-gate-web" node "$GAME/tools/port-gate-checklist.mjs" --target web
if [ "${WX:-0}" = "1" ]; then
  step "05-port-gate-wx" node "$GAME/tools/port-gate-checklist.mjs" --target wx
fi

# —— 2026-10-26 可玩基线轮新增（审查通过版落地 · 部署面前置）：——
step "06-assets-gate" node "$GAME/tools/check-assets.mjs"
step "07-build" node "$GAME/tools/build.mjs"
step "08-guard-landing-shell" node "$GAME/ci/guard-landing-shell.mjs"
step "09-playable-smoke" node "$GAME/tools/smoke-playable.mjs"

if [ "$FAIL" -ne 0 ]; then
  echo "VERIFY: FAIL line4-unblock-jam 门禁存在失败步（见上逐条）"
  exit 1
fi
echo "VERIFY: PASS line4-unblock-jam 契约/套件/冒烟/移植门禁全绿（exit 0）"
