#!/usr/bin/env bash
# selftest.sh — experience-review 技能自测：validate-review 的变异测试 + calibrate 形状检查。
# 纪律同 gate-selftest：门禁自己必须先被证明「该拦的拦得住、该放的放得过」。
# 退出码：0 = EXPERIENCE_REVIEW_SELFTEST: PASS；1 = 有断言未过。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# —— 造一个最小合法包骨架：pack.json + 两张占位截图（validate 只核存在性） ——
mkdir -p "$TMP/pack-ok/steps" "$TMP/pack-ok/video/frames"
printf '{}' > "$TMP/pack-ok/pack.json"
printf 'fake' > "$TMP/pack-ok/steps/01-load.png"
printf 'fake' > "$TMP/pack-ok/steps/02-tap.png"

valid_review() { cat <<'EOF'
{
  "schemaVersion": 1,
  "kind": "perceptual-advisory",
  "advisoryOnly": true,
  "generatedBy": "experience-review@0.1.0",
  "target": { "url": "http://x/", "packDir": "pack", "styleCardPath": null },
  "dimensions": [
    { "id": "palette", "score": 3, "summary": "色板基础统一但氛围单薄", "issues": [
      { "severity": "minor", "finding": "背景与主体明度接近，主体不突出", "evidence": "steps/01-load.png（中景主体区域）", "suggestion": "拉开前景/背景明度差" } ] },
    { "id": "typography", "score": 4, "summary": "层级清晰", "issues": [] },
    { "id": "composition", "score": 3, "summary": "有主体但留白不均", "issues": [] },
    { "id": "motion", "score": 4, "summary": "帧序列反馈可见", "issues": [] },
    { "id": "polish", "score": 3, "summary": "无硬伤但边缘糙", "issues": [] }
  ],
  "overall": { "score": 3, "verdictText": "画面完整可玩感足够，主体突出度与细节完成度最值得投入" },
  "topIssues": [
    { "severity": "minor", "finding": "背景与主体明度接近，主体不突出", "evidence": "steps/01-load.png（中景主体区域）", "suggestion": "拉开前景/背景明度差" } ]
}
EOF
}

run_case() { # $1=名字 $2=期望退出码 $3=jq 变换（对合法 review 做破坏）
  local name="$1" expect="$2" transform="$3"
  valid_review | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);($transform);process.stdout.write(JSON.stringify(r,null,2))})" > "$TMP/pack-ok/review.json"
  local code=0
  node "$HERE/validate-review.mjs" "$TMP/pack-ok" >/dev/null 2>&1 || code=$?
  if [ "$code" -eq "$expect" ]; then
    echo "  PASS  ${name}（exit=${code}）"
  else
    echo "  FAIL  ${name}（期望 exit=${expect}，实际 ${code}）"
    FAILURES=$((FAILURES+1))
  fi
}

FAILURES=0
echo "===== validate-review：合法放行 + 五类非法全拦 ====="
run_case "合法评审放行"            0 "void 0"
run_case "缺一维（composition）"   1 "r.dimensions=r.dimensions.filter(d=>d.id!=='composition')"
run_case "分数越界（6）"           1 "r.dimensions[0].score=6"
run_case "证据文件不在包内"        1 "r.dimensions[0].issues[0].evidence='steps/99-nope.png（任意）'"
run_case "overall 与维分不符"      1 "r.overall.score=5"
run_case "advisoryOnly 缺失"       1 "delete r.advisoryOnly"

echo "===== calibrate：形状与门槛 ====="
mkdir -p "$TMP/packs/p1" "$TMP/packs/p2"
cp "$TMP/pack-ok/review.json" "$TMP/packs/p1/review.json" 2>/dev/null || true
# 上面 pack-ok/review.json 是最后一个非法用例，重写回合法再用于 calibrate
valid_review | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);r.overall.score=4;process.stdout.write(JSON.stringify(r))})" > "$TMP/packs/p1/review.json"
valid_review | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);r.overall.score=2;process.stdout.write(JSON.stringify(r))})" > "$TMP/packs/p2/review.json"
cat > "$TMP/human.json" <<'EOF'
{ "p1": { "score": 4 }, "p2": { "score": 3 }, "p3": { "score": 5 } }
EOF
CAL=$(node "$HERE/calibrate.mjs" --packs "$TMP/packs" --human "$TMP/human.json")
echo "$CAL" | grep -q '"pairs": 2' && echo "  PASS  calibrate 配对数（2：p3 无 review 被跳过）" || { echo "  FAIL  calibrate 配对数"; echo "$CAL"; FAILURES=$((FAILURES+1)); }
echo "$CAL" | grep -q '"mode": "SHADOW"' && echo "  PASS  门槛生效（2 对 < 20 → SHADOW）" || { echo "  FAIL  calibrate 未按协议给 SHADOW"; echo "$CAL"; FAILURES=$((FAILURES+1)); }
echo "$CAL" | grep -q '"within1Rate": 1' && echo "  PASS  ±1 一致率计算（4v4、2v3 → 1.0）" || { echo "  FAIL  ±1 一致率"; echo "$CAL"; FAILURES=$((FAILURES+1)); }

if [ "$FAILURES" -eq 0 ]; then
  echo "EXPERIENCE_REVIEW_SELFTEST: PASS"
  exit 0
fi
echo "EXPERIENCE_REVIEW_SELFTEST: FAIL（${FAILURES} 项未过）"
exit 1
