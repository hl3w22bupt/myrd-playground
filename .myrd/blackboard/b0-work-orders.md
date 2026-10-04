# B0 派活单 — 微信小游戏移植轮（2026-09-28 · 主策划签发）

> **工程路径（所有节点锚定）**：`games/stack-tower/`（仓库根 = run 工作区根）
> **黑板路径（所有节点回写）**：`.myrd/blackboard/`（levels.md / assets.md / blockers.md + 本派活单）
> **spec 基线**：v1.2（平台 v4 `cmuj5f6ik00hkm9l64r5uickm`）· approved · numeric sha256 `c3af773b6483…74957d`（冻结锚）
> **产物落点纪律**：策划案改动 → game-design-specs 接口版本链；代码/素材/脚本 → git 仓库文件；门禁证据 → `.myrd/blackboard/gate-logs/b0-wx-port-20260928/`；裁决与阻塞 → blockers.md。下游不靠猜。

## N1 · spec v1.3（游戏策划）
- **输入**：v1.2 approved 八段（平台侧 + 导出件双源，2026-09-28 实查一致）；B0 任务书 platform 段要求。
- **产出**：`tools/build-spec-v13.mjs`（含四段冻结守卫）→ `.myrd/spec/stack-tower-spec-v1.3-payload.json` → `POST /api/v1/game-design-specs/cmuj5f6ik00hkm9l64r5uickm/revisions`（version+1，draft）。
- **范围红线**：仅新增 **platform 段四条目**（`wx-runtime` / `wx-share-loop` / `wx-open-data-rank` / `wx-submission-kit`），每条带 id + 落点文件 + 可执行 check；素材 id 一步定稿（wx-share-card-5x4、wx-share-timeline-1x1、wx-store-screenshot-01~03、wx-friend-rank-ui、wx-icon）；QA 两条验收口径原文写死（主判据=会话分享 5:4 卡；朋友圈=附带项；开放数据域不卡「真机看到真实好友分」）；**world/entities/levels/numeric 四段与 v1.2 逐字节一致**（守卫违反即拒绝产出）；acceptance 32 条零增改。revision detail 存档 ① numeric 段 sha256（唯一冻结基线）② 新增文件全清单。
- **验收信号**：payload 构建守卫全绿 + 平台 201 → 转 N1.5。

## N1.5 · QA spec 预检（游戏 QA）
- **输入**：N1 draft 版全量内容 + v1.2 基线导出件。
- **产出**：`.myrd/blackboard/gate-logs/b0-wx-port-20260928/n1.5-qa-precheck.md`。
- **查项**：四条目 id/落点/check 可执行性逐条核对；acceptance 是否「v1.2 原四判据一字不改 + 仅追加口径写死」；四段冻结独立复算（sortKeys 深比 + sha256）；素材 id 与落点一一对应。
- **验收信号**：缺陷当场打回（不打回 N2）；PASS → `POST /:newId/approve` → 导出件双落点回写（stack-tower-spec.json + design-spec.json）→ 平台侧 approved 唯一复核。

## N2 · 适配层 ‖ 平台素材并行（游戏程序 ‖ 游戏美术）
- **程序**：①`src/platform/wx.ts` wx 装配体（Platform 接口平台无关，抖音日后零改复用）+ onShow/onHide 生命周期；②`src/audio/bgm.ts` BGM 环（调度连续性/静音/首触解锁，DI 可测，web 侧不接线 → 零行为变化）；③分享闭环 `src/platform/share.ts`（会话 5:4 + 朋友圈 1:1）；④开放数据域子包 `wx/open-data-context/`（token 引主包同一份变量文件，构建期单源）；⑤`tools/build-wx.mjs` 组包 → `export/wx/`（project.config.json 用测试号 touristappid 占位）；⑥三脚本：`contract-check`（复用根分发器）/ `scripts/check-wx-bundle-size.mjs`（主包 ≤4MB 与子包 ≤1MB 分列断言）/ `scripts/check-numeric-freeze.mjs`（**只复算 N1 存档 sha256，禁止现场自算**）。
- **美术**：按 spec 定稿 id 产出平台素材（确定性生成链 `tools/gen-wx-assets.mjs` → `assets/wx/` + manifest sha256），全部从「霓虹夜塔」参考卡派生，零新编风格；查表器 `tests/wx/assets-wx-check.mjs`。
- **验收信号**：typecheck 绿 + 组包产物齐 + 三脚本可跑 + 素材查表全 PASS；产物路径全部落回本黑板 assets/levels 两份登记。

## N3 · 三轨门禁（游戏 QA）
- **输入**：N2 全部产物 + v1.2 基线门禁记录。
- **三轨**：①web 回归轨（v1.2 四判据 + 契约全量重跑，零行为变化）→ ②wx devtools 轨（contract + 体积 + numeric 零漂移 + audio/bgm-loop 冒烟；CLI 未装部分以结构门禁取证，如实标注）→ ③真机轨（Android+iOS：BGM onShow/onHide、静音键、首触解锁、会话分享卡片实收、开放数据域渲染；**AppID 未到位 → 不执行不造假，升级主人**）。
- **六条拒绝线（原文执行，任一命中即 reject）**：numeric sha256 不一致 / 差集非空 / bgm-loop 无 wx 结果 / 超预算 / web 回归失败 / 条目缺落点或缺 check。
- **产出**：`games/stack-tower/docs/qa-wx-b0.md` 回执 + gate-logs 证据链。

## N4 · deploy 回流 → 人工拍板（主策划整合）
- **产出**：`games/stack-tower/docs/wx-submission-kit-b0.md`（提审包 sha256 + 提审材料按 id 逐项对照 + 提审材料清单）；blockers.md 收口 + 版本链登记。
- **验收信号**：材料清单齐 → **是否提审由主人拍板；不点头 B0 不闭环**。

## 全局阻塞（跨节点）
- 🚨 **AppID + 类目/资质材料待主人下发**（影响真机轨与提审）；微信开发者工具 CLI 未安装（影响 devtools CLI 面）——均已升级，不阻塞 N1/N1.5/N2/N3 可机跑面。
