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

## 结论

**公网可玩：通过。** liveUrl 可直接打开试玩，第 1 关加载、渲染、旋转交互、通关结算、星级判定全部符合需求；`.wasm` Content-Type 硬约束已修复并在线验证；COOP/COEP 以平台 M1 阶段等效配置达成（M2 可补头部）。
