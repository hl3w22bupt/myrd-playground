#!/usr/bin/env bash
# run-spike.sh — snake-ghost 残影 spike 一键执行（A2，独立 spike，不进主线分支）。
#
# 用法（工作区根执行，或任意目录 —— 脚本自定位）：
#   bash games/game/qa/snake-ghost-spike/run-spike.sh              # 桌面无头 60s 采样
#   GODOT_BIN=/path/to/godot bash games/game/qa/snake-ghost-spike/run-spike.sh
#   SPIKE_SEC=120 bash ... run-spike.sh                            # 加长采样
#
# 产物（落 qa/snake-ghost-spike/data/<时间戳>/）：
#   run-headless.log（SPIKE 逐行原文）/ fps.csv / mem.json
#   判据与「能/不能」回填流程见同目录 README.md（§A2.2，禁止理论推演代替实跑）。
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${SPIKE_OUT_DIR:-$DIR/data/$STAMP}"
SEC="${SPIKE_SEC:-60}"
mkdir -p "$OUT"

# GODOT_BIN 解析：环境变量优先，其次主工程同款 resolve-godot.sh（与冒烟门禁一致）。
if [ -z "${GODOT_BIN:-}" ]; then
  WORKSPACE_ROOT="$(cd "$DIR/../../.." && pwd)"
  if [ -f "$WORKSPACE_ROOT/std-skills/godot-game-dev/scripts/resolve-godot.sh" ]; then
    GODOT_BIN="$(bash "$WORKSPACE_ROOT/std-skills/godot-game-dev/scripts/resolve-godot.sh")"
  fi
fi
if [ -z "${GODOT_BIN:-}" ]; then
  echo "SPIKE: FAIL 未解析到 GODOT_BIN（设置环境变量或确认 resolve-godot.sh 可用）" >&2
  exit 1
fi
echo "[spike] GODOT_BIN=$GODOT_BIN"

# 临时独立工程（零主线侵入：不写入 games/game 的 project.godot / 场景树）。
TMP="$(mktemp -d /tmp/snake-ghost-spike.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
cp "$DIR/spike_main.gd" "$DIR/spike_main.tscn" "$TMP/"
cat > "$TMP/project.godot" <<EOF
; snake-ghost spike throwaway project (ASCII comment only - CJK in cfg caused error 43 on load)
config_version=5

[application]
config/name="snake-ghost-spike"
run/main_scene="res://spike_main.tscn"
config/features=PackedStringArray("4.3")

[display]
window/size/viewport_width=720
window/size/viewport_height=1280
window/handheld/orientation="portrait"
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
EOF

echo "[spike] headless sampling ${SEC}s, output dir ${OUT} (one sample line per second)"
SPIKE_OUT_DIR="$OUT" SPIKE_SEC="$SEC" \
  "$GODOT_BIN" --headless --path "$TMP" 2>&1 | tee "$OUT/run-headless.log"
CODE=${PIPESTATUS[0]}

echo "[spike] 退出码=$CODE；产物："
ls -l "$OUT"
if ! grep -q "SPIKE: verdict_desktop" "$OUT/run-headless.log"; then
  echo "SPIKE: FAIL 未产出 verdict 行（运行异常，检查 run-headless.log）" >&2
  exit 1
fi
echo "[spike] 完成。桌面机判结论见 verdict_desktop 行；Safari 真机录屏项按 README.md 执行后一并回填。"
