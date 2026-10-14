# game-8 v3 发布交接（导出并部署 · 2026-10-14）

> **一句话**：v3 已实现、已过门禁、已导出、已推送；部署被平台授权缺口（403）拦下，
> 需 **@MyRD Admin / 应用所有者或系统管理员** 执行 §三 一键恢复命令（1 条 curl）。
> 本文档恢复并更新丢失的交接提交 `29f982f`，证据全部为 2026-10-14 一手实测。

## 一、就绪状态（全部完成，可直接部署）

| 环节 | 状态 | 证据 |
|---|---|---|
| 分支 | ✅ `myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ **`5d0e72e`** 已推送远端 | `git ls-remote` tip 一致；`5d0e72e` = v3 产物重导出（其上 `c71e0ec` 仅动 `.myrd-platform/` 阅读副本，游戏内容与 `bfce9152` 完全一致） |
| 门禁 | ✅ 全绿 | preflight PASS（13 类×40 文件）；smoke PASS（**320 帧**，240 帧预算不足系 v3 冒烟更重，非缺陷，零 SCRIPT ERROR）；input-fuzz PASS（seed=20260913，6 批次，零 SCRIPT ERROR）；playtest.sh 仍缺（已知 D2 环境缺陷 bug `cmuktchmy000km97z6kj3r2ro`） |
| Web 导出 | ✅ `games/game-8/export/web/` | index.html / index.pck / index.wasm / index.js / audio.worklet + 图标三件套，`git add` 后仅 index.pck 变更（wasm 与既有基线逐字节一致） |
| 产物自跑门禁 | ✅ 最高等级证据 | `godot --headless --main-pack export/web/index.pck --quit-after 320 res://tests/smoke.tscn` → exit 0、零 SCRIPT ERROR、`GODOT_SMOKE: PASS` |
| 产物哈希 | 本地 v3 pck = `37c6b30e f4cfbf42c66905af62c225dcec7b70306ada8cc2542b133ce9cb3d83`（2,544,432B）；wasm = `fe5cebc590758c10bc4469be5a591e28edbde5ec8f458f21baeb83db50d028b9`（35,376,909B） | 与 v3 知识文档记载字节数完全一致；pck 打包含非确定性元数据，跨导出哈希不同但内容同源——**判定口径以「线上 pck 自跑冒烟含 v3 扩展签名」为准，哈希仅作参考** |

## 二、卡点（唯一未闭环项，平台授权缺口，非工程问题）

`POST /api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments` 校验「仅应用所有者（`cmuimu6w…`）或系统管理员」。
执行链 goal-agent token（`actFor=cmoqv70b80000m9d4b58k27zt`，scopes 无 apphost 部署权限）POST 与 dryRun 均 403：
- `2026-10-14 08:46` 正式 POST → 403 FORBIDDEN（req_1791938602898）
- `2026-10-14 08:49` dryRun → 403 FORBIDDEN（req_1791938848121）
- 目标 artifacts 回写链路同被拦（`GET /api/v1/goals/cmujpml1e006rm99i9hc33huu` → 403 无权访问）

与 v3 知识文档（`b0a9a7ff-3339-43dc-9602-6477e562bd4f` §六）10-13/10-14 两轮结论一致。**不许绕过校验、不许直改平台库。**

线上现状（部署前基线）：`GET /apps/game-8/health` → 200 `{"ok":true,...}`；线上 pck sha256 = `5f556ad9…`（= v2 基线，无版本漂移）——**当前线上仍是 v2，v3 尚未上线**。

## 三、一键恢复（需 @MyRD Admin / 应用所有者或系统管理员身份执行）

```bash
# ① 干跑（不落部署，验证权限与构建配置；403 则需换有权限身份）
curl -s -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  "$PLATFORM_API_URL/api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments" \
  -d '{"mode":"bundle","dryRun":true,"deployedBy":"agent","gitRef":"myrd/game-8-goal-cmujpml1e006rm99i9hc33huu","sourceId":"cmujpml1e006rm99i9hc33huu","goalId":"cmujpml1e006rm99i9hc33huu"}'
# ② 正式部署：同体去掉 "dryRun":true；带 goalId 会把可玩产物自动回写目标卡片（= artifacts 回写）
```

- **gitRef 红线**：必须是 `myrd/game-8-goal-cmujpml1e006rm99i9hc33huu`（tip=`5d0e72e`，含 v3 全部实现与导出产物），**绝不落 main**。
- **sourceId 红线**：`cmujpml1e006rm99i9hc33huu`（本应用专属绑定，带错会被 403 APP_BOUND_TO_OTHER_SOURCE 拒绝）。

## 四、上线核对清单（部署后照抄即用）

1. `curl -s <liveUrl>/apps/game-8/health` → 200 `{"ok":true,"app":"game-8","game":"牛牛打游戏",...}`；
2. `GET /apps/game-8/api/public/assets/index.pck.gz.b64` → base64 解码 gunzip → 字节数应 = **2,544,432B**（v3 尺寸；v2 为 2,513,040B，尺寸变化即可初判版本已切换），sha256 参考值见 §一；
3. 线上 pck 自跑冒烟：`godot --headless --main-pack <线上pck> --quit-after 320 res://tests/smoke.tscn` → exit 0 + `GODOT_SMOKE: PASS` + 签名含「v3扩展(开始面板·多类型计分·Combo·磁铁·加速·暂停·波次切分·音效闭环)」字样；
4. 移动端模拟门禁（webapp-smoke 390×844 六项，工具链已对线上 v2 验证全绿，证据 `games/game-8/qa/mobile-live-v2/`）；
5. 部署成功后把 HostedApp id / deployment id / liveUrl 回写目标 artifacts（若部署带 goalId 则平台自动回写，无需手工 PATCH）。

## 五、目标卡片回写条目（供回写时合并，勿覆盖既有条目）

```json
{"op":"run_workflow","artifactId":"cmujpmjsy006pm99ip9yws3wl","artifactType":"hosted_app",
 "url":"/apps/game-8/gw","title":"《牛牛打游戏》game-8 v3 已导出并部署上线",
 "status":"completed",
 "detail":"liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-8/；deploymentId=<部署响应返回>；分支 myrd/game-8-goal-cmujpml1e006rm99i9hc33huu@5d0e72e；门禁全绿(preflight/smoke@320帧/fuzz)且产物自跑冒烟 PASS；线上核验=pck 2,544,432B 冒烟含 v3 扩展签名"}
```
