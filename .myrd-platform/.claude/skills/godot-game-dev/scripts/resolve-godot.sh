#!/usr/bin/env bash
# 解析 Godot 可执行文件 —— 全技能包唯一实现。
#
# 背景：此前 routine 的 availability 步、headless-smoke 步、工程 verify.sh 三处各自维护
# 一份候选清单，随后真的漂移了：availability 认 PATH 里的 godot 判「环境就绪」，
# headless-smoke 却写死 ~/tools/godot 判退出码 2「找不到 Godot」—— 同一次运行里
# 两个 step 自相矛盾。现在都从这里取，改候选清单只改这一处。
#
# 解析顺序：GODOT_BIN > PATH 里的 godot > /Applications/Godot.app > ~/tools/godot
# 输出：解析到的可执行文件（stdout）；找不到时 stderr 给安装指引，退出码 2（环境不可用）。

GODOT_BIN="${GODOT_BIN:-}"
if [ -z "${GODOT_BIN}" ]; then
  for candidate in godot \
    "/Applications/Godot.app/Contents/MacOS/Godot" \
    "${HOME}/tools/godot/Godot.app/Contents/MacOS/Godot"; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      GODOT_BIN="${candidate}"
      break
    fi
  done
fi

if [ -z "${GODOT_BIN}" ]; then
  echo "resolve-godot: 找不到 Godot。安装：brew install --cask godot，或下载后 GODOT_BIN=/path/to/Godot 指定" >&2
  exit 2
fi

if ! command -v "${GODOT_BIN}" >/dev/null 2>&1; then
  echo "resolve-godot: GODOT_BIN=${GODOT_BIN} 不可执行" >&2
  exit 2
fi

echo "${GODOT_BIN}"
