# 《汽车连连看》(game-9) 资产与产物清单（验收复核回写）

## 线上产物标识（第三轮复核复测口径，2026-10-07）

- **HostedApp id**: `cmuw2o6z4018picry133zwcio`（title=汽车连连看，slug=game-9，status=ready）
- **deployment id**: `cmuwqrrl70051m9lgj8v89gh9`（**v5 running**；v1–v4 superseded）
- **commit**: 游戏代码 `2626927` @ 分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn`
  （其后 `c1106d7`/`d8c6ae8`/`0a45faa` 仅 qa 文档，不影响线上产物）
- **liveUrl**: https://leomac-studio.tail49399e.ts.net/apps/game-9/（免登录；`/gw` 路径同源可用）
- **/health 身份**: `{"ok":true,"app":"game-9","title":"汽车连连看"}`（2026-10-07 实测）
- **字节级证实**: 线上 `api/public/assets/index.pck` 解码后 sha256
  `ebcb3202…acf2b`（3,968,912 B）＝ 仓库 v5 导出 @`2626927` 逐字节一致；index.js 同（2026-10-07 复测）

## 游戏资产（已入库 @ 部署分支）

- 字体：NotoSansSC-Regular.otf；音效：confirm/fail/hit/score .wav
- Web 导出：games/game-9/export/web（index.pck 3.97MB release 口径 @v5；wasm/js 经 base64 文本通道懒加载）
- 壳契约：音频手势解锁器（__audioDebug）+ 调参桥（?tuning= → __GAME_TUNING__，线上实测在位）+ 相对路径资产

## QA 证据链（v5 口径）

- PREFLIGHT PASS 14 类 / GODOT_SMOKE PASS 240 帧 / GODOT_FUZZ PASS 6 批 239 帧
- **GODOT_PLAYTEST: PASS 两档**（900 帧 fb=75/80/76；5400 帧 fb=517/483/518，
  阈值 tests/playtest.json 四键全满足）：qa/playtest-round2/
- **GODOT_PLAYTEST: PASS 第三轮独立复跑**（2026-10-07，四门禁全绿，三局指标与 round2 归档
  **逐字一致**＝确定性复现）：qa/playtest-round3/
- **MOBILE_SMOKE round6 PASS 10/10**（第三轮复核对线上 v5 独立复跑，2026-10-07T14:50Z，
  tapDiff=320，fps=36，console 零错误）：qa/mobile-round6/
- 历史：qa/mobile（round2/round4/round5 口径 PASS）、qa/mobile-round3（v3 时代复核复跑）
- 验收复核报告：qa/ACCEPTANCE_REVIEW.md（v3）→ qa/ACCEPTANCE_REVIEW_ROUND2.md（v5，PR #36）
  → **qa/ACCEPTANCE_REVIEW_ROUND3.md（v5 独立复验，本轮）**
- 待落账 goal artifacts JSON：qa/ACCEPTANCE_REVIEW_ROUND3.md §四（API 403 待 owner 凭据）

## 唯一剩余动作

- owner 人工试玩回填（qa/playtest-kit.md 四问量表，入口 liveUrl + 调参 ?tuning=1）并拍板
  ——机器侧全绿不替代人工验收，拍板前目标不关闭。
