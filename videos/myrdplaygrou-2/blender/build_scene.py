# ============================================================================
# 模板: 微缩讲解片 Blender 场景 (来自已交付项目 故宫中轴线巡礼)
# 改造清单 (按顺序, 详细说明见 ../references/pipeline.md Step 3):
#   1. M 材料色板 —— 换成新主体配色 (源色要比目标渲出色深一档, AgX 提亮降饱和)
#   2. 【城市布局】整段 —— 用 box()/hip_roof()/pyramidal()/hall()/gate()/tree() 重拼
#   3. KEYS 表 —— (frame, cam_pos, target); 帧号来自旁白实测时长反推的场景边界
#   4. SCENES 表 —— 段名+帧区间, 必须与 KEYS/旁白边界一致
#   5. 渲染基准: 太阳 3.0/15° + 天空 0.55 + exposure -0.15 (先跑基准再调色)
# 运行: blender -b -P build_scene.py -- --test F / --draft / --final [--scene sN]
# 坑: 见 ../references/gotchas.md (软链接/G2 FFMPEG/G3 API/G5 穿模判定)
# ============================================================================
"""故宫中轴线巡礼 — Blender 5.x 程序化微缩场景 + 一镜到底相机
用法:
  blender -b -P build_scene.py -- --test 30            # 单帧测试 PNG
  blender -b -P build_scene.py -- --draft              # 草稿全片 (50% res, 16 samples, mp4)
  blender -b -P build_scene.py -- --final              # 终稿全片 (100% res, 96 samples, mp4 per scene)
  blender -b -P build_scene.py -- --final --scene s4   # 只渲某一段
"""
import bpy, bmesh, math, random, argparse, sys, os
from math import radians

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--test", type=int, default=0, help="渲染单帧并退出 (PNG)")
ap.add_argument("--draft", action="store_true")
ap.add_argument("--final", action="store_true")
ap.add_argument("--scene", type=str, default="all")
args = ap.parse_args(argv)

random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "renders")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.6, metal=0.0, spec=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    return m

M = {
    "wall":   mat("wall",   (0.420, 0.095, 0.075), 0.70),  # 宫墙红 (AgX 会提亮, 源色加深)
    "roof":   mat("roof",   (0.610, 0.375, 0.078), 0.30),  # 金琉璃
    "roof_d": mat("roof_d", (0.490, 0.290, 0.072), 0.36),  # 檐口加深
    "marble": mat("marble", (0.900, 0.872, 0.800), 0.52),  # 汉白玉
    "ground": mat("ground", (0.450, 0.425, 0.380), 0.92),  # 石板地
    "axis":   mat("axis",   (0.580, 0.545, 0.485), 0.85),  # 中轴御路
    "water":  mat("water",  (0.200, 0.380, 0.370), 0.12),  # 金水河
    "leaf":   mat("leaf",   (0.300, 0.470, 0.280), 0.80),
    "trunk":  mat("trunk",  (0.290, 0.225, 0.180), 0.90),
    "base":   mat("base",   (0.235, 0.185, 0.150), 0.85),  # 基座侧壁
    "dark":   mat("dark",   (0.045, 0.038, 0.035), 0.90),  # 门洞
    "gold":   mat("gold",   (0.760, 0.550, 0.130), 0.30, metal=0.30),  # 宝顶 (低金属度, 免环境反射发白)
}

# ---------------------------------------------------------------- primitives
def box(name, w, d, h, loc, m, rz=0.0):
    """w=x宽, d=y深, h=z高; loc=底面中心"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, d, h)
    o.location = (loc[0], loc[1], loc[2] + h / 2)
    o.rotation_euler = (0, 0, rz)
    if m:
        o.data.materials.append(m)
    return o

def hip_roof(name, w, d, h, ridge=0.5, eave=1.18, m=None, loc=(0, 0, 0), rz=0.0, finial=False):
    """庑殿顶: 矩形底 + 脊线; ridge=脊长/底宽; eave=出檐倍数"""
    bw, bd = w * eave, d * eave
    rw = max(w * ridge, 0.10)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in [
        (-bw/2, -bd/2, 0), (bw/2, -bd/2, 0), (bw/2, bd/2, 0), (-bw/2, bd/2, 0),
        (-rw/2, 0, h), (rw/2, 0, h)]]
    bm.faces.new([vs[0], vs[1], vs[5], vs[4]])  # 前坡
    bm.faces.new([vs[2], vs[3], vs[4], vs[5]])  # 后坡
    bm.faces.new([vs[0], vs[3], vs[4]])          # 左山面
    bm.faces.new([vs[1], vs[5], vs[2]])          # 右山面
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (loc[0], loc[1], loc[2])
    o.rotation_euler = (0, 0, rz)
    bpy.context.collection.objects.link(o)
    if m:
        me.materials.append(m)
    # 脊两端鸱吻
    for sgn in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = bpy.context.active_object
        c.name = f"{name}_chi"
        c.scale = (0.05, 0.05, 0.09)
        c.location = (loc[0] + sgn * rw / 2, loc[1], loc[2] + h + 0.03)
        c.rotation_euler = (0, 0, rz)
        c.data.materials.append(M["roof_d"])
    if finial:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(loc[0], loc[1], loc[2] + h + 0.06), segments=16, ring_count=8)
        s = bpy.context.active_object
        s.data.materials.append(M["gold"])
    return o

def pyramidal(name, w, d, h, m=None, loc=(0, 0, 0), eave=1.18, finial=True):
    """四角攒尖顶 (中和殿)"""
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=max(w, d) * eave / 2 * 1.18,
                                    radius2=0.012, depth=h, location=(loc[0], loc[1], loc[2] + h / 2),
                                    rotation=(0, 0, radians(45)))
    o = bpy.context.active_object
    o.name = name
    if m:
        o.data.materials.append(m)
    if finial:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, location=(loc[0], loc[1], loc[2] + h + 0.05), segments=16, ring_count=8)
        s = bpy.context.active_object
        s.data.materials.append(M["gold"])
    return o

def gate(name, loc, w=2.2, d=0.9, h=0.6, pavilion_h=0.42, openings=3):
    """城台+门洞(暗盒露出)+顶上殿楼"""
    x, y = loc[0], loc[1]
    z = loc[2] if len(loc) > 2 else 0.0
    box(f"{name}_tai", w, d, h, (x, y, z), M["wall"])
    # 门洞: 暗色小盒略凸出前后面 (diorama 视觉骗术)
    xs = [-w * 0.30, 0, w * 0.30] if openings == 3 else [0]
    for i, ox in enumerate(xs):
        ow = w * 0.13 if i == 1 else w * 0.10
        box(f"{name}_arch{i}", ow, d * 1.06, h * 0.62, (x + ox, y, z), M["dark"])
    # 楼
    pw = w * 0.82
    box(f"{name}_body", pw, d * 0.66, pavilion_h, (x, y, z + h), M["wall"])
    hip_roof(f"{name}_roof", pw, d * 0.80, pavilion_h * 0.95, ridge=0.55,
             m=M["roof"], loc=(x, y, z + h + pavilion_h))
    return h + pavilion_h * 1.95  # 总高估计

def hall(name, loc, w, d, body_h=0.42, roof_h=0.34, ridge=0.6, double=False,
         tier=1, tier_size=1.35, m_body=M["wall"], m_roof=M["roof"], finial=False):
    """殿堂: 台基 + 身 + (重檐裙檐) + 顶"""
    x, y = loc[0], loc[1]
    z = loc[2] if len(loc) > 2 else 0.0
    tw, td = w * tier_size, d * tier_size
    top = z
    for i in range(tier):
        t = 1.0 - i * 0.10
        box(f"{name}_tier{i}", tw * t, td * t, 0.15, (x, y, top), M["marble"])
        top += 0.15
    box(f"{name}_body", w, d, body_h, (x, y, top), m_body)
    top += body_h
    if double:
        hip_roof(f"{name}_skirt", w * 1.28, d * 1.24, roof_h * 0.42, ridge=0.94,
                 m=m_roof, loc=(x, y, top - 0.02), eave=1.0)
        box(f"{name}_upper", w * 0.72, d * 0.74, body_h * 0.42, (x, y, top + roof_h * 0.42 - 0.06), m_body)
        hip_roof(f"{name}_roof", w * 0.74, d * 0.76, roof_h * 0.85, ridge=0.5,
                 m=m_roof, loc=(x, y, top + roof_h * 0.42 + body_h * 0.42 - 0.06))
        top += roof_h * 0.42 + body_h * 0.42 + roof_h * 0.85
    else:
        hip_roof(f"{name}_roof", w, d, roof_h, ridge=ridge, m=m_roof, loc=(x, y, top), finial=finial)
        top += roof_h
    return top

def tree(name, loc, s=1.0):
    x, y, z = loc
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045 * s, depth=0.22 * s,
                                        location=(x, y, z + 0.11 * s))
    t = bpy.context.active_object
    t.name = name + "_trunk"
    t.data.materials.append(M["trunk"])
    for i, (dx, dy, r, hh) in enumerate([(0, 0.02, 0.20, 0.30), (0.05, -0.04, 0.13, 0.18)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r * s,
                                              location=(x + dx * s, y + dy * s, z + 0.22 * s + hh * s * (0.6 + i * 0.35)))
        o = bpy.context.active_object
        o.name = f"{name}_crown{i}"
        o.scale = (1, 1, 0.82)
        o.data.materials.append(M["leaf"])

# ---------------------------------------------------------------- 城市布局
WX, WY = 4.3, 7.0          # 城墙半宽/南界(-)/北界(+)
wall_h = 0.55

# 基座 (diorama 花盆)
box("base", 14.0, 19.5, 0.5, (0, 0.75, -0.5), M["base"])
# 地面
box("ground", 13.0, 18.5, 0.06, (0, 0.75, 0.0), M["ground"])
# 中轴御路
box("axisroad", 0.95, 15.4, 0.02, (0, 0.4, 0.06), M["axis"])
# 护城河环 (四条水带)
mw = 0.62
for nm, cx, cy, w_, d_ in [("moat_s", 0, -(WY + 0.55), 12.6, mw),
                           ("moat_n", 0, (WY + 0.55 + 1.5), 12.6, mw),
                           ("moat_e", (WX + 0.55), 0.75, mw, 17.6),
                           ("moat_w", -(WX + 0.55), 0.75, mw, 17.6)]:
    box(nm, w_, d_, 0.05, (cx, cy, -0.005), M["water"])

# 城墙四边 (在门楼处自然被城台体量盖过)
box("wall_s", WX * 2, 0.16, wall_h, (0, -WY, 0), M["wall"])
box("wall_n", WX * 2, 0.16, wall_h, (0, WY, 0), M["wall"])
box("wall_e", 0.16, WY * 2, wall_h, (WX, 0.75, 0), M["wall"])
box("wall_w", 0.16, WY * 2, wall_h, (-WX, 0.75, 0), M["wall"])

# 四角角楼 (两层小楼)
for i, (cx, cy) in enumerate([(WX, -WY), (-WX, -WY), (WX, WY), (-WX, WY)]):
    box(f"corner{i}_t1", 0.34, 0.34, 0.30, (cx, cy, wall_h), M["wall"])
    hip_roof(f"corner{i}_r1", 0.34, 0.34, 0.22, ridge=0.42, m=M["roof"], loc=(cx, cy, wall_h + 0.30))
    box(f"corner{i}_t2", 0.22, 0.22, 0.18, (cx, cy, wall_h + 0.52), M["wall"])
    hip_roof(f"corner{i}_r2", 0.24, 0.24, 0.16, ridge=0.4, m=M["roof"], loc=(cx, cy, wall_h + 0.70))

# ---- 外朝: 午门 → 内金水桥 → 太和门 → 三大殿
# 午门 (凹形)
gate("wumen", (0, -WY), w=3.0, d=1.0, h=0.85, pavilion_h=0.48)
for sgn in (-1, 1):  # 两翼前伸
    wx = sgn * (1.5 + 0.55)
    box(f"wumen_wing{sgn}", 1.1, 1.5, 0.50, (wx, -WY - 0.75, 0), M["wall"])
    box(f"wumen_wingtower{sgn}", 0.52, 0.52, 0.42, (wx, -WY - 1.32, 0.50), M["wall"])
    hip_roof(f"wumen_wingroof{sgn}", 0.56, 0.56, 0.34, ridge=0.45, m=M["roof"], loc=(wx, -WY - 1.32, 0.92))

# 内金水河 + 五桥
box("jinshui", 6.8, 0.55, 0.04, (0, -5.35, -0.01), M["water"])
for i in range(5):
    bx = (i - 2) * 0.52
    box(f"bridge{i}", 0.30, 0.68, 0.10, (bx, -5.35, 0.03), M["marble"])

# 太和门
gate("taihemen", (0, -4.15), w=2.0, d=0.8, h=0.55, pavilion_h=0.40)

# 三大殿台基 (三层)
tx, ty = 0.0, -1.35
for i in range(3):
    t = 1.0 - i * 0.10
    box(f"sandaodian_tier{i}", 4.3 * t, 2.9 * t, 0.16, (tx, ty, 0.06 + i * 0.16), M["marble"])
terrace_top = 0.06 + 3 * 0.16  # 0.54

taihe_top = hall("taihe", (tx, ty + 0.72), w=2.35, d=0.85, body_h=0.5, roof_h=0.30,
                 double=True, tier=0, m_roof=M["roof"])  # loc z 用 terrace_top
# hall() 不支持外部 z —— 直接重造太和殿: 上面的调用从 z=0 起, 删除重建
def hall_at(name, loc, *a, **kw):
    return hall(name, (loc[0], loc[1], loc[2]), *a, **kw)

# (清理简化) 太和殿重造于台基顶
for ob in list(bpy.data.objects):
    if ob.name.startswith("taihe"):
        bpy.data.objects.remove(ob, do_unlink=True)
# 三大殿顺序 (南→北): 太和 → 中和 → 保和; y 越小越靠南
taihe_top = hall("taihe", (tx, ty - 0.85, terrace_top), w=2.35, d=0.85, body_h=0.48,
                 roof_h=0.30, double=True, tier=0)

zhonghe_top = pyramidal("zhonghe_roof", 0.72, 0.72, 0.44, m=M["roof"],
                        loc=(tx, ty - 0.10, terrace_top + 0.30))
box("zhonghe_body", 0.72, 0.72, 0.30, (tx, ty - 0.10, terrace_top), M["wall"])

baohe_top = hall("baohe", (tx, ty + 0.72, terrace_top), w=1.85, d=0.70, body_h=0.42,
                 roof_h=0.30, ridge=0.62, tier=0)

# 后三宫
gate("qianqingmen", (0, 0.55), w=1.5, d=0.6, h=0.42, pavilion_h=0.30, openings=3)
qianqing_top = hall("qianqing", (0, 1.45, 0.06), w=1.55, d=0.62, body_h=0.38, roof_h=0.28, ridge=0.58, tier=1, tier_size=1.3)
jiaotai_top = pyramidal("jiaotai_roof", 0.52, 0.52, 0.30, m=M["roof"], loc=(0, 2.15, 0.06 + 0.22))
box("jiaotai_body", 0.52, 0.52, 0.22, (0, 2.15, 0.06), M["wall"])
kun_top = hall("kun", (0, 2.80, 0.06), w=1.35, d=0.58, body_h=0.34, roof_h=0.26, ridge=0.58, tier=1, tier_size=1.3)

# 御花园 + 钦安殿
box("yugarden", 2.6, 2.3, 0.03, (0, 4.45, 0.05), mat("garden", (0.400, 0.470, 0.330), 0.9))
qinan_top = hall("qinan", (0, 4.45, 0.08), w=0.55, d=0.45, body_h=0.30, roof_h=0.24, ridge=0.4, tier=1, tier_size=1.25, finial=False)
# 御花园树 (避开中轴与钦安殿)
for i in range(16):
    tx_ = random.choice([-1, 1]) * random.uniform(0.45, 1.15)
    ty_ = random.uniform(3.45, 5.5)
    if abs(tx_) < 0.6 and abs(ty_ - 4.45) < 0.5:
        continue
    tree(f"gtree{i}", (tx_, ty_, 0.06), s=random.uniform(0.8, 1.25))
# 东西侧散树
for i in range(10):
    tree(f"stree{i}", (random.choice([-1, 1]) * random.uniform(2.9, 3.7), random.uniform(-3.5, 6.0), 0.06),
         s=random.uniform(0.8, 1.2))

# 神武门 (北门)
gate("shenwumen", (0, WY), w=2.0, d=0.8, h=0.6, pavilion_h=0.42)

# 东西六宫示意 (两侧小殿群)
for sgn in (-1, 1):
    for j, yy in enumerate((-2.0, -1.4, -0.8)):
        hx = sgn * 2.55
        hall(f"side_west{sgn}_{j}", (hx, yy, 0.06), w=0.55, d=0.42, body_h=0.24, roof_h=0.20,
             ridge=0.45, tier=1, tier_size=1.3, m_roof=M["roof_d"])
    for j, yy in enumerate((1.3, 1.9, 2.5)):
        hx = sgn * 2.55
        hall(f"side_east{sgn}_{j}", (hx, yy, 0.06), w=0.55, d=0.42, body_h=0.24, roof_h=0.20,
             ridge=0.45, tier=1, tier_size=1.3, m_roof=M["roof_d"])

# ---------------------------------------------------------------- 光照/世界
sun = bpy.data.lights.new("sun", 'SUN')
sun.energy = 3.0
sun.angle = radians(15)
sun.color = (1.0, 0.93, 0.82)
so = bpy.data.objects.new("sun", sun)
so.rotation_euler = (radians(48), 0, radians(-32))
bpy.context.collection.objects.link(so)

world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.800, 0.805, 0.770, 1)  # 暖纸色天
bg.inputs[1].default_value = 0.55

# ---------------------------------------------------------------- 相机一镜到底
cam = bpy.data.cameras.new("cam")
cam.lens = 40
cam.clip_start = 0.05
cam.clip_end = 200
cam_o = bpy.data.objects.new("cam", cam)
bpy.context.collection.objects.link(cam_o)
scene.camera = cam_o

tgt = bpy.data.objects.new("lookat", None)
bpy.context.collection.objects.link(tgt)
c = cam_o.constraints.new('TRACK_TO')
c.target = tgt
c.track_axis = 'TRACK_NEGATIVE_Z'
c.up_axis = 'UP_Y'

# SINE 插值: Blender 5.x 的 action.fcurves API 变动, 改用全局插值偏好
try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'SINE'
except Exception:
    pass

# (frame, pos, target) —— 按旁白实测时长重排 (全片 61.5s = 1845f)
KEYS = [
    # S1 0-216 南面高空缓降 (中轴居中)
    (0,    (0.9, -15.6, 7.4), (0, 0.3, 0.6)),
    (123,  (0.45, -12.4, 4.6), (0, -3.0, 0.8)),
    (216,  (0.15, -10.4, 3.0), (0, -6.5, 1.0)),
    # S2 216-435 正面平视午门 (凹形城台+三门洞可读), 渐近
    (326,  (0.0, -12.4, 2.00), (0, -7.2, 1.05)),
    (435,  (0.0, -10.8, 2.20), (0, -7.0, 0.95)),
    # S3 435-606 越过午门顶, 半空俯瞰广场+三大殿
    (606,  (0.0, -4.2, 2.90), (0, -1.8, 1.15)),
    # S4 606-960 后拉+下降 reveal 太和殿正面 (远机位 4.2 单位, 殿占 ~80% 宽, 有天空)
    (735,  (-0.30, -6.20, 2.45), (-0.05, -2.40, 1.00)),
    (831,  (-0.12, -6.80, 2.30), (0, -2.30, 0.95)),
    (885,  (-0.10, -6.85, 2.30), (0, -2.30, 0.95)),
    (960,  (0.12, -6.40, 2.25), (0.10, -2.30, 1.00)),
    # S5 960-1146 越太和殿顶俯瞰中和/保和, 前望乾清门
    (1053, (0.0, -2.75, 3.50), (0.0, -1.10, 0.80)),
    (1146, (0.0, -0.40, 2.60), (0.0, 1.20, 0.80)),
    # S6 1146-1350 乾清门外望乾清宫 (越过门楼, 相机留在门外)
    (1233, (0.0, -0.35, 1.85), (0.0, 1.45, 0.85)),
    (1350, (0.0, -0.15, 1.80), (0.0, 1.45, 0.90)),
    # S7 1350-1482 快速掠过后三宫 (抬高望御花园)
    (1482, (0.0, 2.30, 2.60), (0.0, 4.60, 0.80)),
    # S8 1482-1650 御花园上空穿行 (树冠之上)
    (1566, (0.30, 2.90, 2.00), (-0.10, 4.70, 0.70)),
    (1650, (-0.25, 4.40, 2.20), (0.0, 6.50, 0.70)),
    # S9 1650-1845 拔升回望全城
    (1752, (0.0, 8.8, 4.0), (0, 0.5, 0.5)),
    (1845, (0.0, 11.8, 8.2), (0, -0.5, 0.5)),
]
for f, p, t in KEYS:
    cam_o.location = p
    tgt.location = t
    cam_o.keyframe_insert("location", frame=f)
    tgt.keyframe_insert("location", frame=f)
for f, p, t in KEYS:
    cam_o.location = p
    tgt.location = t
    cam_o.keyframe_insert("location", frame=f)
    tgt.keyframe_insert("location", frame=f)

# ---------------------------------------------------------------- 渲染配置
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.fps = 30
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -0.15
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

ee = None
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        scene.render.engine = eng
        ee = eng
        break
    except Exception:
        continue
if args.draft:
    scene.render.resolution_percentage = 50
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 16
elif args.final:
    scene.render.resolution_percentage = 100
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 64
else:
    scene.render.resolution_percentage = 50
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 16

SCENES = [("s1", 0, 216), ("s2", 216, 435), ("s3", 435, 606), ("s4", 606, 960),
          ("s5", 960, 1146), ("s6", 1146, 1350), ("s7", 1350, 1482),
          ("s8", 1482, 1650), ("s9", 1650, 1845)]

def render_video(tag, f0, f1):
    """PNG 序列 (use_empty 下 FFMPEG 枚举不可用, 由外部 ffmpeg 合封)"""
    seq_dir = os.path.join(OUT, tag)
    os.makedirs(seq_dir, exist_ok=True)
    scene.frame_start, scene.frame_end = f0, f1
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(seq_dir, "frame")
    bpy.ops.render.render(animation=True)

def render_still(frame):
    scene.frame_set(frame)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.join(OUT, f"test_f{frame}.png")
    bpy.ops.render.render(write_still=True)

if args.test:
    render_still(args.test)
elif args.draft:
    for tag, f0, f1 in SCENES:
        if args.scene == "all" or args.scene == tag:
            render_video(tag + "_draft", f0, f1)
elif args.final:
    for tag, f0, f1 in SCENES:
        if args.scene == "all" or args.scene == tag:
            render_video(tag, f0, f1)
else:
    print("nothing to do: pass --test F / --draft / --final")
