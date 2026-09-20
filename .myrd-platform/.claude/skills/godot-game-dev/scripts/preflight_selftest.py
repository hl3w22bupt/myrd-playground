#!/usr/bin/env python3
"""preflight.py 的自测：用合成工程逐条验证「该拦的拦下、不该拦的放行」。

背景：审查发现 preflight 自身有「验证器缺陷」类问题 —— 文档承诺的检查项与实现不符
（P5 整类文件被跳过）、按属性顺序硬编码的正则在「编辑器保存过一次」之后集体失效。
本脚本把这些缺陷固化成回归用例：门禁自己的门禁。

用法：
    python3 scripts/preflight_selftest.py [preflight.py 路径]
退出码：0 = 全部用例符合预期；1 = 有用例不符（打印差异）。

用例命名：`must_fail:[Pxx]` 期望退出码 1 且输出含该检查码；`must_pass` 期望退出码 0。
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_GODOT = """config_version=5

[application]

config/name="selftest"
run/main_scene="res://scenes/main.tscn"

[autoload]

GameState="*res://autoload/game_state.gd"
"""

MAIN_TSCN_HAND_WRITTEN = """[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/main.gd" id="1_main"]
[ext_resource type="PackedScene" path="res://scenes/coin.tscn" id="2_coin"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")

[node name="Coin" parent="." instance=ExtResource("2_coin")]
"""

MAIN_TSCN_EDITOR_SAVED = """[gd_scene load_steps=4 format=3 uid="uid://selftestscene1"]

[ext_resource type="Script" uid="uid://selftestscript1" path="res://scripts/main.gd" id="1_main"]
[ext_resource type="Texture2D" uid="uid://selftesttex1" path="res://icon.svg" id="3_tex"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")

[node name="Icon" type="Sprite2D" parent="."]
texture = ExtResource("3_tex")
"""

MAIN_GD_OK = """extends Node2D
func _ready() -> void:
	print("ok")
"""

# 不含金币实例引用的最小主场景（给不需要 coin.tscn 的用例用）
MAIN_TSCN_SCRIPT_ONLY = """[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/main.gd" id="1_main"]

[node name="Main" type="Node2D"]
script = ExtResource("1_main")
"""

COIN_TSCN = "[gd_scene format=3]\n[node name=\"Coin\" type=\"Area2D\"]\n"
GAME_STATE_GD = "extends Node\n"
ICON_IMPORT = 'uid="uid://selftesttex1"\n'

# 用例注册表：目录名 → {文件路径: 内容, 期望}
CASES: list[dict] = [
    {
        "name": "baseline-handwritten",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN,
            "scenes/coin.tscn": "[gd_scene format=3]\n[node name=\"Coin\" type=\"Area2D\"]\n",
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
            "icon.svg": "<svg/>\n",
        },
        "expect": "must_pass",
    },
    {
        # P5 高危回归：.gd 里 preload 悬空路径必须拦下（曾被整类文件跳过）
        "name": "p5-dangling-preload-in-gd",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN,
            "scripts/main.gd": 'extends Node2D\nconst S = preload("res://scenes/gone.tscn")\n',
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P5",
    },
    {
        # P5 防误报：注释掉的路径不算引用
        "name": "p5-commented-path-ignored",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": 'extends Node2D\n# 备选：preload("res://scenes/gone.tscn")\nfunc _ready() -> void:\n\tprint("ok")\n',
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P5 防误报：文档/脚本里的示例路径不参与检查（白名单扫描集）
        "name": "p5-doc-paths-ignored",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": GAME_STATE_GD,
            "README.md": '计划新增 `res://scenes/enemy.tscn`，示例见 "res://scenes/boss.tscn"。\n',
            "tools/gen.sh": 'echo "res://scenes/missing.tscn"\n',
        },
        "expect": "must_pass",
    },
    {
        # P6 高危回归：编辑器保存过的场景（带 uid、属性顺序不同）不得误报/漏报
        "name": "p6-editor-saved-scene",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_EDITOR_SAVED,
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": GAME_STATE_GD,
            "icon.svg": "<svg/>\n",
            "icon.svg.import": ICON_IMPORT,
        },
        "expect": "must_pass",
    },
    {
        # P6：编辑器风格头里悬空的 ext_resource path 仍要被拦（防「放宽正则=放弃检查」）
        "name": "p6-editor-saved-dangling-path",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_EDITOR_SAVED.replace('path="res://icon.svg"', 'path="res://icon_gone.svg"'),
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P6",
    },
    {
        # P8：to="."（根节点）连接、方法缺失 —— 曾被静默跳过
        "name": "p8-root-connection-missing-method",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN
            + '[connection signal="tapped" from="Coin" to="." method="_on_coin_tapped"]\n',
            "scripts/main.gd": MAIN_GD_OK,
            "scenes/coin.tscn": "[gd_scene format=3]\n[node name=\"Coin\" type=\"Area2D\"]\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P8",
    },
    {
        # P8：to="." 且方法存在 —— 不得误报
        "name": "p8-root-connection-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN
            + '[connection signal="tapped" from="Coin" to="." method="_on_coin_tapped"]\n',
            "scripts/main.gd": "extends Node2D\nfunc _ready() -> void:\n\tprint(\"ok\")\n\nfunc _on_coin_tapped() -> void:\n\tprint(\"tapped\")\n",
            "scenes/coin.tscn": "[gd_scene format=3]\n[node name=\"Coin\" type=\"Area2D\"]\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P8：连接目标是实例化子场景的根节点，方法在子场景脚本里缺失
        "name": "p8-instanced-root-missing-method",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN
            + '[connection signal="tapped" from="Coin" to="Coin" method="_on_coin_tapped"]\n',
            "scripts/main.gd": MAIN_GD_OK,
            "scenes/coin.tscn": '[gd_scene format=3]\n[ext_resource type="Script" path="res://scripts/coin.gd" id="1_coin"]\n[node name="Coin" type="Area2D"]\nscript = ExtResource("1_coin")\n',
            "scripts/coin.gd": "extends Area2D\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P8",
    },
    {
        # P10：.gd 里引用未声明的 uid 必须拦下
        "name": "p10-undeclared-uid",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN,
            "scripts/main.gd": 'extends Node2D\nfunc _ready() -> void:\n\tprint(load("uid://nosuchuid1").resource_name)\n',
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P10",
    },
    {
        # P10：场景首行头声明的 uid 被别的场景引用 —— 放行（双前缀 bug 曾让声明永远收集不到）
        "name": "p10-declared-uid-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": '[gd_scene load_steps=2 format=3 uid="uid://realtexuid1"]\n\n[ext_resource type="Texture2D" uid="uid://realtexuid1" path="res://icon.svg" id="3_tex"]\n\n[node name="Main" type="Node2D"]\n',
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
            "icon.svg": "<svg/>\n",
            "icon.svg.import": 'uid="uid://realtexuid1"\n',
        },
        "expect": "must_pass",
    },
    {
        # P12：内建 callable 豁免 —— 曾把 queue_free 当「本文件方法」误报
        "name": "p12-builtin-callable-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": 'extends Node2D\nfunc _ready() -> void:\n\tget_tree().create_timer(1.0).timeout.connect(queue_free)\n\tget_tree().create_timer(2.0).timeout.connect(hide)\n',
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P12：真接线断裂（拼错方法名）必须拦下
        "name": "p12-broken-connect",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN,
            "scripts/main.gd": 'extends Node2D\nsignal tapped\nfunc _ready() -> void:\n\ttapped.connect(_on_tapped_renamed_away)\n',
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P12",
    },
    {
        # P11：Godot 3 残留语法必须拦下（既有行为回归保护）
        "name": "p11-godot3-syntax",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_HAND_WRITTEN,
            "scripts/main.gd": "extends Node2D\nonready var label = $Label\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P11",
    },
    {
        # P11：Godot 3 类型名污染必须拦下（模型被 Godot 3 语料浸透的高频翻车点，见 error-signatures §G）
        "name": "p11-godot3-type-names",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Node2D\nvar body := KinematicBody2D.new()\nvar arr := PoolVector2Array()\n"
                + "var rb: RigidBody = null\nprint(body, arr, rb)\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P11",
    },
    {
        # P11：`extends Spatial`（裸 Spatial 类型标注）必须拦下
        "name": "p11-godot3-spatial-extends",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Spatial\nfunc _ready() -> void:\n\tprint(\"ok\")\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P11",
    },
    {
        # P11：Godot 3 旧 API 签名必须拦下（move_and_slide 带参 / instance() / Tween.new / interpolate_property / export var）
        "name": "p11-godot3-api-forms",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends CharacterBody2D\nexport var speed = 300.0\nfunc _ready() -> void:\n\t"
                + "var scene := load(\"res://scenes/coin.tscn\")\n\tvar tween = Tween.new()\n\t"
                + "tween.interpolate_property(self, \"position\")\n\tprint(scene.instance(), tween)\n"
                + "func _physics_process(_delta: float) -> void:\n\tmove_and_slide(velocity, Vector2.UP)\n",
            "scenes/coin.tscn": COIN_TSCN,
            "autoload/game_state.gd": GAME_STATE_GD,
        },
        "expect": "must_fail:P11",
    },
    {
        # P11 防误报：Godot 3 写法只出现在 # 注释里（迁移对照/防退化提醒）—— 放行
        "name": "p11-commented-godot3-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Node2D\n"
                + "# 禁止 Godot 3 残留：onready var / export var speed = 300\n"
                + "# yield(get_tree().create_timer(1), \"timeout\")\n"
                + "# KinematicBody2D / extends Spatial / RigidBody / PoolVector2Array\n"
                + "# move_and_slide(vel, Vector2.UP) / load(\"res://x.tscn\").instance()\n"
                + "# Tween.new() / interpolate_property() / connect(\"pressed\", self, \"_on_x\")\n"
                + "func _ready() -> void:\n\tprint(\"ok\")\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P11 防误报：全部 Godot 4 等价写法 —— 放行（CharacterBody2D / @export / 无参 move_and_slide / instantiate / PackedVector2Array / await）
        "name": "p11-godot4-equivalents-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends CharacterBody2D\n@export var speed: float = 300.0\n"
                + "func _ready() -> void:\n\tvar coin := load(\"res://scenes/coin.tscn\").instantiate()\n\t"
                + "var path := PackedVector2Array()\n\tpath.append(Vector2.ZERO)\n\tprint(coin, path)\n\t"
                + "await get_tree().create_timer(0.1).timeout\n"
                + "func _physics_process(_delta: float) -> void:\n\t"
                + "velocity = Input.get_vector(\"move_left\", \"move_right\", \"move_up\", \"move_down\") * speed\n\tmove_and_slide()\n",
            "scenes/coin.tscn": COIN_TSCN,
            "autoload/game_state.gd": GAME_STATE_GD,
        },
        "expect": "must_pass",
    },
    {
        # P13：场景里有中文 Label 但没设全局字体 —— Web 导出必出缺字方块，拦下
        "name": "p13-cjk-without-font",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY
            + '[node name="Title" type="Label" parent="."]\ntext = "糖果粉碎传奇"\n',
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P13",
    },
    {
        # P13：有中文 + 已设置 custom_font 且字体文件存在 —— 放行
        "name": "p13-cjk-with-font-ok",
        "files": {
            "project.godot": PROJECT_GODOT + '\n[gui]\n\ntheme/custom_font="res://assets/fonts/NotoSansSC-Regular.otf"\n',
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY
            + '[node name="Title" type="Label" parent="."]\ntext = "糖果粉碎传奇"\n',
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
            "assets/fonts/NotoSansSC-Regular.otf": "OTF",
        },
        "expect": "must_pass",
    },
    {
        # P13：custom_font 指向的字体文件不存在 —— 拦下（P5 不扫 project.godot，这里兜底）
        "name": "p13-cjk-font-file-missing",
        "files": {
            "project.godot": PROJECT_GODOT + '\n[gui]\n\ntheme/custom_font="res://assets/fonts/gone.otf"\n',
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY
            + '[node name="Title" type="Label" parent="."]\ntext = "糖果粉碎传奇"\n',
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P13",
    },
    {
        # P13 防误报：中文只出现在 .gd 注释里（不会被渲染）+ 无字体 —— 放行
        "name": "p13-gd-comment-chinese-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Node2D\n# 胜负遮罩文案（HUD 动态文本统一英文，避免豆腐块）\nfunc _ready() -> void:\n\tprint(\"ok\")\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P13 防误报：纯英文工程不需要字体 —— 放行
        "name": "p13-ascii-only-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY
            + '[node name="Title" type="Label" parent="."]\ntext = "SCORE 0 / 600"\n',
            "scripts/main.gd": MAIN_GD_OK,
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
    {
        # P14：脚本引用 Juice. 但 [autoload] 未注册 Juice —— 解析期 Identifier not found，提前拦
        "name": "p14-juice-used-without-autoload",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Node2D\nfunc _on_score(score: int) -> void:\n\tJuice.pop(self)\n\tprint(score)\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_fail:P14",
    },
    {
        # P14 防误报：Juice. 只出现在 # 注释里（规范/迁移说明）不触发
        "name": "p14-juice-comment-only-ok",
        "files": {
            "project.godot": PROJECT_GODOT,
            "scenes/main.tscn": MAIN_TSCN_SCRIPT_ONLY,
            "scripts/main.gd": "extends Node2D\n# 反馈统一走 Juice.pop / Juice.sfx（本工程暂未接入反馈单例）\nfunc _ready() -> void:\n\tprint(\"ok\")\n",
            "autoload/game_state.gd": "extends Node\n",
        },
        "expect": "must_pass",
    },
]


def run_case(preflight: Path, case: dict) -> str | None:
    """跑单个用例。返回 None = 符合预期；字符串 = 失败原因。"""
    with tempfile.TemporaryDirectory(prefix="godot-preflight-selftest-") as tmp:
        project = Path(tmp) / case["name"]
        for rel, content in case["files"].items():
            target = project / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(preflight), str(project)],
            capture_output=True, text=True,
        )
    expect = case["expect"]
    if expect == "must_pass":
        if proc.returncode != 0:
            return f"期望 PASS，实际退出码 {proc.returncode}：{proc.stdout.strip().splitlines()[:3]}"
        return None
    code = expect.split(":")[1]
    if proc.returncode != 1:
        return f"期望 FAIL[{code}]（退出码 1），实际退出码 {proc.returncode}：{proc.stdout.strip()[:200]}"
    if f"[{code}]" not in proc.stdout:
        return f"期望输出含 [{code}]，实际：{proc.stdout.strip()[:300]}"
    return None


def main() -> int:
    preflight = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("preflight.py")).resolve()
    failures: list[str] = []
    for case in CASES:
        problem = run_case(preflight, case)
        marker = "ok  " if problem is None else "FAIL"
        print(f"[{marker}] {case['name']}（{case['expect']}）")
        if problem:
            failures.append(f"{case['name']}: {problem}")
            print(f"       {problem}")
    print()
    print(f"preflight 自测：{len(CASES) - len(failures)}/{len(CASES)} 用例符合预期")
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
