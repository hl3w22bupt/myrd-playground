#!/usr/bin/env python3
"""从 v1 机读契约件派生 v2 payload：numeric 只增不改，新增 visualQuality / gameplayDepth / ac6~ac12。"""
import json, sys

SRC = ".myrd/spec/design-spec.json"
spec = json.load(open(SRC, encoding="utf-8"))
assert spec["meta"]["version"] == "1.0.0", "源必须是 v1"

spec["meta"]["version"] = "2.0.0"
spec["meta"]["doc"] = "docs/games/farm-yard/design-spec-v2.md"
spec["meta"]["supersedes"] = "cmulah8f5002im9lfnzx1ycx7"
spec["meta"]["supersedesVersion"] = "1.0.0"
spec["meta"]["revisedAt"] = "2026-10-02"
spec["meta"]["revisionReason"] = "owner 两条硬意见：①画面品质不达标（物件偏小/构图空旷纯色块/缺生长动物收获动效/缺手绘质感/适配不全）；②玩法深度不足（自动化/一键订单生产链/批量操作缺失）"

spec["content"] = {}
spec["content"]["visualQuality"] = {
    "objectScaleRatio": [1.5, 2.0],
    "cellCoverageMin": 0.70,
    "matureHeightMinRatio": 0.85,
    "hitzone": {"minShortEdgePx": 88, "coverageMin": 0.90, "centerOffsetMaxPx": 12, "gapMinPx": 8},
    "layout": {
        "blankAreaRatioMax": 0.15, "skyBlankAreaRatioMax": 0.20,
        "anchorMinPer256Window": 2, "decorationDensityMinPer512": 1,
        "groundShadeLevelsMin": 3, "skyLayersMin": 3, "regionGapMaxPx": 12,
    },
    "animation": [
        {"id": "m1", "name": "生长阶段过渡", "ms": 240}, {"id": "m2", "name": "植物待机摇摆", "deg": 2, "periodSec": 2.8},
        {"id": "m3", "name": "成熟呼吸光", "pct": 5, "periodSec": 1.6}, {"id": "m4", "name": "动物待机行为", "intervalSec": [6, 10]},
        {"id": "m5", "name": "动物产蛋", "ms": 600}, {"id": "m6", "name": "动物互动反馈", "ms": 500, "particles": 6},
        {"id": "m7", "name": "收获弹跳", "ms": 120}, {"id": "m8", "name": "收获粒子", "ms": 600, "particles": 16},
        {"id": "m9", "name": "收获飞行", "ms": 400}, {"id": "m10", "name": "一键生产脉冲", "ms": 200},
        {"id": "m11", "name": "划动轨迹", "fadeMs": 300}, {"id": "m12", "name": "帮工工作循环", "speedPxSec": 120},
    ],
    "particleCapOnScreen": 120, "fpsFloor": {"desktop": 55, "mobile": 30},
    "art": {
        "outlineWidthPx": 3, "outlineColor": "#6B5B45", "outlineWobbleMaxPx": 2,
        "fillNoisePx": [2, 3], "fillNoiseAlphaMax": 0.08, "solidFillMaxPx": 128,
        "grassShades": ["#B7D194", "#A8C686", "#96B475"], "soilShades": ["#9B7B55", "#8A6F4D", "#7A5F42"],
        "cornerRadiusMinPx": 6, "textureStyle": "程序化手绘（无外部素材）", "webExportBudgetMb": 1,
    },
    "responsive": {
        "portraitDesign": "720x1280", "landscapeDesign": "1280x720", "layoutBreakpointAspect": 1.0,
        "landscapeLayout": "左栏62%田区(菜园+果园+花园+禽舍)｜右栏38%氛围区(休闲+工坊+农舍)",
        "scaleRange": [0.75, 1.6], "safeHotzonePx": 88,
        "testViewports": ["1280x720", "1920x1080", "720x1280", "390x844"],
        "mobileZoom": "等比缩放适配（非双指缩放，固定全景镜头沿 v1）",
    },
}

spec["numeric"]["helpers"] = {
    "unlockLevel": 4, "helperHouseCost": 800,
    "slots": [{"lv": 1, "upgradeCost": None, "count": 1}, {"lv": 2, "upgradeCost": 1500, "count": 2}, {"lv": 3, "upgradeCost": 3000, "count": 3}],
    "hireCost": 300, "wagePer10Min": 60, "duties": ["plant", "harvest", "feed"],
    "scanIntervalSec": 5, "actionGapSec": 2,
    "boundaries": "不自动交付订单、不自动买地/升级；金币不足停手+toast，不产生负数；与玩家手动动作走同一结算函数",
}
spec["numeric"]["autoOrder"] = {
    "enabled": True, "planPersist": True, "progressRing": "n/m", "capacityBound": True,
    "readyDeadlineSec": "最慢作物growSec+30", "disabledReasons": ["缺金币", "缺工坊", "缺解锁"],
}
spec["numeric"]["batch"] = {
    "enabled": True, "minHotzonePx": 88, "repeatGapMs": 60, "oncePerCell": True,
    "settlement": "与逐点点击完全一致（金币/经验/库存零偏差）",
    "insufficientFunds": "停止后续格 + fail 音效，已执行格不回滚",
}
spec["numeric"]["animalInteraction"] = {"tier": "P1", "cooldownSec": 30, "tapsForBuff": 5, "buffEffect": "eggIntervalMultiplier: 0.9", "hooks": "animalAffection 字段必须预留"}
spec["numeric"]["leisurePlay"] = {
    "tier": "P1",
    "bench": {"restSec": 10, "yieldMultiplier": 1.15, "perSessionLimit": 3},
    "fountain": {"tossCoins": 20, "effect": "订单刷新立即完成", "cooldownSec": 60},
    "teahouse": {"gift": "随机1件已解锁低价原料", "cooldownSec": 120},
}

spec["content"]["gameplayDepth"] = {
    "p0": [
        {"id": "B1", "name": "自动化帮工", "specRef": "design-spec-v2.md §2.B1", "acceptance": "ac11"},
        {"id": "B2", "name": "一键订单生产链", "specRef": "design-spec-v2.md §2.B2", "acceptance": "ac11"},
        {"id": "B3", "name": "划动批量操作", "specRef": "design-spec-v2.md §2.B3", "acceptance": "ac11"},
    ],
    "p1": [
        {"id": "B4", "name": "动物互动", "specRef": "design-spec-v2.md §2.B4", "acceptance": "ac12"},
        {"id": "B5", "name": "休闲天地轻玩法", "specRef": "design-spec-v2.md §2.B5", "acceptance": "ac12"},
    ],
    "p0Rule": "缺任一 P0 项即 v2 验收不通过；P1 不交付不判死，但须留入口占位与数据 hooks",
    "compatibility": "v1 numeric 全部键值不变，v2 仅新增键；实现先过 v1 契约再叠加 v2",
}

spec["acceptance"] += [
    {"id": "ac6", "statement": "所有可交互物件视觉主体相对 v1 放大1.5~2.0倍、占格比≥70%，点击热区短边≥88px且与视觉包围盒偏差≤12px", "check": "遍历 _hotspots 断言尺寸/间距/偏差 + 截图采样测占格比", "checkKind": "auto"},
    {"id": "ac7", "statement": "无空白纯色块：区域内空白窗占比≤15%（天空≤20%），任意256×256窗≥2个视觉锚点，地面≥3档色阶", "check": "截图像素采样统计（空白窗判定口径见 A2）", "checkKind": "auto"},
    {"id": "ac8", "statement": "动效 m1~m12 全部存在且参数达标，动效期间输入不锁、移动端≥30fps", "check": "冒烟脚本逐项触发 + 时序采样断言", "checkKind": "auto"},
    {"id": "ac9", "statement": "暖色手绘质感达标：3px暖褐描边+顶点抖动、大填充带噪点、无直角物件外形", "check": "噪点/描边像素统计断言 + owner 看截图/试玩拍板", "checkKind": "manual"},
    {"id": "ac10", "statement": "四视口（1280×720/1920×1080/720×1280/390×844）布局不破、热区全部≥88设计像素、横竖屏切换无重叠", "check": "每视口跑 ac6 断言 + UI 包围盒两两不相交断言", "checkKind": "auto"},
    {"id": "ac11", "statement": "P0 三件套可玩且数值正确：帮工60s离手全自动、一键订单免操作备齐、划动结算与逐点零偏差", "check": "冒烟脚本：雇帮工挂机/点一键生产/注入划动路径，逐项断言结算", "checkKind": "auto"},
    {"id": "ac12", "statement": "P1 两项：已交付按 B4/B5 规格验收；未交付须有入口占位与数据 hooks，owner 拍板「接受缺省」或「补做」", "check": "接口存在性断言 + owner 试玩拍板", "checkKind": "manual"},
]

payload = {
    "goalId": spec["meta"]["goalId"],
    "parentSpecId": "cmulah8f5002im9lfnzx1ycx7",
    "title": "田园小院",
    "spec": spec,
}
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/v2payload.json"
json.dump(payload, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
# 自检：v1 numeric 旧键值未被改动
v1 = json.load(open(SRC, encoding="utf-8"))
for k in v1["numeric"]:
    if k not in ("helpers", "autoOrder", "batch", "animalInteraction", "leisurePlay"):
        assert v1["numeric"][k] == spec["numeric"][k], f"numeric.{k} 被改动！"
print(f"OK -> {out}  acceptance={len(spec['acceptance'])}  numericKeys={sorted(spec['numeric'].keys())}")
