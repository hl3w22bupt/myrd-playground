# deploy-r8-20261012 —— workflow deploy 节点取证包（重跑放行轮）

## 部署单
- 坑：`cmv36wl94001xm9mxp119q48x`（slug **wheat-squad-2** · sourceId=wheat-squad · projectId=cmto0g28j0002m9sqnvjdy8o7，黑板登记复用，未新建）
- 部署单：`cmv4wnl880009m95qbp6ye1am` = **version 8** · status=**running** · commitHash=**21756d7**（=本轮 HEAD=origin/main，重跑口径：publish 已回流 origin/main，识别为已回流放行部署）· errorMessage=null · manifestPath=games/wheat-squad/apphost.toml · sourceId=wheat-squad
- 部署前 v7 @46cce20（落后 14 提交：N9 复核 + N10–N15 门禁收口 + 美术复证轮 r2–r7）

## 部署前门禁（本节点实跑，01 号证据）
- 确定性重建：`node tools/build.mjs` 重建 10 文件 ≡ 仓内提交 build/ 逐字节全等（git status 空）——「部署字节=提交字节」成立；src/build 同批止于 729ef41，其后零代码变更
- verify.sh 五步全 PASS，VERIFY-EXIT=0：①统一契约（approved spec 对账）②自有契约 ③WS-SMOKE headless 全链路（ready ✓→击杀 ✓→A1/A4 埋点真实产生 ✓→victory 167s run_duration_ms=167984ms 真实载荷 ✓→重开复位 ✓→console 零错误 ✓）④⑤SCOPE-GUARD 双模式

## 线上自测（v8 ready 后）
| 检查 | 结果 |
|---|---|
| /gw/health | **HTTP 200** |
| /gw 页面 | **HTTP 200 但 title=汽车连连看** —— ≡ /apps/game-9/gw 字节全等（md5 `abb7c87b…`，与 N8 登记 W-3 串线指纹一致） |
| 资产面 main.mjs | **live ≡ 提交 build 全等**（md5 `1711423891…` ≡ N8 登记值）——坑资产确为本游戏产物 |
| WS-LIVE-SMOKE | **FAIL（exit=1）**：页面（game-9 壳）引用 `index.js` → 404 boot 断链，READY 超时 |

## 结论
- **部署面成功**：v8 ready @21756d7，API 三要素（status/commitHash/errorMessage）在档；资产权威面字节全等。
- **页面路 W-3 串线第四次复现**：正确 manifestPath+sourceId 部署（v4/v5/v7/v8）后页面路仍发共享 game-9 壳，资产路与页面路分离——平台 serving 层缺陷，非本游戏部署面问题。玩家侧后果：试玩入口 boot 断链（game-9 壳引 index.js，本坑无此资产）。
- W-3 维持升级运维/平台侧（主人转发）；解除判据=页面路按坑 manifest 返回对应壳（页面 title=麦浪小队），复测判据=WS-LIVE-SMOKE PASS。
