#!/usr/bin/env python3
"""levels_inventory.py — 关卡难度现状盘点（机器解析 game_state.gd，禁止手抄数值）。

从 autoload/game_state.gd 解析 LEVELS / ZOMBIE_KINDS / CARDS 常量，推导：
- 每关波次数 / 僵尸总数 / 种类构成 / 加权平均血量与速度（spec.numeric.difficulty 推导口径：
  血量 = 基准 × hpScale（boss 固定不乘）、速度 = 基准 × speedScale，权重 = 波次编制只数）
- 出怪节奏（spawn_interval / wave_gap / first_wave_delay）与起始阳光
- 相邻关卡逐项增幅 + 难度曲线单调性机判

判定口径（v3，spec difficulty.curveRule「难度曲线上调」）：hpScale / speedScale / 僵尸总数 /
加权血量 / 加权速度 / 平均每波 **严格递增**、波数 **单调不减** —— 「禁止任何相邻关卡出现整体
难度回落」；相邻增幅不再受 v2「≤30%」上限约束（spec 已声明第 1→2 关 +91.7% 为教学入口后的
第一道台阶、第 7 关台阶式跃升属 boss 编制）。v2 旧口径随策划案 v3 一并废止。

输出：stdout 人类可读表 + 同目录 levels-difficulty.json（供文档与后续工作流引用）。
用法：python3 levels_inventory.py [game_state.gd 路径]
"""
import json
import re
import sys
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "autoload" / "game_state.gd"


def parse_gd(text: str) -> tuple[dict, list, list]:
    """解析 ZOMBIE_KINDS / LEVELS / CARDS（本文件结构规整，逐块正则足够；解析失败即报错，不猜）。"""
    # ZOMBIE_KINDS: &"walker": {"hp": 100.0, "speed": 18.0, "sun_drop": 15},
    kinds = {}
    kinds_block = re.search(r"const ZOMBIE_KINDS: Dictionary = \{(.*?)\n\}", text, re.S).group(1)
    for m in re.finditer(r'&"(\w+)":\s*\{([^}]*)\}', kinds_block):
        fields = dict(re.findall(r'"(\w+)":\s*([\d.]+)', m.group(2)))
        kinds[m.group(1)] = {k: float(v) for k, v in fields.items()}
        # boss / crush 标记（布尔值不在 [\d.+] 里，单独抓）
        kinds[m.group(1)]["boss"] = '"boss": true' in m.group(2)
        kinds[m.group(1)]["crush"] = '"crush": true' in m.group(2)

    # LEVELS：按 "name": "..." 分块
    levels_block = re.search(r"const LEVELS: Array\[Dictionary\] = \[(.*?)\n\]", text, re.S).group(1)
    chunks = re.split(r'\{\s*\n\s*"name":', levels_block)[1:]
    levels = []
    for chunk in chunks:
        name = re.search(r'"([^"]+)"', chunk).group(1)
        head = chunk.split('"waves"')[0]
        scalars = {k: float(v) for k, v in re.findall(r'"(\w+)":\s*([\d.]+)', head)}
        tint = re.search(r'Color\("([0-9a-fA-F]+)"\)', chunk).group(1)
        waves = []
        # 每个 {"groups": [...]} 一波
        for wm in re.finditer(r'"groups":\s*\[(.*?)\]\s*\}', chunk, re.S):
            groups = [{"kind": k, "count": int(c)} for k, c in re.findall(r'&"(\w+)",\s*"count":\s*(\d+)', wm.group(1))]
            waves.append({"groups": groups})
        levels.append({"name": name, **scalars, "chapter_tint": tint, "waves": waves})

    cards_block = re.search(r"const CARDS: Array\[Dictionary\] = \[(.*?)\n\]", text, re.S).group(1)
    cards = []
    for m in re.finditer(r'&"(\w+)":\s*"([^"]*)".*?"cost":\s*(\d+),\s*"hp":\s*([\d.]+)', cards_block):
        cards.append({"id": m.group(1), "tag": m.group(2), "cost": int(m.group(3)), "hp": float(m.group(4))})
    return kinds, levels, cards


def level_stats(kind_meta: dict, level: dict) -> dict:
    total = sum(g["count"] for w in level["waves"] for g in w["groups"])
    by_kind: dict[str, int] = {}
    acc_hp = acc_speed = 0.0
    hp_scale = float(level.get("hp_scale", 1.0))
    speed_scale = float(level.get("speed_scale", 1.0))
    for w in level["waves"]:
        for g in w["groups"]:
            meta = kind_meta[g["kind"]]
            by_kind[g["kind"]] = by_kind.get(g["kind"], 0) + g["count"]
            # spec difficulty.curveRule：血量 = 基准 × hpScale（boss 固定，不乘）；速度全乘 speedScale
            hp = meta["hp"] * (1.0 if meta.get("boss") else hp_scale)
            acc_hp += g["count"] * hp
            acc_speed += g["count"] * meta["speed"] * speed_scale
    return {
        "name": level["name"],
        "start_sun": int(level.get("start_sun", 0)),
        "first_wave_delay_sec": level.get("first_wave_delay", 0),
        "wave_gap_sec": level.get("wave_gap", 0),
        "spawn_interval_sec": level.get("spawn_interval", 0),
        "hp_scale": hp_scale,
        "speed_scale": speed_scale,
        "chapter_tint": level.get("chapter_tint", ""),
        "waves": len(level["waves"]),
        "wave_composition": [
            [{"kind": g["kind"], "count": g["count"]} for g in w["groups"]]
            for w in level["waves"]
        ],
        "zombies_total": total,
        "zombies_by_kind": by_kind,
        "avg_hp": round(acc_hp / max(total, 1), 1),
        "avg_speed": round(acc_speed / max(total, 1), 2),
        "sun_income_if_all_killed": sum(g["count"] * int(kind_meta[g["kind"]]["sun_drop"]) for w in level["waves"] for g in w["groups"]),
    }


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    kinds, levels, cards = parse_gd(path.read_text(encoding="utf-8"))
    stats = [level_stats(kinds, lv) for lv in levels]

    # 相邻关增幅（信息面：v3 已废止 ≤30% 上限，数值仅作盘点展示）
    deltas = []
    for a, b in zip(stats, stats[1:]):
        row = {"from": a["name"], "to": b["name"]}
        for key in ("waves", "zombies_total", "avg_hp", "avg_speed"):
            row[key] = round((b[key] - a[key]) / max(a[key], 1e-9) * 100, 1)
        for key in ("spawn_interval_sec", "wave_gap_sec", "first_wave_delay_sec"):
            row[key] = round((b[key] - a[key]) / max(a[key], 1e-9) * 100, 1)
        deltas.append(row)
    # 难度曲线机判（spec v3 curveRule）：波数单调不减；hpScale / speedScale / 总数 /
    # 加权血量 / 加权速度 / 平均每波 严格递增（任一回落 = FAIL）
    violations = []
    for i in range(1, len(stats)):
        a, b = stats[i - 1], stats[i]
        if b["waves"] < a["waves"]:
            violations.append(f"第{i}→{i+1}关 波数回落 {a['waves']}→{b['waves']}")
        if b["hp_scale"] <= a["hp_scale"]:
            violations.append(f"第{i}→{i+1}关 hpScale 未严格递增 {a['hp_scale']}→{b['hp_scale']}")
        if b["speed_scale"] <= a["speed_scale"]:
            violations.append(f"第{i}→{i+1}关 speedScale 未严格递增 {a['speed_scale']}→{b['speed_scale']}")
        if b["zombies_total"] <= a["zombies_total"]:
            violations.append(f"第{i}→{i+1}关 僵尸总数未严格递增 {a['zombies_total']}→{b['zombies_total']}")
        if b["avg_hp"] <= a["avg_hp"]:
            violations.append(f"第{i}→{i+1}关 加权血量未严格递增 {a['avg_hp']}→{b['avg_hp']}")
        if b["avg_speed"] <= a["avg_speed"]:
            violations.append(f"第{i}→{i+1}关 加权速度未严格递增 {a['avg_speed']}→{b['avg_speed']}")
        per_wave_a = a["zombies_total"] / max(a["waves"], 1)
        per_wave_b = b["zombies_total"] / max(b["waves"], 1)
        if per_wave_b <= per_wave_a:
            violations.append(f"第{i}→{i+1}关 平均每波未严格递增 {per_wave_a:.2f}→{per_wave_b:.2f}")
    curve_ok = not violations

    out = {
        "source": str(path.relative_to(path.parents[3])) if len(path.parents) > 3 else str(path),
        "curve_rule": "v3: hpScale/speedScale/总数/加权血量/加权速度/平均每波 严格递增，波数单调不减"
        "（spec difficulty.curveRule「难度曲线上调」，v2 的 ≤30% 断崖上限已废止）",
        "kinds": kinds,
        "cards": cards,
        "levels": stats,
        "adjacent_deltas_pct": deltas,
        "curve_violations": violations,
        "difficulty_curve_strictly_rising": curve_ok,
    }
    dest = Path(__file__).resolve().parent / "levels-difficulty.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"关卡数：{len(levels)}（来源 {path.name}，机器解析）")
    print(f"{'关':2s} {'名称':16s} {'波':>3s} {'总数':>4s} {'hpScale':>7s} {'速度倍率':>7s} {'均HP':>7s} {'均速':>6s} {'出怪间隔':>8s} {'波间隔':>6s} {'首波延迟':>8s} {'起始阳光':>8s}")
    for i, s in enumerate(stats):
        comp = "+".join(f"{k}×{v}" for k, v in s["zombies_by_kind"].items())
        print(f"{i+1:2d} {s['name']:16s} {s['waves']:3d} {s['zombies_total']:4d} {s['hp_scale']:7.2f} {s['speed_scale']:7.2f} {s['avg_hp']:7.1f} {s['avg_speed']:6.1f} {s['spawn_interval_sec']:8.1f} {s['wave_gap_sec']:6.1f} {s['first_wave_delay_sec']:8.1f} {s['start_sun']:8d}  {comp}")
    print("\n相邻关增幅（%，仅盘点展示；v3 已废止 ≤30% 上限）：")
    for d in deltas:
        print(f"  {d['from']} → {d['to']}: 波数 {d['waves']:+.1f} | 总数 {d['zombies_total']:+.1f} | 均HP {d['avg_hp']:+.1f} | 均速 {d['avg_speed']:+.1f} | 出怪间隔 {d['spawn_interval_sec']:+.1f} | 波间隔 {d['wave_gap_sec']:+.1f} | 首波延迟 {d['first_wave_delay_sec']:+.1f}")
    if violations:
        print("\n难度曲线（v3 严格递增口径）违规：")
        for v in violations:
            print(f"  - {v}")
    print(f"\n难度曲线（v3 严格递增，无整体回落）：{'PASS' if curve_ok else 'FAIL'}")
    print(f"JSON 落盘：{dest}")
    return 0 if curve_ok else 1


if __name__ == "__main__":
    sys.exit(main())
