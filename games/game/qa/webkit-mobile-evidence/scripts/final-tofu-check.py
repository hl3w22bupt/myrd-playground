#!/usr/bin/env python3
"""终验④：HUD 中文（标题/分数/剩余步数）缺字方块（tofu）机械判定。

输入：final3x_hud-chinese.png（final-verify.cjs 真 WebKit 3x 截图，iPhone 13 描述符 390×664@3x）
原理：字体缺 CJK 字形时 Godot 渲染 .notdef 空心方框——每个字符位图完全相同；
      真实汉字字形彼此差异显著。故对 HUD 三个中文区域做「字形分割 → 归一化位图
      两两皮尔逊相关」：全部互相关 ≈1.0 ⇒ tofu；≪1.0 ⇒ 真实字形。
判据（对分割合并/断开鲁棒：真实文本即使多字粘连，粘连块间相关性仍 ≈0）：
  region 判 tofu ⇔ 区域内字形两两相关 max > 0.90
  终验 PASS ⇔ 三个区域全部判「真实字形」且墨水占比处于合理带（0.08~0.75）
输出：final-tofu-report.json + final3x_hud-<region>.png 区域裁剪留证
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "final3x_hud-chinese.png")
OUT_JSON = os.path.join(HERE, "..", "final-tofu-report.json")
THR = 110          # 亮字暗底二值化阈值
CORR_TOFU = 0.90   # 两两相关超过此值判 tofu
INK_LO, INK_HI = 0.08, 0.75

# 区域为 HUD 固定锚点（3x 像素坐标，iPhone 13 描述符 390×664@3x；v5 同款布局）
REGIONS = {
    "title":        {"box": (20, 60, 500, 160),  "expect": "糖果粉碎传奇"},
    "score_label":  {"box": (590, 90, 900, 140), "expect": "SCORE 分数 / 目标"},
    "moves_label":  {"box": (590, 250, 900, 300), "expect": "MOVES 剩余步数"},
}


def segment_cells(crop: np.ndarray, min_gap=3):
    prof = crop.sum(axis=0).astype(float)
    on = prof > 0
    runs, s, gap = [], None, 0
    for i, c in enumerate(on):
        if c:
            if s is None:
                s = i
            gap = 0
        elif s is not None:
            gap += 1
            if gap > min_gap:
                runs.append((s, i - gap + 1))
                s, gap = None, 0
    if s is not None:
        runs.append((s, len(on)))
    widths = [r[1] - r[0] for r in runs]
    med = float(np.median(widths)) if widths else 0.0
    cells = []
    for r0, r1 in runs:
        w = r1 - r0
        k = max(1, round(w / med)) if med > 0 else 1
        step = w / k
        for m in range(k):
            a0 = int(r0 + m * step)
            a1 = int(r0 + (m + 1) * step)
            cells.append((a0, a1))
    out = []
    for c0, c1 in cells:
        sub = crop[:, c0:c1]
        rows = sub.any(axis=1)
        if not rows.any():
            continue
        ry0, ry1 = int(np.argmax(rows)), len(rows) - int(np.argmax(rows[::-1]))
        out.append((c0, ry0, c1, ry1))
    return out


def cell_bitmap(crop, box, size=48):
    x0, y0, x1, y1 = box
    m = crop[y0:y1, x0:x1].astype(float)
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((size, size), Image.BILINEAR)
    return np.array(im, dtype=float) / 255.0


def corr(u, v):
    u, v = u - u.mean(), v - v.mean()
    d = np.sqrt((u * u).sum() * (v * v).sum())
    return float((u * v).sum() / d) if d > 0 else 1.0


def main() -> int:
    a = np.array(Image.open(SRC).convert("L"))
    R = {"source": os.path.basename(SRC), "size": list(a.shape[::-1]), "threshold": THR,
         "corr_tofu_threshold": CORR_TOFU, "regions": {}}
    all_pass = True
    for name, cfg in REGIONS.items():
        x0, y0, x1, y1 = cfg["box"]
        crop = (a[y0:y1, x0:x1] > THR)
        cells = [c for c in segment_cells(crop) if (c[3] - c[1]) >= 14]  # 滤掉分隔点
        maps = [cell_bitmap(crop, c) for c in cells]
        n = len(maps)
        cs = [round(corr(maps[i], maps[j]), 4) for i in range(n) for j in range(i + 1, n)]
        ratios = [round(float((m > 0.5).mean()), 4) for m in maps]
        max_corr = max(cs) if cs else 1.0
        ink_mean = float(np.mean(ratios)) if ratios else 0.0
        tofu = bool(cells) and max_corr > CORR_TOFU
        ink_ok = INK_LO <= ink_mean <= INK_HI if ratios else False
        verdict = "tofu" if tofu else ("distinct_glyphs" if ink_ok else "suspect")
        R["regions"][name] = {
            "expect_text": cfg["expect"], "cells": len(cells),
            "cell_boxes_3x": [[int(v) for v in c] for c in cells],
            "ink_ratios": ratios, "ink_mean": round(ink_mean, 4),
            "pairwise_corr_max": max_corr,
            "pairwise_corr_mean": round(float(np.mean(cs)), 4) if cs else None,
            "verdict": verdict,
        }
        # 区域裁剪留证
        Image.open(SRC).crop((x0, y0, x1, y1)).save(os.path.join(HERE, "..", f"final3x_hud-{name}.png"))
        ok = verdict == "distinct_glyphs"
        all_pass = all_pass and ok
        print(f"[tofu] {name}: cells={len(cells)} ink_mean={ink_mean:.3f} "
              f"corr_max={max_corr:.3f} -> {verdict}")

    R["pass"] = all_pass
    with open(OUT_JSON, "w") as f:
        json.dump(R, f, indent=2, ensure_ascii=False)
    print(f"[tofu] RESULT pass={all_pass}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
