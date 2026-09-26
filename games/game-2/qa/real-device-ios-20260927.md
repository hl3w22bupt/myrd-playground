# 《星尘收集者》iOS Safari 真机实测记录（2026-09-27）

> **结论先行：`未验：真机阻塞`。** 本轮未能附着到真机 Safari，A/B/C/D/E 全部 **未验**（无一项 pass，无一项 fail）。
> 阻塞不是网络、不是部署、不是代码，而是 **两个必须人工在系统设置里打开的开关**（见 §4）。
> 本文件如实记录全部尝试过程与确切报错，让下一轮只翻两个开关即可直达实测环节。

实测时间：2026-09-27 03:10-03:25（+0800）；执行环境：本工作区（macOS 26.3.1 25D771280a）。
配套：清单 `ios-checklist.md`、桌面实测 `measured-evidence.md`、待验回填 `real-device-pending.md`。

## 1. 环境等级（如实标注）

| 项 | 值 | 取证方式 |
|---|---|---|
| 真机机型 | Liang 的 iPhone 16（`iPhone17,3`） | `xcrun devicectl list devices` |
| 真机系统 | iOS 26.6.2 | `xcrun xctrace list devices` |
| 真机 UDID | `00008140-000438141EA2801C` | `xcrun xctrace list devices`（**注意：与 coredevice id 不同**，见 §3.2） |
| 配对状态 | `available (paired)` | `xcrun devicectl list devices` |
| Mac 系统 | macOS 26.3.1（Build 25D771280a） | `sw_vers` |
| safaridriver | 随 Safari 26.3.1（21623.2.7.111.2） | `safaridriver --version` |
| **输入方式** | **无 —— 未获任何输入通道**（既非真实触控，也非合成事件） | 本文件 §3/§4 |
| 网络路径 | Mac ⇄ Tailscale 域名 200；**手机侧可达性未测得**（自动化未附着） | `curl` 实测，见 §5 |

**红线自检**：本文不含任何 `pass`。若下一轮继续实测，A1-A8/B1-B5 等触控项必须用**真实触控**或明确标注「真机 Safari + 合成事件」，二者不得混写。

## 2. 逐项结果（A/B/C/D/E）

| 段 | 项 | 结果 | 说明 |
|---|---|---|---|
| A | A1-A8 虚拟摇杆触控 | **未验** | 会话建不起来（§4），无任何触控注入通道 |
| B | B1-B5 触摸确认按钮 | **未验** | 同上 |
| C | C1-C3 首手势解锁音频 | **未验** | 无法取 `window.__audioDebug()` JSON（无会话即无 JS 求值） |
| C | C4 音效听感 | **未验（阻塞于 SFX 未实现）** | 见 `measured-evidence.md` §5：游戏内 0 个 SFX 节点 |
| D | D1-D6 安全区/横屏 | **未验** | 无法切 orientation、无法截屏 |
| E | E1-E4 帧率 | **未验** | 无 Timelines 抽样通道 |

证据引用：**无截图**。`qa/shots/` 本轮未创建 —— 没有任何一张真机截屏，不造空目录冒充证据。
所有可复核证据均为命令行原始输出，原文见 §3/§5。

## 3. 尝试过程与确切报错（原始输出）

### 3.1 `safaridriver --enable`：失败，需 sudo 密码

```
$ safaridriver --enable            # stdin 关死，非交互
Password:Password is not valid, please try again.     → EXIT=1

$ sudo -n safaridriver --enable
sudo: a password is required                          → EXIT=1
```

授权状态交叉确认（偏好键不存在 = 确证未开）：

```
$ defaults read com.apple.Safari AllowRemoteAutomation
The domain/default pair of (.../com.apple.Safari, AllowRemoteAutomation) does not exist
```

### 3.2 启动参数纠错：`--device` 不是合法选项

```
$ safaridriver -p 1337 --device 09A8F8BF-2765-5EA4-9DAF-138F0DA8A574
safaridriver: unrecognized option `--device'
```

**纠正**：safaridriver 不用命令行选设备，改用**会话能力** `safari:deviceUDID`。任务简报给的
`09A8F8BF-2765-5EA4-9DAF-138F0DA8A574` 是 **CoreDevice id**，不是 UDID —— 传给
`safari:deviceUDID` 会匹配不到设备。真机 UDID 是 `00008140-000438141EA2801C`（§1）。

修正后进程正常存活：`safaridriver -p 1337`（pid 29811，日志 `/tmp/safaridriver-game2.log`，内容为空 —— 无崩溃、无告警）。

### 3.3 建 WebDriver 会话：两个阻塞都被实测命中

第一次（带 `safari:deviceUDID`）→ **设备侧开关未开**：

```json
{"value":{"error":"session not created","message":"Could not create a session: Some devices were found, but could not be used:\n- Liang的 iPhone 16 (00008140-000438141EA2801C): Web Inspector is not enabled on device","stacktrace":""}}
```

第二次（同样带 UDID）与第三次（不带 UDID，即桌面 Safari 路径）→ **Mac 侧开关未开**：

```json
{"value":{"error":"session not created","message":"Could not create a session: You must enable 'Allow remote automation' in the Developer section of Safari Settings to control Safari via WebDriver.","stacktrace":""}}
```

重试 2 次均复现，非偶发。**两个开关是相互独立的必要条件**：只开一个仍建不起来（第一/二次报错互补即是证据）。

## 4. 阻塞原因与下一轮解锁步骤（预计 2 分钟人工操作）

| # | 阻塞 | 确切报错 | 解锁操作（必须人工） |
|---|---|---|---|
| 1 | Mac 侧远程自动化未授权 | `You must enable 'Allow remote automation' in the Developer section of Safari Settings` | 在 Mac 终端执行 `sudo safaridriver --enable` 并输入管理员密码（等同在 Safari 设置 → 开发者 → 勾选「允许远程自动化」）；**或**在 Safari 设置 → 高级勾「显示开发者菜单」后手动勾选 |
| 2 | iPhone 侧 Web Inspector 未开 | `Web Inspector is not enabled on device` | iPhone 设置 → Safari → 高级 → 打开「网页检查器」；同时确认同页「远程自动化」为开 |

解锁后下一轮直接执行（无需重走本轮探索）：

```bash
safaridriver --enable                                   # ① 需要一次管理员密码
safaridriver -p 1337 &                                  # ② 不带 --device
curl -s -X POST http://127.0.0.1:1337/session \
  -H 'Content-Type: application/json' \
  -d '{"capabilities":{"alwaysMatch":{"browserName":"safari","safari:deviceUDID":"00008140-000438141EA2801C"}}}'
```

然后按 `ios-checklist.md` A→E 顺序逐项实测；取证钩子 `window.__audioDebug()`
（返回 `{state, addModules, log}`，见 `server/src/game-page.ts:134`）与
`window.__GAME_TUNING__`（调参桥）已在壳页就位。

## 5. 已实测到的网络层事实（`measured`，非真机）

这一节证明**部署侧没有任何问题** —— 解锁开关后可以直接进入实测，不必怀疑线上。

```
$ curl -s -o /dev/null -w "%{http_code} %{size_download}" -L https://leomac-studio.tail49399e.ts.net/apps/game-2/
→ 200, 12375 字节（页面 HTML）

$ curl -s https://leomac-studio.tail49399e.ts.net/apps/game-2/gw/health
→ {"ok":true,"app":"star-dust-collector","env":"development","assets":"lazy/object-storage"}

页面内取证钩子与防误触声明齐备：
  __audioDebug       ×1    __GAME_TUNING__   ×3
  touch-action: none ×1    user-scalable=no  ×1

资产通道（/apps/game-2/api/public/assets/*，base64 文本通道）：
  index.js.gz.b64     HTTP=200  bytes=331495    t=0.03s
  index.wasm.gz.b64   HTTP=200  bytes=10696408  t=0.43s
  index.pck.gz.b64    HTTP=200  bytes=3344428   t=0.13s
```

**未测得**：iPhone 本机能否解析并访问该 Tailscale 域名（MagicDNS / Tailscale 网络在手机上是否可达）。
这是解锁 §4 两个开关之后的第一个待确认点 —— 若手机不在同一 Tailscale 网络，会在导航步骤直接超时。

## 6. 与桌面 WebKit 实测的差异

| 维度 | 桌面 WebKit（本 Mac Safari 26.3.1） | iOS Safari 真机（iPhone 16 / iOS 26.6.2） |
|---|---|---|
| 本轮可测性 | **连桌面会话也建不起来** —— 同被 Mac 侧「允许远程自动化」阻塞（§3.3 第三次尝试），故桌面 WebKit 本轮同样 0 实测 | 0 实测 |
| 摇杆可见性 | `DisplayServer.is_touchscreen_available()` = false ⇒ TouchUI 隐藏，显示「WASD」提示 | true ⇒ 摇杆自动出现 —— **只能在真机验证** |
| 触控事件路径 | 无 `InputEventScreenTouch/Drag`，桌面冒烟只注入噪声帧验证鲁棒性 | 真实触控/合成 touch 事件 → `_unhandled_input` |
| 音频解锁 | 无手势门槛，AudioContext 直接可用 | 创建即 `suspended`、切后台 `interrupted`，需壳页五手势兜底（C 段核心风险） |
| 安全区 | 无刘海/Dynamic Island/home indicator | D1/D2 必须真机看 |
| 帧率 | 桌面 GPU/无热节流，数据无参考价值 | E1-E4 只认真机 |

**结论**：桌面 WebKit 与真机的差异项（A/D/E 全部、C 的手势解锁、B 的真实触控命中）恰恰是 `ios-checklist.md` 判定 P0 的全部内容，因此桌面侧无法替代、本轮也不产生任何可用于放行的结论。

## 7. 2026-09-27 第 4 轮探针记录（编排侧实测）

> **结论先行：`未验：真机阻塞`（卡点已收敛）。** 4 个必要开关中的 **第 1 个已确认打开**，
> 剩余阻塞从「系统层 sudo 授权」收敛为 **Safari 应用自身的「允许远程自动化」设置**。
> 仍无一项 A/B/C/D/E pass/fail —— 本节只记录探针结果与剩余用户动作。

实测时间：2026-09-27（第 4 轮，编排侧复探）；执行环境：本工作区（macOS 26.3.1）。

### 7.1 已生效：sudo `safaridriver --enable`

```
$ safaridriver --version
Included with Safari 26.3.1 (21623.2.7.111.2)          → EXIT=0
```

`sudo safaridriver --enable` 已由用户执行成功 → **第 1 个开关（Mac 侧远程自动化授权，§4 表 #1）已打开**。
与 §3.1 的 `AllowRemoteAutomation` 偏好键缺失相比，这一步的前置阻塞已解除。

### 7.2 新卡点：Safari 应用自身设置未同步

建会话（`safari:deviceUDID=00008140-000438141EA2801C`，端口 4799）返回**新报错**：

```json
{"value":{"error":"session not created","message":"session not created: You must enable 'Allow remote automation' in the Developer section of Safari Settings to control Safari via WebDriver.","stacktrace":""}}
```

即：`safaridriver` 守护进程层面已获授权，但 **Safari 应用自身的设置项**（设置 → 高级 →
「显示网页开发者功能」→ 菜单栏「开发」→「允许远程自动化」）仍未勾选，
授权没有被自动同步过来。**卡点收敛为 Safari 应用自身设置**。

补充实测：无 sudo 的 `safaridriver --enable` 仍**交互式索要密码**（`Password:` 提示），
非交互环境（stdin 关死）无法完成 —— 不能靠脚本绕过，必须人工操作。

### 7.3 剩余用户动作（预计 2 分钟）

| # | 动作 | 说明 |
|---|---|---|
| ① | Mac Safari → 设置 → 高级 → 勾选 **「显示网页开发者功能」** | 打开「开发」菜单的前置 |
| ② | 菜单栏 **「开发」→「允许远程自动化」**（或终端执行 `safaridriver --enable` 并输入开机密码） | 解除 §7.2 报错 |
| ③ | iPhone 设置 → Safari → 高级 → 打开 **「网页检查器」** | 解除 §3.3 第一次尝试的设备侧报错 |
| ④ | iPhone 数据线连接 Mac，**首次在手机上点「信任」** | 建立设备通道 |

四项完成后即可按 §4 末尾的命令直达实测环节（`safaridriver -p <port>` + `POST /session`
带 `safari:deviceUDID`），再按 `ios-checklist.md` A→E 顺序逐项实测。
