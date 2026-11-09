# ============================================================================
# 《以柔克刚》— diorama 微缩保龄球道 · 一镜到底巡礼
# 变体配方: variants/diorama.md ✅已验证 | 管线契约: SKILL.md §1 (SCENES/KEYS/PLAN 三表)
# 改造清单状态 (来自模板 build_scene.py):
#   1. M 材料色板 —— 保龄球道配色 (源色比目标深一档, AgX 提亮降饱和)
#   2. 【布局】—— 球道 + 十瓶阵 + 气泡膜对照区 (diorama 基座整板)
#   3. KEYS 表 —— 帧号由旁白 ffprobe 实测时长反推 (VO 是时钟, 见 SCENES 上方推导)
#   4. SCENES 表 —— 与 assets/vo/*.mp3 实测逐一对应, 见下方推导块
#   5. 渲染基准: 太阳 3.0/15° + 天空 0.55 + exposure -0.15 (diorama 配方原样保留)
# 运行: blender -b -P build_scene.py -- --test F / --draft / --final [--scene sN]
# 坑: references/gotchas.md (G1 软链接/G2 FFMPEG/G3 API/G5 穿模判定/G6 帧号一致)
# ============================================================================
"""以柔克刚 — Blender 5.x 程序化微缩保龄球道 + 一镜到底相机
用法:
  blender -b -P build_scene.py -- --test 30            # 单帧测试 PNG
  blender -b -P build_scene.py -- --test 30,110,217    # 批量逐机位测试 (一次启动)
  blender -b -P build_scene.py -- --draft              # 草稿全片 (50% res, 16 samples)
  blender -b -P build_scene.py -- --final              # 终稿全片 (100% res, 64 samples, PNG per scene)
  blender -b -P build_scene.py -- --final --scene s4   # 只渲某一段
"""
import bpy, bmesh, math, random, argparse, sys, os
from math import radians

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--test", type=str, default="",
                help="渲染测试 PNG 并退出: 单帧 '30' 或逗号列表 '30,110,217' (逐机位验收用)")
ap.add_argument("--draft", action="store_true")
ap.add_argument("--final", action="store_true")
ap.add_argument("--scene", type=str, default="all")
args = ap.parse_args(argv)

random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "renders")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- 场景边界推导 (VO 是时钟, 2026-11-09 实测)
# assets/vo/sN.mp3 ffprobe 实测秒:
#   s1 6.528  s2 5.856  s3 5.784  s4 6.024  s5 6.888
#   s6 6.792  s7 7.032  s8 5.256  s9 5.112   (Σ = 55.272)
# 场景时长 = 旁白 + 0.4s 入缓冲 + 0.3s 出缓冲 (pipeline.md Step2 / gotchas H6);
# 边界帧 = round(累计秒 × 30fps):
#   s1 0     ..217    (7.233s)   s2 217   ..414    (6.567s)   s3 414  ..608   (6.467s)
#   s4 608   ..810    (6.733s)   s5 810   ..1037   (7.567s)   s6 1037 ..1262  (7.500s)
#   s7 1262  ..1494   (7.733s)   s8 1494  ..1673   (5.967s)   s9 1673 ..1847  (5.800s)
# 全片 1847 帧 = 61.5667s (验收窗 58~62s ✓); voAt = 段首 + 0.4s → scripts/build-captions.mjs PLAN

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.6, metal=0.0, spec=0.4, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    if alpha < 1.0 and "Alpha" in b.inputs:
        b.inputs["Alpha"].default_value = alpha
        # EEvee Next (4.2+/5.x) 用 surface_render_method; 旧 API blend_method 兜底
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    return m

M = {
    "lane":   mat("lane",   (0.520, 0.360, 0.180), 0.42),  # 枫木球道 (目标暖枫 #C89B62, 源色加深)
    "lane_d": mat("lane_d", (0.360, 0.235, 0.115), 0.50),  # 展台暗木
    "gutter": mat("gutter", (0.180, 0.125, 0.085), 0.65),  # 球沟
    "pin":    mat("pin",    (0.880, 0.860, 0.820), 0.32),  # 瓶白
    "pinred": mat("pinred", (0.520, 0.075, 0.060), 0.45),  # 瓶颈红环
    "ball":   mat("ball",   (0.045, 0.060, 0.115), 0.14),  # 深藏青球 (两只同色 = 「同样的球」)
    "film":   mat("film",   (0.720, 0.830, 0.920), 0.18, alpha=0.30),  # 气泡膜 (半透)
    "ground": mat("ground", (0.420, 0.400, 0.370), 0.92),  # 展厅地面暖灰
    "base":   mat("base",   (0.220, 0.160, 0.110), 0.85),  # 基座侧壁深胡桃
    "deck":   mat("deck",   (0.300, 0.210, 0.130), 0.55),  # 瓶区台面
    "leaf":   mat("leaf",   (0.300, 0.470, 0.280), 0.80),  # 低多边形树
    "trunk":  mat("trunk",  (0.290, 0.225, 0.180), 0.90),
    "prop":   mat("prop",   (0.330, 0.300, 0.270), 0.80),  # 回球架/矮凳道具
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

def sphere(name, r, loc, m, squash=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    o = bpy.context.active_object
    o.name = name
    o.scale = (1, 1, squash)
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    if m:
        o.data.materials.append(m)
    return o

def join_parts(parts, name):
    """把一枚瓶的多个部件 join 成单物体, 便于整瓶做倒下动画"""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o

def make_pin(name, x, y, m_body, wrapped=False):
    """保龄瓶: 腹球 + 身(锥台) + 颈红环 + 头球; 站在调用处指定的台面上"""
    parts = []
    z0 = LANE_TOP
    parts.append(sphere(f"{name}_belly", 0.085, (x, y, z0 + 0.115), m_body, squash=0.92))
    bpy.ops.mesh.primitive_cone_add(radius1=0.052, radius2=0.062, depth=0.30,
                                    location=(x, y, z0 + 0.32))
    body = bpy.context.active_object
    body.name = f"{name}_body"
    body.data.polygons.foreach_set("use_smooth", [True] * len(body.data.polygons))
    body.data.materials.append(m_body)
    parts.append(body)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.058, depth=0.032, location=(x, y, z0 + 0.415))
    ring = bpy.context.active_object
    ring.name = f"{name}_ring"
    ring.data.polygons.foreach_set("use_smooth", [True] * len(ring.data.polygons))
    ring.data.materials.append(M["pinred"])
    parts.append(ring)
    parts.append(sphere(f"{name}_head", 0.058, (x, y, z0 + 0.485), m_body))
    o = join_parts(parts, name)
    if wrapped:  # 气泡膜: 三颗半透泡裹身 (对照区的视觉语言)
        bubbles = [sphere(f"{name}_bub{i}", r, (x + dx, y + dy, z0 + dz), M["film"])
                   for i, (dx, dy, dz, r) in enumerate([(-0.055, -0.03, 0.22, 0.088),
                                                        (0.055, 0.02, 0.30, 0.092),
                                                        (0.02, -0.05, 0.40, 0.082)])]
        o = join_parts([o] + bubbles, name)
    return o

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

# ---------------------------------------------------------------- 布局: diorama 基座 + 球道 + 双展区
LANE_TOP = 0.16          # 球道面高度 (lane 底 0.06 + 厚 0.10)

# 基座 (diorama 花盆) + 展厅地面
box("base", 14.0, 21.0, 0.5, (0, 0.5, -0.5), M["base"])
box("ground", 13.2, 20.2, 0.06, (0, 0.5, 0.0), M["ground"])

# 球道: y -9.5 .. +2.5, 宽 1.06; 两侧球沟; 中部箭头标线
box("lane", 1.06, 12.0, 0.10, (0, -3.5, 0.06), M["lane"])
box("gutter_w", 0.24, 12.0, 0.06, (-0.67, -3.5, 0.06), M["gutter"])
box("gutter_e", 0.24, 12.0, 0.06, (0.67, -3.5, 0.06), M["gutter"])
for i in range(4):  # 引导箭头 (diorama 细节, 指向瓶阵)
    box(f"arrow{i}", 0.045, 0.20, 0.006, (0, -7.6 + i * 1.2, LANE_TOP), M["lane_d"])

# 瓶区台面 (球道尽头微抬)
box("deck", 1.5, 2.6, 0.03, (0, 1.25, LANE_TOP - 0.03), M["deck"])

# 十瓶阵 (三角形, 瓶尖朝来球 = -y 方向; 行距 0.5, 列距 0.30)
ROWS = [1, 2, 3, 4]
PIN_XY = []
y_row = 0.6
for n in ROWS:
    for k in range(n):
        PIN_XY.append(((k - (n - 1) / 2) * 0.30, y_row))
    y_row += 0.5
bare_pins = [make_pin(f"pin{i+1}", px, py, M["pin"]) for i, (px, py) in enumerate(PIN_XY)]

# 气泡膜对照区 (右侧独立展台, 同样十瓶三角全部裹膜; 展台南端停第二颗球)
box("bz_platform", 2.4, 4.9, 0.08, (3.1, 0.5, 0.06), M["lane_d"])   # 展台面 z = 0.14
BZ_TOP = 0.14
BZ_XY = []
y_row = 0.35
for n in ROWS:
    for k in range(n):
        BZ_XY.append((3.1 + (k - (n - 1) / 2) * 0.30, y_row))
    y_row += 0.5
wrapped_pins = []
for i, (px, py) in enumerate(BZ_XY):
    o = make_pin(f"wpin{i+1}", px, py, M["pin"], wrapped=True)
    o.location.z += (BZ_TOP - LANE_TOP)  # 展台顶即瓶底
    wrapped_pins.append(o)
# 气泡膜垫 (展台后半幅的半透泡群, 呼应「包装材料」展品身份)
for gy in range(6):
    for gx in range(8):
        sphere(f"sheet_{gx}_{gy}", 0.058,
               (3.1 - 0.84 + gx * 0.24, 1.15 + gy * 0.24, BZ_TOP + 0.02), M["film"])

# 左侧道具: 回球架 + 矮凳 + 低多边形树 (diorama 环境叙事)
box("return_rack", 0.9, 0.35, 0.28, (-2.0, -6.5, 0.06), M["prop"])
box("return_rack2", 0.9, 0.35, 0.16, (-2.0, -6.5, 0.34), M["prop"])
for j in range(4):
    box(f"seat{j}", 0.5, 0.5, 0.22, (-2.4, -3.6 + j * 1.3, 0.06), M["prop"])
for i in range(6):
    tree(f"tree{i}", (-2.6 - random.uniform(0, 1.6), -8.0 + i * 2.6 + random.uniform(-0.5, 0.5), 0.06),
         s=random.uniform(0.8, 1.2))

# ---------------------------------------------------------------- 物体动画 (关键帧; 慢动作 = 拉长碰撞窗)
# 球 1 (球道): f217 起步 → f458 触瓶 (s3「撞击瞬间」, 旁白 voAt=14.20s=f426 起) → f600 停于前两排之间
# (终点 y=0.88: 与倒向修正后的倒瓶瓶腹 y≥1.15 净空 >0.18, 原终点 1.15 会与倒瓶相交)
BALL_R, BALL_Z = 0.17, LANE_TOP + 0.17
ball1 = sphere("ball1", BALL_R, (0, -8.5, BALL_Z), M["ball"])
def roll_key(obj, f, x, y, y0, r=BALL_R):
    """球心沿行进方向滚动: 旋转量 = 位移/半径 (负号 = 朝 +y 滚)"""
    obj.location = (x, y, obj.location.z)
    obj.rotation_euler = (-(y - y0) / r, 0, 0)
    obj.keyframe_insert("location", frame=f)
    obj.keyframe_insert("rotation_euler", frame=f)

ROLL1 = [(217, 0, -8.5), (316, 0, -7.3), (414, 0, -5.4), (458, 0, 0.345),
         (520, 0, 0.85), (600, 0, 0.88)]
for f, x, y in ROLL1:
    roll_key(ball1, f, x, y, y0=-8.5)

# 球 2 (对照区): f810 起步 → f905 触裹膜瓶 (s5「再来一次」) → f1010 停, 瓶未倒 (对照结论)
ball2 = sphere("ball2", BALL_R, (3.1, -1.5, BZ_TOP + BALL_R), M["ball"])
ROLL2 = [(810, 3.1, -1.5), (905, 3.1, 0.095), (1010, 3.1, 0.14)]
for f, x, y in ROLL2:
    roll_key(ball2, f, x, y, y0=-1.5)

# 裸瓶散倒: 触瓶帧 f458 起, 依次错峰 —— 前排骨 s3 内倒完, 后排延续到 s4 (「动量接力」可视化)
def surface_top(x, y):
    """落点承力面顶高: 瓶区台面 0.16 / 球沟 0.12 / 展厅地面 0.06 (散瓶按落点着地, 不悬浮)"""
    if abs(x) <= 0.75 and y <= 2.55:
        return 0.16   # deck (含球道段)
    if abs(x) <= 0.79:
        return 0.12   # gutter
    return 0.06       # ground

def scatter(pin, f_hit, dir_x, dir_y, dist, tilt_deg):
    """f_hit 时刻从站立 → dist 位移 + tilt 倾倒; 倒向 = 动量去向 (+y 远离来球, gotchas: 球推瓶不是瓶迎球)"""
    stand = tuple(pin.location)
    fx, fy = stand[0] + dir_x * dist, stand[1] + dir_y * dist
    fallen = (fx, fy, surface_top(fx, fy) + 0.085)  # 躺平后瓶腹球心 = 面顶 + 腹半径
    pin.rotation_euler = (0, 0, 0)
    pin.keyframe_insert("location", frame=f_hit)
    pin.keyframe_insert("rotation_euler", frame=f_hit)
    pin.location = fallen
    pin.rotation_euler = (-radians(tilt_deg), 0, 0)  # 负号 = 瓶头倒向 +y; 正号会倒回球侧 (实测翻过车)
    pin.keyframe_insert("location", frame=f_hit + 26)
    pin.keyframe_insert("rotation_euler", frame=f_hit + 26)

HIT_ORDER = [(0, 458, 0.10, 1.0, 0.75, 86), (1, 472, -0.5, 1.0, 0.95, 88), (2, 486, 0.6, 1.0, 0.95, 90),
             (3, 522, -0.2, 1.0, 1.05, 87), (4, 540, 0.3, 1.0, 1.10, 92), (5, 556, -0.6, 1.0, 1.00, 89),
             (6, 630, 0.5, 1.0, 1.15, 91), (7, 660, -0.4, 1.0, 1.10, 88), (8, 690, 0.2, 1.0, 1.20, 93),
             (9, 726, -0.3, 1.0, 1.15, 90)]
for idx, f_hit, dx, dy, dist, tilt in HIT_ORDER:
    scatter(bare_pins[idx], f_hit, dx, dy, dist, tilt)

# 裹膜瓶: f905 受冲 → 压缩回弹 (抖而不倒) = 「缓冲把力变温和」的画面结论
for i, pin in enumerate(wrapped_pins):
    ph = 0.10 + (i % 3) * 0.02
    for f, ang in [(905, 0.0), (920, -ph), (946, -ph * 0.45), (980, -ph * 0.15), (1020, 0.0)]:
        pin.rotation_euler = (ang, 0, 0)
        pin.keyframe_insert("rotation_euler", frame=f)

# ---------------------------------------------------------------- 光照/世界 (diorama 配方基准: sun 3.0/15°/暖 + 天空 0.55 暖纸)
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

# SINE 插值: Blender 5.x 的 action.fcurves API 已变, 用全局插值偏好 (gotchas G3)
try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'SINE'
except Exception:
    pass

# (frame, pos, target) —— 段首/段尾必有 key, 全部落在 SCENES 区间内, 尾帧 = 1847 (gotchas G6)
# 机位通则 (variants/diorama.md): 穿行段 z 2.6-3.5 半空巡航; 主角段距离 ≥3 低机位
KEYS = [
    # S1 0-217 启程: 南缘高空缓降, 球道-瓶阵-对照区三件套一次读全
    (0,    (0.8, -16.5, 8.0), (0, 1.0, 0.6)),
    (110,  (0.5, -13.2, 5.4), (0, 0.2, 0.6)),
    (217,  (0.25, -11.2, 3.4), (0, -4.0, 0.8)),
    # S2 217-414 启程: 跟随球起步, 低角度望向瓶阵深处
    (316,  (0, -12.2, 2.9), (0, -6.5, 0.55)),
    (414,  (0, -10.6, 2.4), (0, -4.8, 0.5)),
    # S3 414-608 途经: 撞击瞬间 (f458 触瓶), 近景但距离 ≥3.5 防贴脸
    (414,  (0, -3.6, 1.7), (0, 0.9, 0.5)),
    (500,  (-0.45, -2.7, 1.5), (0.1, 1.0, 0.45)),
    (608,  (-0.5, -1.9, 1.9), (0, 1.2, 0.4)),
    # S4 608-810 途经: 3/4 俯角看后排瓶依次倒下 (动量接力)
    (709,  (2.4, -2.2, 2.5), (0.3, 1.3, 0.35)),
    (810,  (2.0, -1.4, 2.7), (0.2, 1.4, 0.3)),
    # S5 810-1037 抵达: 右摇转向气泡膜对照区, 球 2 撞裹膜瓶 (f905)
    (920,  (2.6, -1.6, 2.3), (3.1, 0.9, 0.4)),
    (1037, (3.1, -2.4, 1.8), (3.1, 1.1, 0.4)),
    # S6 1037-1262 抵达: 缓冲机制近观 (距离 ≥2.6, 裹膜瓶可数)
    (1150, (3.1, -2.2, 1.5), (3.1, 1.2, 0.4)),
    (1262, (3.35, -1.7, 1.35), (3.1, 1.3, 0.35)),
    # S7 1262-1494 抵达: 冲量定理 —— 高机位双展区同框 (倒瓶 vs 立瓶)
    (1380, (4.6, -5.6, 3.6), (1.6, 0.9, 0.4)),
    (1494, (4.2, -4.8, 3.8), (1.5, 1.0, 0.4)),
    # S8 1494-1673 回望: 沿球道后拉升高
    (1583, (1.8, -8.4, 4.6), (0.8, 0.6, 0.5)),
    (1673, (1.2, -10.4, 5.6), (0.6, 0.7, 0.5)),
    # S9 1673-1847 回望: 拔升收全景 (diorama 整板入画)
    (1760, (0.4, -13.0, 7.2), (0, 0.8, 0.5)),
    (1847, (0, -15.5, 9.2), (0, 0.9, 0.5)),
]
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

SCENES = [("s1", 0, 217), ("s2", 217, 414), ("s3", 414, 608), ("s4", 608, 810),
          ("s5", 810, 1037), ("s6", 1037, 1262), ("s7", 1262, 1494),
          ("s8", 1494, 1673), ("s9", 1673, 1847)]

def render_video(tag, f0, f1):
    """PNG 序列 (use_empty 下 FFMPEG 枚举不可用, 由外部 ffmpeg 合封 — gotchas G2)"""
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
    for f in [int(x) for x in str(args.test).split(",") if x.strip()]:
        print(f"[test] rendering frame {f}", flush=True)
        render_still(f)
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
