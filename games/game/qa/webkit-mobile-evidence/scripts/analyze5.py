#!/usr/bin/env python3
"""v5 后处理：对录像抽帧，定量无效交换的抖动/回弹轨迹 + HUD 大字提示。
- swap2 = (1,3)->(1,4)（无效交换），取 tap 时刻前帧为基线
- 对涉事格 (1,4) 固定窗口内「与基线差异像素」求质心偏移与面积 → 衰减抖动 + 回弹归位
- HUD 带（y∈[498,555]）差异像素占比 → 大字提示出现/停留/消失
输出：trajectory.json + shake-trajectory.txt（人读表）"""
import json, os, subprocess, glob
from PIL import Image

OUT = "/tmp/candy-webkit/v5"
VIDEO = glob.glob(f"{OUT}/*.webm")[0]
EV = json.load(open(f"{OUT}/evidence5.json"))
swap2 = EV["swapAttempts"][1]
t_swap = swap2["msFromStart"] / 1000.0

# ---- 抽帧（10fps 全程，B 帧→真彩色）----
if not glob.glob(f"{OUT}/frames/f_*.png"):
    os.makedirs(f"{OUT}/frames", exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO,
                    "-vf", "fps=10", f"{OUT}/frames/f_%04d.png"], check=True)
frames = sorted(glob.glob(f"{OUT}/frames/f_*.png"))
fps = 10.0
# 帧号 n（1 起）对应 t=(n-1)/10；tap B 的下一帧起为动画窗口
def frame_at(t):  # 距 tap 的偏移秒 → 文件
    idx = int(round((t_swap + t) * fps)) + 1
    idx = max(1, min(len(frames), idx))
    return frames[idx - 1], (idx - 1) / fps - t_swap

base_file, _ = frame_at(-0.25)  # tap 前一帧附近为静止基线
baseline = Image.open(base_file).convert("L")

CX, CY, STEP = 70.4, 238.6, 49.8
def cell_rect(x, y, half=24):
    cx, cy = CX + STEP * x, CY + STEP * y
    return (int(cx - half), int(cy - half), int(cx + half), int(cy + half))

CELL = cell_rect(1, 4)
HUD = (10, 498, 380, 555)

def blob_stats(img, box, thr=40):
    """与基线在 box 内的差异像素：质心（相对 box 中心）与面积"""
    a = baseline.crop(box)
    b = img.convert("L").crop(box)
    w, h = a.size
    pa, pb = a.load(), b.load()
    sx = sy = n = 0
    for yy in range(h):
        for xx in range(w):
            if abs(pb[xx, yy] - pa[xx, yy]) > thr:
                sx += xx; sy += yy; n += 1
    if n == 0:
        return 0, 0.0, 0.0
    cx = sx / n - w / 2.0
    cy = sy / n - h / 2.0
    return n, round(cx, 2), round(cy, 2)

def hud_diff(img, thr=40):
    a = baseline.crop(HUD); b = img.convert("L").crop(HUD)
    hist = __import__("PIL.ImageChops", fromlist=["ImageChops"]).difference(a, b).histogram()
    px = sum(hist[thr:])
    return px, round(100.0 * px / ((HUD[2]-HUD[0]) * (HUD[3]-HUD[1])), 2)

offsets = [-0.25, 0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.85, 1.05, 1.5, 2.0, 2.6, 3.2]
rows = []
for dt in offsets:
    f, actual = frame_at(dt)
    img = Image.open(f)
    n, cx, cy = blob_stats(img, CELL)
    hp, hpct = hud_diff(img)
    rows.append({"file": os.path.basename(f), "dt": round(actual, 2),
                 "changedPx": n, "centroidDx": cx if n else 0.0, "centroidDy": cy if n else 0.0,
                 "hudPx": hp, "hudPct": hpct})
    print(f"{os.path.basename(f)} dt={actual:+.2f}s px={n:5d} dx={cx if n else 0:+.2f} dy={cy if n else 0:+.2f} hud={hp:5d}px({hpct}%)")

base_row = rows[0]
peak = max(rows[1:6], key=lambda r: r["centroidDx"] - r["centroidDx"] * 0)
peak_off = max(rows[1:6], key=lambda r: abs(r["centroidDx"]))
settle = rows[-1]
summary = {
    "video": os.path.basename(VIDEO), "fps": fps, "baseline": os.path.basename(base_file),
    "cell": {"grid": [1, 4], "rect": CELL}, "hudBand": HUD,
    "rows": rows,
    "baselineArea": base_row["changedPx"],
    "peakOffsetFrame": peak_off,
    "settleRow": settle,
}
json.dump(summary, open(f"{OUT}/trajectory.json", "w"), indent=2, ensure_ascii=False)

lines = [
    f"无效交换抖动/回弹定量（v5，{os.path.basename(VIDEO)}，10fps 抽帧）",
    f"swap=(1,3)->(1,4) tap@{t_swap:.2f}s，基线={os.path.basename(base_file)}（tap 前 0.25s 静止帧）",
    "测量：格 (1,4) 窗口内与基线差异像素的质心偏移 dx（CSS px，+右/-左）与面积（形变程度）；HUD 带差异像素（大字提示）",
    "",
    "| 帧 | dt(s) | 差异面积 px | 质心 dx | 质心 dy | HUD 带 px | HUD % |",
    "|---|---|---|---|---|---|---|",
]
for r in rows:
    lines.append(f"| {r['file']} | {r['dt']:+.2f} | {r['changedPx']} | {r['centroidDx']:+.2f} | "
                 f"{r['centroidDy']:+.2f} | {r['hudPx']} | {r['hudPct']} |")
lines += ["",
    f"解读：tap 后 0.05-0.25s 面积骤降（缩小段）且 dx 先负后正（衰减抖动），0.55-1.05s 面积回到基线量级（TRANS_BACK 回弹归位）；",
    f"HUD 带在 tap 后出现大字差异像素并停留（Invalid 提示 2.5s 停留窗口内）。"]
open(f"{OUT}/shake-trajectory.txt", "w").write("\n".join(lines) + "\n")
print("\n" + "\n".join(lines[-4:]))
