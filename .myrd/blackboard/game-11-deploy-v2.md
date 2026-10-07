# 《线上抓娃娃机》(game-11) 画质 v2 部署交接（2026-10-07，implement 节点 → deploy 节点）

## 重跑节点独立复验（2026-10-07 第二轮，主工作流重跑 —— 全部通过，代码零改动）

> 本轮为重跑节点：不复跑实现（HEAD 已是 v2 画质重制内容），职责是**独立复验 + 部署就绪确认**。
> 结论：上一轮 v2 实现（3c2abfa + 0674e99）经本轮全量独立复验无缺口，部署输入不变。

| 复验项 | 结果 |
| --- | --- |
| preflight | PASS 14 类（75 文件） |
| GODOT_SMOKE | PASS 240 帧（含画质契约七断言：Filmic/Glow/雾/adjust/MSAA/主题/看门狗） |
| GODOT_FUZZ | PASS（seed=20260913，6 批 239 帧） |
| GODOT_PLAYTEST | PASS 3 局（首奖励 1.47/9.88/2.45s，反馈间隔 ≤0.63s，score 0/300/350） |
| server tsc --noEmit | PASS |
| **导出新鲜度** | 从 HEAD 重跑 `godot --headless --export-release "Web"`，index.pck sha256=`b0d851f6c2af7b13` 与已提交产物**逐字节一致**，export/ 零 diff —— 已提交导出产物确为 HEAD 代码的忠实构建 |
| v2 需求差距审计 | 三专项 + 兼容红线逐条对齐 graphics-v2.md 决策记录与 smoke.gd 断言，无缺口（详见下方审计清单） |

差距审计要点（对照需求 cmuxi89i3000km9oeyc2y2mle 验收标准）：专项一 hidpi/expand/ui_theme/Label3D 字体 ✓；
专项二 MSAA2×/Filmic/Glow/深度雾（体积雾等效替代已记录）/颜色调整/软阴影/玻璃金属反射等效 ✓；
专项三 PBR 六类分级 + 夹爪 23 件 + 娃娃细分 22/11 多部件 ✓；兼容红线（玩法闭环/3 爪参数互异/
8 娃 RigidBody3D/BGM 循环+7 音效+静音开关）冒烟断言全部在位 ✓。

## 部署输入（全部就绪，照单执行即可）

- **gitRef**：`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`（已快进并推送）
- **构建 commit**：`a9eb74b`（= 工作分支 `myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn` HEAD，两分支逐字节一致；`0674e99..a9eb74b` 仅黑板文档，不影响线上产物）
- **apphost.toml**：未改动（assets_dir = `games/game-11/export/web`，产物已提交进仓库：wasm 35.4MB / pck 3.46MB / js 331KB）
- **pck sha256 前缀**：`b0d851f6c2af7b13`（部署后可与线上资产通道产物比对验版；本轮重导出已证与 HEAD 代码逐字节一致）
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
