#!/usr/bin/env python3
"""四轮发布收口（v2.2.1-hotzone-hint-fix）：向目标 artifacts 追加本轮 hosted_app 条目。
既有条目一律保留（含历史 hosted_app 0/7/10/15），只 append，不做原位覆盖。
合并键契约与平台 upsertArtifactEntry 一致：artifactType:artifactId。"""
import json
import os
import urllib.request

API = os.environ["PLATFORM_API_URL"]
TOKEN = os.environ["MYRD_TOKEN"]
GOAL_ID = "cmtoavt8w0008m9y6kclb4s19"
HOSTED_APP_ID = "cmtoavt8p0006m9y6kzy2u14w"
DEPLOYMENT_ID = "cmu8ciomo004nm9x5ct9bbqg2"
LIVE_URL = "https://leomac-studio.tail49399e.ts.net/apps/ai/"
REL_COMMIT = "673b685"   # 部署 commitHash（三 Bug 修复头）
QA_COMMIT = "7a9e1c3"    # 线上 28/28 取证提交


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
before = len(arts)
assert before >= 18, f"现有 artifacts 仅 {before} 条，疑似读脏，中止"

detail = (
    f"liveUrl={LIVE_URL}；deploymentId={DEPLOYMENT_ID}（version=13，gitRef=myrd/games-goal-cmtoavt8w0008m9y6kclb4s19"
    f"@{REL_COMMIT}（=673b6858b126b9a2e48bc2cd21c1bb4909f75b0b，三 Bug 修复头），HostedApp status=running、构建 finishedAt 已落）；"
    f"发布通道=工坊 scaffold→implement→deploy 重跑收口：兜底节点代码改动（9edde78 DPR 热区+布局炸弹、673b685 重导出+hint 修复+门禁断言升级）"
    f"已落发布分支，deploy 节点本地门禁 PASS 后发起部署（HostedApp 链路，非 PublishedApp）；"
    f"门禁=仓库内三件套：Godot 4.3.stable（resolve-godot）+ preflight 13 类 PASS（174 工程文件）+ "
    f"GODOT_SMOKE_FRAMES=240 冒烟退出码 0 且日志含 GODOT_SMOKE: PASS（判定脚本 std-skills/godot-game-dev/scripts/ 未改动）；"
    f"线上核验=/health 200（assets=5，version=2.2.1-hotzone-hint-fix）、/ 308→200（可玩页，canvas+相对路径资产）、"
    f"api/public/assets/index.pck.gz.b64 公网 base64→gunzip 往返 md5=3adbe116a42c07f7ba432486270a5384 与本地导出逐字节一致"
    f"（v12 缺陷版为 acc2804e…，已确认换血）；wasm 引擎指纹 af4a8fc2… 与 v11/v12 同源；"
    f"三 Bug 核验结论（线上实测，非本地推断）：Bug1 选项热区 DPR 换算失效（P1，cmu85yqnf002wm9x5807ozpv2）=resolved——"
    f"A6-hotzone44 PASS，73 逻辑px×生效contentScale1.828=133 物理px ≥44×DPR3=132（=44.5 CSS pt，上轮线上 14.7）；"
    f"Bug2 壳层 #hint 遮挡选项文字（P1，cmu85yvsh002ym9x517ufmbrj）=resolved——G3-hint-overlap PASS，触屏环境提示条 hidden=true、重叠=0"
    f"（上轮重叠 3200px²，修复=三信号触屏检测并集+boot 后隐藏）；Bug3 冒烟默认帧预算误判（P2，cmu85z7k50030m9x54nfnyo7o）=resolved（保持）——"
    f"帧预算 120→240（8604650），本轮裸跑同源冒烟 PASS；"
    f"mobileTouchQA 线上全量 28/28（iPhone 13 DPR3 26 项 + Pixel 7 DPR2.625 冒烟 2 项）：点按推进/选项结算、摇杆拖动驱动位移、"
    f"无缩放/滚动/长按冲突、横竖屏正常、音频解锁 running、46.3fps(仿真)、console 零 error；"
    f"取证=games/ai/qa/mobile-touch-acceptance/results.json+shots（分支 myrd/ai-game-goal-cmtoavt8w0008m9y6kclb4s19@{QA_COMMIT}）"
)

entry = {
    "op": "run_workflow",
    "artifactId": HOSTED_APP_ID,
    "artifactType": "hosted_app",
    "title": "《我被ai女友包围了》已部署（四轮发布收口 v2.2.1-hotzone-hint-fix）",
    "status": "completed",
    "detail": detail,
    "hostedAppId": HOSTED_APP_ID,
    "deploymentId": DEPLOYMENT_ID,
    "liveUrl": LIVE_URL,
    "mobileTouchQa": {
        "verdict": "playable",
        "passed": 28,
        "total": 28,
        "p1": [],
        "report": f"games/ai/qa/mobile-touch-acceptance/report.md@{QA_COMMIT}",
    },
    "threeBugVerdict": {
        "hotzone-dpr-scaling-broken": "resolved（线上 44.5 CSS pt ≥44）",
        "hint-overlay-covers-options": "resolved（触屏 hint hidden=true，重叠 0）",
        "smoke-frame-budget-misjudge": "resolved（帧预算 240，冒烟 PASS）",
    },
}

arts.append(entry)
req("PATCH", f"/api/v1/goals/{GOAL_ID}", {"artifacts": arts})
print(f"PATCH ok（{before} → {before + 1} 条）")

check = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]["artifacts"]
h = [a for a in check if a.get("artifactType") == "hosted_app"][-1]
print("hosted_app 条目数 =", len([a for a in check if a.get("artifactType") == "hosted_app"]), "/ 总数 =", len(check))
print("liveUrl =", h.get("liveUrl"), "| deploymentId =", h.get("deploymentId"), "| hostedAppId =", h.get("hostedAppId"))
print("title =", h.get("title"))
print("detail 头 80 字 =", (h.get("detail") or "")[:80])
