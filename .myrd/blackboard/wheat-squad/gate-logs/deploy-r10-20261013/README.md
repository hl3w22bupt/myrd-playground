# 部署轮 r10（2026-10-13 · 游戏程序 · workflow deploy 节点 · v12 重发复证）

> 依据：工作流 deploy 节点重发（当前成果再发布）。坑复用 `cmv36wl94001xm9mxp119q48x`（slug `wheat-squad-2`，sourceId=wheat-squad，GET 核对后 POST，未新建）。
> 部署单 **v12** `cmv641ays003ym9qq0w2u53bg` · mode=bundle · gitRef=`myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1` · manifestPath=`games/wheat-squad/apphost.toml` · 首轮轮询即 **ready**（errorMessage=null）@ commit `7608768`。

## 证据索引

| # | 文件 | 内容 |
|---|---|---|
| 01 | `01-verify-gates.log` | verify.sh 五步全 PASS（统一契约 + 自有契约 + WS-SMOKE 四事件全链路 + SCOPE-GUARD 双模式），`VERIFY_EXIT=0` @ HEAD `7608768` |
| 02 | `02-deploy-api.log` | 部署请求/响应回执（deploymentId/status=running → 轮询 ready） |
| 03 | `03-live-w3-probe-v12.log` | W-3 **第八次复现**探针：页面 title=汽车连连看 · 页面字节跨坑全等（wheat-squad-2 ≡ game-9，md5 `abb7c87b…`）· health 自报 app=game-9 · 资产路 main.mjs/spec.json/index.html live≡local md5 全等 · 嵌套资产 `src/*.mjs` HTTP 404 · 壳 Godot-only boot 契约要点 |
| 04 | `04-live-smoke-v12.log` | `tools/smoke-live.mjs` 对 LIVE 入口 → DIE READY（boot 断链）**`LIVE_SMOKE_EXIT=1`**（预期红，fail-closed；取码紧邻命令非管道，n9 口径） |

## 结论

1. **部署本体成功**：v12 ready，资产路字节 ≡ HEAD `7608768` build（三件 md5 全等）——部署内容正确在线。
2. **可玩交付维持阻塞（W-3 平台 serving 层，游戏仓侧不可修）**：页面路/health 对所有 app 发同一份 game-9 Godot 共享壳（字节全等实证）；壳 boot 链硬依赖 `index.js`+`index.wasm.gz.b64`+`index.pck.gz.b64` 且资产网关单段路由嵌套 404，TS 多模块工程无法经此壳 boot。**试玩入口维持暂缓交付**（r9 判例：避免误测 game-9 壳）。
3. 解除判据不变：页面 title=麦浪小队 ⇒ smoke-live PASS ⇒ 试玩入口正式交付。
4. 构建确定性：`node tools/build.mjs` 重建 10 文件与仓内产物零字节漂移（部署字节=提交字节）；`games/wheat-squad/src` 自 build 提交 `c4348e1` 起零变更。
