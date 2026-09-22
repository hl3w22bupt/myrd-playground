# -*- coding: utf-8 -*-
"""generate.py —— 《我被AI女友包围了》美术资产生成入口。

用法（在仓库根目录执行）：
    python3 tools/artgen/generate.py            # 产出全部资产到 games/ai/assets/art/，并打印体积清单
    python3 tools/artgen/generate.py --preview  # 仅渲染预览到 /tmp/artgen-preview/

规格表唯一来源：人设卡 portrait_prompt + color（美术单一事实源），
色板派生规则见 .myrd/blackboard/assets.md §一 风格卡。改风格 = 改风格卡 + 改本表/渲染器参数。
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import artanim
import artchibi
import artcore as C
import artportrait as P
import artui
from PIL import Image

# ---------------------------------------------------------------- 角色规格表
# hair/hair2：发型色（派生自 portrait_prompt 描述）；eye：瞳色（提示词写明则照抄）；
# outfit/outfit2：服装主色/暗部；rim：逆光轮廓光；seed：固定种子（可再生）。
CHARACTERS: dict[str, dict] = {
    "lumi": dict(
        skin="#ffe4d6", name="林小暖", theme="#ff9e9e", style="lumi",
        hair="#a8625f", hair2="#7e4642", eye="#c96f6f",
        outfit="#ffb7bc", outfit2="#f28e96", rim="#ffe3c8", seed=11,
    ),
    "vex": dict(
        skin="#f8e6e0", name="薇", theme="#b28dff", style="vex",
        hair="#2e2a38", hair2="#211e2b", eye="#d9414f",
        outfit="#3b3450", outfit2="#2b2740", rim="#ff9d9d", seed=22,
    ),
    "ada": dict(
        skin="#f6e7de", name="艾达", theme="#7ad0c9", style="ada",
        hair="#c3ccd6", hair2="#99a5b3", eye="#4f8fd0",
        outfit="#f2f5f8", outfit2="#d7dfe7", rim="#bff0ff", seed=33,
    ),
    "momo": dict(
        skin="#ffdfc4", name="桃桃", theme="#ffb35c", style="momo",
        hair="#f08a3c", hair2="#cf6a22", eye="#e2632f",
        outfit="#ffd08a", outfit2="#f2a44f", rim="#fff0c8", seed=44,
    ),
    "sera": dict(
        skin="#f2e8f4", name="瑟拉", theme="#8fa8ff", style="sera",
        hair="#7f6bd6", hair2="#5b48a5", eye="#b28dff",
        outfit="#4a4270", outfit2="#332c52", rim="#cfd8ff", seed=55,
    ),
    "player": dict(
        skin="#f3cfae", name="小李", theme="#7fa8d8", style="player",
        hair="#3a3128", hair2="#28221c", eye="#4a6b8a",
        outfit="#4a6f8f", outfit2="#37536b", rim="#d8ecff", seed=66,
    ),
}

EXPRESSIONS = (P.NORMAL, P.HAPPY, P.CRISIS)
ART_ROOT = os.path.join("games", "ai", "assets", "art")
PREVIEW_DIR = "/tmp/artgen-preview"
REPORT: list[tuple[str, int, int, int]] = []  # (相对路径, w, h, bytes)


def _out_dir(cid: str) -> str:
    if cid == "player":
        return os.path.join(ART_ROOT, "player")
    return os.path.join(ART_ROOT, "personas", cid)


def _record(rel: str, img: Image.Image, nbytes: int) -> None:
    REPORT.append((rel, img.size[0], img.size[1], nbytes))


def _emit(img: Image.Image, rel: str, colors: int, preview_name: str | None = None) -> None:
    if os.environ.get("ART_PREVIEW"):
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        img.save(os.path.join(PREVIEW_DIR, preview_name or os.path.basename(rel)))
        return
    path = os.path.join(rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    n = C.save_palette(img, path, colors)
    _record(rel, img, n)


def portraits() -> None:
    for cid, sp in CHARACTERS.items():
        base = _out_dir(cid)
        for label, fname in [("portrait", "portrait.png")] + [(e, f"expr-{e}.png") for e in EXPRESSIONS]:
            img = P.render(sp, P.NORMAL if label == "portrait" else label, size=(288, 384), ss=2)
            _emit(img, os.path.join(base, fname), 128, preview_name=f"{cid}-{fname}")
        avatar = crop_avatar(P.render(sp, P.NORMAL, size=(288, 384), ss=2), sp)
        _emit(avatar, os.path.join(base, "avatar.png"), 96, preview_name=f"{cid}-avatar.png")


def sheets() -> None:
    for cid, sp in CHARACTERS.items():
        base = _out_dir(cid)
        idle = artchibi.sheet(sp, "idle")
        walk = artchibi.sheet(sp, "walk")
        _emit(idle, os.path.join(base, "sheet-idle.png"), 128, preview_name=f"{cid}-sheet-idle.png")
        _emit(walk, os.path.join(base, "sheet-walk.png"), 128, preview_name=f"{cid}-sheet-walk.png")


def ui() -> None:
    out = os.path.join(ART_ROOT, "ui")
    sizes = artui.build_all(out)
    for name, n in sizes.items():
        with Image.open(os.path.join(out, name)) as im:
            _record(os.path.join(out, name), im.convert("RGBA"), n)


def crop_avatar(img: Image.Image, sp: dict) -> Image.Image:
    """头像：头部 1:1 圆形裁切 + 主题色描边（风格卡 §一·比例）。"""
    scale = img.size[0] / P.DW
    cx, cy = P.HEAD_CX * scale, (P.HEAD_CY - 3) * scale
    r = 60.0 * scale
    box = (int(cx - r), int(cy - r), int(cx + r), int(cy + r))
    face = img.crop(box).resize((96, 96), Image.LANCZOS)
    out = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    mask = Image.new("L", (96, 96), 0)
    from PIL import ImageDraw

    dm = ImageDraw.Draw(mask)
    dm.ellipse([2, 2, 94, 94], fill=255)
    out.paste(face, (0, 0), mask)
    dp = ImageDraw.Draw(out)
    theme = C.rgb(sp["theme"])
    dp.ellipse([2, 2, 94, 94], outline=C.alpha(C.shade(theme, 0.72), 255), width=3)
    dp.ellipse([4, 4, 92, 92], outline=C.alpha(C.tint(theme, 0.25), 190), width=1)
    return out


def report() -> None:
    total = 0
    print("\n=== 资产清单（路径 · 尺寸 · 体积）===")
    for rel, w, h, n in sorted(REPORT):
        total += n
        print(f"{rel:52s} {w:4d}x{h:<4d} {n/1024:7.1f} KB")
    print(f"{'TOTAL':52s} {'':11s} {total/1024:7.1f} KB  （预算 ≤ 1228.8 KB）")
    if total > 1228 * 1024:
        print("[WARN] 超出风格卡体积预算：先降表情差分至 240x320，再减色至 64。")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="仅渲染预览到 /tmp/artgen-preview/")
    ap.add_argument("--only", choices=["portraits", "sheets", "anim", "ui"], default=None)
    args = ap.parse_args()
    if args.preview:
        os.environ["ART_PREVIEW"] = "1"
    if args.only in (None, "portraits"):
        portraits()
    if args.only in (None, "sheets"):
        sheets()
    if args.only in (None, "anim"):
        for rel in artanim.write_all(CHARACTERS):
            print(f"[done] {rel}")
    if args.only in (None, "ui"):
        ui()
    if not os.environ.get("ART_PREVIEW"):
        report()


if __name__ == "__main__":
    main()
