# wx 提审包与材料清单 — stack-tower 霓虹夜塔（B0 · 2026-09-28）

> 状态：**可提审形态就绪 · 是否提审待主人拍板**（AppID + 类目/资质材料到位前不执行提审动作，不造假数据）
> spec 依据：v1.3（平台 v5 `cmukkjc10001ym9nb3dnc5kt6`）· approved · content.platform 四条目
> 本文书为 wx-submission-kit 条目落点；N4 deploy 回流按本文书逐项对照入档。

## 一、提审包（export/wx/）

- **整包复合 sha256 = `7ee13ab741fc3586b7477e43f89e94f6d2a3c32eafd49357cbd0c8b19208225f`**（定义：sha256(export/wx/manifest.json 字节)；manifest 逐件登记 62 件 sha256 并经 `check-wx-bundle-size` 磁盘一致性校验）
- game.js `8e47a84d6d0fb70d…301119` ｜ game.json `0ca4df0b756ed6e9…56f539f59` ｜ project.config.json `8c5bbbf0a9795128…798c02cdc`
- 体积分列（预算唯一来源 = spec content.platform.budgets）：**主包 317.8KB / 4MB PASS**；**开放数据域 5.7KB / 1MB PASS**
- 入口链：`game.js → build-wx/app/boot-wx.js`（tsc commonjs 直出，主包 CJS 纯净）
- AppID：`touristappid`（测试号占位，spec wx-runtime.appIdPolicy 原文策略）；正式 AppID 到位后仅需替换 project.config.json 一处

## 二、提审材料按 id 对照（spec ↔ assets/wx/manifest.json ↔ 磁盘，三向一致由 wx-submission-kit 查断言）

| # | 素材 id | 用途 | 落点 | 尺寸 | sha256（前 16） |
|---|---|---|---|---|---|
| 1 | wx-share-card-5x4 | 会话分享卡（**主判据**） | assets/wx/share-card-5x4.png | 500×400 | 见 manifest.json |
| 2 | wx-share-timeline-1x1 | 朋友圈方图（附带项） | assets/wx/share-timeline-1x1.png | 500×500 | 见 manifest.json |
| 3 | wx-store-screenshot-01 | 商店截图一（开局首屏） | assets/wx/store-screenshot-01.png | 1242×2208 | 见 manifest.json |
| 4 | wx-store-screenshot-02 | 商店截图二（perfect 涟漪） | assets/wx/store-screenshot-02.png | 1242×2208 | 见 manifest.json |
| 5 | wx-store-screenshot-03 | 商店截图三（好友排行） | assets/wx/store-screenshot-03.png | 1242×2208 | 见 manifest.json |
| 6 | wx-friend-rank-ui | 好友排行 UI | assets/wx/friend-rank-ui.png | 460×560 | 见 manifest.json |
| 7 | wx-icon | 应用图标 | assets/wx/icon.png | 120×120 | 见 manifest.json |

- 计数注记（N1 已登记）：任务书口径「8 项」与定稿 id 清单 7 项差 1，按「素材 id 一步定稿」以清单执行，差额待主人指认增补。
- 全部素材从「霓虹夜塔」参考卡 v1.0 派生（色源 theme.ts NEON 表，确定性生成链 `tools/gen-wx-assets.mjs`，重跑逐字节一致）。

## 三、提审材料清单（需主人下发/确认的非素材项）

| 项 | 状态 | 说明 |
|---|---|---|
| 微信小游戏 **AppID**（正式） | 🚨 待主人下发 | 现为测试号 touristappid 占位 |
| 类目与资质材料（软著/备案/类目证明等） | 🚨 待主人下发 | 提审必需，团队无法代办 |
| 服务域名/服务器信息（如提审表单要求） | 待定 | 纯本地玩法零后端；如需按表单口径填「无」 |
| 测试账号（如提审需提供） | 待定 | 无登录态玩法，预计填「无需」 |

## 四、复现链

```bash
node tools/gen-bgm.mjs          # BGM 环素材（f0 锁相无缝环 9.6s）
node tools/gen-wx-assets.mjs    # 平台素材 7 项（NEON 派生，确定性）
node tools/build-wx.mjs         # 组包（tsc commonjs + token 单源生成 + manifest）
node scripts/check-wx-bundle-size.mjs   # 分列预算断言
node scripts/check-numeric-freeze.mjs   # numeric 零漂移（只复算 N1 存档）
node tests/wx/run-wx-gate.mjs   # wx 轨门禁聚合
```
