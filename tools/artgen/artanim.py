# -*- coding: utf-8 -*-
"""artanim —— 生成 Godot 4 SpriteFrames (.tres) 帧表资源。

帧表口径（黑板风格卡 §一）：idle 4 帧 / 6fps；walk 4 方向 × 4 帧 / 10fps；
动画名：idle / walk_down / walk_right / walk_left / walk_up（与施工单 WO-03 的状态机键一致）。
精灵表布局：sheet-idle.png = 4 帧 × 96×96 横排；sheet-walk.png = 行序 down/right/left/up × 4 列帧。
"""
from __future__ import annotations

import os

FRAME = 96
WALK_FPS = 10.0
IDLE_FPS = 6.0
DIRECTIONS = ("down", "right", "left", "up")


def _atlas(sub_id: str, ext_id: str, x: int, y: int) -> str:
    return (
        f'[sub_resource type="AtlasTexture" id="AtlasTexture_{sub_id}"]\n'
        f"atlas = ExtResource(\"{ext_id}\")\n"
        f"region = Rect2({x}, {y}, {FRAME}, {FRAME})\n\n"
    )


def _res(p: str) -> str:
    """仓库相对路径 → Godot res:// 路径（工程根 = games/ai/）。"""
    prefix = "games/ai/"
    return p[len(prefix):] if p.startswith(prefix) else p


def sprite_frames_tres(res_path: str, idle_png: str, walk_png: str) -> str:
    """生成 SpriteFrames .tres 文本。"""
    ext = [
        f'[ext_resource type="Texture2D" path="res://{_res(idle_png)}" id="1_idle"]',
        f'[ext_resource type="Texture2D" path="res://{_res(walk_png)}" id="2_walk"]',
    ]
    subs: list[str] = []
    anims: list[str] = []

    # idle：1 行 × 4 帧
    idle_frames = []
    for i in range(4):
        sid = f"idle_{i}"
        subs.append(_atlas(sid, "1_idle", i * FRAME, 0))
        idle_frames.append(f'{{"duration": 1.0, "texture": SubResource("AtlasTexture_{sid}")}}')
    anims.append(
        '"frames": [%s],\n"loop": true,\n"name": &"idle",\n"speed": %.1f' % (", ".join(idle_frames), IDLE_FPS)
    )

    # walk：4 行方向 × 4 帧
    for row, direction in enumerate(DIRECTIONS):
        frames = []
        for col in range(4):
            sid = f"walk_{direction}_{col}"
            subs.append(_atlas(sid, "2_walk", col * FRAME, row * FRAME))
            frames.append(f'{{"duration": 1.0, "texture": SubResource("AtlasTexture_{sid}")}}')
        anims.append(
            '"frames": [%s],\n"loop": true,\n"name": &"walk_%s",\n"speed": %.1f'
            % (", ".join(frames), direction, WALK_FPS)
        )

    load_steps = len(ext) + len(subs) + 1
    head = f'[gd_resource type="SpriteFrames" load_steps={load_steps} format=3]\n\n'
    body = "\n".join(ext) + "\n\n" + "".join(subs)
    anim_text = ", ".join("{\n%s\n}" % a for a in anims)
    resource = "[resource]\nanimations = [%s]\n" % anim_text
    return head + body + resource


def write_all(characters: dict, out_root: str = os.path.join("games", "ai", "assets", "anim")) -> list[str]:
    os.makedirs(out_root, exist_ok=True)
    written = []
    for cid in characters:
        base = os.path.join("games/ai/assets/art/player" if cid == "player" else f"games/ai/assets/art/personas/{cid}")
        res_rel = os.path.join(out_root, f"{cid}-anim.tres").replace(os.sep, "/")
        text = sprite_frames_tres(
            res_rel,
            os.path.join(base, "sheet-idle.png").replace(os.sep, "/"),
            os.path.join(base, "sheet-walk.png").replace(os.sep, "/"),
        )
        with open(res_rel, "w", encoding="utf-8") as f:
            f.write(text)
        written.append(res_rel)
    return written
