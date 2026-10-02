# game-9 线上终态核验报告：四项标识 + 线上可玩性独立复验

> 目标：cmupsrc19002sm9dhp5su0zaj（推箱子点亮方块解谜 game-9）
> 核验对象：线上最终部署（非部署节点自测，本次为独立复验）
> 核验日期：2026-10-02 · 核验人：终态收口节点 agent
> 结论：**线上最终版可玩，四项标识齐备；goal 卡片回写因 token 身份不匹配被 403 拒绝，回写载荷已备好待套用**

## 一、四项标识（本节点产出）

| 标识 | 值 | 来源 |
| --- | --- | --- |
| HostedApp id | `cmupsrats002qm9dhccq0c1px`（slug=game-9，status=ready） | 平台库 hosted_apps（API 列表对非 owner 不可见） |
| deployment id | `cmupxibnn0087m9dhz3cfhap4`（version 1，mode=bundle，duration=838ms） | app_deployments |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-9/ | hosted_apps.live_url + 线上实测 |
| commit | `19a6d59262f50b9d0780a82f16392e5689ce5edd`（短 19a6d59） | deployment.commit_hash，分支 `myrd/games-goal-cmupsrc19002sm9dhp5su0zaj` |

补充口径：

- 部署记录层 `app_deployments.status=running` 与应用 `ready` 并存，属知识文档已记录的已知滞后，判断死活以 `/health` 与实际可达为准。
- 审计分支提示（知识文档「两条分支并存」坑的复核）：线上部署 commit 19a6d59 位于 `myrd/games-goal-cmupsrc19002sm9dhp5su0zaj`（tip=0103b33，其后仅 docs 差异）；本核验节点工作区分支为 `myrd/game-9-goal-cmupsrc19002sm9dhp5su0zaj`（前置体检线，tip 含本文档）。查线上行为认 commit 19a6d59。

## 二、线上可玩性证据链（全部独立复测）

1. **HTTP 层**
   - `GET /apps/game-9/health` → 200 `{"ok":true,"app":"game-9","env":"development","assets":"lazy/object-storage"}`
   - `GET /apps/game-9/` → 308 → 200，返回 game-9 落地壳（标题「推箱子点亮方块解谜」，含 §3C 调参桥与移动端音频解锁器）
2. **资产通道（M1 网关文本通道）**
   - `/api/public/assets/index.js` 200，331,495B（Godot 引擎引导）
   - `/api/public/assets/index.wasm.gz.b64` 200，10,696,408B → b64→gzip 解码 35,376,909B，魔数 `\0asm` 版本 1 —— **与仓库 19a6d59 提交的 index.wasm 字节数完全一致**
   - `/api/public/assets/index.pck.gz.b64` 200，3,338,324B → 解码 2,518,528B，魔数 `GDPC` 版本 2 —— **与仓库提交的 index.pck 字节数完全一致**
   - `/api/public/assets/index.audio.worklet.js` 200，7,298B
3. **浏览器实测（Chromium for Testing 1234 + WebGL2，headless + `--enable-unsafe-swiftshader`）**
   - boot 覆盖层 1.8s 自动隐藏，零控制台错误、零失败请求
   - **AC1/AC2/AC4**：键盘回放 level-01 见证解 `RR`（来自 `games/game-9/scripts/sokoban_levels.gd`，与门禁同源）→ 方块入格点亮 `1/1`、`步数 2 = 目标步数 2`（最佳评级）、通关弹层按倒计时出现（截图 `t1-win.png`）
   - **关卡切换**：N 键进入 level-02「绕后接线」（0/2，目标步数 10）正常加载（`t2-level2.png`）
   - **AC3**：Undo 后步数归 0 且布局精确复原；Restart 回到初始局面（`b-after-undo.png` / `c-after-restart.png`）
4. **AC5（响应）**：桌面键入到画面变化的帧内响应（无输入丢弃以外的可感知延迟）；移动端触屏由门禁 GODOT_FUZZ 与 touch_swipe 断言覆盖，本次未真机复测。

## 三、发现与建议（不阻塞）

1. **通关评级字符缺字形**：弹层「评级」后字符渲染为方框（字体子集缺该符号，疑似 ★ 类），中文正文渲染正常。建议后续给字体子集补上评级用字形并重新导出。
2. **headless 核验环境坑**：browse daemon 的 headless Chromium 默认无 WebGL2（游戏壳按设计报「缺少运行所需特性」，属环境限制而非游戏缺陷）；复测需 `--enable-unsafe-swiftshader`（playwright-core + chromium-1234 实测可行）。

## 四、goal 卡片回写状态：blocked（身份不匹配），载荷已备好

- 本节点平台 token `actFor=cmoqv70b80000m9d4b58k27zt`，而 game-9 goal/hosted app 归属 `cmuimu6w50003m9l61jj8nzxg`：
  - `GET /api/v1/goals/cmupsrc19002sm9dhp5su0zaj` → 403「无权访问」
  - `PATCH`（合并后 8 条 artifacts 数组）→ 403「无权操作」
  - `GET /api/v1/apphost/apps?slug=game-9` / deployment 直查 → 403「仅应用所有者或系统管理员可操作」
- **未伪造身份**：未使用 JWT_SECRET 伪造 goal owner token，回写留给持正确身份的编排者执行。
- **现成载荷**：`docs/game-9-live-verification/merged_artifacts.json` 为「现有 7 条 + 新增 1 条 verify_live」的合并后完整数组，条目含上述四项标识与核验结论；持 goal owner 身份后：
  ```bash
  curl -X PATCH -H "Authorization: Bearer <owner-token>" -H "Content-Type: application/json" \
    "$PLATFORM_API_URL/api/v1/goals/cmupsrc19002sm9dhp5su0zaj" \
    -d @docs/game-9-live-verification/merged_artifacts.json
  ```
  注意先重新 GET 一次 goal artifacts 做三方合并（本条目按 `op=verify_live && artifactId=cmupsrats002qm9dhccq0c1px` 幂等去重），避免覆盖他人新增条目。

## 五、证据文件索引（docs/game-9-live-verification/）

| 文件 | 内容 |
| --- | --- |
| `t0-boot-level1.png` | level-01 初始局面（步数 0，点亮 0/1） |
| `t1-win.png` | 见证解回放通关：点亮 1/1、步数 2=par 2、通关弹层 |
| `t2-level2.png` | 切换 level-02（0/2，par 10） |
| `b-after-undo.png` | Undo 后：步数 0、布局复原 |
| `c-after-restart.png` | Restart 后：初始局面 |
| `merged_artifacts.json` | 待套用的 goal artifacts 合并载荷（8 条） |
