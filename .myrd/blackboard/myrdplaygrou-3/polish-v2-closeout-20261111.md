# 打磨轮收口记录：《实况足球》v2 重跑 round-6~9（polish-v2-closeout，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；收尾 HEAD=**c8146ba**（远端同步）
- 上游：策划案 v2（cmwbl64r10082m97atgikgm0o）唯一事实源；本轮 = playtest/polish 节点（preHook: threejs-browser-smoke 在链：qa/smoke/report.json 双视口 PASS）

## ① 门禁资产核对（先核对后动手）

- std-skills/threejs-game-dev/scripts/ 6 件判定脚本全在仓；references 两模板在仓；.myrd/routines.yaml 含 id=threejs-preflight / id=threejs-browser-smoke（gamePath=games/myrdplaygrou-3）→ 不触发 blocked。

## ② 四轮「改→玩→看」（round-6~9，机器可解析段协议齐全）

| 轮 | 提交 | 主改动 | 玩/看证据 |
|---|---|---|---|
| round-6 | bdb31c3 | IP-1 相机宽高比自适应（竖屏端点不动）+ 冒烟截图补真实跟屏相机 | SEQ-M 复玩：桌面占满画幅、移动端逐字节零漂移 |
| round-7 | 6c9aa39 | IP-2 球门三面网（netTexture 程序化网格） | 实局推进至门前抓拍完整球门结构 |
| round-8 | d8d8a6c | IP-3 彩带粒子池+FOV 冲击+进球特写机位 2.2s；冒烟快进补 handleEvents；Bloom 1/8 | ?smoke=69 确定性取证庆祝四要素同框（双视口） |
| round-9 | c8146ba | v8/v9 部署上线 + 线上实局验证 + 收尾帧率余量（内部分辨率 0.7/阴影 384） | SEQ-M 线上复玩 + 线上进球特写机位实证 + 线上 mobile 门禁 PASS |

- 改进点全部带出处（qa/ 既有证据），数值改动未触碰 spec.numeric 定稿值（性能参数在 render 层，玩法数值零改动）。
- 判定器零触碰；.myrd/routines.yaml 零触碰。

## ③ 部署链

- v8=cmwbtonx4001cm9dzws5myo5z（d8d8a6c，504 受理→running 在服）→ 收尾加固后追发 v9=**cmwbubpyu001um9dzpliv6ujq**（c8146ba，running 在服，v8 转 superseded）。
- 线上复证：GET / 200 = 594,716B 与 dist/web/index.html 逐字节一致（cmp）；/health 200。
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/

## ④ 收尾证据

- playtest-summary：rounds=9 / screenshots=29 / consoleErrors=0 / versionSha=c8146ba；**valid=false 唯一缺口 C4**（平台级判定器间 schema 漂移：mobile-web-smoke.mjs:87-92 写 {id,label,status} vs playtest-summary.mjs 读 c.name/c.pass，两判定器红线禁改；原始 touch-pipeline/touch-response=pass 在档）。
- visual-ratchet（advisory）：v7→v8 线上移动配对 2 对 0 回归（title 1.0 / 摇杆 0.75）；桌面取景重构=round-6 刻意重设计在案。
- artifacts 回写（PATCH 200，GET 复读核验 28 条）：op=polish_record + op=playtest_summary（autoPassSuggested=false + 完整归因——按「缺口无法补齐不凑 PASS」纪律）。

## ⑤ 会话异常留痕

- 本轮中途 sessiond 随上一执行进程退出（后台任务无完成记录）→ 按「试玩证据缺失」纪律重启会话（session-live.json）而非编造；local 8737 http 伺服用于打磨期确定性复现，线上取证全部对 liveUrl。
