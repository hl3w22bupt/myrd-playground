#!/usr/bin/env python3
"""三 Bug 复核终态回写：Bug3 → resolved（附修复证据），Bug1/2 → 保持 unconfirmed（附复核证据与复现步骤）。"""
import json, os, urllib.request

API = os.environ["PLATFORM_API_URL"]
TOKEN = os.environ["MYRD_TOKEN"]

def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())

REPORT = "games/ai/qa/mobile-touch-recheck/RECHECK-REPORT.md（分支 myrd/ai-game-goal-cmtoavt8w0008m9y6kclb4s19，PR https://github.com/hl3w22bupt/myrd-playground/pull/20）"
ENV = ("线上 https://leomac-studio.tail49399e.ts.net/apps/ai/（v2.2.0-touch-viewport，pck md5 acc2804ee4ebccbe97782db00dad4f0a）；"
       "Playwright Chromium iPhone 13 DPR3 仿真（SwiftShader 软渲染，CDP 原生触摸注入）")

COMMON_FINGERPRINT = ("线上部署指纹=index.pck md5 acc2804ee4ebccbe97782db00dad4f0a / index.wasm md5 "
    "af4a8fc2925d992348eb30deeeb54360（经 /apps/ai/api/public/assets/*.gz.b64 base64→gunzip 往返校验）＝缺陷版本 "
    "1f97f2a5 导出的 v2.2.0-touch-viewport 产物；修复运行 cmu860w2d0035m9x5z58uo6xf（completed）实际产出为玩法验收升级 "
    "（commit 5772961，workflow 分支），未触及三 Bug 任何修复点，其发布决策保留剧情引擎版并以 commitHash=1f97f2a5 重部署"
    "（deployment cmu87uw3z003nm9x5h3bitqf7，v12）——三 Bug 均无修复落地，线上亦无热修。")

BUG1 = "cmu85yqnf002wm9x5807ozpv2"
BUG2 = "cmu85yvsh002ym9x517ufmbrj"
BUG3 = "cmu85z7k50030m9x54nfnyo7o"

updates = {
    BUG1: {
        "tags": ["games/ai", "mobile-touch", "P1", "qa-recheck-2026-09-19", "unfixed"],
        "actualBehavior": ("【QA 复核 2026-09-19】未修复，线上复现。同口径复测（复用上一轮验收工具 qa_mobile_touch.mjs，"
            "iPhone 13 DPR3，QA_FAST=1 全流程 26 项）：A6-hotzone44 NG——optionHotzoneCssComputed=14.7 CSS pt"
            "（44 视口px×0.333，标准 33%），optionPlateHeightCssMeasured=6.3 CSS px，与 v11 基线逐项同值、零修复痕迹。"
            + COMMON_FINGERPRINT +
            " 残留根因：games/ai/scripts/main.gd _min_option_height() 以 window_get_size()/get_viewport_rect().size 换算，"
            "Web 导出下两者同为画布物理像素（1170×1992），比值恒 1 → min_touch_px=44 落成 44 物理 px。"
            "复现步骤：①iPhone 13（DPR3）打开 liveUrl ②画面内点按启动、连续点按推进 6 次至选择节点 "
            "③量选项按钮热区=44 视口px×(1/3)≈14.7 CSS pt<44，难以点中 ④脚本化：cd games/ai/qa/mobile-touch-acceptance && "
            "QA_FAST=1 node qa_mobile_touch.mjs，看 A6-hotzone44 NG。复核报告：" + REPORT),
    },
    BUG2: {
        "tags": ["games/ai", "mobile-touch", "P1", "qa-recheck-2026-09-19", "unfixed"],
        "actualBehavior": ("【QA 复核 2026-09-19】未修复，线上复现。同口径复测：G3-hint-overlap NG——hintOverlapDialogPx=3200 px²"
            "（hint=195x65@bottom654，移动端窄视口换行 3 行，压住选项 2/3 文字），与 v11 基线同值。"
            + COMMON_FINGERPRINT +
            " 壳层 /apps/ai 返回 HTML 与 server/src/game-page.ts 逐字段一致（#hint 仍 position:fixed; bottom:10px，"
            "boot 完成后常显，无移动端避让、无『选项出现时隐藏』postMessage 约定）。"
            "复现步骤：①iPhone 13（DPR3）打开 liveUrl ②推进至选择节点 ③观察底部三行提示条遮盖选项 2/3 文字"
            "（pointer-events:none 功能可点但不可见，截图 games/ai/qa/mobile-touch-recheck/evidence_A6_choice_bottom_crop.png）"
            "④脚本化：同上工具看 G3-hint-overlap NG。修复方向：移动端（maxTouchPoints>1 或窄视口）隐藏 #hint 或避让对话选项区，"
            "并补『提示条与选项区重叠=0』壳层断言；修复后须重新导出+重新部署再回归（只合代码不部署，线上指纹不变、复核仍 NG）。"
            "复核报告：" + REPORT),
    },
    BUG3: {
        "tags": ["games/ai", "godot-gate", "P2", "qa-recheck-2026-09-19", "fixed"],
        "actualBehavior": ("【QA 复核 2026-09-19：已修复，默认预算误判消除】复核修正原诊断：Engine.max_fps=60 早在 v2.1.0 迁入"
            "（1a19d080）即位于 games/ai/tests/smoke.gd _ready() 首行（第 100 行），『未设置』不成立；真实缺口="
            "std-skills/godot-game-dev/scripts/smoke.sh 默认兜底预算 120 帧——games/ai 冒烟（三幕剧情+三链路重放+十组行为断言）"
            "在 60fps 限速下需 ≈200+ process 帧才跑得完，120 帧裸跑必被兜底杀掉误判 FAIL（复现实测 exit=1、无标记），"
            "而门禁真实路径（routines.yaml smokeFrames=240 / games/ai verify.sh 默认 240）原本即 PASS——误判仅发生在裸跑场景。"
            "修复：smoke.sh 默认 GODOT_SMOKE_FRAMES 120→240（与 routine/verify.sh 同值，兜底语义不变，120 帧 FAIL 实测即证"
            "预算不足仍会被拦），提交 8604650e（PR https://github.com/hl3w22bupt/myrd-playground/pull/20）。"
            "验证：修复后裸跑 bash std-skills/godot-game-dev/scripts/smoke.sh games/ai → exit=0、GODOT_SMOKE: PASS、"
            "断言标记齐全、日志无脚本错误（6.8s）；bash games/ai/verify.sh → PREFLIGHT: PASS 13 类 + smoke PASS 全绿。"
            "验收口径对照：①smoke 场景 max_fps=60 在位（smoke.gd:100；240 帧 PASS 且全程 6.8s 佐证限速生效）"
            "②日志含 GODOT_SMOKE: PASS ③默认预算误判消除。复核报告：" + REPORT),
    },
}

# ① 证据字段回写（PUT /bugs?id=）
for bid, fields in updates.items():
    r = req("PUT", f"/api/v1/bugs?id={bid}", fields)
    print(f"[PUT] {bid} → version={r['data'].get('version')} tags={r['data'].get('tags')}")

# ② Bug3 状态机：unconfirmed → open → in-progress → resolved
cur = req("GET", "/api/v1/bugs")["data"]["bugs"]
status3 = next(b["status"] for b in cur if b["id"] == BUG3)
print(f"[state] {BUG3} current={status3}")
path = {"unconfirmed": ["open", "in-progress", "resolved"], "open": ["in-progress", "resolved"], "in-progress": ["resolved"]}[status3]
for st in path:
    r = req("PATCH", f"/api/v1/bugs/status?id={BUG3}", {"status": st})
    print(f"[PATCH] {BUG3} → {st} (resolvedAt={r['data'].get('resolvedAt')})")

# ③ 回读核验
final = req("GET", "/api/v1/bugs")["data"]["bugs"]
for bid in (BUG1, BUG2, BUG3):
    b = next(x for x in final if x["id"] == bid)
    print(f"[verify] {bid}: status={b['status']} version={b['version']} resolvedAt={b.get('resolvedAt')} tags={b.get('tags')}")
