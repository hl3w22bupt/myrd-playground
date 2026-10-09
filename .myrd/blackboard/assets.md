# 《节奏大师》(game-10) 资产与产物清单（主策划线上复核回写 2026-10-09）

## 线上产物标识（本次复核回写三项）

- **HostedApp id**: `cmv0xyobv000bm94o6kxqca8z`（slug=game-10，status=ready，version=2；`GET /api/v1/apps?projectId=cmv0xyobf0007m94ogyu79h0k` 实读）
- **deployment id**: `cmv10cg93001jm94of535yg54`（commit=`2ccb38e` @ 分支 `myrd/game-10-goal-cmv0xypkw000dm94o58qf3x8j`）
- **liveUrl**: https://leomac-studio.tail49399e.ts.net/apps/game-10/（免登录；`/gw` 同源可用）
- **/health 身份**: `{"ok":true,"app":"game-10","title":"节奏大师","assets":"lazy/object-storage"}`（2026-10-09 实测）
- **字节级证实**: 线上 index.pck 解码 2,524,032 B（md5 a4d5858d…）＝2ccb38e 构建；线上 index.js 331,495 B（md5 4e08904b…）与仓库逐字节一致；壳层 2ccb38e..b0e8560 零差异

## 游戏资产（已入库 @ 功能线分支）

- Web 导出：games/game-10/export/web（index.pck 2,524,160 B @b0e8560；wasm 35,376,909 B 原始 / base64 文本通道懒加载，js 明文 331,495 B）
- 壳契约：音频手势解锁器（__audioDebug）+ 调参桥（?tuning=<JSON> → __GAME_TUNING__）+ 相对路径资产
- 配置表：config/difficulties.json（四档 value+min+max 区间 + judge_windows_ms + score_weights + song_duration_s）
- 试玩验收包：qa/playtest-kit.md；SFX 生成器 tools/gen_sfx.gd

## QA 证据链

- PREFLIGHT PASS 14 类 / GODOT_SMOKE PASS 240 帧 AC1–AC5 / GODOT_FUZZ PASS / GODOT_PLAYTEST PASS 380/520/600（知识文档 7af3a518 §五）
- **MOBILE_SMOKE 首轮 PASS 10/10**（2026-10-09T13:45Z，fps=38）：qa/mobile/
- **MOBILE_SMOKE 复核轮独立复跑 PASS 10/10**（2026-10-09T14:23Z，fps=36，tapDiff=13，console 零错误）：qa/mobile-round2/
- 主策划线上复核报告：**qa/LIVE_REVIEW_2026-10-09.md（本轮）**——台账实读 + 字节取证 + 门禁复跑三合一
- goal artifacts 已追加 op=online_review（本 goal API 本轮可写，game-9 时代 403 未复现）

## 已知缺口（线上落后 HEAD 一提交）

- 线上＝2ccb38e，HEAD＝b0e8560（调参面板接线 main.gd 9 行）；线上 `?tuning=1` 不出面板，`?tuning=<JSON>` 直传桥不受影响
- 处置：一次重部署即消（部署权限不在本节点，见 blockers.md B2）

## 唯一剩余动作

- owner 人工试玩回填（qa/playtest-kit.md 四问量表，入口 liveUrl）+ AC4 真机抽查 + 拍板
  ——机器侧全绿不替代人工验收，拍板前目标不关闭。
