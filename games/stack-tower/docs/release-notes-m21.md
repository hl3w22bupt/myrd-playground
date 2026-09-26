# Stack Tower · M2.1 Release Notes（v0.1.0-m2.1）

> 撰写：T2 游戏策划（主策划派单）· 日期 2026-09-26
> **状态：扣住（HELD）——本 notes 在 QA 第二段「对外放行」（N6 线上冒烟全绿）前不生效、不对外宣告**；生效时由主策划在 N7 改签状态并登记版本链
> 发布对象：tag `stack-tower-m2.1-release` @ `5a3284fa137a3926fabb5f7b4fcdd098bd075df3`
> 对内放行凭据：QA 回执 `QA-REL-M21-20260926-01`

---

## 一、版本一句话

**「一块一块往上叠」上线声音了**：切面看准、一指点下——现在每一次落块、完美、失误与重开都有声音，手机竖屏直接玩，还能装到桌面离线玩。

## 二、更新点清单（M2.1「有声可装」增量）

1. **音效包 sfx-pack-v1**：落块 / 完美 / 失误 / 结束 / 重开 / 过关 六事件双格式音效；连击音高逐级上探（封顶 +12 半音）、完美叮与塔身涟漪同拍、失误短促不拖沓、重开必响应（≤200ms）；静音开关状态记住你。
2. **移动端触控适配**：竖屏单指即玩；点按即落（300ms 内不吞不抖）、禁双指缩放与长按菜单；横屏进来有「转回竖屏」遮罩，转屏自动暂停；刘海/安全区不遮 HUD。
3. **PWA 可安装**：浏览器菜单「添加到主屏幕」即装；装完断网也能玩（离线全量预缓存 + 断网自动回退）；再次打开从桌面图标直进。
4. **数值零改动声明**：本版为发布轮，玩法数值与 M2 首卡完全一致（冻结基线零漂移），老玩家手感不变。

## 三、体验地址与安装指引

- **URL（HTTPS）**：`https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw`
- **在线玩**：手机或电脑浏览器打开即玩（电脑键盘：空格/点击落块，R 重开）。
- **安装（Android / Chrome 系）**：打开 URL → 菜单 ⋮ → 「安装应用 / 添加到主屏幕」→ 桌面图标直进。
- **安装（iOS / Safari）**：用 Safari 打开 URL → 分享按钮 → 「添加到主屏幕」→ 从桌面图标打开（iOS 仅从桌面图标启动才享受全屏离线体验）。
- **离线验证**：安装后开一次飞行模式再从桌面图标进入，可完整玩一局。

## 四、基线声明（v1 冻结 + v1.1 证据条款）

- **数值基线 = spec v1 冻结段**：完美窗口 140−8×(层−1) 封底 60ms / 切面宽 120·下限 36 / 计分 place+10、perfect 25+min(5×(连击−1),75) / 速度 160+24×(层−1) 封顶 420 / 层目标 8+2×(关−1)、12 关 228 层——v1/v3/发布导出件三方键序无关深比**全等**（证据：`games/stack-tower/docs/release-healthcheck-m21.md` §2，2026-09-26）。
- **证据条款 = v1.1 D3 口径**：本轮全部冒烟与门禁证据均按「文件名 + 日期 + 命令 + 输出摘要（+ tag hash）」落档（本表 §五与两份 N1/N2/N3 文档即按此撰写）。
- **spec 版本事实**：契约与实现唯一依据 = 平台 **v3 · approved**（`cmugok2uz000xm9ilx42t8pnl`）；v1.1 为「登记就绪版」（payload 就绪、冻结于 D4/D5 两用例落盘与主人答复），本轮零 spec 版本事件、零调优零新功能。

## 五、「声明 → acceptance 条款 → 冒烟项」溯源映射表

| 声明（§二） | acceptance 条款（spec v3 approved） | 冒烟/门禁项（文件级证据） |
|---|---|---|
| 音效六事件双格式 | acc-a1（sfx-pack-v1 注册表：命名/时长/双格式/manifest） | `run-all` 22 内 m21-acc-a1；`release-healthcheck-m21.md` §5 注册表逐条 + `art-final-check.md` §会签（双签） |
| 连击音高上探封顶 | acc-a4a（逐级 +1 半音）/ acc-a4b（封顶 +12 不再升） | `run-all` 内 m21-acc-a4a/a4b PASS（`gate-logs/release-m21-20260926/3-run-all.log`） |
| 重开必响应 ≤200ms | acc-a6（restart 事件契约 + RESTART_SFX_MAX_MS=200） | m21-acc-a6 PASS；restart 198ms 实测（healthcheck §5） |
| 失误不挤占关键音 | acc-a5a（critical 优先）/ acc-a5b（音频帧预算 p95） | m21-acc-a5a/a5b PASS（同上日志） |
| 静音状态记住 | acc-a3（静音持久化） | m21-acc-a3 PASS；d2 断网链路内复验 |
| 点按即落、禁缩放长按 | acc-m2（触控归一 300ms 去抖 / touch-action / 禁 gesturestart） | m21-acc-m2 PASS |
| 横屏遮罩 + 转屏暂停 | acc-m3（遮罩暂停并冻结内核）/ acc-m4（横竖纵横比） | m21-acc-m3/m4 PASS |
| 安全区不遮 HUD | acc-m1（safe-area） | m21-acc-m1 PASS |
| 添加到主屏幕即装 | acc-d1（PWA 壳：manifest 双图标 any maskable + SW 注册） | m21-acc-d1 PASS；美术终检 `art-final-check.md` ①（0px 出圆） |
| 断网也能玩 | acc-d2（离线冷启动→一局→重开→静音持久 + 404 负面用例） | m21-acc-d2 PASS（`3-run-all.log` 尾两行 `ok`） |
| 数值零改动 | e01–e08 冻结 gameplay 条款 + e07 数值总闸 | `contract-check` ② [B] 22/22；unified ① 62/0；`4-smoke.log`（seed=20260925 score=120 确定性） |
| 老用户刷新即得新版 | （SW 机制：activate 清旧缓存 + skipWaiting + claim） | `release-healthcheck-m21.md` §3 + N6 线上冒烟「老用户升级」单列项 |

## 六、版本链登记所需 spec 字段包（N7 主策划收口用）

```
game:          stack-tower（games/stack-tower/）
releaseTag:    stack-tower-m2.1-release
tagHash:       5a3284fa137a3926fabb5f7b4fcdd098bd075df3
branch:        myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d
specPlatformId:cmugok2uz000xm9ilx42t8pnl
specApproved:  v3（status=approved，2026-09-26 API 实查）
numericBaseline: v1 冻结段七键（DEFAULT_SEED/FIXED_STEP_MS/MAX_DT_MS/perfect_window/cut_width/scoring/difficulty，三方深比全等）
evidenceClause: v1.1 D3（文件名+日期+命令+输出摘要；本轮已按此执行）
pendingSpec:   v1.1（payload= .myrd/spec/stack-tower-spec-v1.1-payload.json；冻结于 D4/D5）
internalReceipt: QA-REL-M21-20260926-01
productionUrl: https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
appHost:       appId cmugttipt000km9299oej5z9b · platformSlug stack-tower-3
prevDeployed:  75debf9（2026-09-25 部署轮）
knownOpen:     U1 audio-events/bgm-loop（D4 冻结）· U2 真机三项 · U3 iOS 真机 · U4 v1.1 登记 · U5 主人试玩终裁
```

> 生效流程（N7）：对外放行全绿 → 本文件状态改签「生效（LIVE）+ 生效时间」→ 主策划在 blockers.md 登记版本链条目。
