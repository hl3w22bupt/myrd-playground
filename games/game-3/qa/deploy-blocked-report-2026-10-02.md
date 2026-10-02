# 《疾风忍者跑》发布报告（2026-10-02）—— 构建全绿，部署因授权 blocked

## 结论

- **status = blocked（授权环境问题）**：部署 API 与目标卡片回写 API 均返回 403，
  当前 workflow 节点 token 的用户身份既不是托管应用 `cmuieq51i002am9gyfxqx06rl` 的所有者，
  也不是系统管理员。**不是代码问题，无需改动任何工程/壳代码。**
- 代码侧全部就绪并已推送：分支 `myrd/games-goal-cmuieq51k002cm9gysxbyppv7`，HEAD `c2dea78`。

## 已完成且验证通过的部分

| 项 | 结果 |
|---|---|
| 门禁 preflight | PASS（13 类前置一致性检查，71 文件） |
| 门禁 smoke | PASS（240 帧，tests/smoke.tscn，断言齐全，无脚本错误） |
| 门禁 input-fuzz | PASS（GODOT_FUZZ: PASS，seed=20260913，6 批 239 帧） |
| 门禁 playtest | PASS（GODOT_PLAYTEST: PASS，3 局 ×900 帧；第 2 局收集 5 枚飞镖得分，节奏代理指标全部在阈值内） |
| Web 导出 | 重新导出并与工程同步（index.pck 2604656 B / index.wasm 35376909 B / index.js 331495 B），产物入库 |
| 壳（apphost.toml + server/） | 已就绪：name=ninja-run / runtime=node20 / health=/health / **assets_dir="games/game-3/export/web"**（资产出 bundle） |
| server 契约 | Node20 + Hono，入口 server/src/index.ts `export default app`；GET /health；GET / 落地页；GET /api/public/assets/:name 走平台模板 asset-store（与 templates/apphost/myrd-app 逐字节一致，diff 为空），gzip 资产回 base64 文本、null 回 404 |
| 落地页硬契约 | ① AudioContext 构造器包裹捕获实例；② document 级 touchstart/touchend/pointerdown/keydown/click（capture+passive）同步 resume；③ `window.__audioDebug()` 返回 `{state, addModules, log}`；④ `?tuning=` 调参桥先于引擎加载写入 `window.__GAME_TUNING__`（另有 ?tuning=1 滑杆工作台，键/范围与 TUNING_META 一致）；⑤ 资源全相对路径（BASE_PATH 按页面路径推导，兼容无尾斜杠网关入口）；⑥ base64 → Uint8Array → DecompressionStream('gzip') → 内存字节经 fetch 拦截喂引擎（未用 instantiateStreaming） |
| server typecheck | tsc --noEmit 通过 |
| 本地启动自测 | esbuild 打包后 boot：/health=200 ok:true；/=200（含 canvas/音频解锁器/调参桥/相对路径断言，无绝对路径与图片引用）；未配置 APPHOST_ASSET_* 时资产正确 404 |

## 阻塞证据（复现命令与响应）

```bash
curl -X POST "$PLATFORM_API_URL/api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl/deployments" \
  -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"bundle","deployedBy":"workflow","triggeredById":"cmuieq51k002cm9gysxbyppv7",
       "gitRef":"myrd/games-goal-cmuieq51k002cm9gysxbyppv7","sourceId":"cmuieq51k002cm9gysxbyppv7"}'
# → {"error":{"code":"FORBIDDEN","message":"仅应用所有者或系统管理员可操作"}}
```

交叉验证（同一 token）：
- `GET /api/v1/apphost/apps` → `{"data":[]}`（该身份名下 0 个应用 → 非应用所有者）
- `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl` → 403 同上
- `GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7` → `{"code":"FORBIDDEN","message":"无权访问"}`（目标不可见 → 产物回写同样被拦）
- `GET /api/v1/goals` → `{"data":{"goals":[]}}`
- `PATCH /api/v1/goals/cmuieq51k002cm9gysxbyppv7`（鉴权探针，body 非法且不会改动数据）→
  `{"code":"FORBIDDEN","message":"无权操作"}` —— 产物回写被同一授权层拦截；
  按「不要覆盖丢失已有条目」纪律未做盲 PATCH，blocked 报告以本文件代持，
  授权修复后按恢复 runbook 补写目标卡片。
- token 本身有效：JWT payload `{"userId":"cmt428ptv004bm9seap9ankcc","role":"developer","via":"workflow-node"}`，未过期

## 需要谁做什么（运维）

给 workflow 节点使用的身份（userId `cmt428ptv004bm9seap9ankcc`）以下任一授权：
1. 把它设为托管应用 `cmuieq51i002am9gyfxqx06rl`（slug game-3）的所有者/操作者；或
2. 给该用户授予系统管理员角色；或
3. 为本目标的工作流节点改发「应用所有者」身份的 token。

## 恢复 runbook（授权后按序执行）

```bash
git checkout myrd/games-goal-cmuieq51k002cm9gysxbyppv7   # 确认在功能分支，HEAD ≥ c2dea78
curl -X POST "$PLATFORM_API_URL/api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl/deployments" \
  -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"bundle","deployedBy":"workflow","triggeredById":"cmuieq51k002cm9gysxbyppv7",
       "gitRef":"myrd/games-goal-cmuieq51k002cm9gysxbyppv7","sourceId":"cmuieq51k002cm9gysxbyppv7"}'
# status=running → 记 liveUrl；随后 curl liveUrl/health 与 liveUrl/ 均应 200
# 产物回写：先 GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7 读 artifacts，再 PATCH 合并后的完整数组
```

## 重入复核（2026-10-02T00:29Z，第二次进入本节点）

**结论不变：仍为 blocked，阻塞点依旧是授权层，非代码。**

| 复核项 | 本次结果 |
|---|---|
| 分支同步 | 本地 HEAD = `b2bc346` = `origin/myrd/games-goal-cmuieq51k002cm9gysxbyppv7`（`git ls-remote` 实证） |
| 门禁 preflight | PASS（13 类 73 文件，退出码 0） |
| 门禁 smoke | PASS（240 帧，退出码 0，`godot-smoke: PASS 断言标记齐全，日志无脚本错误`；脚本所有失败路径均 `exit 1`，退出码 0 即真通过） |
| 门禁 input-fuzz | PASS（`GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239`，退出码 0） |
| 门禁 playtest | PASS（`GODOT_PLAYTEST: PASS`，3 局 ×900 帧；run2 `score=5|fb=44`，首奖励 2.67s，节奏阈值内） |
| 导出产物 | `games/game-3/export/web/` 含 index.html / index.js / index.pck / index.wasm（35MB，走 assets_dir 对象存储，不受 bundle 25MB 约束） |
| 授权探测（本轮新证） | `2026-10-02T00:29:47Z` POST `/api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl/deployments` → `403 FORBIDDEN 仅应用所有者或系统管理员可操作`，requestId `req_1790900987990`；同刻 GET `/api/v1/goals/cmuieq51k002cm9gysxbyppv7` → `403 无权访问` |
| 工作区 | `git status --porcelain` 干净，无漂移 |

**本轮为何只发一次部署探针**：授权 403 是环境缺陷，重试不可能改变结果。本轮单次探针只为确认
「上次阻塞是否已被运维修复」——结论是未修复（userId 仍 `cmt428ptv004bm9seap9ankcc`，role 仍
developer，via workflow-node，名下应用列表仍为空）。继续重试只会重复失败，故停止，等运维放权。

**需要运维做的事与上次完全一致（见上文「需要谁做什么」）**，三条任选其一即可解锁。

## 部署形态说明（供验收）

首选形态 a（已配置）：`assets_dir` 出 bundle —— 平台把 `games/game-3/export/web` 上传对象存储
（wasm/pck gzip），server 用 asset-store 懒加载，bundle 本体不含游戏资源（远小于 25MB 上限）。
壳侧加载链：`api/public/assets/index.js`（script，text/javascript）→
`index.wasm.gz.b64` / `index.pck.gz.b64`（base64 文本 → gunzip → 内存字节）→
fetch 拦截回喂引擎；audio worklet 经 addModule 补丁走同通道（失败自动降级原路径一次）。
