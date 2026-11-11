#!/usr/bin/env bash
# seq-m.sh — 打磨轮固定动作序列（mobile 视口 390×844，跨轮同一序列保证截图/快照可比）
# 用法：SEQ=<标签> bash qa/playtest/seq-m.sh <session-file>
# 序列（12 步）：title 截图 → 右半屏点按开球 → 摇杆上左 → 截图 → ←键 → ↑键 →
#               摇杆右推 → 传球 → 射门 → 终态截图 → HUD 探针
set -euo pipefail
SESSION="${1:?usage: seq-m.sh <session-file>}"
STEP="/Users/leo/.myrd/workspaces/cmvqriupu0007m9qphvokoci9/run-cmwbl6h6e008am97aetlijmmv/.myrd-platform/.claude/skills/experience-harness/scripts/session-step.mjs"
run() { echo "--- $* ---"; node "$STEP" --session "$SESSION" "$@"; }

run --screenshot                                  # 00 title
run --tap 300,300                                 # 01 右半屏点按 = 开球
run --wait 900
run --swipe 95,680:200,590                        # 02 摇杆上左推
run --wait 900
run --screenshot                                  # 03 摇杆位移态
run --pressKey ArrowLeft                          # 04 ←键（sf-bug-controls 语义锚）
run --wait 700
run --pressKey ArrowUp                            # 05 ↑键
run --wait 700
run --swipe 95,680:210,680                        # 06 摇杆右推
run --wait 900
run --tap 348,726                                 # 07 传球按钮
run --wait 500
run --tap 348,800                                 # 08 射门按钮
run --wait 900
run --screenshot                                  # 09 动作后终态
run --probe 'JSON.stringify({state:(window.__tsState?window.__tsState():document.title),home:document.getElementById("home-score")?.textContent,away:document.getElementById("away-score")?.textContent,time:document.getElementById("time")?.textContent})' # 10 HUD 探针
echo "SEQ-M DONE"
