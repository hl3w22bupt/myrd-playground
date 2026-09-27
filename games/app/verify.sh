#!/usr/bin/env bash
# games/app 本地门禁入口：resolve-godot + preflight + smoke（240 帧）+ input-fuzz + playtest。
# 只是调用仓库内判定脚本（std-skills/godot-game-dev/scripts/），不重新实现任何检查逻辑；
# 判定协议：退出码 0 且日志含 GODOT_SMOKE / GODOT_FUZZ / GODOT_PLAYTEST 的 PASS。
# 用法：bash games/app/verify.sh   （仓库根目录执行）

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GAME_PATH="games/app"
SMOKE_FRAMES="${GODOT_SMOKE_FRAMES:-240}"

cd "$ROOT"

echo "== [1/5] resolve-godot =="
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" || {
  echo "verify: 环境不可用（找不到 Godot，退出码 $?）"; exit 2; }
echo "GODOT_BIN=$GODOT_BIN"

echo "== [2/5] preflight =="
python3 std-skills/godot-game-dev/scripts/preflight.py "$GAME_PATH" || {
  echo "verify: preflight 未通过"; exit 1; }

echo "== [3/5] headless smoke (${SMOKE_FRAMES} frames) =="
GODOT_SMOKE_FRAMES="$SMOKE_FRAMES" GODOT_BIN="$GODOT_BIN" \
  bash std-skills/godot-game-dev/scripts/smoke.sh "$GAME_PATH" || {
  echo "verify: smoke 未通过"; exit 1; }

echo "== [4/5] input-fuzz =="
GODOT_BIN="$GODOT_BIN" bash std-skills/godot-game-dev/scripts/input-fuzz.sh "$GAME_PATH" || {
  echo "verify: input-fuzz 未通过"; exit 1; }

echo "== [5/5] playtest（机器人试玩，3 局）=="
GODOT_BIN="$GODOT_BIN" bash std-skills/godot-game-dev/scripts/playtest.sh "$GAME_PATH" || {
  echo "verify: playtest 未通过"; exit 1; }

echo "verify: 全部通过（PREFLIGHT: PASS + GODOT_SMOKE: PASS + GODOT_FUZZ: PASS + GODOT_PLAYTEST: PASS）"
