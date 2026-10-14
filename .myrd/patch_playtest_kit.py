#!/usr/bin/env python3
"""playtest 节点（v5 轮 run cmv7snbpq000nm9tiuyizp98o）：把试玩验收包作为 op=playtest_kit 条目
PATCH 合并进 goal artifacts。合并语义：GET 现有数组 → 追加（不覆盖/不修改已有条目）→ 整组 PATCH 写回。
⚠️ 本轮节点自身执行时 goal API 403（身份错位第三次复现，见 games/game-8/docs/v5-playtest-blocked-report.md），
本脚本由 app owner（cmuimu6w…）/admin 或 goal 委派发起的下一轮代为执行（python3 .myrd/patch_playtest_kit.py）。
⚠️ 部署路由带 goalId 时平台会自动 upsert 合并 hosted_app 产物（R6/D5 语义）；本脚本只负责 playtest_kit 条目。"""
import json
import os
import sys
import urllib.request
from typing import Optional

API = os.environ["PLATFORM_API_URL"].rstrip("/")
TOKEN = os.environ["MYRD_TOKEN"]
GOAL_ID = "cmujpml1e006rm99i9hc33huu"
LIVE_URL = "https://leomac-studio.tail49399e.ts.net/apps/game-8/"
TRAJECTORY_ID = "cmv7snbpq000nm9tiuyizp98o"  # 本节点 run id（工作区名 run-<id>）

DETAIL = (
    "【节点状态：blocked（试玩验收包已交付；blocked 事由=部署身份错位第三次复现，非模板资产缺失，试玩未发起）】"
    "v5 修复轮（需求 cmv7skg01000km9tiuig8nyjx × v4 REJECT docs/v4-acceptance-report.md）。"
    "硬约束核查全过：门禁判定脚本七件套在仓库 std-skills/godot-game-dev/scripts/，"
    ".myrd/routines.yaml 含 godot-smoke（5 步含 playtest@3600）与 mobile-web-smoke，references 两份模板在位。"
    "||【关键实锤（本轮一手）】① 线上仍是 v4 不可玩包：线上 index.pck 3,210,752 B，sha256 7738850a…5d8502"
    "（经 api/public/assets/index.pck.gz.b64 下载实算）与 v4 部署锚点逐字节一致，非 v5 预期 3ca34b43…/2,613,856B；"
    "② 部署 API 干跑 403「仅应用所有者或系统管理员可操作」req_1791971169333——身份错位第三次独立复现"
    "（前两次 req_1791968912360/req_1791969367365，机制见 docs/v5-release-handoff.md §五）；"
    "③ goal 读/回写 API 403（req_1791971123121），本节点 artifacts 回写无法经 HTTP 完成，本条目由有权限身份代写；"
    "④ preHook mobile-web-smoke verdict=PASS（checkedAt 2026-10-14T09:43:07Z）属实，但本轮实证其 PASS 适用边界："
    "断言集不覆盖 v4 缺陷 A/B/C/D，对 v4 线上包同样全绿——单独不能自证线上可玩，须联用 tools/playability-probe.mjs"
    "（P1/P2/P3，CDP 真实事件驱动）；该探针因部署未完成尚未对线上跑过（qa/mobile/playability.json 不存在）；"
    "warn 注记：preHook 未带 --project，joystick-target 为 legacy 取证不断言（joyAreaDiff=0）。"
    "v5 本地证据全绿（分支 HEAD 1d4b5b6）：preflight/smoke@320/input-fuzz/playtest@3600 PASS×4 + "
    "qa/local-v5-verify/playability.json P1=1365 命中/P2=117px/P3=173px + C/D 浏览器取证截图。"
    "||【试玩指引（部署解阻后生效，全文见 games/game-8/docs/playtest-kit.md v5 版）】入口 "
    + LIVE_URL +
    "（工程内无 .myrd/spec/design-spec.json，按实现说明+approved 策划案口径）：开始面板即目标说明"
    "（60 秒收集 20 分/青草垛+1·金铃铛+3·时钟+2 加时/磁铁·加速）；键盘 WASD+方向键（v5 勘误：Web 键盘一直有效）、"
    "触屏左下摇杆 8 向（热区外扩 40px，按下即接管）；v5 四修复的可感验收点：A 开局 10s 内同屏可收集物>0（否则立即停止试玩报告）、"
    "B 按 A 向左且摇杆跟手方向正确、C 结算页结论/新纪录/按钮三段零重叠（调参桥 ?tuning={\"TIME_LIMIT\":15,\"TARGET_SCORE\":60} "
    "15s 快进到失败结算取证）、D 桌面视口完全无摇杆/触屏确认钮；Combo 2s 窗口、三波次（波间 1.2s）、同屏上限 6、反馈三件套+震屏。"
    "||【结构化试玩量表（四问逐条，不合并）】状态：待用户试玩（未回填，严禁编造；且试玩以部署解阻为前提）。"
    "① 首分钟能否看懂目标与操作：待回填（是/否+卡点）；"
    "② 结束时想不想再来一局：待回填（1-5 分+原因）；"
    "③ 手感、反馈与观感：待回填（1-5 分分项：打击感/音效/画面响应/风格统一与排版清晰——后两项对照 games/game-8/.myrd/style-card.md："
    "字号档 40-48/24-28/16-18px、色板 #3498db/#2ecc71/#f39c12、触达区≥44×44px、无溢出遮挡，偏离卡片即在分值中体现）；"
    "④ 节奏有无明显断档或无聊段：待回填（有/无+出现在第几秒）。"
    "||【调参工作台入口】" + LIVE_URL + "?tuning=1 —— 右上角调参面板拖滑杆即时生效；点「复制调参 URL」得 ?tuning=<JSON> 链接，"
    "发回即一次完整调参结果。只认 game_state.gd TUNING_META 17 个声明键（v5 未动数值，与 v4 同表）：TARGET_SCORE=20、TIME_LIMIT=60、"
    "MAX_COLLECTIBLES=6、SPAWN_INTERVAL_START=0.8、SPAWN_INTERVAL_MIN=0.45、LIFETIME_START=6.0、LIFETIME_MIN=3.0、"
    "PLAYER_SCALE=1.4、PLAYER_SPEED=145、COMBO_WINDOW=2.0、COMBO_BONUS_MAX=5、TIME_BONUS_CLOCK=4.0、MAGNET_RADIUS=100、"
    "MAGNET_DURATION=5.0、BOOST_MULT=1.5、BOOST_DURATION=4.0、WAVE_BREAK_SECONDS=1.2；"
    "URL 未声明键忽略并在 diff 说明中标注；数值回写唯一事实源是策划案 cmv7i4txk000zjofi5vrdcrvk 的 revisions（禁止散点改代码默认值）。"
    "||【解阻与后续】解阻路径见 docs/v5-playtest-blocked-report.md §六：owner/admin 或 goal 委派轮执行一键部署（gitRef 红线=功能分支，绝不落 main）"
    "→ mobile-web-smoke（带 --project）+ playability-probe 双验 A/B/C/D → 通过后按 playtest-kit.md 收集用户量表与调参 URL → "
    "第 3 步（POST /api/v1/game-design-specs/cmv7i4txk000zjofi5vrdcrvk/revisions → approve → 追加 op=tuning_applied）→ 下一轮按新 spec 重部署。"
    "未收到用户结果前本条目量表维持待回填，不伪造。"
)

ENTRY = {
    "op": "playtest_kit",
    "artifactType": "playtest_kit",
    "artifactId": TRAJECTORY_ID,
    "status": "blocked",
    "title": "game-8 试玩验收包 v5（验收包已交付；试玩待 v5 部署解阻，量表待用户回填）",
    "url": LIVE_URL,
    "detail": DETAIL,
}


def req(method: str, path: str, body: Optional[dict] = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read())


def main() -> int:
    goal = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]
    arts = goal.get("artifacts")
    if not isinstance(arts, list):
        print("FATAL: goal.artifacts 不是数组，拒绝整组写回", file=sys.stderr)
        return 1
    before = len(arts)
    dup = [a for a in arts if a.get("op") == "playtest_kit" and "v5" in str(a.get("title", ""))]
    if dup:
        print(f"SKIP: 本轮条目已存在（{len(dup)} 条），不重复追加")
        return 0
    merged = arts + [ENTRY]
    req("PATCH", f"/api/v1/goals/{GOAL_ID}", {"artifacts": merged})
    after = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]["artifacts"]
    print(f"OK: artifacts {before} -> {len(after)} 条；末条 op={after[-1]['op']} title={after[-1]['title']}")
    kits = [a for a in after if a.get("op") == "playtest_kit"]
    print(f"playtest_kit 条目共 {len(kits)} 条（历史条目均已保留）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
