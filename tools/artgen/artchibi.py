# -*- coding: utf-8 -*-
"""artchibi —— 精灵表渲染器（96×96/帧，chibi 2.5 头身）。

帧表布局（黑板风格卡 §一·统一动画参数）：
    sheet-idle.png = 1 行 × 4 帧（呼吸 ±1px，第 4 帧眨眼）
    sheet-walk.png = 4 行方向 × 4 帧（行序：down / right / left / up；下肢摆幅 ±4px，手臂反相）
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

import artcore as C

FRAME = 96  # 单帧设计空间 96×96
DIRECTIONS = ("down", "right", "left", "up")
WALK_FRAMES = 4
IDLE_FRAMES = 4


def _outline(sp: dict) -> tuple:
    return C.shade(C.rgb(sp["hair"]), 0.40)


def _skin_line(sp: dict) -> tuple:
    return C.shade(C.rgb(sp["skin"]), 0.62)


def _head(d: ImageDraw.ImageDraw, sp: dict, s, cx: float, cy: float, direction: str, blink: bool) -> None:
    """chibi 头：后发 → 脸 → 五官 → 前发。"""
    rx, ry = 19.0, 18.0
    hair = C.rgb(sp["hair"])
    hair2 = C.rgb(sp["hair2"])
    skin = C.rgb(sp["skin"])
    line = _outline(sp)
    # 后发
    if direction == "up":
        C.poly(d, s.pts(C.blob(cx, cy, rx + 2.5, ry + 2.0, squash=0.04)), fill=hair2, outline=line, width=s.l(1.4))
        C.stroke(d, s.pts(C.bez([(cx - 10, cy - 12), (cx - 2, cy - 16), (cx + 8, cy - 12)], n=20)), C.tint(hair, 0.30), s.l(1.2))
    else:
        C.poly(d, s.pts(C.blob(cx, cy, rx + 2.0, ry + 1.5, squash=0.04)), fill=hair2)
    # 特殊发型后层
    st = sp["style"]
    if st == "momo":  # 双马尾
        for sgn in (-1, 1):
            tail = C.blob(cx + sgn * (rx + 8), cy + 4 + (2 if direction == "up" else 0), 7.0, 12.0)
            C.poly(d, s.pts(tail), fill=hair2, outline=line, width=s.l(1.2))
    elif st in ("vex", "sera"):  # 长发垂到身体
        for sgn in (-1, 1):
            C.poly(d, s.pts(C.blob(cx + sgn * (rx + 3), cy + 16, 6.0, 13.0)), fill=hair2, outline=line, width=s.l(1.2))
    elif st == "lumi":
        for sgn in (-1, 1):
            C.poly(d, s.pts(C.blob(cx + sgn * (rx + 2), cy + 12, 5.0, 10.0)), fill=hair2, outline=line, width=s.l(1.1))
    # 脸（up 方向不画脸）
    if direction != "up":
        C.poly(d, s.pts(C.blob(cx, cy + 1, rx - 1.0, ry - 0.5)), fill=skin, outline=C.alpha(_skin_line(sp), 210), width=s.l(1.1))
        eye_dx = 7.5 if direction == "down" else 11.0
        if direction in ("left", "right"):
            eye_dx = 9.0
        ey = cy + 3.0
        if blink:
            for sgn in ((-1, 1) if direction == "down" else (1,)):
                for sg in sgn if isinstance(sgn, tuple) else (sgn,):
                    ex = cx + sg * eye_dx
                    C.stroke(d, s.pts(C.bez([(ex - 3.4, ey), (ex, ey + 1.6), (ex + 3.4, ey - 0.6)], n=16)), C.shade(hair, 0.45), s.l(1.4))
        else:
            iris = C.rgb(sp["eye"])
            for sg in ((-1, 1) if direction == "down" else ((1,) if direction == "right" else (-1,))):
                ex = cx + sg * eye_dx
                C.poly(d, s.pts(C.blob(ex, ey, 3.6, 4.0)), fill=C.rgb("#fdf8f5"))
                C.poly(d, s.pts(C.blob(ex + sg * 0.4, ey + 0.8, 2.7, 3.2)), fill=iris)
                C.poly(d, s.pts(C.blob(ex + sg * 0.4, ey + 1.2, 1.2, 1.5)), fill=C.shade(iris, 0.32))
                d.ellipse(s.pts([(ex - 2.0, ey - 1.8), (ex - 0.2, ey - 0.2)]), fill=C.rgb("#ffffff"))
            if direction == "down":
                C.stroke(d, s.pts(C.bez([(cx - 2.0, ey + 7.0), (cx + 0.6, ey + 8.4), (cx + 3.0, ey + 7.0)], n=16)), C.rgb("#b4706f"), s.l(1.2))
                for sg in (-1, 1):
                    C.poly(d, s.pts(C.blob(cx + sg * 11.0, ey + 4.0, 3.0, 1.8)), fill=C.alpha(C.mix(C.rgb(sp["theme"]), C.rgb("#ff9fa8"), 0.5), 60))
    # 前发（刘海贴头顶）
    if st == "sera" and direction != "up":  # 兜帽
        C.poly(d, s.pts(C.blob(cx, cy - 2, rx + 6.0, ry + 4.0, squash=0.06)), fill=C.rgb(sp["outfit"]), outline=C.shade(C.rgb(sp["outfit"]), 0.45), width=s.l(1.4))
    bang_y = cy - 8.0 if direction != "up" else cy - 12.0
    sweep = 0.0
    if direction == "right":
        sweep = -3.0
    elif direction == "left":
        sweep = 3.0
    bang = C.bez(
        [
            (cx - rx - 1 + sweep, cy + 2), (cx - rx - 2 + sweep, bang_y - 4), (cx - 8 + sweep, bang_y - 9),
            (cx + sweep, bang_y - 11), (cx + 8 + sweep, bang_y - 9), (cx + rx + 2 + sweep, bang_y - 4), (cx + rx + 1 + sweep, cy + 2),
            (cx + 10 + sweep, bang_y - 1), (cx + 3 + sweep, bang_y + 2), (cx - 4 + sweep, bang_y - 1), (cx - rx + 1 + sweep, cy + 1),
        ],
        n=64,
    )
    C.poly(d, s.pts(bang), fill=hair, outline=line, width=s.l(1.3))
    # 主题色饰件
    if st == "momo":
        for sgn in (-1, 1):
            C.poly(d, s.pts(C.blob(cx + sgn * (rx - 1), bang_y - 6, 3.4, 2.6)), fill=C.rgb(sp["theme"]))
    if st == "ada" and direction != "up":  # 终端护目镜
        C.stroke(d, s.pts([(cx - rx + 1, bang_y - 3), (cx + rx - 1, bang_y - 3)]), C.alpha(C.rgb(sp["theme"]), 220), s.l(1.6))


def _body(d: ImageDraw.ImageDraw, sp: dict, s, cx: float, top: float, direction: str, leg_phase: float, arm_phase: float, walking: bool) -> None:
    """躯干 + 四肢。top = 躯干顶部 y。"""
    outfit = C.rgb(sp["outfit"])
    theme = C.rgb(sp["theme"])
    skin = C.rgb(sp["skin"])
    line = C.shade(outfit, 0.45)
    w = 15.0
    # 腿
    leg_color = C.shade(C.rgb("#3a3550"), 0.9)
    swing = leg_phase if walking else 0.0
    if direction in ("down", "up"):
        for sgn, off in ((-1, swing), (1, -swing)):
            x = cx + sgn * 6.0
            C.stroke(d, s.pts([(x, top + 20), (x, top + 30 - off)]), leg_color, s.l(6.0))
            C.poly(d, s.pts(C.blob(x, top + 32 - off, 4.0, 2.4)), fill=C.rgb("#2b2735"))
    else:
        for off, front in ((swing, 1), (-swing, 0)):
            x = cx + off * 1.6
            y0 = top + 20 - (1 if front else 0)
            C.stroke(d, s.pts([(x, y0), (x + off * 1.2, y0 + 10)]), leg_color if front else C.shade(leg_color, 0.8), s.l(6.0))
            C.poly(d, s.pts(C.blob(x + off * 1.4, y0 + 12, 4.2, 2.4)), fill=C.rgb("#2b2735") if front else C.shade(C.rgb("#2b2735"), 0.8))
    # 躯干
    C.poly(
        d,
        s.pts(C.bez([(cx - w, top + 2), (cx - w - 1, top + 12), (cx - w + 2, top + 22), (cx + w - 2, top + 22), (cx + w + 1, top + 12), (cx + w, top + 2), (cx, top - 3)], n=48)),
        fill=outfit,
        outline=line,
        width=s.l(1.3),
    )
    # 主题色饰带 / 领口
    C.stroke(d, s.pts(C.bez([(cx - 6, top + 1), (cx, top + 4), (cx + 6, top + 1)], n=16)), C.shade(outfit, 0.62), s.l(1.2))
    C.poly(d, s.pts(C.blob(cx, top + 6, 3.2, 2.2)), fill=theme, outline=C.shade(theme, 0.55), width=s.l(0.9))
    # 手臂（走路反相摆动）
    arm = arm_phase if walking else 0.0
    for sgn in (-1, 1):
        off = arm * sgn
        ax = cx + sgn * (w + 1.0)
        C.stroke(d, s.pts([(ax, top + 4), (ax + sgn * 1.0 + off * 1.2, top + 12 + abs(off) * 0.4), (ax + off * 2.0, top + 17)]), outfit, s.l(5.0))
        C.poly(d, s.pts(C.blob(ax + off * 2.0, top + 19, 2.8, 2.8)), fill=skin, outline=C.alpha(_skin_line(sp), 190), width=s.l(0.9))
    del line


def render_frame(sp: dict, direction: str = "down", t: float = 0.0, walking: bool = False, blink: bool = False, ss: int = 2) -> Image.Image:
    """渲染单帧。t ∈ [0,1) 为相位；walking=False 时为待机呼吸。"""
    size = (FRAME * ss, FRAME * ss)
    s = _Sx = type("S", (), {})()
    scale = FRAME * ss / FRAME
    s.p = lambda x, y: (x * scale, y * scale)
    s.pts = lambda pts: [(x * scale, y * scale) for x, y in pts]
    s.l = lambda v: max(1, int(round(v * scale)))

    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 地面投影
    C.poly(d, s.pts(C.blob(48, 88, 15.0, 3.4)), fill=C.alpha(C.rgb("#0b0710"), 110))

    if walking:
        bob = -1.4 * abs(math.sin(2 * math.pi * t))
        leg = 4.0 * math.sin(2 * math.pi * t)
        arm = -3.0 * math.sin(2 * math.pi * t)
    else:
        bob = -1.0 * (0.5 - 0.5 * math.cos(2 * math.pi * t))
        leg = 0.0
        arm = 0.0

    cx = 48.0
    head_cy = 34.0 + bob
    _body(d, sp, s, cx, head_cy + 15.0, direction, leg, arm, walking)
    _head(d, sp, s, cx, head_cy, direction, blink)
    return C.downscale(img, (FRAME, FRAME))


def sheet(sp: dict, kind: str, ss: int = 2) -> Image.Image:
    """输出精灵表。kind ∈ {'idle','walk'}。"""
    if kind == "walk":
        out = Image.new("RGBA", (FRAME * WALK_FRAMES * ss, FRAME * len(DIRECTIONS) * ss), (0, 0, 0, 0))
        for row, direction in enumerate(DIRECTIONS):
            for col in range(WALK_FRAMES):
                frame = render_frame(sp, direction, t=col / WALK_FRAMES, walking=True, ss=ss)
                out.alpha_composite(frame, (col * FRAME * ss, row * FRAME * ss))
    else:
        out = Image.new("RGBA", (FRAME * IDLE_FRAMES * ss, FRAME * ss), (0, 0, 0, 0))
        for col in range(IDLE_FRAMES):
            frame = render_frame(sp, "down", t=col / IDLE_FRAMES, walking=False, blink=(col == IDLE_FRAMES - 1), ss=ss)
            out.alpha_composite(frame, (col * FRAME * ss, 0))
    return C.downscale(out, (out.size[0] // ss, out.size[1] // ss))
