# -*- coding: utf-8 -*-
"""artui —— UI 素材渲染器（面板 / 按钮 / 状态条 / 摇杆 / 标题与结局底图）。

UI 色板（风格卡 §一）：深底 #17131c→#241c2b、面板描边 #6b5a86（中性紫灰，兼容 5 位女友主题色）、
强调暖白 #fff3e6。主题色仍以人设卡 color 为唯一来源（UI 侧用 modulate/tint 上色，不另配色）。
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw, ImageFilter

import artcore as C

DEEP_TOP = C.rgb("#241c2b")
DEEP_BOT = C.rgb("#120e18")
PANEL_LINE = C.rgb("#6b5a86")
WARM = C.rgb("#fff3e6")


def _rounded(layer: Image.Image, box: tuple, radius: int, fill: tuple, outline: tuple, width: int) -> None:
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def _panel(w: int, h: int, radius: int, fill: tuple, line: tuple, width: int, shadow: int = 8) -> Image.Image:
    """九宫格面板：外投影 → 底 → 内侧高光。透明边缘留 shadow px。"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pad = shadow
    box = (pad, pad, w - pad - 1, h - pad - 1)
    # 外投影（alpha 渐隐，用多层同心圆角矩形近似）
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -1):
        a = int(70 * (1 - i / (shadow + 1)))
        d.rounded_rectangle([pad - i + 2, pad - i + 3, w - pad + i - 3, h - pad + i - 1], radius=radius + i, fill=(6, 4, 10, a))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(2)))
    # 底 + 描边
    _rounded(img, box, radius, fill, line, width)
    # 内侧顶部高光（细线，风格卡·光照：单层受光）
    d2 = ImageDraw.Draw(img)
    d2.rounded_rectangle(
        [box[0] + 3 * width, box[1] + width, box[2] - 3 * width, box[1] + width + max(2, width)],
        radius=max(1, width),
        fill=(255, 250, 240, 26),
    )
    return img


def dialog_panel(ss: int = 2) -> Image.Image:
    w, h = 192 * ss, 128 * ss
    img = _panel(w, h, 12 * ss, (24, 19, 32, 190), C.alpha(PANEL_LINE, 235), max(1, round(1.5 * ss)), shadow=8 * ss)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10 * ss, 10 * ss, w - 10 * ss, h - 10 * ss], radius=8 * ss, outline=C.alpha(WARM, 40), width=ss)
    return C.downscale(img, (192, 128))


def option_button(state: str, ss: int = 2) -> Image.Image:
    w, h = 192 * ss, 64 * ss
    if state == "hover":
        fill, line, glow = (46, 36, 62, 220), C.alpha(C.tint(PANEL_LINE, 0.45), 250), (255, 250, 240, 30)
    elif state == "active":
        fill, line, glow = (16, 12, 22, 228), C.alpha(C.tint(PANEL_LINE, 0.60), 250), (0, 0, 0, 46)
    else:
        fill, line, glow = (30, 24, 40, 205), C.alpha(PANEL_LINE, 220), (0, 0, 0, 0)
    img = _panel(w, h, 10 * ss, fill, line, max(1, round(1.2 * ss)), shadow=5 * ss)
    d = ImageDraw.Draw(img)
    if glow[3]:
        d.rounded_rectangle([6 * ss, 6 * ss, w - 6 * ss, h - 6 * ss], radius=7 * ss, fill=glow)
    if state == "active":  # 按下内阴影（下半部）
        d.rounded_rectangle([5 * ss, h // 2, w - 5 * ss, h - 5 * ss], radius=7 * ss, fill=glow)
    return C.downscale(img, (192, 64))


def bar_frame(ss: int = 2) -> Image.Image:
    w, h = 128 * ss, 20 * ss
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=9 * ss, fill=(10, 8, 14, 205), outline=C.alpha(PANEL_LINE, 200), width=ss)
    d.rounded_rectangle([2 * ss, 2 * ss, w - 2 * ss, h - 2 * ss], radius=7 * ss, outline=(255, 255, 255, 26), width=ss)
    return C.downscale(img, (128, 20))


def bar_fill(ss: int = 2) -> Image.Image:
    w, h = 96 * ss, 12 * ss
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = C.rgb("#5fc46f")
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=5 * ss, fill=base)
    d.rounded_rectangle([0, 0, w - 1, h // 2], radius=5 * ss, fill=C.tint(base, 0.30))
    d.rounded_rectangle([0, h - 3 * ss, w - 1, h - 1], radius=5 * ss, fill=C.shade(base, 0.72))
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=5 * ss, outline=C.alpha(C.shade(base, 0.5), 220), width=ss)
    return C.downscale(img, (96, 12))


def soft_shadow(ss: int = 2) -> Image.Image:
    size = 128 * ss
    img = C.glow(size, size, size / 2, size / 2, size / 2, (0, 0, 0, 150))
    return C.downscale(img, (128, 128))


def joystick(part: str, ss: int = 2) -> Image.Image:
    if part == "ring":
        size = 128 * ss
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        c = size / 2
        d.ellipse([c - 52 * ss, c - 52 * ss, c + 52 * ss, c + 52 * ss], fill=(24, 19, 32, 120), outline=C.alpha(PANEL_LINE, 220), width=2 * ss)
        d.ellipse([c - 44 * ss, c - 44 * ss, c + 44 * ss, c + 44 * ss], outline=(255, 255, 255, 30), width=ss)
        for i in range(4):  # 方向刻度
            a = math.pi / 2 * i
            x1 = c + 46 * ss * math.cos(a)
            y1 = c + 46 * ss * math.sin(a)
            x2 = c + 52 * ss * math.cos(a)
            y2 = c + 52 * ss * math.sin(a)
            d.line([x1, y1, x2, y2], fill=C.alpha(WARM, 120), width=2 * ss)
        return C.downscale(img, (128, 128))
    size = 64 * ss
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    d.ellipse([c - 26 * ss, c - 26 * ss, c + 26 * ss, c + 26 * ss], fill=(48, 40, 62, 235), outline=C.alpha(C.tint(PANEL_LINE, 0.4), 245), width=2 * ss)
    d.ellipse([c - 18 * ss, c - 20 * ss, c + 6 * ss, c - 2 * ss], fill=(255, 255, 255, 40))
    return C.downscale(img, (64, 64))


def _full_bg(kind: str, ss: int = 2) -> Image.Image:
    w, h = 640 * ss, 360 * ss
    img = C.vgrad(w, h, C.mix(DEEP_TOP, C.rgb("#2c2338"), 0.4), DEEP_BOT)
    # 主题色光球（5 位女友 = 5 个主题色光晕，呼应「被包围」）
    themes = ["#ff9e9e", "#b28dff", "#7ad0c9", "#ffb35c", "#8fa8ff"]
    d = ImageDraw.Draw(img)
    for i, t in enumerate(themes):
        cx = w * (0.14 + 0.18 * i)
        cy = h * (0.30 if kind == "title" else 0.34) + (10 * ss if i % 2 else -8 * ss)
        img.alpha_composite(C.glow(w, h, cx, cy, 58 * ss, C.alpha(C.rgb(t), 120)))
    # 星点
    C.bokeh(img, C.rgb("#ffffff"), count=90, seed=5 if kind == "title" else 9, rmin=0.6 * ss, rmax=1.8 * ss, alpha_max=150)
    C.bokeh(img, C.tint(C.rgb("#b28dff"), 0.3), count=26, seed=21, rmin=1.5 * ss, rmax=4.5 * ss, alpha_max=34)
    d2 = ImageDraw.Draw(img)
    if kind == "title":
        # 远景城市剪影 + 顶部标题光带
        base_y = h * 0.80
        import random

        rng = random.Random(12)
        x = 0
        while x < w:
            bw = rng.uniform(24 * ss, 62 * ss)
            bh = rng.uniform(28 * ss, 120 * ss)
            d2.rectangle([x, base_y - bh, x + bw, h], fill=(14, 11, 20, 255))
            for wy in range(int(base_y - bh) + 6 * ss, int(h) - 6 * ss, 12 * ss):  # 零星灯窗
                if rng.random() < 0.16:
                    d2.rectangle([x + 4 * ss, wy, x + bw - 4 * ss, wy + 3 * ss], fill=(255, 214, 150, 70))
            x += bw + rng.uniform(2 * ss, 10 * ss)
        img.alpha_composite(C.glow(w, h, w / 2, h * 0.24, 190 * ss, C.alpha(WARM, 40)))
    else:
        # 结局：地平光带 + 上升光尘
        d2.line([(0, h * 0.72), (w, h * 0.72)], fill=C.alpha(WARM, 40), width=2 * ss)
        img.alpha_composite(C.glow(w, h, w / 2, h * 0.72, 240 * ss, C.alpha(WARM, 34)))
    return C.vignette(C.downscale(img, (640, 360)), strength=0.42)


def build_all(out_dir: str, ss: int = 2) -> dict:
    import os

    os.makedirs(out_dir, exist_ok=True)
    import artcore as C

    jobs = {
        "dialog-panel.png": dialog_panel(ss),
        "option-button.png": option_button("normal", ss),
        "option-button-hover.png": option_button("hover", ss),
        "option-button-active.png": option_button("active", ss),
        "bar-frame.png": bar_frame(ss),
        "bar-fill.png": bar_fill(ss),
        "soft-shadow.png": soft_shadow(ss),
        "joystick-ring.png": joystick("ring", ss),
        "joystick-knob.png": joystick("knob", ss),
        "title-bg.png": _full_bg("title", ss),
        "ending-bg.png": _full_bg("ending", ss),
    }
    sizes = {}
    for name, img in jobs.items():
        path = os.path.join(out_dir, name)
        if name.endswith("bg.png"):
            sizes[name] = C.save_full(img, path, 256)
        else:
            sizes[name] = C.save_rgba(img, path)
    return sizes
