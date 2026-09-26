#!/usr/bin/env bash
# 《光路谜阵》调参数据采集器：跑 tests/tuning_probe.gd（无头），把 JSON 落盘
# games/game-4/qa/tuning-data.json。
#
# 职责边界：本脚本只做「运行探针 + 抽取 JSON + 落盘 + 摘要打印」，不实现任何玩法判定；
# 判定全部在探针内由生产代码（levels.gd / puzzle_logic.gd / game_state.gd）机判得出。
# Godot 解析复用技能包 resolve-godot.sh（唯一权威来源），不在本脚本内自实现。
#
# 用法：bash games/game-4/qa/collect_tuning_data.sh
# 退出码：0 = 采集成功且硬契约断言全过；1 = 探针报硬契约问题；2 = 环境不可用。

set -uo pipefail

GAME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${GAME_DIR}/../.." && pwd)"
OUT_JSON="${GAME_DIR}/qa/tuning-data.json"
PROBE="res://tests/tuning_probe.gd"

SKILL_DIR="${REPO_ROOT}/std-skills/godot-game-dev"
if [ ! -f "${SKILL_DIR}/scripts/resolve-godot.sh" ] && [ -f "${REPO_ROOT}/docs/skills/godot-game-dev/scripts/resolve-godot.sh" ]; then
  SKILL_DIR="${REPO_ROOT}/docs/skills/godot-game-dev"
fi
if [ ! -f "${SKILL_DIR}/scripts/resolve-godot.sh" ]; then
  echo "collect: FAIL 环境不可用（找不到 ${SKILL_DIR}/scripts/resolve-godot.sh）" >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "collect: FAIL 环境不可用（找不到 python3）" >&2
  exit 2
fi

GODOT_BIN="$(bash "${SKILL_DIR}/scripts/resolve-godot.sh")" || GODOT_BIN=""
if [ -z "${GODOT_BIN}" ]; then
  echo "collect: FAIL 环境不可用（找不到可执行的 Godot）" >&2
  exit 2
fi
echo "collect: Godot = $("${GODOT_BIN}" --version 2>/dev/null | head -1)"
echo "collect: 运行调参探针（约 10s，含 10 关有界最优解搜索）…"

RAW="$("${GODOT_BIN}" --headless --path "${GAME_DIR}" -s "${PROBE}" 2>&1)"
PROBE_EXIT=$?
printf '%s\n' "${RAW}" > "${GAME_DIR}/qa/tuning-probe-last-run.log"

# 抽取 TUNING_DATA_BEGIN/END 之间的 JSON 并校验结构，产出最终落盘文件。
# 注意：python 程序体走 heredoc（stdin），探针数据只能从日志文件读，不能也走 stdin。
python3 - "${OUT_JSON}" "${GAME_DIR}/qa/tuning-probe-last-run.log" <<'PYEOF'
import json, sys, datetime

out_path = sys.argv[1]
raw = open(sys.argv[2], encoding="utf-8", errors="replace").read()
try:
    body = raw.split("TUNING_DATA_BEGIN", 1)[1].split("TUNING_DATA_END", 1)[0]
    data = json.loads(body)
except (IndexError, json.JSONDecodeError) as exc:
    print(f"collect: FAIL 探针输出解析失败：{exc}", file=sys.stderr)
    sys.exit(2)

required = ["levels", "difficulty_curve", "star_thresholds", "star_distribution",
            "par_findings", "models", "contract_checks"]
missing = [k for k in required if k not in data]
if missing:
    print(f"collect: FAIL 探针 JSON 缺字段：{missing}", file=sys.stderr)
    sys.exit(2)
if len(data["levels"]) != 10:
    print(f"collect: FAIL 关卡数 {len(data['levels'])} != 10", file=sys.stderr)
    sys.exit(2)

data["meta"] = {
    "game": "game-4",
    "title": "光路谜阵",
    "generated_at_utc": datetime.datetime.now(datetime.timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%SZ"),
    "collector": "games/game-4/qa/collect_tuning_data.sh",
    "probe": "games/game-4/tests/tuning_probe.gd",
    "fact_sources": ["scripts/levels.gd", "scripts/puzzle_logic.gd", "autoload/game_state.gd"],
    "method_notes": [
        "全部数值由生产代码无头机判得出，无手填、无推测填充",
        "par = LevelSet.par_of（声明最优解）；true_par = 有界 BFS 更短解搜索 + 直管 180° 对称闭式下界合成",
        "星级分布 = expert/casual/novice 三档画像走真实 GameState.register_rotation 状态机",
        "通关时长分两层：机器侧为有界搜索实测毫秒；人类时长为显式参数模型估算（models.*，非实测）",
        "用户真实试玩数据以 PLAYTEST_KIT.md 四问量表回填为准，本文件不含也不代填用户结论",
    ],
}
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
    fh.write("\n")

problems = data["contract_checks"]["problems"]
print(f"collect: 已落盘 {out_path}")
pf = data["par_findings"]
print(f"collect: par 汇总 —— 声明合计 {pf['declared_par_total']}，真 par 合计 {pf['true_par_total']}，"
      f"虚高 {len(pf['inflate_levels'])} 关，最优性未证明 {len(pf['unproven_levels'])} 关")
for row in pf["inflate_levels"]:
    print(f"collect: FINDING 第 {row['level']} 关「{row['name']}」声明 par={row['declared_par']}，"
          f"真最优 ≤ {row['true_par']}（虚高 {row['inflation_steps']} 步）")
for row in data["difficulty_curve"]["true_par_drops"]:
    print(f"collect: FINDING 真 par 难度回落：第 {row['at_level']} 关（{row['delta']:+d} 步）")
if problems:
    for p in problems:
        print(f"collect: FAIL 硬契约 {p}", file=sys.stderr)
    sys.exit(1)
print("collect: PASS 硬契约断言全过（10 关可解/未提前通关/星级规则一致/解锁链完整/声明 par 非递减）")
PYEOF

COLLECT_EXIT=$?
# 探针自身的退出码只在「无 JSON 产出」时才有决定意义（硬契约问题已由 python 段复判）。
if [ "${COLLECT_EXIT}" -ne 0 ]; then
  exit "${COLLECT_EXIT}"
fi
if [ "${PROBE_EXIT}" -ne 0 ]; then
  echo "collect: WARN 探针退出码 ${PROBE_EXIT} 但 JSON 已产出且契约复判通过（检查 tuning-probe-last-run.log）" >&2
fi
exit 0
