# spec 派生材料核对表 —— g2-blocks（2026-10-23 · P0-2 · 游戏策划署名件）

> 更新时间：2026-10-23 ｜ 负责人：游戏策划 ｜ 下一步：G-1 链面修复后本表随新 approved 版重锚刷新（差项 G-5）
> 派生源：契约导出件 `.myrd/spec/g2-blocks/design-spec.json`（`_platform` 锚 v9/1.6，**链上已无 approved 资质——B-6 连带，本表字段映射仍以导出件内容为准**）+ 材料清单 dy 段 v3（部署源面 `g2-blocks-main/docs/platform/dy/dy-submission-kit.md`）
> 核对口径：材料逐 id → 规格来源字段（spec 六段定位）→ 落点 → 派生成立性

## dy 段（抖音 · kit v3 逐 id）

| 材料 id | 规格来源（spec 字段定位） | 落点 | 派生成立性 |
|---|---|---|---|
| dy-share-card | `numeric.platform.dy.shareCard{width:720,height:1280}` + `acceptance[ac-13-no-external-texture]`（零外部贴图 → 卡面=实机画面）+ `world.tone`（暖色工坊视觉基调） | `export/dy/assets/dy-share-720x1280.png`（assets-manifest sha256 机判 dy-k6） | ✅ 尺寸/内容纪律双字段可溯源 |
| dy-icon（512×512） | `world.themeZones`（矿石色板 zone）+ `acceptance[ac-12-palette-double-gate]`（palette 双门禁 → 自绘派生零外部素材）+ `numeric.palette`（白名单色） | `assets/dy/dy-icon-512.png` + manifest（提审材料通道不占主包） | ✅ 色板/自绘纪律可溯源；尺寸来源=平台规范（映射表 dy-diff 行）非 spec 字段——如实标注 |
| dy-store-screenshot-01..03 | `numeric.platform.dy.storeScreenshotMinCount(3)` + `levels[]`（两关实机形态）+ `acceptance[ac-32-settlement-ia]`（结算页三层 IA = 截图主画面） | `assets/dy/shots/` ×3 + manifest（机判 3/3 sha256 三面全等，19 号轮） | ✅ 张数/画面纪律可溯源；**重摄挂账 = 差项 G-6**（v1.3 形态后未重摄） |
| dy-appid / 类目 / 资质 | 非 spec 字段（提审主体信息，平台侧）——spec `meta.platform.target=["wx","dy"]` 仅声明目标平台 | `export/dy/project.config.json`（占位 `touristappid`） | 🚨 主人侧（G-2），无 spec 派生面 |
| compliance-copy（game-name/share-title/privacy-summary/age-rating） | `meta.title`（名实一致 DC-01）+ `world.uxCommitments`/`acceptance[ac-16-persistence-minimal]`（收集项与代码一致 DC-06）+ `acceptance[ac-28-daily-hook-min-loop]`（share-title 承载面） | `export/dy/compliance-copy.json`（dy-k7 机判逐 slot 在位） | ✅ 四 slot 均可溯源；**age-rating=占位冻结（DC-07 提审日人工核对）** |
| 主包体积 | `numeric.platform.dy.bundleLimitBytes(4,194,304)` | 301,279B（部署源面实测）→ 占比 7.2% | ✅ 阈值字段直派生（详见美术件预算表） |

## wx 段（wx-submission-kit 判例同构 · 本轮核对面）

| 材料 id | 规格来源 | 派生成立性 |
|---|---|---|
| wx 包 | `numeric.platform.wx` 同构阈值面 + `acceptance[ac-17-repo-one-zero-touch]/[ac-18-ci-guard-repo-scope]`（源面纪律） | ✅ 结构可溯源；wx 面复跑差项 G-4 |
| wx 反扫（tt 违规标识符零命中） | `acceptance[ac-33-submission-bundle-zero-diff]`（FORBIDDEN 面收窄至 wx/dy 互斥子面） | ✅ 契约条款直派生；最近记录 10/11 @ `4fba03a`（线头未变） |

## 结论

1. **派生结构成立**：dy/wx 材料逐 id 均有 spec 字段定位，无「凭空规格」——派生纪律（规格来源=映射表，表上没有=缺件）执行有效。
2. **派生资质失效（连带 G-5）**：全部映射锚定在导出件内容（锚 v9/1.6），链上无 approved 版 → 材料包「内容正确、资质缺失」——这正是 R3 定级的主因之一。
3. 尺寸类规格（icon 512、截图 390×844@2x）来源为平台规范映射表而非 spec——按 kit 自身纪律如实标注，不伪装成 spec 派生。

——游戏策划（派生核对 · 主策划复核登记）
