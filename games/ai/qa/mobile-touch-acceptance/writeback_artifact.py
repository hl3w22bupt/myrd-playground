#!/usr/bin/env python3
"""把移动端触屏验收结论回写目标 artifacts：原位更新最近一条 hosted_app 条目
（与平台 upsertArtifactEntry 的 artifactType:artifactId 合并键一致），不动其它条目。"""
import json
import os
import urllib.request

API = os.environ["PLATFORM_API_URL"]
TOKEN = os.environ["MYRD_TOKEN"]
GOAL_ID = "cmtoavt8w0008m9y6kclb4s19"
HOSTED_APP_ID = "cmtoavt8p0006m9y6kzy2u14w"
DEPLOYMENT_ID = "cmu836iw00027m9x5uv3snds0"
LIVE_URL = "https://leomac-studio.tail49399e.ts.net/apps/ai/"
QA_COMMIT = "dbb9fb73"


def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(
        API + path, data=data, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())


goal = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]
arts = goal.get("artifacts") or []
idx = max(i for i, a in enumerate(arts) if a.get("artifactType") == "hosted_app")
entry = dict(arts[idx])
assert entry.get("artifactId") == HOSTED_APP_ID, "最近 hosted_app 条目非当前 v11 部署"

qa_note = (
    f"；mobileTouchQA（2026-09-19，触屏 UA+CDP 触摸事件仿真 iPhone 13 DPR3 / Pixel 7）："
    f"结论=移动端可玩（26/28 检查通过）——点按启动/推进 14ms(≤100ms)、选项点选结算、"
    f"摇杆拖动驱动玩家位移(~240px/s 与 spec.move_speed 吻合)、无缩放/滚动/长按冲突、"
    f"横竖屏切换正常、音频上下文解锁 running、47fps(SwiftShader 仿真)、console 零 error；"
    f"遗留 P1×2：①触控热区 DPR 换算失效（选项热区 14.7 CSS pt < 44，_min_option_height 的 "
    f"window/viewport 换算在 Web 导出下恒为 1）②壳层 #hint 提示条遮挡选项 2/3 文字(重叠 3200px²)；"
    f"报告与证据=games/ai/qa/mobile-touch-acceptance/（分支 myrd/ai-game-goal-cmtoavt8w0008m9y6kclb4s19@{QA_COMMIT}）"
)
if "mobileTouchQA" not in entry.get("detail", ""):
    entry["detail"] = entry.get("detail", "") + qa_note
entry["hostedAppId"] = HOSTED_APP_ID
entry["deploymentId"] = DEPLOYMENT_ID
entry["liveUrl"] = LIVE_URL
entry["mobileTouchQa"] = {
    "verdict": "playable_with_issues",
    "passed": 26, "total": 28,
    "p1": ["hotzone-dpr-scaling-broken", "hint-overlay-covers-options"],
    "report": f"games/ai/qa/mobile-touch-acceptance/report.md@{QA_COMMIT}",
}
arts[idx] = entry

req("PATCH", f"/api/v1/goals/{GOAL_ID}", {"artifacts": arts})
print("PATCH ok; verify:")
check = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]["artifacts"]
h = [a for a in check if a.get("artifactType") == "hosted_app"][-1]
print("liveUrl =", h.get("liveUrl"), "| deploymentId =", h.get("deploymentId"), "| hostedAppId =", h.get("hostedAppId"))
print("mobileTouchQa =", json.dumps(h.get("mobileTouchQa"), ensure_ascii=False))
print("detail tail =", h.get("detail", "")[-120:])
