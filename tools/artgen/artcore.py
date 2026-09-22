# -*- coding: utf-8 -*-
"""artcore —— 美术生成器共享基元层。

风格卡（唯一视觉事实源）见 `.myrd/blackboard/assets.md` §一：
调色板三级 / 柔和逆光单层 cel / 细描边（禁纯黑）/ 统一比例。
本模块只实现四要素与通用后期，不含任何角色设定（角色设定在 generate.py）。

所有绘制在 2x 超采样画布上完成，最终 LANCZOS 降采样，保证轮廓平滑。
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

# ---------------------------------------------------------------- 颜色（风格卡 §一）


def rgb(s: str, a: int = 255) -> tuple:
    """'#rrggbb' → (r,g,b,a)"""
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def mix(c1: tuple, c2: tuple, t: float) -> tuple:
    return (
        round(c1[0] + (c2[0] - c1[0]) * t),
        round(c1[1] + (c2[1] - c1[1]) * t),
        round(c1[2] + (c2[2] - c1[2]) * t),
        round(c1[3] + (c2[3] - c1[3]) * t),
    )


def shade(c: tuple, f: float) -> tuple:
    """变暗（cel 阴影 / 描边色）。f<1 变暗。"""
    return (round(c[0] * f), round(c[1] * f), round(c[2] * f), c[3])


def tint(c: tuple, f: float) -> tuple:
    """向暖白提亮（受光面 / rim）。"""
    return mix(c, (255, 250, 244, c[3]), f)


def alpha(c: tuple, a: int) -> tuple:
    return (c[0], c[1], c[2], a)


# ---------------------------------------------------------------- 画布与渐变


def canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def vgrad(w: int, h: int, top: tuple, bot: tuple) -> Image.Image:
    """垂直渐变底（风格卡：背景 = 辅色渐变）。"""
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    a = np.array(top[:3], dtype=np.float32)
    b = np.array(bot[:3], dtype=np.float32)
    rgb_ = a[None, None, :] * (1.0 - t)[:, :, None] + b[None, None, :] * t[:, :, None]
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[..., :3] = np.clip(rgb_, 0, 255).astype(np.uint8)
    arr[..., 3] = 255
    return Image.fromarray(arr, "RGBA")


def glow(w: int, h: int, cx: float, cy: float, r: float, color: tuple, strength: float = 1.0) -> Image.Image:
    """径向辉光 halo（风格卡：主题色 halo，半径 = 头宽 × 2.2）。"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(r, 1.0)
    f = np.clip(1.0 - d, 0.0, 1.0) ** 2 * strength
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = np.clip(color[i] * f, 0, 255).astype(np.uint8)
    arr[..., 3] = np.clip(color[3] * f, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def bokeh(img: Image.Image, color: tuple, count: int, seed: int, rmin: float, rmax: float, alpha_max: int = 26) -> None:
    """背景散景粒子（克制：低透明度，不抢主体）。"""
    import random

    rng = random.Random(seed)
    d = ImageDraw.Draw(img)
    w, h = img.size
    for _ in range(count):
        r = rng.uniform(rmin, rmax)
        x = rng.uniform(-r, w + r)
        y = rng.uniform(-r, h + r)
        a = int(alpha_max * rng.uniform(0.35, 1.0))
        d.ellipse([x - r, y - r, x + r, y + r], fill=alpha(color, a))


# ---------------------------------------------------------------- 几何与描边


def bez(pts: list, n: int = 64) -> list:
    """de Casteljau 贝塞尔采样（任意阶），返回折线点列。"""
    out = []
    m = len(pts) - 1
    for i in range(n + 1):
        t = i / n
        p = [(float(x), float(y)) for x, y in pts]
        for _ in range(m):
            p = [
                (p[j][0] + (p[j + 1][0] - p[j][0]) * t, p[j][1] + (p[j + 1][1] - p[j][1]) * t)
                for j in range(len(p) - 1)
            ]
        out.append(p[0])
    return out


def blob(cx: float, cy: float, rx: float, ry: float, n: int = 72, phase: float = 0.0, squash: float = 0.0) -> list:
    """椭圆（可微压扁）闭合点列。squash>0 = 上宽下窄（用于发型/衣摆）。"""
    pts = []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        k = 1.0 + squash * math.sin(a + phase)
        pts.append((cx + rx * math.cos(a) * k, cy + ry * math.sin(a)))
    return pts


def _iw(width) -> int:
    """描边宽度取整（PIL 要求 int），最小 1。"""
    return max(1, int(round(width)))


def poly(d: ImageDraw.ImageDraw, pts: list, fill=None, outline=None, width: int = 0, closed: bool = True) -> None:
    """填充 +（可选）平滑描边：描边走 line(joint='curve') 避免锯齿接缝。"""
    if fill is not None:
        d.polygon([(round(x), round(y)) for x, y in pts], fill=fill)
    if outline is not None and width > 0:
        line = [(round(x), round(y)) for x, y in pts] + ([(round(pts[0][0]), round(pts[0][1]))] if closed else [])
        d.line(line, fill=outline, width=_iw(width), joint="curve")


def stroke(d: ImageDraw.ImageDraw, pts: list, color: tuple, width: int, closed: bool = False) -> None:
    line = [(round(x), round(y)) for x, y in pts] + ([(round(pts[0][0]), round(pts[0][1]))] if closed else [])
    d.line(line, fill=color, width=_iw(width), joint="curve")


# ---------------------------------------------------------------- cel 阴影（单层，风格卡 §一·光照）


def shadow_in(base: Image.Image, offset: tuple, color: tuple, opac: float = 0.55, blur: int = 0) -> Image.Image:
    """在 base 的 alpha 形状内，向 offset 方向压一层 cel 阴影。

    base：已画好底色的 RGBA 形状层；offset：阴影偏移（px，指向受光反方向）。
    返回叠加阴影后的副本。
    """
    mask = base.split()[3]
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rectangle([0, 0, w, h], fill=alpha(color, int(255 * opac)))
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    shifted_mask = Image.new("L", (w, h), 0)
    shifted_mask.paste(mask, (int(offset[0]), int(offset[1])))
    inner = ImageChops.multiply(mask, shifted_mask)
    layer.putalpha(ImageChops.multiply(layer.split()[3], inner))
    out = base.copy()
    out.alpha_composite(layer)
    return out


# ---------------------------------------------------------------- 轮廓光（柔和逆光）


def rim_layers(char: Image.Image, color: tuple, spread: int = 7, inner: int = 5, opac_out: int = 150, opac_in: int = 95) -> tuple:
    """由剪影派生外轮廓光 + 内缘受光两层。

    返回 (rim_out, rim_in)：rim_out 画在角色**后面**（外扩光圈），rim_in 叠在角色上面（内缘受光带）。
    方向：内缘光带按左上 135° 主光加权（风格卡·光照）。
    """
    a = char.split()[3]
    w, h = char.size
    dil = a.filter(ImageFilter.MaxFilter(spread * 2 + 1))
    outer_mask = ImageChops.subtract(dil, a).filter(ImageFilter.GaussianBlur(2))
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    m = np.asarray(outer_mask, dtype=np.float32) / 255.0
    for i in range(3):
        arr[..., i] = int(color[:3][i])
    arr[..., 3] = np.clip(m * opac_out, 0, 255).astype(np.uint8)
    rim_out = Image.fromarray(arr, "RGBA")

    ero = a.filter(ImageFilter.MinFilter(inner * 2 + 1))
    inner_mask = ImageChops.subtract(a, ero)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(w - 1, 1) - 0.5) * 2.0
    ny = (yy / max(h - 1, 1) - 0.5) * 2.0
    light = np.clip(0.5 - (nx + ny) * 0.5, 0.0, 1.0)  # 左上最亮
    arr2 = np.zeros((h, w, 4), dtype=np.uint8)
    for i in range(3):
        arr2[..., i] = int(color[:3][i])
    arr2[..., 3] = np.clip((np.asarray(inner_mask, np.float32) / 255.0) * (0.35 + 0.65 * light) * opac_in, 0, 255).astype(
        np.uint8
    )
    rim_in = Image.fromarray(arr2, "RGBA")
    return rim_out, rim_in


# ---------------------------------------------------------------- 后期


def vignette(img: Image.Image, strength: float = 0.35, color: tuple = (10, 8, 16)) -> Image.Image:
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(w - 1, 1) - 0.5) * 2.0
    ny = (yy / max(h - 1, 1) - 0.5) * 2.0
    d = np.sqrt(nx * nx + ny * ny) / 1.4142
    f = np.clip(d - 0.5, 0, 1) / 0.5 * strength
    arr = np.asarray(img).astype(np.float32)
    col = np.array(color[:3], dtype=np.float32)
    arr[..., :3] = arr[..., :3] * (1.0 - f[..., None]) + col[None, None, :] * f[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def edge_tint(img: Image.Image, color: tuple, strength: float = 0.4) -> Image.Image:
    """四边色晕（crisis 档专用：红色边缘危机感）。"""
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = np.abs(xx / max(w - 1, 1) - 0.5) * 2.0
    ny = np.abs(yy / max(h - 1, 1) - 0.5) * 2.0
    f = np.clip(np.maximum(nx, ny) - 0.45, 0, 1) / 0.55 * strength
    arr = np.asarray(img).astype(np.float32)
    col = np.array(color[:3], dtype=np.float32)
    a = f[..., None]
    arr[..., :3] = arr[..., :3] * (1 - a) + col[None, None, :] * a
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def grain(img: Image.Image, amount: int = 5, seed: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    arr = np.asarray(img).astype(np.int16)
    n = rng.integers(-amount, amount + 1, size=arr.shape[:2])
    arr[..., :3] = np.clip(arr[..., :3] + n[..., None], 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def downscale(img: Image.Image, size: tuple) -> Image.Image:
    return img.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------- 导出（风格卡 §三：PNG-8 调色板）


def save_palette(img: Image.Image, path: str, colors: int = 128) -> int:
    """PNG-8 调色板导出（保留边缘半透明），返回字节数。"""
    rgba = img.convert("RGBA")
    q = rgba.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(path, optimize=True)
    import os

    return os.path.getsize(path)


def save_rgba(img: Image.Image, path: str) -> int:
    """真 RGBA PNG（不量化）：用于带平滑半透明的 UI 九宫格件（量化会破坏 alpha 层级）。"""
    import os

    img.convert("RGBA").save(path, optimize=True)
    return os.path.getsize(path)


def save_full(img: Image.Image, path: str, colors: int = 256) -> int:
    """全屏底图导出（256 色调色板）。"""
    import os

    rgba = img.convert("RGBA")
    q = rgba.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(path, optimize=True)
    return os.path.getsize(path)
