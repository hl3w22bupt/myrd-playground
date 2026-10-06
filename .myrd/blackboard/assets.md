# 《线上抓娃娃机》(game-11) 资产与产物清单（验收复核回写）

## 线上产物标识（已实测核对，2026-10-06T12:13Z+）

- **HostedApp id**: `cmuwf171v000vm9lg2vqldhwy`（slug=game-11，status=ready，网关在线实证）
- **deployment id**: `cmuwj6mze0037m9lgdwigdpli`（gitRef=`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`，构建 commit `155e442`；其 `155e442..bffad6b` 仅 QA 证据/文档提交，不影响线上产物）
- **liveUrl**: https://leomac-studio.tail49399e.ts.net/apps/game-11/（免登录；实测 HTTP 200）
- **/health 身份**: `{"ok":true,"app":"claw-machine-game-11","env":"development","assets":"lazy/object-storage"}`
- **线上=仓库实证**: index.js sha256 逐字节一致；index.pck（gzip+b64 解码后）sha256 `87f7ae8e…` 与 `games/game-11/export/web/index.pck` 一致，GDPC 魔数正确

## 游戏资产（全程序化，零外部模型/音频文件）

- 3D：机台/玻璃罩/顶灯（machine.gd）、3 种爪型（claw.gd）、8 种娃娃 RigidBody3D（doll.gd）——BoxMesh/SphereMesh 等代码建模
- 音频：BGM `bgm_shop.wav`（20s 无缝循环，-9dB）+ 7 种音效（22kHz 16bit WAV，离线 `tools/gen_bgm.gd`/`gen_sfx.gd` 合成）
- 字体：NotoSansSC 子集（Web 端中文必备）
- Web 导出：games/game-11/export/web（wasm 35.4MB / pck 3.4MB 对象存储懒加载；`export/`、`qa/` 已加 .gdignore 不打进 pck）
- 壳契约：gzip+b64 文本资产通道 + 音频手势解锁器（`__audioDebug`）+ 调参桥（`?tuning=` 7 键）+ 全相对路径

## 门禁证据链（验收复核节点独立复跑，2026-10-06T12:1xZ）

- 门禁 A 本地四门禁：`bash games/game-11/verify.sh` EXIT=0 —— preflight PASS 14 类 / GODOT_SMOKE PASS 240 帧 / GODOT_FUZZ PASS（seed=20260913，6 批 239 帧）/ GODOT_PLAYTEST PASS 3 局（首奖励 2.55/9.88/2.53s）
- 门禁 B 移动端模拟门禁：round3 PASS 10/10（`qa/mobile/` @10:29Z）+ **round4 独立复跑 PASS 10/10**（`qa/mobile-round4/` @12:18Z，fps=10、tapDiff=43、console error=0）——双轮收敛可复现
- 验收复核报告：games/game-11/qa/ACCEPTANCE_REVIEW.md
- 功能分支已快进对齐部署分支：`myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn` @ `bffad6b`
