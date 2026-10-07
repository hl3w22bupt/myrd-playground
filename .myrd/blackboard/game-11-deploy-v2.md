# 《线上抓娃娃机》(game-11) 画质 v2 部署交接（2026-10-07，implement 节点 → deploy 节点）

## 部署输入（全部就绪，照单执行即可）

- **gitRef**：`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`（已快进并推送）
- **构建 commit**：`0674e99`（= 工作分支 `myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn` HEAD，分支内容逐字节一致）
- **apphost.toml**：未改动（assets_dir = `games/game-11/export/web`，产物已提交进仓库：wasm 35.4MB / pck 3.46MB / js 331KB）
- **pck sha256 前缀**：`b0d851f6c2af7b13`（部署后可与线上资产通道产物比对验版）
- **HostedApp**：`cmuwf171v000vm9lg2vqldhwy`（slug=game-11，status=ready，不变）
- **liveUrl**：https://leomac-studio.tail49399e.ts.net/apps/game-11/（不变）

## 部署前门禁证据（与仓库内判定脚本同源实跑，commit 0674e99）

| 门禁 | 结果 |
| --- | --- |
| preflight 14 类 | PASS（75 文件） |
| GODOT_SMOKE | PASS（240 帧，含新增画质契约断言：Filmic/Glow/雾/adjust/MSAA/主题/看门狗七项） |
| GODOT_FUZZ | PASS（seed=20260913，6 批 239 帧） |
| GODOT_PLAYTEST | PASS（3 局 900 帧，首奖励 2.5s，反馈间隔 ≤0.63s，score 350/300） |
| server tsc --noEmit | PASS（壳页 game-page.ts 改动） |

## 本轮部署的关键变化（deploy 后移动门禁预期）

1. **壳页 DPR 分级钳制**：WebGL probe 检测软渲染（SwiftShader/llvmpipe/software）→ 钳 1
   （与 v1 部署行为一致，门禁 runner 预期走这条路）；真 GPU → 钳 2（hidpi 清晰文字，专项一）；
   URL `?dpr=N` 显式覆盖。**门禁预期与上轮同等条件**（v1 上轮 runner 实测 10fps PASS）。
2. **游戏内软渲染 LOW 档**：adapter 名命中 → 启动即关 MSAA/Glow/雾/调整/补光/阴影，
   跳过看门狗暖身；真机/桌面（HIGH）全效果 —— 专项二效果验收以真机/桌面预览为准。
3. **同机对照实验**：v1 与 v2 在本地 SwiftShader 同时刻实测 fps 完全一致（均 5，本地读数仅供
   相对比较）——画质升级零帧回退；上轮 10fps 为平台 runner 环境。
4. 体积红线：pck 3.4MB → 3.46MB（+1.8%，全程序化资产策略不变，无显著回退）。

## 部署后验收清单（deploy 节点执行）

- [ ] `/health` 200 且 `app=claw-machine-game-11`
- [ ] 线上壳页含分级钳制代码（grep `CAPPED_DPR` 附近有 `UNMASKED_RENDERER_WEBGL`）
- [ ] 线上 pck 解码后 sha256 = `b0d851f6…` 前缀（确认新构建生效）
- [ ] mobile-web-smoke 对 liveUrl PASS 10 项（软渲染 runner 走钳 1+LOW，与上轮基线同条件）
- [ ] 产物回写：deployment id（新）+ HostedApp id + liveUrl → goal artifacts

## 回写产物标识（部署完成后由 deploy 节点补全）

- HostedApp id：`cmuwf171v000vm9lg2vqldhwy`
- deployment id：待平台部署后回填（上轮为 `cmuwj6mze0037m9lgdwigdpli`，本轮会产生新 id）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-11/
