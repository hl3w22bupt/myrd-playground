#!/usr/bin/env python3
"""Chibi 立绘/精灵帧渲染库（gen_sprites.py 的底层）。

所有形象派生自人设卡 portrait_prompt（美术单一事实源），本库不含任何角色名——
角色特征（发色/发型/服装/瞳色/道具）由调用方从 portrait_prompt 解析后以参数传入。

坐标基准：viewBox 0 0 48 64，地面 y≈60，头心 (24,20)。
姿态参数（pose dict）：
  bob       躯干/头部整体下沉量（呼吸/步行起伏）
  leg_l/leg_r  左右腿摆动相位（-1 后摆 .. +1 前摆）
  arm_l/arm_r  左右臂摆动相位
  lean      躯干前倾（walk 时轻微）
  blink     眨眼（0 睁眼 / 1 半闭）
  face_turn 朝向偏移（-1 左 .. +1 右，用于转身过渡帧的视觉暗示）
"""

from __future__ import annotations

import math


def _g(id_: str, stops: list[tuple[float, str, float]], vertical: bool = True) -> str:
    x2, y2 = ("0%", "100%") if vertical else ("100%", "0%")
    body = "".join(
        f'<stop offset="{int(o*100)}%" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops
    )
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="{y2}">{body}</linearGradient>'


def _limb(x1: float, y1: float, x2: float, y2: float, w: float, color: str) -> str:
    return (
        f'<path d="M{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f}" stroke="{color}" '
        f'stroke-width="{w:.1f}" stroke-linecap="round" fill="none"/>'
    )


def _leg(pose: dict, side: int, hip_x: float, hip_y: float, color: str, shoe: str) -> str:
    """腿：髋→膝→踝两段，stride 为摆动幅度（±4.2px），抬起时踝上提。"""
    stride = pose.get("leg_l" if side < 0 else "leg_r", 0.0) * 4.2
    knee_x = hip_x + stride * 0.45
    knee_y = hip_y + 5.2 - abs(stride) * 0.18
    foot_x = hip_x + stride
    foot_y = 57.6 - max(0.0, stride) * 1.5
    parts = [
        _limb(hip_x, hip_y, knee_x, knee_y, 3.4, color),
        _limb(knee_x, knee_y, foot_x, foot_y, 3.0, color),
        f'<ellipse cx="{foot_x + 0.4:.1f}" cy="{foot_y + 0.9:.1f}" rx="2.7" ry="1.6" fill="{shoe}"/>',
    ]
    return "".join(parts)


def _arm(pose: dict, side: int, shoulder_x: float, shoulder_y: float, color: str, hand: str) -> str:
    swing = pose.get("arm_l" if side < 0 else "arm_r", 0.0) * 3.6
    elbow_x = shoulder_x + side * 1.6 + swing * 0.4
    elbow_y = shoulder_y + 4.6
    hand_x = elbow_x + side * 0.9 + swing
    hand_y = elbow_y + 4.4 - abs(swing) * 0.25
    return (
        _limb(shoulder_x, shoulder_y, elbow_x, elbow_y, 3.2, color)
        + _limb(elbow_x, elbow_y, hand_x, hand_y, 2.8, color)
        + f'<circle cx="{hand_x:.1f}" cy="{hand_y:.1f}" r="1.7" fill="{hand}"/>'
    )


def chibi_frame(
    palette: dict,
    hair_style: str,
    accessories: list[str],
    pose: dict | None = None,
) -> str:
    """渲染一帧 48×64 chibi。palette/sprite_lib 不认识角色，只认识颜色与形状参数。"""
    pose = pose or {}
    bob = pose.get("bob", 0.0)
    lean = pose.get("lean", 0.0)
    blink = pose.get("blink", 0.0)
    turn = pose.get("face_turn", 0.0)
    skin = palette["skin"]
    skin_hi = palette["skin_hi"]
    hair_a, hair_b = palette["hair_a"], palette["hair_b"]
    fit_a, fit_b = palette["fit_a"], palette["fit_b"]
    fit_dark = palette["fit_dark"]
    leg_color = palette["leg"]
    shoe = palette["shoe"]
    iris = palette["iris"]
    accent = palette["accent"]
    head_cy = 20.0 + bob * 0.55
    tor_y = 33.5 + bob
    defs = "".join([
        _g("g_skin", [(0.0, skin_hi, 1.0), (1.0, skin, 1.0)]),
        _g("g_hair", [(0.0, hair_a, 1.0), (1.0, hair_b, 1.0)]),
        _g("g_fit", [(0.0, fit_a, 1.0), (1.0, fit_b, 1.0)]),
        _g("g_leg", [(0.0, fit_dark, 1.0), (1.0, leg_color, 1.0)]),
    ])
    p: list[str] = []
    # 地面软阴影
    p.append('<ellipse cx="24" cy="60.6" rx="11.5" ry="2.4" fill="#10101c" opacity="0.28"/>')
    # 后发（长发在身后铺开；短发贴头；双马尾在头后两侧）
    p.append(_back_hair(hair_style, head_cy, hair_b))
    # 腿（远侧先画）
    p.append(_leg(pose, 1, 26.6, tor_y + 12.5, "url(#g_leg)", shoe))
    # 裙摆 / 下摆
    p.append(
        f'<path d="M16.2 {tor_y + 9.2} L31.8 {tor_y + 9.2} L34.2 {tor_y + 14.6} '
        f'Q24 {tor_y + 16.4} 13.8 {tor_y + 14.6} Z" fill="url(#g_fit)"/>'
    )
    # 近侧腿
    p.append(_leg(pose, -1, 21.4, tor_y + 12.5, "url(#g_leg)", shoe))
    # 躯干（walk 前倾：水平轻移）
    shift = lean * 0.9
    p.append(
        f'<path d="M16.6 {tor_y + 10.2} Q15.4 {tor_y + 2.2} 18.6 {tor_y - 0.4} '
        f'L29.4 {tor_y - 0.4} Q32.6 {tor_y + 2.2} 31.4 {tor_y + 10.2} '
        f'Q24 {tor_y + 12.2} 16.6 {tor_y + 10.2} Z" fill="url(#g_fit)" '
        f'transform="translate({shift:.2f} 0)"/>'
    )
    # 领口 / 胸前装饰线
    p.append(
        f'<path d="M20.4 {tor_y - 0.2} Q24 {tor_y + 2.6} 27.6 {tor_y - 0.2}" stroke="{fit_dark}" '
        f'stroke-width="1.1" fill="none" transform="translate({shift:.2f} 0)"/>'
    )
    p.append(
        f'<circle cx="24" cy="{tor_y + 5.4:.1f}" r="1.25" fill="{accent}" opacity="0.95" '
        f'transform="translate({shift:.2f} 0)"/>'
    )
    # 手臂（近侧最后画，覆盖躯干边缘）
    p.append(_arm(pose, 1, 30.6 + shift, tor_y + 1.6, fit_dark, skin))
    p.append(_arm(pose, -1, 17.4 + shift, tor_y + 1.6, "url(#g_fit)", skin))
    # 头
    p.append(
        f'<circle cx="24" cy="{head_cy:.1f}" r="13.1" fill="url(#g_skin)" '
        f'stroke="#caa08a" stroke-width="0.5"/>'
    )
    # 前发 + 表情
    p.append(_front_hair(hair_style, head_cy, hair_a, hair_b))
    p.append(_face(head_cy, iris, blink, turn))
    # 道具 / 配饰（派生自 portrait_prompt 关键词）
    for acc in accessories:
        p.append(_accessory(acc, head_cy, tor_y, palette))
    body = "".join(p)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" '
        f'viewBox="0 0 48 64"><defs>{defs}</defs>{body}</svg>'
    )


def _back_hair(style: str, head_cy: float, color: str) -> str:
    cy = head_cy
    if style == "twin":
        tails = "".join(
            f'<path d="M{24 + s * 10.5:.1f} {cy - 3:.1f} Q{24 + s * 19:.1f} {cy + 5:.1f} '
            f'{24 + s * 16.5:.1f} {cy + 21:.1f} Q{24 + s * 14:.1f} {cy + 27:.1f} '
            f'{24 + s * 12:.1f} {cy + 21:.1f} Q{24 + s * 14.5:.1f} {cy + 8:.1f} '
            f'{24 + s * 8:.1f} {cy + 2:.1f} Z" fill="{color}"/>'
            for s in (-1, 1)
        )
        return tails + f'<circle cx="24" cy="{cy:.1f}" r="13.6" fill="{color}"/>'
    if style == "long":
        return (
            f'<path d="M24 {cy - 14.5:.1f} Q8.5 {cy - 12:.1f} 10.5 {cy + 8:.1f} '
            f'Q11.5 {cy + 22:.1f} 15.5 {cy + 30:.1f} L18.5 {cy + 27:.1f} '
            f'L18 {cy + 8:.1f} Z" fill="{color}"/>'
            f'<path d="M24 {cy - 14.5:.1f} Q39.5 {cy - 12:.1f} 37.5 {cy + 8:.1f} '
            f'Q36.5 {cy + 22:.1f} 32.5 {cy + 30:.1f} L29.5 {cy + 27:.1f} '
            f'L30 {cy + 8:.1f} Z" fill="{color}"/>'
        )
    # short：贴头短发 + 微翘发尾
    return (
        f'<path d="M24 {cy - 14.8:.1f} Q7.5 {cy - 13:.1f} 9.5 {cy + 5:.1f} '
        f'Q10 {cy + 11:.1f} 13 {cy + 13.5:.1f} L13 {cy + 3:.1f} Z" fill="{color}"/>'
        f'<path d="M24 {cy - 14.8:.1f} Q40.5 {cy - 13:.1f} 38.5 {cy + 5:.1f} '
        f'Q38 {cy + 11:.1f} 35 {cy + 13.5:.1f} L35 {cy + 3:.1f} Z" fill="{color}"/>'
    )


def _front_hair(style: str, head_cy: float, color_a: str, color_b: str) -> str:
    cy = head_cy
    base = (
        f'<path d="M11.6 {cy + 1:.1f} Q10.5 {cy - 12.5:.1f} 24 {cy - 13.6:.1f} '
        f'Q37.5 {cy - 12.5:.1f} 36.4 {cy + 1:.1f} '
        f'Q33.5 {cy - 4.5:.1f} 29.5 {cy - 3.2:.1f} '
        f'Q27.5 {cy - 7.5:.1f} 23.5 {cy - 5.5:.1f} '
        f'Q18.5 {cy - 8.5:.1f} 15.5 {cy - 2.8:.1f} '
        f'Q13.5 {cy - 1.5:.1f} 11.6 {cy + 1:.1f} Z" fill="url(#g_hair)"/>'
    )
    sheen = (
        f'<path d="M15 {cy - 6.5:.1f} Q20 {cy - 11.5:.1f} 28 {cy - 10.5:.1f}" '
        f'stroke="#ffffff" stroke-width="1.5" opacity="0.35" fill="none" stroke-linecap="round"/>'
    )
    extra = ""
    if style == "twin":
        extra = (
            f'<circle cx="12.6" cy="{cy - 6.5:.1f}" r="2.0" fill="{color_b}"/>'
            f'<circle cx="35.4" cy="{cy - 6.5:.1f}" r="2.0" fill="{color_b}"/>'
        )
    elif style == "long":
        extra = (
            f'<path d="M13.8 {cy + 1:.1f} Q12.2 {cy + 9:.1f} 14.6 {cy + 15:.1f}" '
            f'stroke="{color_b}" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
            f'<path d="M34.2 {cy + 1:.1f} Q35.8 {cy + 9:.1f} 33.4 {cy + 15:.1f}" '
            f'stroke="{color_b}" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
        )
    return base + sheen + extra


def _face(head_cy: float, iris: str, blink: float, turn: float) -> str:
    cy = head_cy
    ex = 5.1 - turn * 1.1
    eye_h = 2.9 * (1.0 - blink * 0.82)
    eyes = ""
    for s in (-1, 1):
        cx = 24 + s * ex
        if eye_h < 0.9:
            eyes += (
                f'<path d="M{cx - 1.9:.1f} {cy + 1.4:.1f} Q{cx:.1f} {cy + 2.4:.1f} '
                f'{cx + 1.9:.1f} {cy + 1.4:.1f}" stroke="#3a2c30" stroke-width="1.0" '
                f'fill="none" stroke-linecap="round"/>'
            )
        else:
            eyes += (
                f'<ellipse cx="{cx:.1f}" cy="{cy + 1.5:.1f}" rx="1.95" ry="{eye_h:.2f}" fill="{iris}"/>'
                f'<ellipse cx="{cx:.1f}" cy="{cy + 1.5:.1f}" rx="1.95" ry="{eye_h:.2f}" fill="none" '
                f'stroke="#3a2c30" stroke-width="0.55"/>'
                f'<circle cx="{cx - 0.55:.1f}" cy="{cy + 0.75:.1f}" r="0.62" fill="#ffffff" opacity="0.95"/>'
            )
    mouth = (
        f'<path d="M22.6 {cy + 6.4:.1f} Q24 {cy + 7.6:.1f} 25.4 {cy + 6.4:.1f}" '
        f'stroke="#b4705e" stroke-width="0.95" fill="none" stroke-linecap="round"/>'
    )
    blush = "".join(
        f'<ellipse cx="{24 + s * 8.0:.1f}" cy="{cy + 5.2:.1f}" rx="2.1" ry="1.15" '
        f'fill="#ff9d9d" opacity="0.5"/>'
        for s in (-1, 1)
    )
    return eyes + blush + mouth


def _accessory(kind: str, head_cy: float, tor_y: float, palette: dict) -> str:
    cy, ty = head_cy, tor_y
    if kind == "cup":
        return (
            f'<g transform="translate({30.2:.1f} {ty + 3.4:.1f})">'
            f'<rect x="-2.6" y="-2.2" width="5.2" height="4.4" rx="1.0" fill="#f7f2ea" '
            f'stroke="#c9b8a4" stroke-width="0.5"/>'
            f'<path d="M2.6 -0.9 Q4.6 -0.5 2.6 1.1" stroke="#c9b8a4" stroke-width="0.8" fill="none"/>'
            f'<path d="M-1.4 3.9 L1.4 3.9 L1.0 5.4 L-1.0 5.4 Z" fill="#8a5a3c"/>'
            f'<path d="M-1.2 -2.6 Q0 -4.4 1.2 -2.6" stroke="#ffffff" stroke-width="0.7" '
            f'fill="none" opacity="0.8"/></g>'
        )
    if kind == "tablet":
        return (
            f'<g transform="translate({33.0:.1f} {ty + 4.2:.1f}) rotate(12)">'
            f'<rect x="-3.0" y="-2.2" width="6.0" height="4.4" rx="0.8" fill="#0f2733" '
            f'stroke="{palette["iris"]}" stroke-width="0.6"/>'
            f'<path d="M-2.0 -0.6 L2.0 -0.6 M-2.0 0.7 L0.6 0.7" stroke="{palette["iris"]}" '
            f'stroke-width="0.55" opacity="0.9"/></g>'
        )
    if kind == "star":
        star = ""
        for s in (-1, 1):
            sx, sy = 24 + s * 10.6, cy - 8.6
            pts = " ".join(
                f"{sx + 2.1 * math.cos(math.radians(a)):.1f} {sy + 2.1 * math.sin(math.radians(a)):.1f}"
                for a in range(-90, 270, 144)
            )
            star += f'<polygon points="{pts}" fill="#ffe27a" stroke="#e0b64f" stroke-width="0.4"/>'
        return star
    if kind == "headphone":
        return (
            f'<path d="M13.4 {cy - 1.5:.1f} Q24 {cy - 18.5:.1f} 34.6 {cy - 1.5:.1f}" '
            f'stroke="{palette["accent"]}" stroke-width="1.7" fill="none" stroke-linecap="round"/>'
            f'<rect x="{11.4:.1f}" y="{cy - 2.4:.1f}" width="3.6" height="5.2" rx="1.6" '
            f'fill="{palette["accent"]}"/>'
            f'<rect x="{33.0:.1f}" y="{cy - 2.4:.1f}" width="3.6" height="5.2" rx="1.6" '
            f'fill="{palette["accent"]}"/>'
        )
    if kind == "strands":
        return (
            f'<path d="M31.5 {cy + 7.5:.1f} Q34.5 {cy + 12:.1f} 32.2 {cy + 18:.1f}" '
            f'stroke="{palette["hair_a"]}" stroke-width="1.1" fill="none" stroke-linecap="round" '
            f'opacity="0.9"/>'
        )
    if kind == "sparkle":
        return (
            f'<circle cx="36.5" cy="{cy - 11:.1f}" r="0.9" fill="#cfe0ff" opacity="0.9"/>'
            f'<circle cx="10.5" cy="{cy - 13.5:.1f}" r="0.7" fill="#cfe0ff" opacity="0.75"/>'
        )
    return ""
