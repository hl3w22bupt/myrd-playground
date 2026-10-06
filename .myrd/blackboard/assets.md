# 《汽车连连看》(game-9) 资产与产物清单（验收复核回写）

## 线上产物标识（已实测核对，2026-10-06T04:20Z）

- **HostedApp id**: `cmuw2o6z4018picry133zwcio`（title=汽车连连看，slug=game-9，status=ready，version=3）
- **deployment id**: `cmuw5ctmf01aoicryv3xjkbzp`（v3 running，v1/v2 superseded）
- **commit**: `f15a2ba` @ 分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn`
- **liveUrl**: https://leomac-studio.tail49399e.ts.net/apps/game-9/（免登录；`/gw` 路径同源可用）
- **/health 身份**: `{"ok":true,"app":"game-9","title":"汽车连连看"}`（同路径覆盖后归属确认）

## 游戏资产（已入库 @ 部署分支）

- 字体：NotoSansSC-Regular.otf；音效：confirm/fail/hit/score .wav
- Web 导出：games/game-9/export/web（index.pck 2.5MB release 口径；wasm 经 gzip+base64 文本通道懒加载）
- 壳契约：音频手势解锁器（__audioDebug）+ 调参桥（?tuning= → __GAME_TUNING__）+ 相对路径资产

## QA 证据链

- PREFLIGHT PASS 13 类 / GODOT_SMOKE PASS 240 帧 / GODOT_FUZZ PASS 6 批 239 帧（部署分支判定器实跑）
- MOBILE_SMOKE round2 PASS 10/10（games/game-9/qa/mobile/report.json @04:00:31Z）
- **MOBILE_SMOKE round3 PASS 10/10（games/game-9/qa/mobile-round3/，本次验收复核独立复跑 @04:20:14Z，tapDiff=320，fps=26）**
- 验收复核报告：games/game-9/qa/ACCEPTANCE_REVIEW.md
