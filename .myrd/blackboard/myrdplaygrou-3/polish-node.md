# polish 节点留痕（2026-11-11）

- run：cmwar74im003km9m2cwb92xkq ｜ 分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h ｜ 起笔 HEAD：99dbe77 前基线 e172e96
- 四轮「改→玩→看」（round-0 基线 + 3 改进轮），全部留痕 qa/playtest/round-{0,1,2,3}.md + steps/ + snapshots/，每轮单独 commit+push
- 具名改进点 9 条（improvements.md，全部取证自查带出处——用户打分卡 playtest_cmwaqvrng002lm9m2nftdd20h 未回填）：
  - 轮 1：IP9 方向与相机倒置（round-0 交互取证新立，高优先）+ IP1/IP2 相机重取景（CAM_AHEAD 2.7→8）+ IP3 光晕收口
  - 轮 2：IP4 金币立体化（竖盘+光斑+自转浮动）+ IP6 title 文案孤字 + IP8 __footballProbe 探针
  - 轮 3：IP5 事件粒子爆点（goal/save/collect）+ IP7 __audioDebug 契约 + 看台色带（首版宽檐白板当轮自纠窄檐）
- 内核确定性绊线：?smoke=8/28 快照四轮逐位一致（240/2/3/8/82.0 与 340/3/4/8/81.1）—— 三轮打磨零玩法回归
- 收口门禁（全实跑）：GAME-GATES 5/5 · PREFLIGHT PASS 0 WARN · BROWSER-SMOKE PASS（desktop 17.3 / mobile 14.8 fps，零回归）·
  MOBILE_SMOKE PASS（audio-unlock 首次过，IP7 落地）· ASSET_TRIPLE_CHECK PASS · VISUAL_RATCHET 4 条疑似全解释为刻意重设计（advisory）
- **PLAYTEST_SUMMARY FAIL（1 项，模板级缺陷，如实归因不伪造）**：C4 读数器（playtest-summary.mjs 期望 checks[].name/.pass）
  与产出器（mobile-web-smoke.mjs:89 实发 id/label/status）schema 漂移——预置首版即如此，任何游戏合法产出都无法过该读数。
  两脚本均判定器禁改（红线）；触摸可达性证据实际存在且 PASS（touch-pipeline/touch-response）。C1/C2/C3/C5/C6/C7 全绿。
  待运维改模板仓 playtest-summary.mjs（读 c.id??c.name + c.pass??(c.status==="pass")）后重跑即 PASS。
- 产物回写：op=polish_record + op=playtest_summary（autoPassSuggested=false，reason 指向模板缺陷与全绿清单）——
  PATCH 合并语义沿用客户端拼接（先 GET 全量 7 条，追加 2 条，整体 PATCH 回写并回读核验）。
- 部署边界：线上仍 @88b7469；新版部署归宿主 deploy_playable（gitRef=本分支），节点不碰部署 API（知识库「部署身份链 403」）。
- 会话资源：sessiond 显式 stop（130 步）；本地静态伺服（127.0.0.1:8137）收尾即停。
