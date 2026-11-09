#!/usr/bin/env python3
"""goal.artifacts 回写 (PATCH /api/v1/goals/:id, 全量读改写 + 幂等键 + GET 复核)
幂等键 = artifactType:artifactId (不携带 workflowRunUrl —— 引擎自有条目零触碰, 只追加自有条目)
用法: python3 write_artifact.py <goalId> <payload.json>
payload.json: {"op","title","status","detail","artifactType","artifactId","url"(可选)}
"""
import json, os, subprocess, sys, datetime

GOAL = sys.argv[1]
PAYLOAD_FILE = sys.argv[2]
API = os.environ.get("PLATFORM_API_URL", "http://localhost:3111")
TOK = os.environ["MYRD_TOKEN"]

def api(method, path, body=None):
    cmd = ["curl", "-s", "-m", "30", "-X", method, f"{API}{path}",
           "-H", f"Authorization: Bearer {TOK}", "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body, ensure_ascii=False)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"curl failed: {r.stderr}")
    return json.loads(r.stdout)

# 1. GET 现状 (记录 N 与条目)
g = api("GET", f"/api/v1/goals/{GOAL}")
goal = g["data"]["goal"] if "data" in g else g
arts = goal.get("artifacts") or []
n0, keys0 = len(arts), [a.get("artifactType", "") + ":" + str(a.get("artifactId")) for a in arts]
print(f"[1/4] GET ok: artifacts N={n0}")

p = json.load(open(PAYLOAD_FILE))
key = f"{p['artifactType']}:{p['artifactId']}"

# 2. upsert 合并 (键命中 → 原位更新; 未命中 → 追加; 其他条目零触碰)
merged = False
for a in arts:
    if f"{a.get('artifactType','')}:{a.get('artifactId')}" == key:
        a.update({k: v for k, v in p.items() if v is not None})
        merged = True
        break
if not merged:
    p.setdefault("createdAt", datetime.datetime.now(datetime.timezone.utc).isoformat())
    arts.append(p)
print(f"[2/4] upsert key={key} merged={merged} (N {n0} -> {len(arts)})")

# 3. PATCH 全量数组写回
r = api("PATCH", f"/api/v1/goals/{GOAL}", {"artifacts": arts})
if isinstance(r, dict) and r.get("error"):
    raise RuntimeError(f"PATCH failed: {r['error']}")
print(f"[3/4] PATCH ok")

# 4. GET 复核
g2 = api("GET", f"/api/v1/goals/{GOAL}")
goal2 = g2["data"]["goal"] if "data" in g2 else g2
arts2 = goal2.get("artifacts") or []
n2 = len(arts2)
mine = [a for a in arts2 if f"{a.get('artifactType','')}:{a.get('artifactId')}" == key]
print(f"[4/4] GET verify: N {n0} -> {n2} (delta {n2-n0}), my entry present={len(mine)==1}, "
      f"status={mine[0].get('status') if mine else 'MISSING'}, detail_len={len(mine[0].get('detail') or '') if mine else 0}")
if len(mine) != 1:
    sys.exit(2)
print("WRITEBACK OK")
