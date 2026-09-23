#!/usr/bin/env bash
# verify-local.sh — AppHost 壳（server/）本地端到端验证门禁。
# 复刻平台构建链：tsc --noEmit → esbuild 单 bundle（CJS + runner 胶水）→ 起服 →
# 伪对象存储（fake-s3.mjs）喂资产 → curl 断言 /health 与 /。
# 用途：部署前证明「这套分支部署上去 / 就是 transport-ship 单文件游戏」，不依赖平台对象存储。
# 用法：bash server/tools/verify-local.sh   （仓库根执行；退出码 0 = 全过）
set -u
cd "$(dirname "$0")/.."   # → server/

ROOT="$(cd .. && pwd)"
GAME_HTML="$ROOT/games/transport-ship-3d/export/web/index.html"
WORK="$(mktemp -d /tmp/apphost-verify.XXXXXX)"
RUNNER=".apphost-runner.local.cjs"   # 必须落在 server/ 内：相对导入 ./src/index 与 node_modules 解析都以它为基
P_S3=14612; P_APP=14611
fails=0
note() { printf '%s\n' "$*"; }
check() { # check <名称> <实际> <期望>
  if [ "$2" = "$3" ]; then note "  PASS  $1（$2）"; else note "  FAIL  $1（实际=$2 期望=$3）"; fails=$((fails+1)); fi
}

cleanup() { kill ${S3_PID:-0} ${APP_PID:-0} 2>/dev/null; wait 2>/dev/null; rm -f "$RUNNER"; }
trap cleanup EXIT

note "[1/4] tsc --noEmit（与平台步骤 2 同口径）"
npx tsc --noEmit || { note "  FAIL  tsc 类型检查未过"; exit 1; }
note "  PASS  类型检查通过"

note "[2/4] esbuild 单 bundle（平台步骤 3：runner 胶水 + 用户 app，CJS）"
cat > "$RUNNER" <<'EOF'
const mod = require("./src/index");
const app = mod && (mod.default || mod);
if (!app || typeof app.fetch !== "function") { console.error("[apphost] bundle 未导出 Hono app"); process.exit(1); }
const { serve } = require("@hono/node-server");
const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port }, () => console.log("[apphost] app listening on :" + port));
EOF
npx esbuild "$RUNNER" --bundle --platform=node --format=cjs --outfile="$WORK/bundle.cjs" --log-level=warning \
  || { note "  FAIL  esbuild 打包失败"; exit 1; }
note "  PASS  bundle 就绪（$(du -k "$WORK/bundle.cjs" | cut -f1) KB）"

note "[3/4] 起伪对象存储 + 壳（assets_dir = games/transport-ship-3d/export/web）"
[ -f "$GAME_HTML" ] || { note "  FAIL  缺游戏导出产物 $GAME_HTML（先跑 node games/transport-ship-3d/tools/build.mjs）"; exit 1; }
FAKE_S3_MODE=raw FAKE_S3_PORT=$P_S3 node tools/fake-s3.mjs >"$WORK/s3.log" 2>&1 & S3_PID=$!
PORT=$P_APP APPHOST_ENVIRONMENT=local \
  APPHOST_ASSET_ENDPOINT="http://127.0.0.1:$P_S3" APPHOST_ASSET_BUCKET=fake \
  APPHOST_ASSET_MANIFEST_KEY=manifest.json APPHOST_ASSET_ACCESS_KEY=test APPHOST_ASSET_SECRET_KEY=test \
  node "$WORK/bundle.cjs" >"$WORK/app.log" 2>&1 & APP_PID=$!
sleep 2

note "[4/4] 断言（/health 与 /）"
health_code="$(curl -s -o "$WORK/health.json" -w '%{http_code}' "http://127.0.0.1:$P_APP/health")"
check "/health HTTP 状态" "$health_code" "200"
grep -q '"app":"transport-ship-3d"' "$WORK/health.json" && app_name=yes || app_name=no
check "/health 应用标识" "$app_name" "yes"

page_code="$(curl -s -o "$WORK/page.html" -w '%{http_code}' "http://127.0.0.1:$P_APP/")"
check "/ HTTP 状态" "$page_code" "200"
want_bytes="$(wc -c < "$GAME_HTML" | tr -d ' ')"
got_bytes="$(wc -c < "$WORK/page.html" | tr -d ' ')"
check "/ 响应体字节数 = 游戏导出产物" "$got_bytes" "$want_bytes"
cmp -s "$WORK/page.html" "$GAME_HTML" && identical=yes || identical=no
check "/ 响应体与游戏产物逐字节一致" "$identical" "yes"
grep -q '<title>运输船 3D' "$WORK/page.html" && title=yes || title=no
check "/ 页面标题为运输船 3D" "$title" "yes"

note "—— 合计 $fails FAIL ——"
[ "$fails" -eq 0 ] && note "APPHOST-SHELL: PASS 壳伺服 transport-ship 单文件游戏（本地端到端）"
[ "$fails" -eq 0 ] || note "APPHOST-SHELL: FAIL（日志 $WORK/app.log）"
exit $([ "$fails" -eq 0 ] && echo 0 || echo 1)
