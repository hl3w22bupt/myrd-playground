#!/usr/bin/env python3
# C 轮 N3 美术线机器审计（dy 平台素材 5 件 · 风格四要素 + 竖屏安全区 + combo 高光标记锚点）
# 运行（repo 根 = games/stack-tower）：python3 <本文件>
# 规则口径（2026-09-30 N3 校准）：
#   - 竖屏安全区（side60/top132/bottom96）按 spec 原文仅对 dy-store-screenshot-03 硬约束
#     （expect 唯一写「安全区内」）；share-card（500×400 会话卡）与 01/02（全幅商店图，wx B0
#     同构边距）只记 edge_margin ≥14px 信息项。
#   - 切面白带为 α 混合叠加，检测用近白（RGB≥228）而非精确 #ffffff。
#   - 异色哨兵（hue ±14°）为信息项：青环叠加暖色块的混合中间色是加色 idiom 固有产物
#     （冻结四联图生成器同法）；「禁止私设色值」以生成器零 hex 字面量为强断言（grep=0）。
from PIL import Image
import colorsys, json, re, sys

theme = open('src/render/theme.ts').read()
pick = lambda n: re.search(n + r":\s*'(#[0-9a-f]{6})'", theme).group(1)
A = {k: pick(v) for k, v in [('SKY_T','NIGHT_SKY_TOP'),('SKY_B','NIGHT_SKY_BOTTOM'),('CUT','CUT_FACE'),('RIP','RIPPLE_RING'),('GLW','PERFECT_GLOW'),('HOR','HORIZON')]}
BLOCKS = [pick(f'BLOCK_NEON_0{i}') for i in range(1,7)]
hx = lambda s: tuple(int(s[i:i+2],16) for i in (1,3,5))
sky = lambda t: tuple(round(hx(A['SKY_T'])[i]+(hx(A['SKY_B'])[i]-hx(A['SKY_T'])[i])*t) for i in range(3))
shade = lambda c,f: tuple(round(v*f) for v in hx(c))
hu = lambda c: colorsys.rgb_to_hsv(*[v/255 for v in hx(c)])[0]
hd = lambda a,b: min(abs(a-b), 1-abs(a-b))
ANCHOR_HUES = [hu(b) for b in BLOCKS] + [hu(A['GLW'])]

def audit(name, path, safe_hard):
    im = Image.open(path).convert('RGB'); W,Hh = im.size; px = im.load()
    r = {'id': name, 'size': f'{W}x{Hh}'}
    r['ratio_ok'] = (W,Hh) in [(500,400),(1242,2208),(512,512)]
    r['sky_ok'] = px[0,0]==hx(A['SKY_T']) and px[0,Hh-1]==hx(A['SKY_B'])
    need = BLOCKS if 'screenshot' in name else BLOCKS[:3]
    flat = {px[x,y] for y in range(0,Hh,3) for x in range(0,W,3)}
    r['blocks3face_ok'] = all(all(sh in flat for sh in (hx(b), shade(b,.88), shade(b,.76))) for b in need)
    minx,maxx,miny,maxy = W,0,Hh,0
    foreign = 0
    for y in range(Hh):
        if abs(y-0.78*Hh)<=3: continue
        ref = sky(y/(Hh-1))
        for x in range(W):
            p = px[x,y]
            if max(abs(p[i]-ref[i]) for i in range(3))>8:
                minx,maxx=min(minx,x),max(maxx,x); miny,maxy=min(miny,y),max(maxy,y)
            h,s,v = colorsys.rgb_to_hsv(*[v/255 for v in p])
            if s>0.35 and v>0.35 and hd(h, min(ANCHOR_HUES, key=lambda a: hd(a,h))) > 14/360:
                foreign += 1
    side,top,bot = 60,132,96
    r['safe_bbox'] = [minx,miny,maxx,maxy]
    r['edge_margin'] = min(minx, W-1-maxx, miny, Hh-1-maxy)
    r['safe_ok'] = (minx>=side and maxx<=W-side and miny>=top and maxy<=Hh-bot) if safe_hard else r['edge_margin']>=14
    r['foreign_hue_px_info'] = foreign
    if '02' in name:
        glw = sum(1 for y in range(0,Hh,2) for x in range(0,W,2) if hd(colorsys.rgb_to_hsv(*[v/255 for v in px[x,y]])[0], hu(A['GLW']))<14/360 and px[x,y][0]>110)
        rip = sum(1 for y in range(0,Hh,2) for x in range(0,W,2) if px[x,y]==hx(A['RIP']))
        cut = sum(1 for y in range(0,Hh,2) for x in range(0,W,2) if all(v>=228 for v in px[x,y]))
        r['marker'] = {'glow_px':glw,'ripple_exact_px':rip,'cutface_near_white_px':cut,'marker_ok': glw>50 and rip>100 and cut>30}
    return r

files = [('dy-share-card','assets/tt/share-card.png',False),
         ('dy-store-screenshot-01','assets/tt/store-screenshot-01.png',False),
         ('dy-store-screenshot-02','assets/tt/store-screenshot-02.png',False),
         ('dy-store-screenshot-03','assets/tt/store-screenshot-03.png',True),
         ('dy-icon','assets/tt/icon.png',False)]
out = [audit(*f) for f in files]
print(json.dumps(out, ensure_ascii=False))
ok = all(x.get('marker',{}).get('marker_ok',True) and all(x[k] for k in ('ratio_ok','sky_ok','blocks3face_ok','safe_ok')) for x in out)
print('ART-AUDIT:', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
