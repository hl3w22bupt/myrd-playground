#!/usr/bin/env python3
"""Godot 工程前置一致性检查（Proactive Check，无需 Godot 即可机判）。

对应技能包 SKILL.md「前置一致性检查清单」的可执行版：在真正运行游戏之前，
把「跨文件不一致、场景接线断裂、资源路径悬空」这类必然导致黑屏的问题拦下来。

用法：
    python3 scripts/preflight.py <工程目录>          # 默认当前目录

退出码：0 = 通过；1 = 发现问题；2 = 不是 Godot 工程（缺 project.godot）。
需要 Python 3.8+（无 3.9+ 专属 API，脚本自身不可用不会伪装成「工程有不一致」）。

检查项（与 OpenGame M4「Proactive 前置一致性检查」对齐）：
  P1  project.godot 存在且可解析
  P2  run/main_scene 指向的场景存在
  P3  config/icon 指向的资源存在
  P4  每个 autoload 的脚本存在，且单例名与脚本 class_name 不冲突
  P5  所有 .tscn/.tres/.gd 里引用的 res:// 路径都真实存在（.gd 先剥注释再查，
      防止「注释掉的示例路径」误报；文档类 .md/.sh 不在扫描集内）
  P6  每个 .tscn 的 ext_resource 声明与 ExtResource("id") 引用一一对应
  P7  每个 .tscn 的节点 parent 路径能在该场景树里解析
  P8  .tscn [connection] 声明的目标方法在目标脚本里存在（含 to="." 根节点、
      以及连接目标为实例化子场景根节点时子场景脚本里的一级解析）
  P9  class_name 全工程唯一（重复声明会让类型解析失败）
  P10 uid:// 引用都能在工程内找到声明（声明源：.gd 头注释 / 场景资源首行头 / .import）
  P11 禁止 Godot 3 残留语法/类型名（13 条模式，对照表见
      references/error-signatures.md §G：onready var / export var / export(...) /
      yield() / connect("sig",…) / KinematicBody* / 裸 Spatial / 裸 RigidBody /
      带参 move_and_slide / load(...).instance() / Pool*Array / Tween.new() /
      interpolate_property()。在剥掉 # 注释后的代码里匹配 —— 迁移对照写进注释
      不触发）
  P12 .gd 里 connect(方法名) 的目标方法在同文件中存在（实测盲区：场景级
      [connection] 能查，代码级 connect 拼错方法名只有运行期才会暴露；
      Godot 内建 callable 豁免 —— queue_free/hide 这类方法体本来就不在本文件）
  P13 工程含「会渲染的中文文案」时必须设置 [gui] theme/custom_font 且指向的
      字体文件存在（Web 导出跑在浏览器沙箱里拿不到系统字体，引擎内置默认
      字体只含拉丁字形；没有这份字体，中文会渲染成 TextServer 缺字方块）。
      .gd 先剥注释再检测 —— 注释里的中文不会被渲染，不算触发条件

健壮性说明：.tscn 的方括号头一律按 key=value 解析、与属性顺序无关。
Godot 编辑器保存场景时会写入 `uid="…"`、调整属性顺序 —— 任何按固定顺序匹配
的正则在「编辑器保存过一次」之后都会集体失效（漏报 + 误报，实测见 README）。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RES_REF = re.compile(r"""["'](res://[^"']+)["']""")
UID_TOKEN = re.compile(r"uid://(?!//)[A-Za-z0-9]+")
CONNECT_CALL = re.compile(r"^\s*(?:[\w\[\]\"\.]+?)\.connect\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)", re.M)
EXT_RES_USE = re.compile(r'ExtResource\(\s*"([^"]+)"\s*\)')
CLASS_NAME = re.compile(r"^class_name\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
ATTR = re.compile(r'(\w+)\s*=\s*(?:"([^"]*)"|([^\s\]]+))')
SCRIPT_EXT_IN_HEADER = re.compile(r'script\s*=\s*ExtResource\("([^"]+)"\)')
INSTANCE_EXT_IN_HEADER = re.compile(r'instance\s*=\s*ExtResource\("([^"]+)"\)')
# Godot 内建/高频成员方法作为 callable 连接（`timer.timeout.connect(queue_free)`）是
# 合法写法，方法体不可能出现在本文件里 —— 豁免检查，否则健康工程会被误报打回。
BUILTIN_CONNECT_TARGETS = frozenset({
    "queue_free", "free", "hide", "show", "emit_signal", "set_visible", "set_deferred",
    "call_deferred", "callv", "grab_focus", "release_focus", "clear", "reset_size",
    "reparent", "remove_child", "add_child", "set_process", "set_physics_process",
    "set_process_mode", "start", "stop", "play", "pause", "seek", "select", "deselect",
})
GD3_PATTERNS = (
    (re.compile(r"^\s*onready\s+var\b", re.M), "Godot 3 语法 `onready var` → 应为 `@onready var`"),
    (re.compile(r"^\s*export\s*\(", re.M), "Godot 3 语法 `export(...)` → 应为 `@export ...`"),
    (re.compile(r"^\s*export\s+var\b", re.M), "Godot 3 语法 `export var` → 应为 `@export var`"),
    (re.compile(r"\byield\s*\("), "Godot 3 语法 `yield()` → 应为 `await`"),
    (re.compile(r"\bconnect\s*\(\s*\""), 'Godot 3 语法 `connect("sig", self, "m")` → 应为 `sig.connect(m)`'),
    (re.compile(r"\bKinematicBody(2D|3D)?\b"), "Godot 3 类型 `KinematicBody*` → 应为 `CharacterBody2D` / `CharacterBody3D`"),
    (re.compile(r"\bextends\s+Spatial\b|:\s*Spatial\b"), "Godot 3 类型 `Spatial` → 应为 `Node3D`"),
    (re.compile(r"\bRigidBody\b(?!2D|3D)"), "Godot 3 类型 `RigidBody`（裸名）→ 应为 `RigidBody3D`（2D 场景用 `RigidBody2D`）"),
    (re.compile(r"\bmove_and_slide\s*\(\s*[^)]"), "Godot 3 签名 `move_and_slide(vel, up)` → 应先给 `velocity` 赋值，再无参调用 `move_and_slide()`"),
    (re.compile(r"\b(?:load|preload)\s*\([^)]*\)\s*\.\s*instance\s*\(\s*\)"), "Godot 3 API `.instance()` → 应为 `.instantiate()`"),
    (re.compile(r"\bPool\w+Array\b"), "Godot 3 类型 `Pool*Array` → 应为 `Packed*Array`"),
    (re.compile(r"\bTween\.new\s*\("), "Godot 3 `Tween.new()` → 应为 `create_tween()`"),
    (re.compile(r"\binterpolate_property\s*\("), "Godot 3 Tween API `interpolate_property()` → 应为 `create_tween()` + `tween_property()`"),
)

CHECKS = 13

# CJK 渲染字符集：假名、汉字（扩展A/基本区/兼容区）、CJK 标点、全角形式。
# 命中任意一个就视为「工程会渲染非拉丁文案」，P13 要求全局默认字体兜底。
CJK_GLYPH = re.compile(r"[぀-ヿ㐀-䶿一-鿿豈-﫿　-〿＀-￯]")


def fail(messages: list[str], code: str, message: str) -> None:
    messages.append(f"PREFLIGHT: FAIL [{code}] {message}")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


def parse_attrs(header: str) -> dict[str, str]:
    """解析 .tscn 方括号头里的 key=value 属性（键序无关）。"""
    attrs: dict[str, str] = {}
    for match in ATTR.finditer(header):
        attrs[match.group(1)] = match.group(2) if match.group(2) is not None else match.group(3)
    return attrs


def section_headers(text: str, kind: str) -> list[tuple[dict[str, str], str]]:
    """收集 `[kind ...]` 头 → [(属性字典, 头原文), …]。"""
    return [(parse_attrs(match.group(1)), match.group(1))
            for match in re.finditer(rf"^\[{kind}\s+([^\]]*)\]", text, re.M)]


SECTION_RE = re.compile(r"^\[(\w+)\s*([^\]]*)\]", re.M)


def scene_blocks(text: str, kind: str) -> list[tuple[dict[str, str], str]]:
    """收集 `[kind …]` 段 → [(属性字典, 段全文), …]。

    必须用「段」而不是「行」：节点的 `script = ExtResource("id")` /
    `instance = ExtResource("id")` 写在头的**下一行**（节点体），
    只搜头文本会把所有节点都当成「没挂脚本 / 不是实例」，P8 静默失效。
    """
    matches = list(SECTION_RE.finditer(text))
    blocks: list[tuple[dict[str, str], str]] = []
    for index, match in enumerate(matches):
        if match.group(1) != kind:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((parse_attrs(match.group(2)), text[match.start():end]))
    return blocks


def strip_gd_comment(code_line: str) -> str:
    """去掉一行 GDScript 的 # 注释（字符串字面量里的 # 不算注释）。"""
    quote = ""
    index = 0
    while index < len(code_line):
        ch = code_line[index]
        if quote:
            if ch == "\\":
                index += 2
                continue
            if ch == quote:
                quote = ""
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            return code_line[:index]
        index += 1
    return code_line


def parse_project_godot(text: str) -> dict[str, dict[str, str]]:
    """极简 INI 解析：section -> {key: value}。只用于读取 project.godot 关键字段。"""
    sections: dict[str, dict[str, str]] = {}
    current = ""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            sections.setdefault(current, {})
            continue
        if "=" in line and current:
            key, _, value = line.partition("=")
            sections[current][key.strip()] = value.strip().strip('"')
    return sections


def strip_res(path_value: str) -> str | None:
    """从 project.godot 的值里取出 res:// 相对路径（autoload 形如 *res://autoload/x.gd）。"""
    match = re.search(r"res://([^\"\s]+)", path_value)
    return match.group(1) if match else None


def rel_path_of(res_path: str) -> str:
    """res://路径 → 工程相对路径（与 res_files / script_bodies 的键形态一致）。"""
    return res_path[len("res://"):] if res_path.startswith("res://") else res_path


def main() -> int:
    project_dir = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    project_file = project_dir / "project.godot"
    messages: list[str] = []

    if not project_file.is_file():
        print(f"PREFLIGHT: FAIL [P1] 不是 Godot 工程：{project_dir} 下没有 project.godot")
        return 2

    project = parse_project_godot(read_text(project_file))
    res_files = {str(p.relative_to(project_dir)) for p in project_dir.rglob("*") if p.is_file()}

    def exists(res_path: str) -> bool:
        rel = res_path[len("res://"):] if res_path.startswith("res://") else res_path
        if rel.startswith(".godot/"):
            return True  # 引擎生成的导入缓存，导入后即存在，不做静态核对
        return rel in res_files or any(f == rel or f.startswith(rel + ".") for f in res_files)

    # P2 主场景 / P3 图标
    app = project.get("application", {})
    main_scene = app.get("run/main_scene", "")
    if not main_scene:
        fail(messages, "P2", "project.godot 未设置 run/main_scene（无头运行会没有入口场景）")
    elif not exists(main_scene):
        fail(messages, "P2", f"run/main_scene 指向的场景不存在：{main_scene}")
    icon = app.get("config/icon", "")
    if icon and not exists(icon):
        fail(messages, "P3", f"config/icon 指向的资源不存在：{icon}")

    # P4 autoload
    for key, value in project.get("autoload", {}).items():
        rel = strip_res(value)
        if rel is None:
            fail(messages, "P4", f"autoload {key} 的值不是 res:// 路径：{value}")
            continue
        if rel not in res_files:
            fail(messages, "P4", f"autoload {key} 的脚本不存在：res://{rel}")
            continue
        declared = CLASS_NAME.search(read_text(project_dir / rel))
        if declared and declared.group(1) == key:
            fail(messages, "P4", f"autoload 单例名 {key} 与脚本 class_name {key} 冲突（Godot 会报 hides an autoload singleton）")

    # 收集脚本体（P8/P9/P11/P12 用）
    script_bodies: dict[str, str] = {}
    class_names: dict[str, str] = {}
    for rel in sorted(res_files):
        if not rel.endswith(".gd"):
            continue
        body = read_text(project_dir / rel)
        script_bodies[rel] = body
        declared = CLASS_NAME.search(body)
        if declared:
            name = declared.group(1)
            if name in class_names:
                fail(messages, "P9", f"class_name {name} 重复声明：{class_names[name]} 与 {rel}")
            else:
                class_names[name] = rel

    # P5 res:// 引用存在性 + P10 uid 引用。
    # 扫描集用白名单：只有真正承载资源引用的文件类型才检查。
    # （曾用黑名单 —— .md/.sh 里的示例路径会误报，而最该查的 .gd 反而被整体跳过。）
    scan_files = sorted(
        rel for rel in res_files
        if rel.endswith((".tscn", ".tres", ".gd")) and ".godot/" not in rel
    )
    declared_uids: set[str] = set()
    referenced_uids: list[tuple[str, str]] = []
    path_backed_uids: set[str] = set()  # 同一处引用自带可解析 res:// 路径的 uid（引擎可回退到路径）
    for rel in scan_files:
        raw = read_text(project_dir / rel)
        if rel.endswith(".gd"):
            body = "\n".join(strip_gd_comment(line) for line in raw.splitlines())
            # .gd 的自身 uid 声明写在文件头注释里（Godot 4.4+）：注释行上的 token 算声明
            for line in raw.splitlines():
                stripped = line.strip()
                if stripped.startswith("#"):
                    declared_uids.update(UID_TOKEN.findall(stripped))
        else:
            body = raw
            # .tscn/.tres 的自身 uid 声明在首行头部（[gd_scene … uid="uid://…"]）
            first_line = raw.splitlines()[0] if raw.splitlines() else ""
            declared_uids.update(UID_TOKEN.findall(first_line))
        for res_ref in RES_REF.findall(body):
            if not exists(res_ref):
                fail(messages, "P5", f"{rel} 引用的资源不存在：{res_ref}")
        for uid in UID_TOKEN.findall(body):
            referenced_uids.append((rel, uid))
        # 编辑器保存的场景里 ext_resource 常同时带 uid="uid://…" 与 path="res://…"：
        # 只要路径真实存在，uid 对不上时引擎会回退到路径（仅告警，不黑屏）→ 不作硬失败
        for line in raw.splitlines():
            if "uid://" not in line:
                continue
            path_match = re.search(r'path="(res://[^"]+)"', line)
            if path_match and exists(path_match.group(1)):
                path_backed_uids.update(UID_TOKEN.findall(line))
    # .import 是引擎生成的导入元数据：记录源资产的 uid → 视为声明源（不作引用源）
    for rel in sorted(res_files):
        if rel.endswith(".import") and ".godot/" not in rel:
            declared_uids.update(UID_TOKEN.findall(read_text(project_dir / rel)))
    for rel, uid in referenced_uids:
        if uid in declared_uids or uid in path_backed_uids:
            continue
        fail(messages, "P10", f"{rel} 引用的 uid 无声明：{uid}（uid 与路径二选一，建议统一用 res:// 路径）")

    # P6/P7/P8 场景内部一致性（头属性键序无关，编辑器保存过的场景同样适用）
    for rel in scan_files:
        if not rel.endswith(".tscn"):
            continue
        text = read_text(project_dir / rel)
        ext_headers = section_headers(text, "ext_resource")
        declared_ext = {attrs.get("id", ""): attrs.get("path", "") for attrs, _raw in ext_headers}
        for ext_id, path in declared_ext.items():
            if not exists(path):
                fail(messages, "P6", f"{rel} ext_resource id={ext_id} 指向的文件不存在：{path}")
        for ext_id in EXT_RES_USE.findall(text):
            if ext_id not in declared_ext:
                fail(messages, "P6", f"{rel} 使用了未声明的 ExtResource(\"{ext_id}\")")

        node_headers = scene_blocks(text, "node")
        root_name = node_headers[0][0].get("name", "") if node_headers else ""
        node_paths: set[str] = {"."}
        scripts_by_node: dict[str, str] = {}
        instance_roots: dict[str, str] = {}  # 节点名 → 被实例化的子场景路径
        for attrs, block in node_headers:
            name = attrs.get("name", "")
            parent = attrs.get("parent", "")
            node_paths.add(name if parent in (".", "") else f"{parent}/{name}")
            script_ext = SCRIPT_EXT_IN_HEADER.search(block)
            if script_ext:
                # 脚本路径统一转成工程相对形态：script_bodies / .gd 扫描都按相对路径作键
                scripts_by_node[name] = rel_path_of(declared_ext.get(script_ext.group(1), ""))
            instance_ext = INSTANCE_EXT_IN_HEADER.search(block)
            if instance_ext:
                instance_roots[name] = declared_ext.get(instance_ext.group(1), "")
        for attrs, _raw in node_headers:
            parent = attrs.get("parent", "")
            if parent and parent != "." and parent not in node_paths:
                fail(messages, "P7", f"{rel} 节点 parent 路径无法解析：\"{parent}\"（场景树接线断裂）")

        for attrs, _raw in section_headers(text, "connection"):
            signal = attrs.get("signal", "")
            from_node = attrs.get("from", "")
            to_node = attrs.get("to", "")
            method = attrs.get("method", "")
            for endpoint in (from_node, to_node):
                if endpoint and endpoint != "." and endpoint not in node_paths:
                    fail(messages, "P8", f"{rel} connection 的节点不存在：{endpoint}（信号 {signal}）")
            target_script = resolve_connection_script(root_name, to_node, scripts_by_node, instance_roots, project_dir)
            if target_script and target_script in script_bodies:
                if not re.search(rf"^\s*func\s+{re.escape(method)}\s*\(", script_bodies[target_script], re.M):
                    fail(messages, "P8", f"{rel} 信号 {signal} 连到的方法 {method}() 在 {target_script} 里不存在")

    # P11 Godot 3 残留语法/类型名（剥掉 # 注释后再匹配：
    # 「不要用 KinematicBody2D」这类防退化注释是合法的，不触发）
    for rel, body in script_bodies.items():
        stripped = "\n".join(strip_gd_comment(line) for line in body.splitlines())
        for pattern, hint in GD3_PATTERNS:
            if pattern.search(stripped):
                fail(messages, "P11", f"{rel} {hint}")

    # P12 代码级 connect() 的目标方法存在性（自连接形态；跨文件 Callable 由运行期冒烟兜底）
    for rel, body in script_bodies.items():
        for target in CONNECT_CALL.findall(body):
            if target in BUILTIN_CONNECT_TARGETS:
                continue
            if not re.search(rf"^\s*func\s+{re.escape(target)}\s*\(", body, re.M):
                fail(messages, "P12", f"{rel} connect({target}) 的目标方法在同文件里不存在（方法被改名/删除后接线断裂）")

    # P13 CJK 字体保障（中文文案 × Web 导出沙箱无系统字体的组合必翻车，见 docstring）
    render_bodies: list[str] = []
    for rel in scan_files:
        body = read_text(project_dir / rel)
        if rel.endswith(".gd"):
            body = "\n".join(strip_gd_comment(line) for line in body.splitlines())
        render_bodies.append(body)
    if any(CJK_GLYPH.search(body) for body in render_bodies):
        custom_font = project.get("gui", {}).get("theme/custom_font", "")
        if not custom_font:
            fail(messages, "P13",
                 "工程含会渲染的中文文案，但未设置 [gui] theme/custom_font"
                 "（Web 导出拿不到系统字体，中文会渲染成缺字方块；"
                 "参考 minimal-2d 模板 assets/fonts/ 的子集化 Noto Sans CJK SC）")
        elif not exists(custom_font):
            fail(messages, "P13", f"gui/theme/custom_font 指向的字体不存在：{custom_font}")

    if messages:
        for message in messages:
            print(message)
        print(f"PREFLIGHT: FAIL 共 {len(messages)} 处不一致（{CHECKS} 类检查）")
        return 1

    project_file_count = sum(1 for rel in res_files if ".godot/" not in rel)
    print(f"PREFLIGHT: PASS {CHECKS} 类前置一致性检查全部通过（{project_file_count} 个工程文件，不含 .godot/ 导入缓存）")
    return 0


def resolve_connection_script(
    root_name: str,
    to_node: str,
    scripts_by_node: dict[str, str],
    instance_roots: dict[str, str],
    project_dir: Path,
) -> str | None:
    """尽力找到 connection 目标节点对应的脚本相对路径（P8 方法存在性检查用）。

    三种情况：
      - to="."（根节点）：取根节点名（此前只查 "." 这个不存在的键，检查被静默跳过）
      - 节点自带 script=ExtResource(...)：直接取
      - 节点是实例化的子场景：读子场景，取其根节点的脚本（一级，带环保护）
    """
    node_name = root_name if to_node in ("", ".") else to_node.split("/")[-1]
    script = scripts_by_node.get(node_name)
    if script:
        return script
    instance_scene = instance_roots.get(node_name)
    if instance_scene:
        return root_script_of_scene(instance_scene, project_dir, seen=set())
    return None


def root_script_of_scene(scene_path: str, project_dir: Path, seen: set[str]) -> str | None:
    """读一个 .tscn，返回它根节点挂的脚本相对路径（不递归子场景的子场景）。"""
    rel = scene_path[len("res://"):] if scene_path.startswith("res://") else scene_path
    if rel in seen or not rel.endswith(".tscn"):
        return None
    seen.add(rel)
    text = read_text(project_dir / rel)
    ext_headers = section_headers(text, "ext_resource")
    declared_ext = {attrs.get("id", ""): attrs.get("path", "") for attrs, _raw in ext_headers}
    for attrs, block in scene_blocks(text, "node"):
        script_ext = SCRIPT_EXT_IN_HEADER.search(block)
        if script_ext:
            return rel_path_of(declared_ext.get(script_ext.group(1), "")) or None
    return None


if __name__ == "__main__":
    sys.exit(main())
