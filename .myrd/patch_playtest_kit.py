#!/usr/bin/env python3
"""playtest 节点：把试玩验收包作为 op=playtest_kit 条目 PATCH 合并进 goal artifacts。
合并语义：GET 现有数组 → 追加（不覆盖/不修改已有条目）→ 整组 PATCH 写回。"""
import json
import os
import sys
import urllib.request
from typing import Optional

API = os.environ["PLATFORM_API_URL"].rstrip("/")
TOKEN = os.environ["MYRD_TOKEN"]
GOAL_ID = os.environ["MYRD_GOAL_ID"]
LIVE_URL = "https://leomac-studio.tail49399e.ts.net/apps/game-8/"
TRAJECTORY_ID = "cmv7i60dg0015jofiw908gzny"  # 本节点 run id（工作区名 run-<id>）

DETAIL = (
    "【节点状态：completed（验收包已交付，量表待用户试玩）】本轮走工作流主通道（上轮节点被取消致 playtest 缺失，本轮闭环）："
    "绑定 v4 需求 cmv7hnfx3000ojofistqwry8l × 策划案 v3 approved（GameDesignSpec cmv7i4txk000zjofi5vrdcrvk）。"
    "硬约束核查全过、不触发 blocked：门禁判定脚本六件套全部在仓库 std-skills/godot-game-dev/scripts/"
    "（preflight.py/smoke.sh/input-fuzz.sh/playtest.sh/resolve-godot.sh/mobile-web-smoke.mjs——上轮缺失的 playtest.sh 本轮已在位）；"
    ".myrd/routines.yaml 含 id=godot-smoke（5 步含 playtest 步，上轮「playtest 缺失」的结构性根因本轮已修复）与 id=mobile-web-smoke；"
    "references/{godot-smoke-routine.md,mobile-smoke-routine.md} 参数化模板在位。"
    "||前置机判（2026-10-14 本节点实测，全部一手）：preflight PASS（15 类×81 工程文件）；smoke PASS（320 帧与 240 帧双预算，exit 0 零 SCRIPT ERROR）；"
    "input-fuzz PASS（seed=20260913，6 批次 239 帧）；playtest PASS（3 局 fb=185/228/217，run2 score=3、run3 score=4 真实收集——上轮缺失项本轮闭环）；"
    "线上 pck 自跑冒烟 PASS；mobile-web-smoke PASS（10 项全绿：FPS 36/触摸管线通/音频解锁器在位/视口无溢出，"
    "证据 games/game-8/qa/mobile/ 本轮 preHook 复跑 checkedAt 2026-10-14T05:41:08Z，verdict=PASS，与 preHook 结论一致无矛盾）。"
    "如实注记：mobile 报告部分 check 的 detail 字段带失败提示文案（低于良好阈值但高于失败阈值的提示语），判定以 status/verdict 与 metrics 为准（15 色≥2、idleDiff=400>0、fps=36≥8）。"
    "部署锚点：HostedApp cmujpmjsy006pm99ip9yws3wl、deployment cmv7oa022000im9700bqwktfj @ commit 9bda2c1"
    "（gitRef myrd/game-8-goal-cmujpml1e006rm99i9hc33huu 未落 main），线上 index.pck sha256 7738850a…5d8502 与 HEAD 导出逐字节一致。"
    "||【试玩指引】入口 " + LIVE_URL + "（加载≤3s 无白屏/闪退）；开始面板即目标说明（60 秒内收集 20 分/青草垛+1·金铃铛+3·时钟+2 并加时/磁铁·加速帮你冲刺）；"
    "键盘 WASD+方向键、触屏左下虚拟摇杆 8 向（触摸 UI 仅触屏环境显示），P/触屏按钮暂停，结算 R/按钮双入口一键重开+返回合集入口；"
    "三波次（波间停顿 1.2s+横幅提示，越往后稀有物与道具占比越高）、Combo 2s 窗口每级+1 封顶 5 只加成 ≥2 分高分物、同屏上限 6、过期不计分；"
    "反馈三件套（音效+粒子+飘字同帧）、关键事件震屏；结算含本局÷目标、历史最高分/最高连击、新纪录金色高亮；存档持久化重进不丢。"
    "重点观察五条（首分钟易懂性/玩法深度可感/画面风格统一/反馈齐发/节奏断档）见 games/game-8/docs/playtest-kit.md §1.5（本分支，本轮补齐落盘）。"
    "||【结构化试玩量表（四问逐条，不合并）】状态：待用户试玩（未回填，严禁编造）。"
    "① 首分钟能否看懂目标与操作：待回填（是/否+卡点）；"
    "② 结束时想不想再来一局：待回填（1-5 分+原因）；"
    "③ 手感、反馈与观感：待回填（1-5 分分项：打击感/音效/画面响应/风格统一与排版清晰——后两项对照 games/game-8/.myrd/style-card.md："
    "字号档 40-48/24-28/16-18px、色板 #3498db/#2ecc71/#f39c12、触达区≥44×44px、无溢出遮挡，偏离卡片即在分值中体现）；"
    "④ 节奏有无明显断档或无聊段：待回填（有/无+出现在第几秒）。"
    "||【调参工作台入口】https://leomac-studio.tail49399e.ts.net/apps/game-8/?tuning=1 —— 打开后画面右上角出现调参面板，拖滑杆即时生效；"
    "点「复制调参 URL」得 ?tuning=<JSON> 链接，发回即一次完整调参结果。"
    "只认 game_state.gd 数值区 TUNING_META 17 个声明键：TARGET_SCORE=20、TIME_LIMIT=60、MAX_COLLECTIBLES=6、"
    "SPAWN_INTERVAL_START=0.8、SPAWN_INTERVAL_MIN=0.45、LIFETIME_START=6.0、LIFETIME_MIN=3.0、"
    "PLAYER_SCALE=1.4(v1 回滚 1.0)、PLAYER_SPEED=145(v1 回滚 220)、COMBO_WINDOW=2.0、COMBO_BONUS_MAX=5、"
    "TIME_BONUS_CLOCK=4.0、MAGNET_RADIUS=100、MAGNET_DURATION=5.0、BOOST_MULT=1.5、BOOST_DURATION=4.0、WAVE_BREAK_SECONDS=1.2；"
    "URL 里未声明键忽略并在 diff 说明中标注；数值回写唯一事实源是策划案 revisions（禁止散点改代码默认值）。"
    "||【后续】第 3 步（试玩结果回写 spec：POST /api/v1/game-design-specs/cmv7i4txk000zjofi5vrdcrvk/revisions → approve → 追加 op=tuning_applied 产物）"
    "因未收到用户结果本轮整体跳过、不伪造；量表回填+调参 URL 到达后按 games/game-8/docs/playtest-kit.md §四 协议执行，下一轮工作流按新 spec 重部署。"
)

ENTRY = {
    "op": "playtest_kit",
    "artifactType": "playtest_kit",
    "artifactId": TRAJECTORY_ID,
    "status": "completed",
    "title": "game-8 试玩验收包 v4（主通道闭环：门禁全绿含 playtest；量表待用户试玩）",
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
    dup = [a for a in arts if a.get("op") == "playtest_kit" and "v4" in str(a.get("title", ""))]
    if dup:
        print(f"SKIP: 本轮条目已存在（{len(dup)} 条），不重复追加")
        return 0
    merged = arts + [ENTRY]
    req("PATCH", f"/api/v1/goals/{GOAL_ID}", {"artifacts": merged})
    after = req("GET", f"/api/v1/goals/{GOAL_ID}")["data"]["goal"]["artifacts"]
    print(f"OK: artifacts {before} -> {len(after)} 条；末条 op={after[-1]['op']} title={after[-1]['title']}")
    kits = [a for a in after if a.get("op") == "playtest_kit"]
    print(f"playtest_kit 条目共 {len(kits)} 条（含上轮 blocked 1 条，均已保留）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
