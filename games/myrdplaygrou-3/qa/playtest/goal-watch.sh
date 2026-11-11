#!/usr/bin/env bash
# goal-watch.sh — 实局进球抓拍：轮询 HUD 比分，变化即连拍（网面/横幅证据）。
# 用法：bash goal-watch.sh <session-file> <最大轮询次数> <输出标签>
set -euo pipefail
SESSION="${1:?session-file}"; MAX="${2:-40}"; TAG="${3:-watch}"
STEP="/Users/leo/.myrd/workspaces/cmvqriupu0007m9qphvokoci9/run-cmwbl6h6e008am97aetlijmmv/.myrd-platform/.claude/skills/experience-harness/scripts/session-step.mjs"
parse() { python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('probeResult',''))
"; }
prev=""
for i in $(seq 1 "$MAX"); do
  cur=$(node "$STEP" --session "$SESSION" --probe 'JSON.stringify({h:document.getElementById("home-score")?.textContent,a:document.getElementById("away-score")?.textContent,t:document.getElementById("time")?.textContent})' | parse)
  echo "[$i] $cur"
  ha=$(echo "$cur" | python3 -c "
import json,sys
raw=sys.stdin.read().strip()
try:
    d=json.loads(raw); print(d.get('h','?'),d.get('a','?'))
except Exception:
    print('?')
")
  if [ -n "$prev" ] && [ "$ha" != "$prev" ] && [ "$ha" != "?" ]; then
    echo "GOAL DETECTED: $prev -> $ha"
    node "$STEP" --session "$SESSION" --screenshot | grep -o '"screenshot": "[^"]*"' | head -1
    node "$STEP" --session "$SESSION" --wait 400 >/dev/null
    node "$STEP" --session "$SESSION" --screenshot | grep -o '"screenshot": "[^"]*"' | head -1
  fi
  prev="$ha"
  sleep 1.2
done
echo "GOAL-WATCH DONE ($TAG)"
