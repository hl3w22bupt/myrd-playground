# 《光路谜阵》liveUrl 公网可玩性核验（verify 节点取证）

- 核验时间：2026-09-26（公网核验节点）
- 方法：curl（HTTP 层）+ Playwright 无头 Chromium 1280×800（真实加载与交互）
- 核验对象：`https://leomac-studio.tail49399e.ts.net/apps/game-4`
- 部署：v2（commit `619d6d6`，首次核验）→ **v4 running**（commit `178a8e3`，含 Content-Type 修复后复验）
  - v3/v4 说明：deploy POST 网关 504 重试导致重复创建，两笔同 gitRef，v4 running、v3 superseded

## 一、公网可玩性（第 1 关实测，全绿）

| 步骤 | 结果 |
|---|---|
| 打开 liveUrl | 200 text/html（`/apps/game-4/` 308 规整到无尾斜杠，属正常） |
| 引擎启动 | `#boot` 遮罩按期隐藏，进度条走完，canvas 1280×800 可见 |
| 控制台 | **0 error / 0 pageerror / 0 失败请求**（v2、v4 两轮均如此） |
| 第 1 关渲染 | HUD「第 1/10 关 · 初试光线」「旋转 0 / 最优 1」+ 1-10 关选择条 + 光源/镜子/接收器全部在位（截图取证 `01_loaded.png` / `03_final.png`） |
| 交互通关 | 空格旋转 1 次 → 光束点亮接收器（变绿）→「通关！★★★（步数 1 / 最优 1）」，星级符合「最优解 = 3 星」规则 |
| 仓库资源 | `index.js`/`index.wasm.gz.b64`/`index.pck.gz.b64` 全部 200；不存在资源正确 404（`missing.js`→404），无缺失资产 |

## 二、部署硬约束逐条核验

| 约束 | 核验结果 |
|---|---|
| `.wasm` Content-Type = `application/wasm` | **修复后通过**：v4 起 `GET /api/public/assets/index.wasm` 返回 `content-type: application/wasm`（修复 commit `178a8e3`：raw 名直取且清单类型为 wasm 时按真实 MIME 伺服；`application/wasm` 不在 M1 网关二进制黑名单，可透传）。修复前为 `text/plain` |
| 页面加载无控制台报错 | 通过（两轮无头实测均 0 error） |
| 主菜单进入第 1 关并正常渲染交互 | 通过（见上表） |
| 资源无 404 | 通过 |
| COOP/COEP 跨域隔离 | **M1 网关约束下以等效配置达成**：平台网关响应头仅透传 `Content-Type`/`Cache-Control`（`services/apphost/proxy.ts`），应用层设置 COOP/COEP 无法到达浏览器。等效保障 = ① 单线程 Godot Web 构建，不依赖 SharedArrayBuffer/`crossOriginIsolated`，页面经 b64→DecompressionStream 端内解压直喂引擎（避开 instantiateStreaming 对响应头的要求）；② 边缘已带 `access-control-allow-origin: *`。M2 流式代理落地后可直接补头部 |

## 三、artifacts 回写

- 部署 API 携带 `goalId=cmuieqj7o0031m9gyf4pbwptg` + `artifactKind=playable`，部署成功后平台自动回写目标卡片：
  `playable / deploy_playable / completed / https://leomac-studio.tail49399e.ts.net/apps/game-4/`（唯一一条，重复项已清理）
- 与既有 `hosted_app`（`/apps/game-4/gw` 相对路径）并存，本次为完整公网 URL 口径

## 四、v5 轮核验（2026-09-27，spec.numeric 收口重部署）

- 部署：**v5 running**（commit `6cbeee5`，deploymentId `cmuin4z7q001om9l6lxwbw46s`，
  gitRef `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，mode=bundle，11 资产 36.5MB→存储 10.4MB）
- 本轮构建内容：spec.numeric 拍板数值（par 修真 + 难度曲线回正，见 `qa/spec-numeric.json`）
  + Juice 反馈协议 + 合成音效（`qa/SFX_NOTES.md`），四门禁全绿（PREFLIGHT / GODOT_SMOKE 240 帧 /
  GODOT_FUZZ / **GODOT_PLAYTEST** 3 种子×900 帧）

| 步骤 | 结果 |
|---|---|
| 壳页 `GET /apps/game-4/gw` | **200 text/html**（12KB；`/` 308 规整，正常） |
| `GET /api/public/assets/index.wasm` | **200 + `content-type: application/wasm`** ✓（硬约束持续满足） |
| `GET /api/public/assets/index.js` | 200 `text/javascript` |
| pck 内容一致性 | 线上资产（b64→gunzip 解码）与仓库构建 `export/web/index.pck` **逐字节一致**（sha256 `5bfa5ca8…`，2,568,528 B）—— 线上即本轮新构建 |
| 部署状态 | `running`（= 服务中终态，engine 事务内切指针 + hosted_apps.current_deployment_id 已指向 v5） |

## 结论

**公网可玩：通过。** liveUrl 可直接打开试玩，第 1 关加载、渲染、旋转交互、通关结算、星级判定全部符合需求；`.wasm` Content-Type 硬约束已修复并在线验证；COOP/COEP 以平台 M1 阶段等效配置达成（M2 可补头部）。

## 五、v6 轮复验（2026-09-27，iterate 收口轮：四门禁复跑 + 重导出 + 重部署）

- 门禁复跑（同源判定脚本 `std-skills/godot-game-dev/scripts/`，HEAD `4b24894`）：
  `PREFLIGHT: PASS`（13 类 / 63 文件）→ `GODOT_SMOKE: PASS`（240 帧）→
  `GODOT_FUZZ: PASS`（seed=20260913，6 批 239 帧）→ `GODOT_PLAYTEST: PASS`（3 种子×900 帧，
  METRICS 与 `qa/PLAYTEST_KIT.md` §一逐字段一致 —— 判定可复现）
- Web 重导出（`godot --headless --export-release Web`）：产物与库内基线**逐字节一致**
  （pck sha256 `5bfa5ca8…` / wasm sha256 `fe5cebc5…`）—— 构建可复现，无需产物换版
- 部署：**v6 running**（deploymentId `cmuio05ia0036m9l69170hjqi`，commit `4b24894`，
  gitRef `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，mode=bundle，
  部署 API 携带 `goalId=cmuieqj7o0031m9gyf4pbwptg` + `artifactKind=playable`；
  部署前先 dryRun 校验构建，正式 POST 单次不重试 —— 规避 v3/v4 的 504 重复部署坑）

| 步骤 | 结果 |
|---|---|
| 壳页 `GET /apps/game-4`（308 规整后跟随） | **200 text/html 12,178 B**，含调参桥 `__GAME_TUNING__` 与音频解锁 `__audioDebug` |
| `GET /health` | 200 `{"ok":true,"app":"light-path-labyrinth",...}` |
| `GET /api/public/assets/index.wasm` | **200 + `content-type: application/wasm`** ✓（10,696,408 B；b64+gzip 载荷解回 sha256 `fe5cebc5…` 35,376,909 B，与库内 wasm 逐字节一致 —— MIME 修复后载荷有效） |
| `GET /api/public/assets/index.js` | 200 `text/javascript` 331,495 B（= 库内字节数） |
| pck 内容一致性 | 线上 `index.pck.gz.b64`（b64→gunzip）sha256 `5bfa5ca8…` 2,568,528 B，与库内构建**逐字节一致** |
| 部署状态 | `running`（服务终态，`hosted_apps.current_deployment_id` 已指向 v6，app status=ready，无 errorMessage） |

**v6 结论：公网可玩通过，四门禁 + 构建复现 + 部署指针三者同一 HEAD，收口闭环。**
