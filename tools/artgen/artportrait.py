# -*- coding: utf-8 -*-
"""artportrait —— 立绘 / 表情差分渲染器（3:4，设计空间 200×266.67）。

比例系统（风格卡 §一·比例，全部由下方常量驱动）：
    头：中心 (100,84)，半宽 34 / 半高 42（头顶 y=42，下巴 y=126，占画宽 34%）。
    眼线 y=94（半宽 11）· 眉 y=81 · 鼻 y=107 · 嘴 y=115 · 腮红 y=104。
    颈 y=118..144 · 肩线 y=150 半宽 25 · 腰 y=200 半宽 21 · 臀 y=236 半宽 26 · 底裁切 y=266.7。
角色外观只由 generate.py 规格表（派生自人设卡 portrait_prompt + color）驱动；
表情三档 normal / happy / crisis 与黑板风格卡 §一「统一动画参数」一一对应。
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

import artcore as C

DW, DH = 200.0, 800.0 / 3.0  # 设计空间（3:4）

# ---- 人体比例常量（风格卡 §一·比例）----
HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY = 100.0, 84.0, 34.0, 42.0
EYE_Y, EYE_DX, EYE_RX, EYE_RY = 91.0, 13.0, 8.4, 6.9
BROW_Y, NOSE_Y, MOUTH_Y, BLUSH_Y = 81.0, 107.0, 115.0, 104.0
NECK_TOP, NECK_BOT, NECK_HW = 118.0, 142.0, 7.6
SHOULDER_Y, SHOULDER_HW = 146.0, 36.0
WAIST_Y, WAIST_HW = 200.0, 26.0
HIP_Y, HIP_HW = 238.0, 32.0
BOTTOM = 266.7

# 表情档位（与 PersonaLoader.EXPRESSION_* / ExpressionKind 对齐）
NORMAL, HAPPY, CRISIS = "normal", "happy", "crisis"


class _S:
    """设计空间 → 超采样画布 坐标换算。"""

    def __init__(self, s: float):
        self.s = s

    def p(self, x: float, y: float):
        return (x * self.s, y * self.s)

    def pts(self, pts: list):
        return [(x * self.s, y * self.s) for x, y in pts]

    def l(self, v: float) -> int:
        return max(1, int(round(v * self.s)))


# ---------------------------------------------------------------- 部位路径


def _head_path() -> list:
    cx, cy, rx, ry = HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY
    return C.bez(
        [
            (cx, cy - ry), (cx - 0.45 * rx, cy - ry), (cx - rx, cy - 0.55 * ry), (cx - rx, cy + 0.05 * ry),
            (cx - rx, cy + 0.30 * ry), (cx - 0.82 * rx, cy + 0.70 * ry), (cx - 0.45 * rx, cy + 0.94 * ry), (cx, cy + ry + 3),
            (cx + 0.45 * rx, cy + 0.94 * ry), (cx + 0.82 * rx, cy + 0.70 * ry), (cx + rx, cy + 0.30 * ry), (cx + rx, cy + 0.05 * ry),
            (cx + rx, cy - 0.55 * ry), (cx + 0.45 * rx, cy - ry),
        ],
        n=96,
    )


def _torso_path() -> list:
    cx = HEAD_CX
    return C.bez(
        [
            (cx - SHOULDER_HW, SHOULDER_Y), (cx - SHOULDER_HW - 3, SHOULDER_Y + 16), (cx - WAIST_HW - 1, WAIST_Y),
            (cx - WAIST_HW + 1, WAIST_Y + 20), (cx - HIP_HW, HIP_Y), (cx - HIP_HW, BOTTOM),
            (cx + HIP_HW, BOTTOM), (cx + HIP_HW, HIP_Y), (cx + WAIST_HW - 1, WAIST_Y + 20), (cx + WAIST_HW + 1, WAIST_Y),
            (cx + SHOULDER_HW + 3, SHOULDER_Y + 16), (cx + SHOULDER_HW, SHOULDER_Y), (cx, SHOULDER_Y - 16),
        ],
        n=90,
    )


# ---------------------------------------------------------------- 背景


def _background(img: Image.Image, sp: dict, s: _S, expr: str) -> Image.Image:
    w, h = img.size
    theme = C.rgb(sp["theme"])
    aux = C.shade(theme, 0.30)
    aux2 = C.shade(theme, 0.13)
    base = C.vgrad(w, h, C.mix(aux, C.rgb("#332b40"), 0.30), C.mix(aux2, C.rgb("#150f1d"), 0.50))
    hx, hy = s.p(HEAD_CX, HEAD_CY)
    base.alpha_composite(C.glow(w, h, hx, hy, s.l(HEAD_RX * 2.6), C.alpha(C.tint(theme, 0.18), 110)))
    base.alpha_composite(C.glow(w, h, s.l(100), s.l(240), s.l(70), C.alpha(C.tint(theme, 0.30), 46)))
    d = ImageDraw.Draw(base)
    C.poly(d, s.pts(C.blob(100, 258, 44, 6.0)), fill=C.alpha(C.rgb("#0b0710"), 120))
    C.bokeh(base, C.tint(theme, 0.40), count=14, seed=sp["seed"], rmin=s.l(1.0), rmax=s.l(3.4))
    if sp["style"] == "sera":
        C.bokeh(base, C.rgb("#ffffff"), count=30, seed=sp["seed"] + 3, rmin=s.l(0.35), rmax=s.l(1.0), alpha_max=95)
    if expr == CRISIS:
        base = C.edge_tint(base, C.rgb("#8e2430"), strength=0.45)
    return C.vignette(base, strength=0.32 if expr != CRISIS else 0.44)


# ---------------------------------------------------------------- 发型


def _hair_back(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    hair = C.rgb(sp["hair"])
    hair2 = C.rgb(sp["hair2"])
    line = C.shade(hair, 0.40)
    st = sp["style"]
    wl = s.l(1.5)
    cy, ry = HEAD_CY, HEAD_RY
    if st == "vex":  # 黑长直：垂到腰下
        left = C.bez([(HEAD_CX - 24, cy - ry + 26), (HEAD_CX - 36, cy + 20), (HEAD_CX - 38, cy + 80), (HEAD_CX - 34, cy + 136), (HEAD_CX - 26, cy + 158)], n=44)
        right = C.bez([(HEAD_CX + 24, cy - ry + 26), (HEAD_CX + 36, cy + 20), (HEAD_CX + 38, cy + 80), (HEAD_CX + 34, cy + 136), (HEAD_CX + 26, cy + 158)], n=44)
        C.poly(d, s.pts(left + [(HEAD_CX - 26, cy + 158), (HEAD_CX + 26, cy + 158)] + right[::-1]), fill=hair2)
        C.stroke(d, s.pts(left), line, wl)
        C.stroke(d, s.pts(right), line, wl)
        for x0, x1 in ((HEAD_CX - 18, HEAD_CX - 14), (HEAD_CX, HEAD_CX + 2), (HEAD_CX + 16, HEAD_CX + 12)):
            d.line(s.pts([(x0, cy + 30), (x1, cy + 130)]), fill=C.alpha(C.tint(hair, 0.26), 80), width=s.l(0.9))
    elif st == "lumi":  # 微卷长发：两侧波浪卷
        left = C.bez([(HEAD_CX - 22, cy - ry + 30), (HEAD_CX - 34, cy + 14), (HEAD_CX - 28, cy + 52), (HEAD_CX - 36, cy + 88), (HEAD_CX - 26, cy + 102)], n=56)
        right = C.bez([(HEAD_CX + 22, cy - ry + 30), (HEAD_CX + 34, cy + 14), (HEAD_CX + 28, cy + 52), (HEAD_CX + 36, cy + 88), (HEAD_CX + 26, cy + 102)], n=56)
        C.poly(d, s.pts(left + [(HEAD_CX - 26, cy + 102), (HEAD_CX + 26, cy + 102)] + right[::-1]), fill=hair2)
        C.stroke(d, s.pts(left), line, wl)
        C.stroke(d, s.pts(right), line, wl)
        for cx, cyy, r in ((HEAD_CX - 30, cy + 92, 6.4), (HEAD_CX + 30, cy + 92, 6.4), (HEAD_CX - 25, cy + 60, 5.0), (HEAD_CX + 25, cy + 60, 5.0)):
            C.poly(d, s.pts(C.blob(cx, cyy, r, r)), fill=hair2)
    elif st == "momo":  # 双马尾
        C.poly(d, s.pts(C.blob(HEAD_CX, cy - 4, HEAD_RX + 8, HEAD_RY + 2, squash=0.05)), fill=hair2)
        for sign in (-1, 1):
            pts = C.bez(
                [(HEAD_CX + sign * (HEAD_RX - 4), cy - ry + 56), (HEAD_CX + sign * (HEAD_RX + 26), cy + 10),
                 (HEAD_CX + sign * (HEAD_RX + 12), cy + 56), (HEAD_CX + sign * (HEAD_RX + 28), cy + 92)],
                n=48,
            )
            tail = []
            for i, p in enumerate(pts):
                r = 10 - 5 * (i / len(pts))
                tail.append((p[0] - r, p[1]))
            for i, p in reversed(list(enumerate(pts))):
                r = 12 - 6 * (i / len(pts))
                tail.append((p[0] + r, p[1]))
            C.poly(d, s.pts(tail), fill=hair2)
            C.stroke(d, s.pts(pts), line, wl)
    elif st == "ada":  # 短波波头（贴头）
        C.poly(d, s.pts(C.blob(HEAD_CX, cy - 4, HEAD_RX + 3, HEAD_RY - 4, squash=0.05)), fill=hair2, outline=line, width=wl)
    elif st == "sera":  # 兜帽长发
        C.poly(d, s.pts(C.blob(HEAD_CX, cy - 2, HEAD_RX + 6, HEAD_RY + 3, squash=0.04)), fill=hair2)
        for sign in (-1, 1):
            p = C.bez(
                [(HEAD_CX + sign * (HEAD_RX - 4), cy), (HEAD_CX + sign * (HEAD_RX + 10), cy + 44),
                 (HEAD_CX + sign * (HEAD_RX + 4), cy + 92), (HEAD_CX + sign * (HEAD_RX + 12), cy + 120)],
                n=40,
            )
            tail = []
            for i, q in enumerate(p):
                r = 11 - 5 * (i / len(p))
                tail.append((q[0] - r, q[1]))
            for i, q in reversed(list(enumerate(p))):
                r = 11 - 5 * (i / len(p))
                tail.append((q[0] + r, q[1]))
            C.poly(d, s.pts(tail), fill=hair2)
            C.stroke(d, s.pts(p), line, wl)
    elif st == "player":  # 主角短发
        C.poly(d, s.pts(C.blob(HEAD_CX, cy - 4, HEAD_RX + 3, HEAD_RY - 2, squash=0.03)), fill=hair2, outline=line, width=wl)


def _bang(cx: float, cy: float, rx: float, ry: float, tips: list, sweep: float = 0.0) -> list:
    """刘海 = 外缘（沿头顶弧线，略大于头廓）+ 内缘锯齿发梢。

    tips：[(dx, dy)] 相对 (cx, cy) 的发梢折点，从右往左排列；dy 为发梢落点高度（0 = 眼线）。
    sweep：>0 时刘海整体向一侧偏移（斜刘海/七三分）。
    """
    top = cy - ry - 5
    e = sweep * 0.5
    outer = C.bez(
        [
            (cx - rx - 2 + e, cy + 2),
            (cx - rx - 5 + e, cy - ry * 0.45),
            (cx - 16 + e, top),
            (cx + e, top - 5),
            (cx + 16 + e, top),
            (cx + rx + 5 + e, cy - ry * 0.45),
            (cx + rx + 2 + e, cy + 2),
        ],
        n=64,
    )
    inner = [(cx + dx + e, cy + dy) for dx, dy in tips]
    return outer + inner + [outer[0]]


def _hair_front(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    hair = C.rgb(sp["hair"])
    line = C.shade(hair, 0.40)
    st = sp["style"]
    wl = s.l(1.5)
    cx, cy, rx, ry = HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY
    if st == "vex":  # 斜刘海（盖右眼）+ 姬发式侧发
        bang = _bang(cx, cy, rx, ry, [(rx - 6, -4), (12, 6), (2, -8), (-8, -5), (-16, -7), (-rx + 4, -7)], sweep=6.0)
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        for sgn, dy in ((-1, 2), (1, -2)):
            lock = C.bez([(cx + sgn * (rx - 3), cy - 6 + dy), (cx + sgn * (rx - 1), cy + 20), (cx + sgn * (rx + 1), cy + 46), (cx + sgn * (rx + 7), cy + 52), (cx + sgn * (rx + 2), cy + 24), (cx + sgn * (rx + 4), cy - 4 + dy)], n=44)
            C.poly(d, s.pts(lock), fill=hair)
        C.stroke(d, s.pts(C.bez([(cx - 20, cy - 30), (cx - 2, cy - 44), (cx + 16, cy - 40)], n=24)), C.tint(hair, 0.34), s.l(1.5))
    elif st == "lumi":  # 空气刘海
        bang = _bang(cx, cy, rx, ry, [(rx - 4, -6), (18, -9), (4, 4), (-4, 4), (-14, -9), (-rx + 4, -6)])
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 22, cy - 30), (cx - 4, cy - 44), (cx + 18, cy - 40)], n=24)), C.tint(hair, 0.36), s.l(1.6))
    elif st == "momo":  # 平刘海 + 发圈
        bang = _bang(cx, cy, rx, ry, [(rx - 2, -7), (14, -5), (6, -7), (-4, -5), (-13, -7), (-rx + 2, -7)])
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 22, cy - 32), (cx - 4, cy - 45), (cx + 16, cy - 42)], n=24)), C.tint(hair, 0.38), s.l(1.6))
        for sgn in (-1, 1):  # 马尾发圈
            C.poly(d, s.pts(C.blob(cx + sgn * (rx - 1), cy - ry + 38, 7.0, 5.2)), fill=C.rgb(sp["theme"]), outline=C.shade(C.rgb(sp["theme"]), 0.55), width=s.l(1.0))
    elif st == "ada":  # 七三分短刘海
        bang = _bang(cx, cy, rx, ry, [(rx - 2, -7), (14, -4), (4, -9), (-8, -4), (-18, -7), (-rx + 4, -7)], sweep=4.0)
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 20, cy - 30), (cx - 2, cy - 43), (cx + 16, cy - 40)], n=24)), C.tint(hair, 0.44), s.l(1.4))
    elif st == "sera":  # 中分刘海 + 兜帽（帽体在头发外层）
        bang = _bang(cx, cy, rx, ry, [(rx - 2, -7), (10, -4), (0, -2), (-10, -4), (-rx + 2, -7)])
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        hood = C.bez([(cx - rx - 12, cy + 30), (cx - rx - 18, cy - 18), (cx - 26, cy - ry - 9), (cx, cy - ry - 17), (cx + 26, cy - ry - 9), (cx + rx + 18, cy - 18), (cx + rx + 12, cy + 30), (cx + rx + 2, cy + 6), (cx, cy - 2), (cx - rx - 2, cy + 6)], n=76)
        C.poly(d, s.pts(hood), fill=C.rgb(sp["outfit"]), outline=C.shade(C.rgb(sp["outfit"]), 0.42), width=s.l(1.7))
        C.stroke(d, s.pts(C.bez([(cx - rx - 8, cy + 22), (cx - 22, cy - 10), (cx - 6, cy - ry + 1)], n=24)), C.alpha(C.tint(C.rgb(sp["outfit"]), 0.45), 170), s.l(1.4))
    elif st == "player":  # 男生碎刘海 + 耳机
        bang = _bang(cx, cy, rx, ry, [(rx - 4, -7), (16, -9), (8, -4), (-4, -9), (-14, -4), (-rx + 4, -7)])
        C.poly(d, s.pts(bang), fill=hair, outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 20, cy - 30), (cx - 4, cy - 44), (cx + 14, cy - 41)], n=24)), C.tint(hair, 0.40), s.l(1.4))


# ---------------------------------------------------------------- 五官


def _eye(d: ImageDraw.ImageDraw, sp: dict, s: _S, cx: float, cy: float, expr: str, flip: float = 1.0) -> None:
    skin = C.rgb(sp["skin"])
    iris = C.rgb(sp["eye"])
    dark = C.shade(C.rgb(sp["hair"]), 0.42)
    white = C.rgb("#fdf8f5")
    rx, ry = EYE_RX, EYE_RY
    if expr == HAPPY:  # 眯眼笑
        arc = C.bez([(cx - rx * flip, cy + 2), (cx - rx * 0.4 * flip, cy - 8), (cx + rx * 0.5 * flip, cy - 7), (cx + rx * flip, cy + 1)], n=32)
        C.stroke(d, s.pts(arc), dark, s.l(2.4))
        C.stroke(d, s.pts(C.bez([(cx - rx * 0.7 * flip, cy + 6), (cx, cy + 8), (cx + rx * 0.7 * flip, cy + 5)], n=20)), C.alpha(C.shade(skin, 0.78), 160), s.l(1.1))
        return
    if expr == CRISIS:  # 半睁细眼
        top, crx, cry = cy + 1.0, rx * 0.82, ry * 0.62
    else:
        top, crx, cry = cy - 7.0, rx, ry
    C.poly(d, s.pts(C.blob(cx, cy + 1.0, crx, cry, squash=0.05)), fill=white)
    irx, iry = cx + flip * 0.6, cy + 2.8
    C.poly(d, s.pts(C.blob(irx, iry, min(crx - 1.6, 7.4), min(cry + 0.6, 8.6))), fill=iris)
    C.poly(d, s.pts(C.blob(irx, iry + 2.6, min(crx - 2.8, 5.6), 4.2)), fill=C.tint(iris, 0.34))
    C.poly(d, s.pts(C.blob(irx, iry + 0.8, 3.0, 3.8)), fill=C.shade(iris, 0.30))
    d.ellipse(s.pts([(irx - 4.6, iry - 4.0), (irx - 0.6, iry - 0.6)]), fill=C.rgb("#ffffff"))
    d.ellipse(s.pts([(irx + 1.5, iry + 3.6), (irx + 3.6, iry + 5.5)]), fill=C.alpha(C.rgb("#ffffff"), 190))
    lash = C.bez(
        [(cx - (crx + 2.6) * flip, cy + 1.5), (cx - crx * 0.5 * flip, top - 3.6), (cx + crx * 0.5 * flip, top - 4.0), (cx + (crx + 1.6) * flip, cy + 0.2)],
        n=36,
    )
    C.stroke(d, s.pts(lash), dark, s.l(2.5))
    C.stroke(d, s.pts(C.bez([(cx + (crx + 1.4) * flip, cy - 0.8), (cx + (crx + 4.8) * flip, cy - 3.0), (cx + (crx + 6.4) * flip, cy - 7.0)], n=20)), dark, s.l(2.0))
    bot = cy + cry + 1.2
    C.stroke(d, s.pts(C.bez([(cx - 6 * flip, bot - 1.2), (cx, bot + 0.8), (cx + 6 * flip, bot - 1.8)], n=20)), C.alpha(C.shade(skin, 0.76), 170), s.l(1.1))


def _face(d: ImageDraw.ImageDraw, sp: dict, s: _S, expr: str) -> None:
    skin = C.rgb(sp["skin"])
    theme = C.rgb(sp["theme"])
    hair = C.rgb(sp["hair"])
    mouth_c = C.rgb("#c06a6c")
    brow = C.shade(hair, 0.72)
    for cx in (HEAD_CX - EYE_DX, HEAD_CX + EYE_DX):
        lift = -3.5 if expr == HAPPY else (-1.5 if expr == CRISIS else 0.0)
        arc = C.bez([(cx - 10, BROW_Y + 2 + lift), (cx, BROW_Y - 2 + lift), (cx + 10, BROW_Y + lift)], n=24)
        C.stroke(d, s.pts(arc), C.alpha(brow, 235), s.l(2.0))
    _eye(d, sp, s, HEAD_CX - EYE_DX, EYE_Y, expr, flip=1.0)
    _eye(d, sp, s, HEAD_CX + EYE_DX, EYE_Y, expr, flip=-1.0)
    C.stroke(d, s.pts([(HEAD_CX - 0.8, NOSE_Y - 1.5), (HEAD_CX + 0.8, NOSE_Y + 0.6), (HEAD_CX - 1.6, NOSE_Y + 1.2)]), C.alpha(C.shade(skin, 0.78), 190), s.l(1.1))
    if expr == HAPPY:
        mouth = C.bez([(HEAD_CX - 7.5, MOUTH_Y - 8), (HEAD_CX, MOUTH_Y + 1), (HEAD_CX + 7.5, MOUTH_Y - 8)], n=24)
        C.poly(d, s.pts(mouth + [(HEAD_CX + 7.5, MOUTH_Y - 8), (HEAD_CX - 7.5, MOUTH_Y - 8)]), fill=C.rgb("#a84e55"))
        C.stroke(d, s.pts(mouth), C.shade(mouth_c, 0.82), s.l(1.5))
        C.stroke(d, s.pts([(HEAD_CX - 5.5, MOUTH_Y - 6.4), (HEAD_CX + 5.5, MOUTH_Y - 6.4)]), C.alpha(C.rgb("#ffffff"), 210), s.l(1.2))
    elif expr == CRISIS:
        wave = [(HEAD_CX - 6.5, MOUTH_Y - 4), (HEAD_CX - 3, MOUTH_Y - 6), (HEAD_CX, MOUTH_Y - 3), (HEAD_CX + 3, MOUTH_Y - 6), (HEAD_CX + 6.5, MOUTH_Y - 4)]
        C.stroke(d, s.pts(C.bez(wave, n=48)), mouth_c, s.l(1.8))
    else:
        arc = C.bez([(HEAD_CX - 4.5, MOUTH_Y - 6), (HEAD_CX, MOUTH_Y - 3), (HEAD_CX + 4.5, MOUTH_Y - 6)], n=20)
        C.stroke(d, s.pts(arc), mouth_c, s.l(1.9))
    blush_a = {NORMAL: 46, HAPPY: 92, CRISIS: 84}[expr]
    blush_col = C.mix(C.tint(theme, 0.45), C.rgb("#ff9fa8"), 0.5)
    for cx in (HEAD_CX - 19, HEAD_CX + 19):
        C.poly(d, s.pts(C.blob(cx, BLUSH_Y - 2, 6.4, 3.4)), fill=C.alpha(blush_col, blush_a))
    if expr == HAPPY:
        for cx in (HEAD_CX - 21, HEAD_CX + 21):
            for i in range(3):
                x = cx - 3 + i * 3
                C.stroke(d, s.pts([(x, BLUSH_Y - 4), (x + 1.4, BLUSH_Y)]), C.alpha(C.rgb("#ffffff"), 110), s.l(0.9))
    if expr == CRISIS:  # 汗滴
        drop = C.bez([(HEAD_CX + 26, 70), (HEAD_CX + 30, 76), (HEAD_CX + 28, 81), (HEAD_CX + 24, 81), (HEAD_CX + 22, 76)], n=30)
        C.poly(d, s.pts(drop), fill=C.rgb("#bfe3ef"), outline=C.shade(C.rgb("#7fb6c9"), 0.8), width=s.l(1.0))


# ---------------------------------------------------------------- 头 / 颈 / 身体


def _head(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    skin = C.rgb(sp["skin"])
    line = C.shade(skin, 0.68)
    C.poly(d, s.pts(_head_path()), fill=skin, outline=C.alpha(line, 200), width=s.l(1.2))
    for sgn in (-1, 1):
        C.poly(d, s.pts(C.blob(HEAD_CX + sgn * (HEAD_RX - 2), HEAD_CY + 12, 3.2, 5.4)), fill=skin, outline=line, width=s.l(1.0))


def _body_base(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    skin = C.rgb(sp["skin"])
    line = C.shade(skin, 0.62)
    C.poly(d, s.pts([(HEAD_CX - NECK_HW, NECK_TOP), (HEAD_CX + NECK_HW, NECK_TOP), (HEAD_CX + NECK_HW, NECK_BOT), (HEAD_CX - NECK_HW, NECK_BOT)]), fill=C.shade(skin, 0.95))
    C.stroke(d, s.pts([(HEAD_CX - NECK_HW, NECK_TOP + 2), (HEAD_CX - NECK_HW, NECK_BOT)]), C.alpha(line, 170), s.l(1.1))
    C.stroke(d, s.pts([(HEAD_CX + NECK_HW, NECK_TOP + 2), (HEAD_CX + NECK_HW, NECK_BOT)]), C.alpha(line, 170), s.l(1.1))
    C.poly(d, s.pts(_torso_path()), fill=skin)
    C.stroke(d, s.pts(C.bez([(HEAD_CX - 12, SHOULDER_Y - 8), (HEAD_CX, SHOULDER_Y - 4), (HEAD_CX + 12, SHOULDER_Y - 8)], n=20)), C.alpha(C.shade(skin, 0.82), 120), s.l(1.0))


def _arm(d: ImageDraw.ImageDraw, sp: dict, s: _S, shoulder: tuple, elbow: tuple, hand: tuple, sleeve_hex: str, sleeve_len: float) -> None:
    skin = C.rgb(sp["skin"])
    skin_line = C.shade(skin, 0.62)
    sc = C.rgb(sleeve_hex)
    pts_full = C.bez([shoulder, elbow, hand], n=40)
    n_cut = int(len(pts_full) * max(0.0, min(1.0, sleeve_len)))
    if n_cut > 2:
        C.stroke(d, s.pts(pts_full[:n_cut]), sc, s.l(11.5))
    rest = pts_full[n_cut - 1 if n_cut > 0 else 0:]
    if len(rest) > 1:
        C.stroke(d, s.pts(rest), skin, s.l(7.6))
    cx, cy = hand
    C.poly(d, s.pts(C.blob(cx, cy, 4.8, 5.4)), fill=skin, outline=skin_line, width=s.l(1.1))


def _outfit(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    st = sp["style"]
    outfit = C.rgb(sp["outfit"])
    theme = C.rgb(sp["theme"])
    line = C.shade(outfit, 0.42)
    skin = C.rgb(sp["skin"])
    wl = s.l(1.5)
    cx = HEAD_CX
    body = _torso_path()

    if st == "lumi":  # 暖粉开衫 + 白色内搭 + 胸前系带 + 热可可
        C.poly(d, s.pts(body), fill=outfit, outline=line, width=wl)
        inner = C.bez(
            [(cx - 11, SHOULDER_Y - 14), (cx - 15, SHOULDER_Y + 20), (cx - 12, WAIST_Y), (cx - 10, WAIST_Y + 40), (cx - 9, BOTTOM),
             (cx + 9, BOTTOM), (cx + 10, WAIST_Y + 40), (cx + 12, WAIST_Y), (cx + 15, SHOULDER_Y + 20), (cx + 11, SHOULDER_Y - 14), (cx, SHOULDER_Y - 18)],
            n=70,
        )
        C.poly(d, s.pts(inner), fill=C.rgb("#fff2f4"))
        for sgn in (-1, 1):
            C.stroke(d, s.pts(C.bez([(cx + sgn * 11, SHOULDER_Y - 12), (cx + sgn * 14, SHOULDER_Y + 30), (cx + sgn * 11, WAIST_Y + 30)], n=26)), C.shade(outfit, 0.74), s.l(1.3))
        for y in (WAIST_Y - 18, WAIST_Y, WAIST_Y + 18):
            C.poly(d, s.pts(C.blob(cx, y, 2.1, 2.1)), fill=C.alpha(C.rgb("#ffffff"), 225))
        C.poly(d, s.pts(C.blob(cx, SHOULDER_Y - 6, 8.2, 4.8)), fill=theme, outline=C.shade(theme, 0.55), width=s.l(1.0))
        _arm(d, sp, s, (cx - SHOULDER_HW + 4, SHOULDER_Y + 4), (cx - SHOULDER_HW - 4, SHOULDER_Y + 44), (cx - 14, WAIST_Y - 12), sp["outfit"], 1.0)
        _arm(d, sp, s, (cx + SHOULDER_HW - 4, SHOULDER_Y + 4), (cx + SHOULDER_HW + 4, SHOULDER_Y + 44), (cx + 14, WAIST_Y - 12), sp["outfit"], 1.0)
        _mug(d, sp, s, (cx, WAIST_Y - 6))
    elif st == "vex":  # 松垮校服外套（露肩）+ 红丝带 + 指尖缠发
        C.poly(d, s.pts(body), fill=C.shade(outfit, 0.86), outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - SHOULDER_HW + 3, SHOULDER_Y + 4), (cx - 16, SHOULDER_Y + 40), (cx - 12, WAIST_Y + 10), (cx - 6, BOTTOM)], n=32)), line, s.l(1.3))
        C.stroke(d, s.pts(C.bez([(cx + SHOULDER_HW - 3, SHOULDER_Y + 4), (cx + 14, SHOULDER_Y + 34), (cx + 10, WAIST_Y + 6), (cx + 5, BOTTOM)], n=32)), line, s.l(1.3))
        C.poly(d, s.pts(C.blob(cx - SHOULDER_HW + 6, SHOULDER_Y + 2, 11, 6.4)), fill=skin, outline=C.shade(skin, 0.62), width=s.l(1.1))
        rib = C.rgb("#e0475f")
        C.poly(d, s.pts(C.blob(cx + 3, SHOULDER_Y + 4, 7.6, 5.2)), fill=rib, outline=C.shade(rib, 0.6), width=s.l(1.0))
        C.stroke(d, s.pts(C.bez([(cx + 3, SHOULDER_Y + 8), (cx - 1, SHOULDER_Y + 34), (cx + 4, WAIST_Y - 14)], n=24)), C.shade(rib, 0.85), s.l(1.5))
        _arm(d, sp, s, (cx - SHOULDER_HW + 4, SHOULDER_Y + 4), (cx - SHOULDER_HW - 1, SHOULDER_Y + 42), (cx - 19, WAIST_Y + 8), sp["outfit"], 0.9)
        _arm(d, sp, s, (cx + SHOULDER_HW - 4, SHOULDER_Y + 4), (cx + SHOULDER_HW + 4, SHOULDER_Y + 30), (cx + 24, HEAD_CY + 58), sp["outfit"], 0.55)
        C.stroke(d, s.pts(C.bez([(cx + 26, HEAD_CY + 56), (cx + 24, HEAD_CY + 40), (cx + 18, HEAD_CY + 30)], n=20)), C.rgb(sp["hair"]), s.l(2.2))
    elif st == "ada":  # 白大褂 + 深色内搭 + 全息平板
        C.poly(d, s.pts(body), fill=C.shade(C.rgb("#3b4250"), 0.92))
        inner = C.bez(
            [(cx - 11, SHOULDER_Y - 14), (cx - 15, SHOULDER_Y + 22), (cx - 13, WAIST_Y), (cx - 10, BOTTOM), (cx + 10, BOTTOM),
             (cx + 13, WAIST_Y), (cx + 15, SHOULDER_Y + 22), (cx + 11, SHOULDER_Y - 14), (cx, SHOULDER_Y - 18)],
            n=70,
        )
        C.poly(d, s.pts(inner), fill=C.shade(C.rgb("#2f3542"), 0.9))
        for sgn in (-1, 1):  # 白大褂门襟
            lapel = C.bez(
                [(cx + sgn * 11, SHOULDER_Y - 14), (cx + sgn * 19, SHOULDER_Y + 24), (cx + sgn * 15, WAIST_Y - 10),
                 (cx + sgn * 21, WAIST_Y + 40), (cx + sgn * 28, BOTTOM), (cx + sgn * 15, BOTTOM), (cx + sgn * 12, WAIST_Y + 30),
                 (cx + sgn * 15, WAIST_Y - 20), (cx + sgn * 10, SHOULDER_Y - 10)],
                n=70,
            )
            C.poly(d, s.pts(lapel), fill=outfit)
        C.stroke(d, s.pts(C.bez([(cx - 12, SHOULDER_Y - 12), (cx, SHOULDER_Y - 4), (cx + 12, SHOULDER_Y - 12)], n=24)), C.shade(outfit, 0.72), s.l(1.3))
        C.poly(d, s.pts(C.blob(cx, SHOULDER_Y - 8, 7.6, 4.4)), fill=theme, outline=C.shade(theme, 0.6), width=s.l(1.0))
        _tablet(d, sp, s, (cx, WAIST_Y - 14))
        _arm(d, sp, s, (cx - SHOULDER_HW + 3, SHOULDER_Y + 2), (cx - SHOULDER_HW - 2, SHOULDER_Y + 38), (cx - 16, WAIST_Y - 6), sp["outfit"], 1.0)
        _arm(d, sp, s, (cx + SHOULDER_HW - 3, SHOULDER_Y + 2), (cx + SHOULDER_HW + 2, SHOULDER_Y + 38), (cx + 16, WAIST_Y - 6), sp["outfit"], 1.0)
    elif st == "momo":  # 卫衣 + 抽绳 + 剪刀手
        C.poly(d, s.pts(body), fill=C.shade(outfit, 0.96), outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 14, SHOULDER_Y - 14), (cx, SHOULDER_Y - 4), (cx + 14, SHOULDER_Y - 14)], n=24)), C.shade(outfit, 0.62), s.l(1.7))
        for x in (cx - 6, cx + 6):
            C.stroke(d, s.pts([(x, SHOULDER_Y - 6), (x - 1.5, SHOULDER_Y + 10), (x + 1, SHOULDER_Y + 22)]), C.rgb("#fff3e0"), s.l(1.3))
            C.poly(d, s.pts(C.blob(x + 1, SHOULDER_Y + 23, 2.1, 2.1)), fill=C.rgb("#fff3e0"))
        C.poly(d, s.pts(C.blob(cx, WAIST_Y - 10, 14, 10)), fill=C.alpha(C.tint(theme, 0.22), 70))
        _peace_hand(d, sp, s, (cx + 27, HEAD_CY + 26))
        _arm(d, sp, s, (cx - SHOULDER_HW + 3, SHOULDER_Y + 2), (cx - SHOULDER_HW - 2, SHOULDER_Y + 42), (cx - 16, WAIST_Y - 2), sp["outfit"], 1.0)
    elif st == "sera":  # 斗篷 + 星饰
        cloak = C.bez(
            [(cx - SHOULDER_HW, SHOULDER_Y), (cx - SHOULDER_HW - 8, SHOULDER_Y + 20), (cx - SHOULDER_HW - 10, WAIST_Y - 12),
             (cx - SHOULDER_HW - 4, WAIST_Y + 30), (cx - HIP_HW - 2, BOTTOM), (cx + HIP_HW + 2, BOTTOM),
             (cx + SHOULDER_HW + 4, WAIST_Y + 30), (cx + SHOULDER_HW + 10, WAIST_Y - 12), (cx + SHOULDER_HW + 8, SHOULDER_Y + 20),
             (cx + SHOULDER_HW, SHOULDER_Y), (cx, SHOULDER_Y - 14)],
            n=84,
        )
        C.poly(d, s.pts(cloak), fill=C.shade(outfit, 0.84), outline=C.shade(outfit, 0.40), width=wl)
        C.stroke(d, s.pts(C.bez([(cx - SHOULDER_HW, SHOULDER_Y + 2), (cx, SHOULDER_Y + 14), (cx + SHOULDER_HW, SHOULDER_Y + 2)], n=30)), C.shade(outfit, 0.52), s.l(1.5))
        C.poly(d, s.pts(_star(cx, SHOULDER_Y - 2, 5.6)), fill=C.rgb("#ffe9a8"), outline=C.shade(C.rgb("#c9a24d"), 0.9), width=s.l(1.0))
        for sx, sy, r in ((cx - 20, WAIST_Y + 6, 3.4), (cx + 20, WAIST_Y + 20, 4.2), (cx - 10, WAIST_Y + 44, 2.8)):
            C.poly(d, s.pts(_star(sx, sy, r)), fill=C.alpha(C.rgb("#dfe6ff"), 200))
    elif st == "player":  # 连帽衫 + 口袋 + 耳机
        C.poly(d, s.pts(body), fill=outfit, outline=line, width=wl)
        C.stroke(d, s.pts(C.bez([(cx - 13, SHOULDER_Y - 14), (cx, SHOULDER_Y - 4), (cx + 13, SHOULDER_Y - 14)], n=24)), C.shade(outfit, 0.60), s.l(1.6))
        pocket = C.bez([(cx - 17, WAIST_Y + 14), (cx + 17, WAIST_Y + 14), (cx + 13, WAIST_Y + 38), (cx - 13, WAIST_Y + 38)], n=32)
        C.poly(d, s.pts(pocket), fill=C.shade(outfit, 0.88), outline=C.shade(outfit, 0.55), width=s.l(1.1))
        for x in (cx - 6, cx + 6):
            C.stroke(d, s.pts([(x, SHOULDER_Y - 8), (x - 1.5, SHOULDER_Y + 8), (x + 1, SHOULDER_Y + 18)]), C.rgb("#e8eef5"), s.l(1.3))
        _headphone(d, sp, s)
        _arm(d, sp, s, (cx - SHOULDER_HW + 3, SHOULDER_Y + 2), (cx - SHOULDER_HW - 3, SHOULDER_Y + 44), (cx - 12, WAIST_Y + 26), sp["outfit"], 1.0)
        _arm(d, sp, s, (cx + SHOULDER_HW - 3, SHOULDER_Y + 2), (cx + SHOULDER_HW + 3, SHOULDER_Y + 44), (cx + 12, WAIST_Y + 26), sp["outfit"], 1.0)

    # 侧缘明暗（风格卡·光照：单层 cel）
    C.stroke(d, s.pts(C.bez([(cx - SHOULDER_HW + 4, SHOULDER_Y + 6), (cx - WAIST_HW - 3, WAIST_Y), (cx - HIP_HW + 3, HIP_Y)], n=24)), C.alpha(C.tint(outfit, 0.34), 90), s.l(1.0))
    C.stroke(d, s.pts(C.bez([(cx + SHOULDER_HW - 4, SHOULDER_Y + 6), (cx + WAIST_HW + 3, WAIST_Y), (cx + HIP_HW - 3, HIP_Y)], n=24)), C.alpha(C.shade(outfit, 0.66), 90), s.l(1.0))


def _star(cx: float, cy: float, r: float) -> list:
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return C.bez(pts, n=8)


def _peace_hand(d: ImageDraw.ImageDraw, sp: dict, s: _S, pos: tuple) -> None:
    skin = C.rgb(sp["skin"])
    line = C.shade(skin, 0.62)
    cx, cy = pos
    C.stroke(d, s.pts([(cx - 2, cy + 13), (cx, cy + 3)]), skin, s.l(6.6))
    C.poly(d, s.pts(C.blob(cx, cy, 5.0, 4.6)), fill=skin, outline=line, width=s.l(1.1))
    for dx, dy in ((-3.0, -7.4), (2.6, -8.0)):
        C.stroke(d, s.pts([(cx + dx * 0.3, cy - 2.5), (cx + dx, cy + dy)]), skin, s.l(3.0))
        C.stroke(d, s.pts([(cx + dx * 0.3, cy - 2.5), (cx + dx, cy + dy)]), line, s.l(0.1))


def _mug(d: ImageDraw.ImageDraw, sp: dict, s: _S, pos: tuple) -> None:
    mug = C.rgb("#f6f1ea")
    line = C.shade(mug, 0.66)
    cx, cy = pos
    C.poly(d, s.pts(C.bez([(cx - 14, cy - 9), (cx + 14, cy - 9), (cx + 11, cy + 10), (cx - 11, cy + 10)], n=40)), fill=mug, outline=line, width=s.l(1.2))
    C.stroke(d, s.pts(C.bez([(cx + 14, cy - 5), (cx + 20, cy - 1), (cx + 14, cy + 5)], n=20)), line, s.l(1.5))
    d.ellipse(s.pts([(cx - 14, cy - 12), (cx + 14, cy - 6)]), fill=C.rgb("#6b4230"))
    for dx in (-5, 5):
        C.stroke(d, s.pts(C.bez([(cx + dx, cy - 17), (cx + dx + 3, cy - 23), (cx + dx - 2, cy - 29), (cx + dx + 2, cy - 34)], n=30)), C.alpha(C.rgb("#ffffff"), 110), s.l(1.3))


def _tablet(d: ImageDraw.ImageDraw, sp: dict, s: _S, pos: tuple) -> None:
    theme = C.rgb(sp["theme"])
    body = C.shade(C.rgb("#2c3140"), 0.9)
    cx, cy = pos
    pts = C.bez([(cx - 22, cy - 10), (cx + 22, cy - 13), (cx + 23, cy + 13), (cx - 21, cy + 16)], n=40)
    C.poly(d, s.pts(pts), fill=body, outline=C.shade(body, 0.5), width=s.l(1.2))
    inner = C.bez([(cx - 17, cy - 6), (cx + 17, cy - 9), (cx + 18, cy + 9), (cx - 16, cy + 12)], n=40)
    C.poly(d, s.pts(inner), fill=C.alpha(C.mix(theme, C.rgb("#0e1520"), 0.72), 235))
    for i, dy in enumerate((-3, 3, 8)):
        w_ = 12 + (i * 6) % 14
        C.stroke(d, s.pts([(cx - 13 + i * 2, cy + dy), (cx - 13 + i * 2 + w_, cy + dy - 1)]), C.alpha(C.tint(theme, 0.35), 210), s.l(1.5))


def _headphone(d: ImageDraw.ImageDraw, sp: dict, s: _S) -> None:
    band_c = C.rgb("#33333c")
    for sgn in (-1, 1):
        C.poly(d, s.pts(C.blob(HEAD_CX + sgn * (HEAD_RX + 1), HEAD_CY + 4, 5.2, 7.2)), fill=band_c, outline=C.shade(band_c, 0.6), width=s.l(1.0))
        C.poly(d, s.pts(C.blob(HEAD_CX + sgn * (HEAD_RX + 1), HEAD_CY + 4, 3.1, 4.8)), fill=C.rgb(sp["theme"]))
    C.stroke(d, s.pts(C.bez([(HEAD_CX - HEAD_RX - 1, HEAD_CY), (HEAD_CX - HEAD_RX + 4, HEAD_CY - HEAD_RY - 2), (HEAD_CX, HEAD_CY - HEAD_RY - 7), (HEAD_CX + HEAD_RX - 4, HEAD_CY - HEAD_RY - 2), (HEAD_CX + HEAD_RX + 1, HEAD_CY)], n=44)), band_c, s.l(3.0))


# ---------------------------------------------------------------- 顶层组装


def render(sp: dict, expr: str, size: tuple = (288, 384), ss: int = 2) -> Image.Image:
    """渲染立绘 / 表情差分。size 为最终输出像素，ss 为超采样倍率。"""
    w, h = size
    s = _S(w / DW * ss)
    W, H = round(DW * s.s), round(DH * s.s)

    img = _background(Image.new("RGBA", (W, H)), sp, s, expr)

    char = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(char)
    _hair_back(d, sp, s)
    _body_base(d, sp, s)
    _outfit(d, sp, s)
    _head(d, sp, s)
    _face(d, sp, s, expr)
    _hair_front(d, sp, s)

    rim_out, rim_in = C.rim_layers(char, C.rgb(sp["rim"]), spread=5, inner=4, opac_out=88, opac_in=74)
    img.alpha_composite(rim_out)
    img.alpha_composite(char)
    img.alpha_composite(rim_in)
    out = C.downscale(img, (w, h))
    out = C.grain(out, amount=4, seed=sp["seed"] + 11)
    return out
