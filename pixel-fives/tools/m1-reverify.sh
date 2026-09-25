#!/usr/bin/env bash
# M1 复验三件套一键入口（足球线 pixel-fives · 2026-09-22 游戏程序批次）。
#
# 用法（仓库根执行，可整段粘贴复现）：
#   bash pixel-fives/tools/m1-reverify.sh [归档目录后缀]
#
# 三件套：
#   ① 契约测试      node pixel-fives/tools/contract-check.mjs（acc-07，读 .myrd/spec/design-spec-pixel-fives.json）
#   ② 全链路冒烟    node pixel-fives/tests/smoke/full-match.test.mjs（acc-01：开球→90s 局末→终局比分）
#                   node pixel-fives/tests/smoke/fulltime-restart.test.mjs（局末→结算→重开全链路，本批次新增）
#   ③ bot-sim 门禁  node pixel-fives/tools/bot-sim.mjs --seeds 42..141 --json（acc-03/04：固定种子 100 场，
#                   完整 JSON 报告含 per_game[] 逐场比分归档 + 可读逐场比分清单）
#
# 日志归档：.myrd/blackboard/gate-logs/<目录>/（每件一份原文 + 00-summary.txt）。
# 退出码：任一件 FAIL → exit 1（全绿 → exit 0）。
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
SUFFIX="${1:-prog}"
OUT="$ROOT/.myrd/blackboard/gate-logs/m1-reverify-$STAMP-$SUFFIX"
mkdir -p "$OUT"

declare -a NAMES=() CODES=()
run() { # run <日志名> <命令...>
  local name="$1"; shift
  NAMES+=("$name")
  echo "\$ $*" > "$OUT/$name.cmd"
  "$@" > "$OUT/$name.log" 2> "$OUT/$name.stderr.log"
  local code=$?
  CODES+=("$code")
  printf '[%s] exit=%s  %s\n' "$name" "$code" "$*"
  return $code
}

echo "== M1 复验三件套（足球线 pixel-fives）@ $STAMP =="
run 1-contract-check   node pixel-fives/tools/contract-check.mjs
run 2-full-match-smoke node pixel-fives/tests/smoke/full-match.test.mjs
run 3-fulltime-restart node pixel-fives/tests/smoke/fulltime-restart.test.mjs
run 4-bot-sim-100      node pixel-fives/tools/bot-sim.mjs --seeds 42..141 --json

# 逐场比分可读清单（从 4-bot-sim-100 的 JSON 报告提取 per_game[]）
node -e '
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const lines = r.per_game.map((g) =>
  `seed=${g.seed}  ${g.goals_red}:${g.goals_blue}  total=${g.goals_total}  dur=${g.duration_s}s  shots=${g.shots}  errors=${g.errors.length}`);
fs.writeFileSync(process.argv[2], lines.join("\n") + "\n");
fs.appendFileSync(process.argv[2], `\nsummary: goal_range_ratio=${r.summary.goal_range_ratio} duration_in_range_ratio=${r.summary.duration_in_range_ratio} games_with_errors=${r.summary.games_with_errors}\n`);
' "$OUT/4-bot-sim-100.log" "$OUT/4-bot-sim-100-scoreboard.txt"

# 汇总
{
  echo "M1 复验三件套 @ ${STAMP}（足球线 pixel-fives）"
  echo "复现命令：bash pixel-fives/tools/m1-reverify.sh"
  echo ""
  for i in "${!NAMES[@]}"; do
    printf '%-24s exit=%s\n' "${NAMES[$i]}" "${CODES[$i]}"
  done
  echo ""
  echo "判定：$([ "$(printf '%s' "${CODES[@]}" | tr -d '0')" = "" ] && echo ALL-GREEN || echo HAS-FAILURE)"
  echo "归档目录：$OUT"
} > "$OUT/00-summary.txt"
cat "$OUT/00-summary.txt"

for c in "${CODES[@]}"; do [ "$c" -ne 0 ] && exit 1; done
exit 0
