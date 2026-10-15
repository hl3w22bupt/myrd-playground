# 提审素材占位模板 README（wheat-squad · 风格卡 v1 派生）

> 更新时间：2026-10-12 · 负责人：游戏美术（模板）/ 主策划（提审拍板，未拍板不产出正式件）
> **本轮止步：材料清单 + 占位模板。正式提审素材需主人拍板后才产出提交（任务书红线：正式提审止步材料清单）。**

## 清单与规格

| 件 id | 内容 | 规格 | 体积上限（spec artCaps） |
|---|---|---|---|
| sub-icon | 应用图标 | 512×512 PNG | ≤300KB（singleAssetMaxKB） |
| sub-sharecard-5x4 | 分享卡 | 1000×800（5:4） | ≤1024KB（atlasMaxKB） |
| sub-shots-3 | 截图三连（对局早期/中期/结算页各一） | 3× 1170×2080（390×640@3x） | ≤500KB/张（shotMaxKB） |

- 模板文件：`sub-icon.template.svg` / `sub-sharecard-5x4.template.svg` / `sub-shots-3.template.svg`（SVG 文本件，色值 ∈ style-card-v1 白名单；正式件由模板按规格导出 PNG）。
- build 首包口径：qa/ 与 assets/manifest.json **不进 build**（tools/build.mjs 镜像 src/ → build/src/），提审素材不计入首包 4MB。

## 素材文案红线（违规标识符扫描覆盖面 · QA 规则清单同步）

1. 极限词禁用（广告法面）：「最/第一/顶级/国家级/世界级/独家/永久」等极限词不入任何素材文案。
2. 平台红线：好友数据不出开放数据域（素材不得暗示好友排行/好友互动）；凭证不入库（素材不得出现账号/密码/token 收集暗示）。
3. 题材口径：治愈向，禁血腥词（害虫「被冲散」不「被消灭」——style-card-v0 §三既定口吻）。
4. 机判：上述规则已入 `games/wheat-squad/ci/scope-policy.json`（forbiddenReferencePatterns），`node ci/guard-repo-scope.mjs` 对含素材文案扩展名（.md/.svg/.html/.json）全量扫描。

## 正式提审前清单（主人拍板项，本轮不执行）

- [ ] 主人拍板提审时点与渠道（wx/dy 沿 g2-blocks 判例顺延批次，spec meta.platform.note）
- [ ] 渠道后台账号与资质材料（本轮无凭据，占位符 only）
- [ ] 正式素材三件产出（自模板导出）+ 双确认（美术自检 AC-A1..A3 机判 + AC-A4 人判互查）
