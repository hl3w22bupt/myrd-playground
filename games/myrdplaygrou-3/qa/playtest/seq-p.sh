#!/usr/bin/env bash
# seq-p.sh — 打磨轮（polish 周期 v3→v15）固定动作序列（mobile 视口 390×844，跨轮同一序列保证截图/快照可比）
# 用法：SEQ=<标签> bash qa/playtest/seq-p.sh <session-file>
# 序列（18 步）：教学卡在场截图 → 开始比赛 → 摇杆连续上推×6（向对方球门 -Z 推进）→
#               中途快照 → 传球 → 继续上推×3 → 蓄力射门 → 终态截图 → 内核探针（比分/球位/受控）
# 坐标口径：开始按钮 CSS(121,568)；摇杆锚(95,650)；传球钮(348,726)；射门钮(348,800)——与 SEQ-M/round-11 同源。
set -euo pipefail
SESSION="${1:?usage: seq-p.sh <session-file>}"
STEP="$(git rev-parse --show-toplevel 2>/dev/null || echo /Users/leo/.myrd/workspaces/cmvqriupu0007m9qphvokoci9/run-cmwbusk2s0019m9bbvj1h07sq)/.myrd-platform/.claude/skills/experience-harness/scripts/session-step.mjs"
run() { echo "--- $* ---"; node "$STEP" --session "$SESSION" "$@"; }

run --screenshot                                  # 00 title（教学卡）
run --tap 121,568                                 # 01 开始比赛
run --wait 1200
run --swipe 95,650:95,470                         # 02 摇杆上推 1
run --wait 400
run --swipe 95,650:95,470                         # 03 摇杆上推 2
run --wait 400
run --swipe 95,650:95,470                         # 04 摇杆上推 3
run --wait 400
run --swipe 95,650:95,470                         # 05 摇杆上推 4
run --wait 400
run --swipe 95,650:95,470                         # 06 摇杆上推 5
run --wait 400
run --swipe 95,650:95,470                         # 07 摇杆上推 6
run --wait 600
run --screenshot                                  # 08 推进后快照
run --probe 'JSON.stringify({ball:window.__tsState().ball,c:window.__tsState().controlled,t:window.__tsState().timeLeft})'  # 09 球位探针
run --tap 348,726                                 # 10 传球
run --wait 600
run --swipe 95,650:95,470                         # 11 摇杆上推 7
run --wait 400
run --swipe 95,650:95,470                         # 12 摇杆上推 8
run --wait 400
run --swipe 95,650:95,470                         # 13 摇杆上推 9
run --wait 400
run --tap 348,800                                 # 14 射门
run --wait 900
run --screenshot                                  # 15 射门后终态
run --probe 'JSON.stringify(window.__tsState())'  # 16 内核全量探针
echo "SEQ-P DONE"
