# dy-submission-kit · C 抖音小游戏移植轮提审包与材料清单（spec v1.5）

> 落点：`games/stack-tower/docs/dy-submission-kit-c3.md`（spec v1.5 `content.platform.items[dy-submission-kit].files` 声明件）
> 基线：spec **v1.5 · approved**（平台 v7 `cmunf6r1e014cm9lfamzllk2h`）· numeric 冻结锚 `c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d`（唯一存档 `.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt`）
> repo 根：本仓库根 = run 工作区根（`git rev-parse --show-toplevel` 实证）；黑板指针：`.myrd/blackboard/`（levels.md / assets.md / blockers.md + gate-logs/）
> **是否提审由主人拍板：团队只交包，提审动作不代行。**

---

## 1. 提审包（export/tt/ 全量）

| 项 | 值 |
|---|---|
| 组包命令 | `node games/stack-tower/tools/build-tt.mjs`（tsc CJS 主包 + 骨架 + 运行时资产 + manifest） |
| 主包体积 | 300,401 B（293.4KB）≤ 4,194,304 B（4MB）—— **分列断言 PASS**（`node games/stack-tower/scripts/check-tt-bundle-size.mjs`） |
| 子包分列 | 0 B（抖音无开放数据域独立子包机制；好友榜收敛 tt 云存储单通道，dy-runtime 口径①） |
| manifest | `export/tt/manifest.json`（逐件 sha256 + 主包/子包分列体积；自指排除 manifest 本身） |
| 入口链 | `tt/game.js` → `require('./build-tt/app/boot-tt.js')`（DOM/localStorage shim + Platform 装配 + boot + 分享闭环） |
| AppID | `tt-test-appid-placeholder`（占位；正式 AppID + 类目/资质到位后由主人下发替换） |
| **包指纹** | `export/tt/game.js` sha256 = `580991ccc8d76f4440e97493d3732271afb66137d04a391eb936f852a3d0c9d0` |

> wx 包红线：C 轮 `export/wx/` 零触碰（git status 空 + B0 在案基线 sha256 不动）；构建器 `tools/build-tt.mjs` 输出面仅 `export/tt/`。

## 2. 提审材料清单（按 id 逐项对照；N4 三向核对输入）

素材产线：`node games/stack-tower/tools/gen-tt-assets.mjs`（确定性，重跑逐字节一致；色源唯一真源 = `src/render/theme.ts` NEON 表；风格四要素零漂移，仅规格裁切）。

| id | 落点（repo 根相对） | 规格 | sha256 | 用途 / 派生 |
|---|---|---|---|---|
| dy-share-card | `games/stack-tower/assets/tt/share-card.png` | 500×400（5:4） | `2a5dc3ec21943edc1c06a022de9a90df85e5f6220304cbe715624682a00061be` | 会话分享卡（dy-share-loop **主判据配图**）；参考卡面板一·开局首屏 |
| dy-store-screenshot-01 | `games/stack-tower/assets/tt/store-screenshot-01.png` | 1242×2208 | `5b32b16d3088e18b78536f1e106c88dff1546cc2d42be4fe15f41fc4524bde74` | 商店截图一：开局首屏（参考卡面板一派生） |
| dy-store-screenshot-02 | `games/stack-tower/assets/tt/store-screenshot-02.png` | 1242×2208 | `1e18613946f0a4d012359509e0d24b325fd8825b37a6f5bcb6a2a7983eb84392` | 商店截图二：perfect 涟漪时刻（参考卡面板三派生） |
| dy-store-screenshot-03 | `games/stack-tower/assets/tt/store-screenshot-03.png` | 1242×2208 | `d0e4bd6a7925e163ff8417bd6c1599f8209c49a4d26fe6256f64f8fcca7ab1a0` | 商店截图三：竖屏对局构图（安全区内，参考卡派生） |
| dy-icon | `games/stack-tower/assets/tt/icon.png` | 512×512 | `8c7a9d9df5c93aa5a64c252ab600f6d7adf418833cf62a7297da6f246219dcaa` | 应用图标：塔块霓虹剪影（参考卡块皮同源，禁新编风格） |

- 入包口径：运行时件仅 `dy-share-card` + `dy-icon` 落包；商店截图属提审材料，留仓库不入包（wx B0 判例同构）。
- 材料清单机读面：`games/stack-tower/assets/tt/manifest.json`（逐件 id/file/bytes/sha256/size/use）。

## 3. 能力级 optional（spec 口径原文③，缺失不构成打回项）

- **录屏分享**（`tt.getGameRecorder` 系）：**optional**，本轮不产件、不接线。
- **高光封面卡**（本局录屏帧派生，复用 NEON 色板，禁新编风格）：**optional**，本轮不产件。
- 反向口径：凡 spec 条目**未标注 optional** 的素材/能力缺件，一律按 spec 缺陷打回（本清单 5 件均为必选，全部在位）。

## 4. QA 四条验收口径对照（spec 条目 acceptance 原文收录）

| # | 口径原文（摘） | 本包证据 |
|---|---|---|
| ① | 好友榜落死：tt 云存储（tt.setUserCloudStorage 写 / tt.getFriendCloudStorage 读）**接入或显式降级且门禁输出可见**，降级原因三选一（缺 API/缺授权/非抖音容器）；主包零好友数据落点；禁止「视情况」 | 门禁输出可见：`DY_FRIEND_RANK=degraded reason=no-tt-container` / `reason=missing-api`（非抖音容器与缺 API 档）/ `DY_FRIEND_RANK=cloud`（API 在位档）；读取行零身份数据、零存储落点（`tests/tt/tt-runtime-surface.spec.mjs` 断言） |
| ② | 主判据：tt.shareAppMessage 最小闭环，分享回调 imageUrl 使用 dy-share-card（500×400），卡片可被会话实收 | `tests/tt/tt-share-loop.spec.mjs`：被动回调载荷 imageUrl=`assets/tt/share-card.png` + query `sid=`；主动分享 `shareNow` 同卡；行为冒烟三向一致 |
| ③ | 录屏分享/高光封面卡 = 能力级 optional，缺失不构成打回项；未标注 optional 的缺件按 spec 缺陷打回 | 本文 §3 + 门禁断言（optional 无产件不判缺陷；5 件必选全在位） |
| ④ | N4 三份输入缺一停审：approved spec + 产物带 repo 根/黑板指针 + 机器证据；结论仅输出 JSON（verdict/feedback/evidence） | 三份输入：① spec v1.5 approved 导出件 `.myrd/spec/stack-tower-spec.json`；② 本文书（repo 根 + 黑板指针在上眉）+ `export/tt/`；③ 机器证据 = `node games/stack-tower/tests/tt/run-tt-gate.mjs` 输出（gate-logs 留档） |

## 5. 门禁与复现命令（机器证据）

```
node games/stack-tower/tests/tt/tt-runtime-surface.spec.mjs     # dy-runtime 条目查（含 API 冒烟双档 / UTC+8 seed 边界 / 埋点只读巡检）
node games/stack-tower/tests/tt/tt-share-loop.spec.mjs          # dy-share-loop 条目查（主判据配图绑卡）
node games/stack-tower/tests/tt/tt-submission-kit.spec.mjs      # dy-submission-kit 条目查（本清单核对面）
node games/stack-tower/tests/tt/run-tt-gate.mjs                 # tt 轨门禁聚合（任一 FAIL → exit 1）
node games/stack-tower/scripts/check-tt-bundle-size.mjs         # 主包/子包分列断言
node games/stack-tower/scripts/check-numeric-freeze.mjs         # numeric 零漂移（只复算存档锚）
node scripts/contract-check.mjs                                 # 根契约（spec↔工程一致 + acceptance 实跑）
```

- API 冒烟双档：**devtools 档** = 本机可跑（fake tt 宿主行为冒烟，门禁已执行）；**真机档** = 显式 `blocked`（AppID + 类目/资质 + 真机工具未到位，**不执行、不造假数据**，spec dy-submission-kit.notes 口径）。
- 提审动作前置（主人侧）：① 下发正式 AppID + 类目/资质材料 → 替换 `tt/project.config.json` appid；② 抖音开发者工具（IDE）打开 `games/stack-tower/export/tt/` 走真机档与上传；③ 提审与否由主人拍板。

## 6. 埋点合规巡检（只读，零调优建议）

| 巡检项 | 结论 | 证据 |
|---|---|---|
| tt 面网络调用 | 零（`tt.request`/`uploadFile`/`connectSocket`/`fetch`/`XMLHttpRequest` 均无） | `tests/tt/tt-runtime-surface.spec.mjs` 巡检断言（tt.ts / boot-tt.ts 源扫描） |
| PII 面 | 零（无昵称/头像/设备号/身份字段；分享载荷仅 `sid=` 会话 id，与埋点 anon_id 同源语义） | 同上 + `tt-share-loop` PII 正则断言 |
| 五钩子原位 | 会话埋点仍由共享组装根 `app/main.js` 承载（session_start/session_end 原位），tt 装配面零重抄零旁路 | 编译产物 `export/tt/build-tt/app/main.js` 断言 |
| 好友榜数据 | 仅经 tt 云存储 API；主包零好友数据落点（读取不写任何存储键） | `tt-runtime-surface` 行为断言 |

> 巡检为只读核对，不输出任何调优建议（N2 职责边界；调优属策划/主人决策面）。

## 7. 变更面与红线自查（C 轮）

- 变更面 = dy 三条目声明落点 + 对称新增件（`src/app/boot-tt.ts`、`tsconfig.tt.json`、`tools/gen-tt-assets.mjs`、`tests/tt/*`；落点清单为非穷举声明——wx B0 判例同构：`src/app/boot-wx.ts` 亦不在 wx 条目 files 内而工程在位）。
- numeric / world / levels / entities / acceptance（顶层 40 条）零触碰；missions（content.retention）一字不动；scope_gate 不抢跑。
- web 回归零行为变化：`src/platform/tt.ts` / `src/app/boot-tt.ts` 不被 browser/main 链路 import；`src/platform/share.ts` 仅加法（wx 缺省卡片集字节不变）。
