#!/usr/bin/env python3
"""stack-tower spec v1.1「登记就绪版」YAML 发射器 + 就绪校验器。

复现：python3 scripts/spec-v11-emit-yaml.py
输入：.myrd/spec/stack-tower-spec-v1.1-payload.json（node games/stack-tower/tools/build-spec-v11-ready.mjs 产出）
输出：.myrd/spec/stack-tower-spec-v1.1-ready.yaml（登记就绪全文终稿，与载荷同一内容、键序一致）

校验（任一失败非零退出）：
  1. YAML 回读与登记载荷深比全等（终稿 = 载荷，杜绝两套真相）
  2. v1 冻结数值七键在 v1 原稿 / v3 导出件 / v1.1 三方键序无关深比全等 → 「v1 冻结数值 diff 为空」
  3. 锚点一：首触用例存在（acc-a7，check 含 tests/audio/events.test.ts）
  4. 锚点二：全局证据条款存在（content.evidence.smokeLog 含四要素原文）
  5. D1/D2/D3 关闭要件齐备（基准机四要素 / 实现约束 + 不设 iOS 豁免 / BGM 双轨均不可省 / detail 含「含 QA 三处缺陷修复」且「不产生 v1.2」）
"""
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / ".myrd/spec/stack-tower-spec-v1.1-payload.json"
V11_YAML = ROOT / ".myrd/spec/stack-tower-spec-v1.1-ready.yaml"
V3_JSON = ROOT / ".myrd/spec/stack-tower-spec.json"
V1_JSON = ROOT / ".myrd/spec/stack-tower-spec-v1.json"

HEADER = """# =====================================================================
# stack-tower spec v1.1「登记就绪版」全文终稿（纸面定稿，待登记）
# =====================================================================
# 来源：本文件由 scripts/spec-v11-emit-yaml.py 从
#       .myrd/spec/stack-tower-spec-v1.1-payload.json 机械发射（勿手改；
#       改内容 → 改 games/stack-tower/tools/build-spec-v11-ready.mjs → 重新发射）。
# 版本口径：任务书所称 v1.1 ≡ 平台链 v3（approved, cmugok2uz000xm9ilx42t8pnl）的下一版；
#       登记动作 = POST /api/v1/game-design-specs/cmugok2uz000xm9ilx42t8pnl/revisions，
#       body = 本文件解析后的 {spec, detail}（仅此二键），version+1 单版落账，旧版自动 superseded。
# 冻结承诺：v1 起冻结数值七键 diff 为空；levels/entities/assets/既有 22 条 acceptance/world
#       既有规则逐字保留；版本链仅此一版（不产生 v1.2）。
# 前置条件：游戏 QA 纸面预审通过（登记就绪 / 打回）后方可登记；tests/audio/* 两用例落盘属
#       D4（主人答复 D5 前冻结），落账前由契约 not-runnable 通道显式挂起，不计绿不核销。
# =====================================================================
"""


def stable(value):
    """键序无关深比序列化（与契约 _runner.mjs stableStringify 同口径）。"""
    if value is None or not isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, list):
        return "[" + ",".join(stable(v) for v in value) + "]"
    return "{" + ",".join(f"{json.dumps(k)}:{stable(value[k])}" for k in sorted(value)) + "}"


def die(msg):
    print(f"FAIL {msg}")
    sys.exit(1)


def main():
    payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
    spec, detail = payload["spec"], payload["detail"]

    # —— 发射 YAML（保键序、中文原样）——
    body = yaml.safe_dump(
        {"spec": spec, "detail": detail},
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=100000,
    )
    V11_YAML.write_text(HEADER + body, encoding="utf-8")

    # —— 校验 1：YAML 回读与载荷深比全等 ——
    roundtrip = yaml.safe_load(V11_YAML.read_text(encoding="utf-8"))
    if stable(roundtrip) != stable(payload):
        die("YAML 回读与登记载荷深比不一致（终稿 ≠ 载荷）")

    v3 = json.loads(V3_JSON.read_text(encoding="utf-8"))["spec"]
    v1 = json.loads(V1_JSON.read_text(encoding="utf-8"))["spec"]

    # —— 校验 2：v1 冻结数值七键三方 diff 为空 ——
    for key in ["DEFAULT_SEED", "FIXED_STEP_MS", "MAX_DT_MS", "cut_width", "difficulty", "perfect_window", "scoring"]:
        if stable(spec["numeric"][key]) != stable(v3["numeric"][key]) or stable(v3["numeric"][key]) != stable(v1["numeric"][key]):
            die(f"v1 冻结数值 diff 非空: numeric.{key}")

    # —— 校验 3：锚点一（首触用例存在）——
    acc = {a["id"]: a for a in spec["acceptance"]}
    a7 = acc.get("acc-a7")
    if not a7:
        die("锚点缺失：acc-a7（冷启动首触即放置）不存在")
    if "tests/audio/events.test.ts" not in a7["check"]:
        die("锚点不符：acc-a7 check 未指向 tests/audio/events.test.ts")

    # —— 校验 4：锚点二（全局证据条款存在）——
    evidence = spec["content"].get("evidence", {})
    if "每条冒烟留文件名+日期+命令+输出摘要" not in evidence.get("smokeLog", ""):
        die("锚点缺失：全局证据条款（每条冒烟留文件名+日期+命令+输出摘要）")

    # —— 校验 5：D1/D2/D3 关闭要件 ——
    bd = spec["numeric"].get("benchmark_device", {})
    if bd.get("LAB_RUNNER") != "playwright-chromium" or bd.get("LAB_CPU_THROTTLE_X") != 4:
        die("D1 不符：numeric.benchmark_device 缺 playwright-chromium / 4x CPU throttle")
    if stable(bd.get("LAB_VIEWPORTS_PX")) != stable([[390, 844], [360, 640]]):
        die("D1 不符：numeric.benchmark_device 视口非 390x844 / 360x640 两档")
    if "设备型号 + UA" not in spec["content"].get("benchmark", {}).get("realDevice", ""):
        die("D1 不符：真机口径未要求单列注明设备型号 + UA")
    rules = spec["world"]["architecture_rules"]
    constraint = next((r for r in rules if "首触手势" in r and "AudioContext" in r), None)
    if not constraint:
        die("D2 不符：world 缺首触实现约束（AudioContext 解锁与播放）")
    for token in ["不得吞掉或延后首次出声", "50ms", "不设 iOS 豁免条款"]:
        if token not in constraint:
            die(f"D2 不符：实现约束缺「{token}」")
    if token not in a7["statement"]:
        die("D2 不符：acc-a7 statement 缺「不设 iOS 豁免条款」")
    bgm = evidence.get("bgmSeam", "")
    for token in ["听测留档", "tests/audio/bgm-loop.test.ts", "均不可省"]:
        if token not in bgm:
            die(f"D3 不符：BGM 接缝双轨证据缺「{token}」")
    for token in ["含 QA 三处缺陷修复", "不产生 v1.2", "版本链仅此一版"]:
        if token not in detail:
            die(f"revision detail 缺「{token}」")
    if len(spec["acceptance"]) != 23:
        die(f"acceptance 应为 23 条（22 既有 + acc-a7），实际 {len(spec['acceptance'])}")

    print(f"OK YAML 终稿 → {V11_YAML.relative_to(ROOT)}")
    print("OK 校验 1/5 YAML 回读 = 登记载荷（同一内容）")
    print("OK 校验 2/5 v1 冻结数值七键三方键序无关深比全等（diff 为空）")
    print("OK 校验 3/5 锚点一：acc-a7 首触用例存在（check → tests/audio/events.test.ts）")
    print("OK 校验 4/5 锚点二：全局证据条款存在（content.evidence.smokeLog）")
    print("OK 校验 5/5 D1/D2/D3 关闭要件齐备（基准机四要素 / 实现约束+无 iOS 豁免 / BGM 双轨 / detail 含 QA 三处缺陷修复+不产生 v1.2）")


if __name__ == "__main__":
    main()
