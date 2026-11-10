# game-3（实况足球 · myrdplaygrou-3）scaffold 节点门禁取证

- run：cmwar74im003km9m2cwb92xkq ｜ 分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h ｜ 提交：5504c52
- 时间：2026-11-10

## 门禁读数（全部实跑，非转述）

| 门禁 | 结果 | 关键读数 |
|---|---|---|
| GAME-GATES（tests/run-all.mjs） | PASS 5/5 | 构建复现（两次哈希一致）/ singlefile（566KB 零外链）/ kernel-determinism / state-machine / football-contract（新增玩法契约） |
| PREFLIGHT（仓库内判定器） | PASS 0 WARN | P1 钉版 0.185.1/0.28.2 · P3 内核纯度 4 文件 · P4 四态 · P5 双端 · P6 画质四件套 · P7 零外链 |
| BROWSER-SMOKE（正式 62s 双视口） | PASS | desktop fps 12.6 / mobile fps 10.7；exceptions=0；截图 17/24 种量化色非纯色；性能快照 drawCalls 60/61 triangles 6244/6324 |
| ASSET_TRIPLE_CHECK | PASS（退出码 0） | 清单 7 项全 programmatic+reason，零位图入包，S1-S8 天然满足 |

## 本目录文件

- report.json：browser-smoke 正式档双视口报告（payload 含 render 性能快照）
- smoke-desktop.png / smoke-mobile.png：62s 对局终态截图（桌面 1280×720 / 移动 720×1280 触摸仿真）
- asset-triple-check.json：资产三核对报告

## 部署就绪状态（部署动作归宿主 —— 知识库「部署身份链 403」结论：节点不碰部署 API）

- 工程侧已就绪：根 apphost.toml（name=myrdplaygrou-3，assets_dir=games/myrdplaygrou-3/dist/web）+
  dist/web/{index.html, landing.html} 字节级同源（579274B，SRC_SHA=1e31039e877ffe6c）+
  server /health 元信息已更新
- 宿主执行参数：deploy_playable，sourceId=cmwaqvrnc002jm9m2nqwfsoie（本 goal 名下），
  gitRef=myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h（分叉期显式传，勿缺省部署 main）
- 部署后 liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/
- 线上复证清单：/health 返回 app=myrdplaygrou-3；落地页即游戏本体（title 屏可点开球）；
  移动端触摸摇杆+射门全链路；音频手势解锁后 BGM/哨声可闻
