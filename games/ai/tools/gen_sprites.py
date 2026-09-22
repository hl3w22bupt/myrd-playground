#!/usr/bin/env python3
"""行动段精灵帧生成器：从人设卡 portrait_prompt 派生 idle×2 / walk×4 帧。

美术单一事实源 = portrait_prompt（基线 §三）：本脚本解析卡内关键词
（发色/发型/服装/瞳色/道具）得到渲染参数，不引入卡外设定。
产物：assets/art/sprites/<persona_id>/idle-{0,1}.svg、walk-{0..3}.svg，
     assets/art/player/frames/idle-{0,1}.svg、walk-{0..3}.svg。
运行：python3 tools/gen_sprites.py（工程根 games/ai 下执行）。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from sprite_lib import chibi_frame

ROOT = Path(__file__).resolve().parent.parent
PERSONA_DIR = ROOT / "data" / "personas"
OUT_SPRITES = ROOT / "assets" / "art" / "sprites"
OUT_PLAYER = ROOT / "assets" / "art" / "player" / "frames"

# 发色关键词 → 渐变两端（深→浅顺序为 a 基础色、b 阴影色）。
HAIR_COLORS: list[tuple[str, tuple[str, str]]] = [
    ("银灰", ("#b9bfcc", "#8e95a6")),
    ("黑长", ("#3a3244", "#241f30")),
    ("黑发", ("#3a3244", "#241f30")),
    ("橘色", ("#ffa057", "#e07a33")),
    ("紫发", ("#b09cf5", "#7d64d0")),
    ("微卷", ("#b0705e", "#84503f")),
]
HAIR_STYLES: list[tuple[str, str]] = [
    ("双马尾", "twin"),
    ("长发", "long"),
    ("微卷长发", "long"),
    ("短发", "short"),
]
# 服装关键词 → 上装渐变（a 亮面 / b 暗面）+ 下装/腿色 + 鞋色。
OUTFITS: list[tuple[str, dict]] = [
    ("白大褂", {"fit_a": "#f4f8fb", "fit_b": "#cfdbe6", "fit_dark": "#9fb2c2", "leg": "#8fa3b5", "shoe": "#e8eef4"}),
    ("校服", {"fit_a": "#4b4f66", "fit_b": "#31344a", "fit_dark": "#232639", "leg": "#2c2f42", "shoe": "#505468"}),
    ("卫衣", {"fit_a": "#ffb35c", "fit_b": "#ef8f3a", "fit_dark": "#c9742c", "leg": "#e0893f", "shoe": "#fdf6ec"}),
    ("开衫", {"fit_a": "#ffb7bc", "fit_b": "#f28e96", "fit_dark": "#d4707c", "leg": "#f2a9ae", "shoe": "#fff3f0"}),
    ("斗篷", {"fit_a": "#6f63c4", "fit_b": "#463c96", "fit_dark": "#37307a", "leg": "#463c96", "shoe": "#2f2a66"}),
    ("连帽衫", {"fit_a": "#6d8ae0", "fit_b": "#4a63b8", "fit_dark": "#3a4f99", "leg": "#38406b", "shoe": "#e9edf7"}),
]
IRIS_COLORS: list[tuple[str, str]] = [
    ("红瞳", "#e0475f"),
    ("蓝瞳", "#4f7fd0"),
    ("紫瞳", "#8d6fd9"),
]
ACCESSORIES: list[tuple[str, str]] = [
    ("热可可", "cup"),
    ("全息平板", "tablet"),
    ("星饰", "star"),
    ("发丝", "strands"),
    ("粒子", "sparkle"),
    ("挂颈耳机", "headphone"),
]


def _match(text: str, table) -> object | None:
    for key, value in table:
        if key in text:
            return value
    return None


def traits_from_prompt(prompt: str, theme_color: str) -> dict:
    """从 portrait_prompt 关键词解析渲染参数；缺省回落主题色系。"""
    hair = _match(prompt, HAIR_COLORS) or ("#8a6f6a", "#664f4c")
    style = _match(prompt, HAIR_STYLES) or "long"
    outfit = _match(prompt, OUTFITS)
    iris = _match(prompt, IRIS_COLORS) or "#5a4a52"
    acc = [value for key, value in ACCESSORIES if key in prompt]
    fit = dict(outfit) if outfit else {
        "fit_a": theme_color, "fit_b": _darken(theme_color, 0.78),
        "fit_dark": _darken(theme_color, 0.6), "leg": _darken(theme_color, 0.7),
        "shoe": "#f5efe8",
    }
    return {
        "hair": hair, "style": style, "iris": iris, "acc": acc,
        "fit_a": fit["fit_a"], "fit_b": fit["fit_b"],
        "fit_dark": fit["fit_dark"], "leg": fit["leg"], "shoe": fit["shoe"],
    }


def _darken(hex_color: str, factor: float) -> str:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    return "#{:02x}{:02x}{:02x}".format(int(r * factor), int(g * factor), int(b * factor))


def _palette(t: dict, theme_color: str) -> dict:
    return {
        "skin": "#f2c6a8", "skin_hi": "#ffe4cd",
        "hair_a": t["hair"][0], "hair_b": t["hair"][1],
        "fit_a": t["fit_a"], "fit_b": t["fit_b"], "fit_dark": t["fit_dark"],
        "leg": t["leg"], "shoe": t["shoe"],
        "iris": t["iris"], "accent": theme_color,
    }


# 帧姿态：idle 2 帧（呼吸下沉 + 眨眼），walk 4 帧（步幅正弦、躯干起伏）。
IDLE_POSES = [
    {"bob": 0.0, "blink": 0.0},
    {"bob": 0.7, "blink": 0.0},
]
WALK_POSES = [
    {"bob": 0.0, "leg_l": 1.0, "leg_r": -1.0, "arm_l": -0.9, "arm_r": 0.9, "lean": 0.6},
    {"bob": 0.8, "leg_l": 0.1, "leg_r": -0.1, "arm_l": -0.2, "arm_r": 0.2, "lean": 0.6},
    {"bob": 0.0, "leg_l": -1.0, "leg_r": 1.0, "arm_l": 0.9, "arm_r": -0.9, "lean": 0.6},
    {"bob": 0.8, "leg_l": -0.1, "leg_r": 0.1, "arm_l": 0.2, "arm_r": -0.2, "lean": 0.6},
]


def write_frames(out_dir: Path, palette: dict, style: str, acc: list[str]) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = {"idle": [], "walk": []}
    for i, pose in enumerate(IDLE_POSES):
        path = out_dir / f"idle-{i}.svg"
        path.write_text(chibi_frame(palette, style, acc, dict(pose)))
        written["idle"].append(path)
    for i, pose in enumerate(WALK_POSES):
        path = out_dir / f"walk-{i}.svg"
        path.write_text(chibi_frame(palette, style, acc, dict(pose)))
        written["walk"].append(path)
    return written


def persona_card_paths(rel_dir: str) -> dict:
    base = f"assets/art/sprites/{rel_dir}"
    return {
        "arena_idle": [f"{base}/idle-0.svg", f"{base}/idle-1.svg"],
        "arena_walk": [f"{base}/walk-{i}.svg" for i in range(4)],
    }


def main() -> None:
    cards = sorted(PERSONA_DIR.glob("persona-*.json"))
    assert cards, f"人设卡目录为空：{PERSONA_DIR}"
    for card_path in cards:
        card = json.loads(card_path.read_text())
        pid = str(card.get("id", "")).strip()
        prompt = str(card.get("portrait_prompt", ""))
        theme = str(card.get("color", "#cccccc"))
        if not pid or not prompt:
            raise SystemExit(f"{card_path.name} 缺 id/portrait_prompt（美术单一事实源）")
        traits = traits_from_prompt(prompt, theme)
        palette = _palette(traits, theme)
        write_frames(OUT_SPRITES / pid, palette, traits["style"], traits["acc"])
        # 回写人设卡 art 字段（声明式路径，代码不出现具体贴图名）
        art = card.setdefault("art", {})
        art.update(persona_card_paths(pid))
        card_path.write_text(json.dumps(card, ensure_ascii=False, indent=2) + "\n")
        print(f"[gen] {pid}: idle×2 walk×4（{traits['style']} / {len(traits['acc'])} 配饰）")
    # 主角小李：连帽衫 + 挂颈耳机 + 深色短发（派生自 assets/art/player 立绘既有设定）
    player_prompt = "单身小伙程序员：深色短发，连帽衫，挂颈耳机，牛仔裤运动鞋，红瞳"
    traits = traits_from_prompt(player_prompt, "#5d7bd5")
    traits["style"] = "short"
    palette = _palette(traits, "#5d7bd5")
    write_frames(OUT_PLAYER, palette, "short", traits["acc"])
    print("[gen] player: idle×2 walk×4")


if __name__ == "__main__":
    main()
