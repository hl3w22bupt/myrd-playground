#!/usr/bin/env python3
"""v5 补充定量：以「动画后已稳定帧」为参照系分离 FX 运动；
以「tap 前基线 vs 提示清除后帧」证明糖果归位（差异仅剩选中光环）。
输出：trajectory-fx.json；复制关键帧到 OUT 供 qa 归档。"""
import json, glob, shutil
from PIL import Image, ImageChops

OUT = "/tmp/candy-webkit/v5"
F = sorted(glob.glob(f"{OUT}/frames/f_*.png"))
CX, CY, STEP = 70.4, 238.6, 49.8
CELL = (int(CX + STEP*1 - 24), int(CY + STEP*4 - 24), int(CX + STEP*1 + 24), int(CY + STEP*4 + 24))  # B=(x1,y4)
CELL_A = (int(CX + STEP*1 - 24), int(CY + STEP*3 - 24), int(CX + STEP*1 + 24), int(CY + STEP*3 + 24))  # A=(x1,y3)

def ref(): return Image.open(F[77]).convert("L")   # f_0078 = tap 前 0.23s
base = ref()
settled = Image.open(F[90]).convert("L")           # +1.07s：动画已结束、提示未清
cleared = Image.open(F[112]).convert("L")          # +3.17s：提示已清、糖果归位

def stats(a, b, box, thr=40):
    pa, pb = a.crop(box), b.crop(box)
    w, h = pa.size
    la, lb = pa.load(), pb.load()
    sx = sy = n = 0
    for yy in range(h):
        for xx in range(w):
            if abs(lb[xx, yy] - la[xx, yy]) > thr:
                sx += xx; sy += yy; n += 1
    if n == 0:
        return 0, 0.0, 0.0
    return n, round(sx/n - w/2.0, 2), round(sy/n - h/2.0, 2)

rows = []
# FX 帧（+0.07/+0.17）vs 已稳定参照：纯动画运动量
for idx, dt in ((81, 0.07), (82, 0.17)):
    img = Image.open(F[idx-1]).convert("L")
    n, dx, dy = stats(settled, img, CELL)
    nA, dxA, dyA = stats(settled, img, CELL_A)
    rows.append({"frame": F[idx-1].split("/")[-1], "dt": dt, "cellB": {"px": n, "dx": dx, "dy": dy},
                 "cellA": {"px": nA, "dx": dxA, "dy": dyA}})
    print(f"{F[idx-1].split('/')[-1]} dt=+{dt}s B(px={n},dx={dx:+.2f},dy={dy:+.2f}) A(px={nA},dx={dxA:+.2f})")

# 归位证明：tap 前 vs 提示清除后，A/B 两格差异应只剩选中光环（小而稳定，非错位糖果）
nB, dxB, dyB = stats(base, cleared, CELL)
nA, dxA, dyA = stats(base, cleared, CELL_A)
home = {"cellB_vs_pretap": {"px": nB, "dx": dxB, "dy": dyB},
        "cellA_vs_pretap": {"px": nA, "dx": dxA, "dy": dyA}}
print("home check:", json.dumps(home))

json.dump({"fxFrames": rows, "homeCheck": home,
           "note": "参照系=动画后稳定帧；归位检查=tap前 vs 提示清除后（差异仅选中光环）"},
          open(f"{OUT}/trajectory-fx.json", "w"), indent=2, ensure_ascii=False)

# 关键帧出图（1x）：抖动右摆 + HUD 提示同帧
shutil.copy(F[81], f"{OUT}/frame_invalid-swap_shrink-left.png")
shutil.copy(F[82], f"{OUT}/frame_invalid-swap_right-swing-hud-msg.png")
shutil.copy(F[106], f"{OUT}/frame_invalid-swap_hud-cleared-settled.png")
print("frames copied")
