# 《汽车连连看》(game-9) 资产与产物清单（第二轮线上版复核回写 2026-10-06）

## 线上产物标识（第二轮复核实测核对，2026-10-06T14:4xZ~14:49Z）

- **HostedApp id**: `cmuw2o6z4018picry133zwcio`（title=汽车连连看，slug=game-9，同路径覆盖历史推箱子 game-9）
- **deployment id**: `cmuwqrrl70051m9lgj8v89gh9`（**v5 running**，gitRef=`myrd/games-goal-cmuw2o88z018ricryvpr6v8wn`，sourceId=本 goal id；v3 `cmuw5ctmf01aoicryv3xjkbzp`@f15a2ba 与 v4 `cmuwpdpxw004pm9lgt8rljmsz`@7a68d1e 均 superseded）
- **构建源 commit**: `2626927`（v5 导出刷新；其后 c1106d7/d8c6ae8/0a45faa 只动 qa 文档与黑板）
- **liveUrl**: https://leomac-studio.tail49399e.ts.net/apps/game-9/（免登录；`/gw` 路径同源可用；调参入口加 `?tuning=1`）
- **/health 身份**: `{"ok":true,"app":"game-9","title":"汽车连连看"}`（实测 200）
- **线上=最新部署的字节级证据**：线上 `api/public/assets/index.pck`（gzip+base64 文本通道）解码后
  sha256 `ebcb320298abbeaed9a79f71602c413dc757dccf75a772751e40eeb2b24acf2b`（3,968,912 B）
  ＝ 仓库 v5 导出 `games/game-9/export/web/index.pck`（@2626927）逐字节一致

## 游戏资产（已入库 @ 部署分支）

- 字体：NotoSansSC-Regular.otf；音效：confirm/fail/hit/score .wav
- Web 导出：games/game-9/export/web（**index.pck 3,968,912 B**，v5 @2626927；wasm 35,376,909 B 与 7a68d1e 字节一致；均经 gzip+base64 文本通道懒加载）
- 壳契约：音频手势解锁器（__audioDebug）+ 调参桥（?tuning= → __GAME_TUNING__，线上壳 HTML 实证 2 处）+ 相对路径资产

## QA 证据链（第二轮线上版 = v5）

- PREFLIGHT PASS 14 类 / GODOT_SMOKE PASS 240 帧 / GODOT_FUZZ PASS 6 批 239 帧（v5 迭代复跑）
- **GODOT_PLAYTEST: PASS 两档**（默认档 900 帧 fb=75/80/76；全 session 档 5400 帧 fb=517/483/518；
  阈值 `games/game-9/tests/playtest.json`；日志 `games/game-9/qa/playtest-round2/report*.log`）
- MOBILE_SMOKE PASS 10/10（games/game-9/qa/mobile/report.json @14:19:33Z，tapDiff=320，fps=37）
- **MOBILE_SMOKE round5 PASS 10/10（games/game-9/qa/mobile-round5/，第二轮复核独立复跑 @14:49:03Z，
  tapDiff=320，idleDiff=338，fps=36，EXIT=0）**
- 第二轮复核报告：games/game-9/qa/ACCEPTANCE_REVIEW_ROUND2.md（第一轮见 ACCEPTANCE_REVIEW.md）
- 试玩验收包（owner 量表母本）：games/game-9/qa/playtest-kit.md —— 状态：**待用户试玩**
