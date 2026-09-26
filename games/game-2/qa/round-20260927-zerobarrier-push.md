# 直通车推送记录 · 零门槛真机试玩与回填入口 + 终态清单（2026-09-27）

> 前一轮推送（`round-20260927-express-unlock-push.md`）把「两个开关」当成了必经路径；
> 本轮 feedback hub（v18）上线后换路：**手机零设置**即可完成「真机待验 + 试玩回填」两项。
> 本文件是该次推送的落盘存档（频道、消息 id、正文全文、推送前的线上终态核实），便于审计与下轮引用。

## 1. 推送前线上终态核实（本次实测，非引用）

| 项 | 结果 |
|---|---|
| 游戏入口 `https://leomac-studio.tail49399e.ts.net/apps/game-2` | ✅ 200（带尾斜杠 308 → 无尾斜杠，浏览器自动跟随） |
| 壳页「反馈 ★」角标 | ✅ 在线（顶部居中，href=`api/public/feedback` 相对路径） |
| 反馈中枢 `…/apps/game-2/api/public/feedback` | ✅ 200，内容完整（扫码/试听/一键回填/`__fbAudioDebug` 全部在位） |
| 反馈中枢 `…/apps/game-2/feedback`（无 `/api/public` 前缀） | ❌ 404 —— **线上入口以带前缀者为准**；无前缀路由只存在于工作区 HEAD 源码（未部署） |
| `/gw/health` | ✅ `{"ok":true,...}` |
| 线上版本 | v18，deployment `cmuiytvnl00g7m9l68wuoekds`，commit `aa3c50f`，gitRef `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`（该 commit 不在本工作区分支历史内，路由形态与 HEAD 不同属预期） |

**勘误口径**：`round-20260927-feedback-hub.md` 预告的入口 `<liveUrl>feedback` 与线上实际路由不符；
真机可用入口是 `…/api/public/feedback`（本次 200 实测）。后续物料若引用无前缀入口需随下一次部署对齐。

## 2. 推送落点

| 项 | 值 |
|---|---|
| 频道 | 星尘收集者 · 试玩反馈（`cmuiseju600brm9l6z7xh107f`，private，与上轮同频道） |
| 消息 | `cmuizemgi00gim9l6i4xmt411`（type=text，1581 字符，2026-09-26T22:49:00Z） |
| 发送接口 | `POST /api/v1/channels/{channelId}/messages` |

## 3. 消息正文（全文存档）

🎮 **《星尘收集者》零门槛真机试玩已上线：任何开关都不用开，手机点开就玩**

换路完成：不再依赖 safaridriver / 网页检查器等任何开发者开关。手机**零设置**，约 1 分钟即可同时完成「真机待验 + 试玩回填」两项。此前推送的「两开关清单」降级为可选自动化路径（见文末④）。

**① 最短路径（iPhone Safari，约 1 分钟）**

1️⃣ 点开游戏，随便玩 1 分钟：
https://leomac-studio.tail49399e.ts.net/apps/game-2
摇杆收星尘（+1 分，清脆上行双音）→ 故意撞陨石（-1 护盾，低频闷响）→ 护盾归零看结算（下行三连音）→ 点「重新开始」（上行扫频）。
这一步本身就是真机实测：页面自动采集设备与音频取证（UA、分辨率@DPR、AudioContext 解锁态等），**无需截图、无需连电脑**。首次触摸屏幕后声音即解锁，若没声音先点一下屏幕。

2️⃣ 点游戏页**顶部居中「反馈 ★」角标**打开反馈中枢（或直接开）：
https://leomac-studio.tail49399e.ts.net/apps/game-2/api/public/feedback

3️⃣ 三键提交：四类音效逐类**试听 + 点星**（另加操作流畅度、整体满意度两维）→ 点 **「复制回填链接」** → 回本频道粘贴，即完成回填。
（同页另有「复制 JSON 回执」「在游戏里打开回填链接」两个备用按钮；想改数值仍走原通道：游戏地址加 `?tuning=1` 开调参面板，点「复制调参链接」贴回频道即可。）

**② 终态清单**

- 游戏入口 liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-2 （线上 v18，/health 200，四类音效已实测在位）
- 反馈中枢：https://leomac-studio.tail49399e.ts.net/apps/game-2/api/public/feedback （页面自带 liveUrl 二维码，可电脑打开后用手机扫码进游戏）
- 四类音效（与游戏内同一套合成音色，试听即同款）：
　· collect 收集星尘 —— 正弦上行双音 B5→E6
　· hit 撞陨石 —— 锯齿下行 220→62Hz + 噪声颗粒
　· game_over 护盾耗尽结算 —— 三角波下行三连音 A4→E4→C4
　· restart 重新开始 —— 正弦上行扫频 C5→C6
- 达成 6/8：①Godot 工程就位 ②三门禁（preflight / smoke / input-fuzz）③对抗输入 + 方向契约 ④玩法可玩 ⑤部署闭环（liveUrl 可玩）⑦产物回写（HostedApp / deployment / liveUrl）✅
- 剩余 2 项：⑥真机验收（自动化达成、真机待验）⑧试玩回填（自动化达成、试玩待回填）
　→ 上面①的一条路径即可**同时清零这两项**：试玩页自动取证对应⑥，三键提交对应⑧。

**③ 网络提示**：Tailscale 内网域名，iPhone 需接入同一 Tailscale 网络。

**④ 可选自动化路径（原 3 步，仅自动化回归测试才需要）**：
`sudo safaridriver --enable` → iPhone 设置→Safari→高级→打开「网页检查器」→ safaridriver 会话（真机 UDID `00008140-000438141EA2801C`）。完整手册见仓库 `games/game-2/qa/real-device-ios-20260927.md`。日常试玩完全不需要这些。

## 4. 正文措辞的两处校准（防过度承诺）

1. 「自动取证」只承诺页面**实际采集**的字段（UA / platform / maxTouchPoints / 语言 / 在线态 /
   viewport@DPR / AudioContext 解锁态与 statechange 日志），不承诺「每一步操作被录制」——
   真机操作结论由用户星级评分（sfx_collect / sfx_hit / sfx_game_over / sfx_restart / flow / overall）承载。
2. 音效解锁前提（首次手势）写进正文，避免「没声音 = 音效缺陷」的误报。

## 5. 用户侧下一步（一句话路径）

**手机点开 liveUrl 玩 1 分钟 → 顶部「反馈 ★」→ 点星 → 复制回填链接 → 贴回本频道。**
回填链接一到即同时清零⑥真机待验与⑧试玩待回填两项（数值类回填仍可走 `?tuning=1` 调参链接通道）。
