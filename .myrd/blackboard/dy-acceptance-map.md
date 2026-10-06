# dy 验收四列表（稳定 id ↔ 契约用例 ↔ 判定口径 ↔ 测试文件路径）

> 更新时间：2026-10-06 · 负责人：主策划（N1 定稿）· QA 线核销
> 规格来源：链 v6 `cmuw3gcgm01a9icryraii5dzp`（v1.4-dy draft）· tt↔wx 映射表 `docs/platform/dy/tt-wx-diff-mapping.md`
> 纪律：**表上没有的行视为缺件**；测试文件缺位 = RED 不装绿；N4 复检按本表逐行核销。

## 一、v1.1 基线锚（18 条，本轮零增改）

| 稳定 id | 契约用例 | 判定口径 | 测试文件路径 |
|---|---|---|---|
| ac-01..ac-18 | v1.1 approved 18 条逐字（含 ac-10 J1=400ms @4x/390x844） | 实现与 approved 策划案一致；锚 `302e6336…` 不降 | `scripts/contract-check.mjs`（G2_SPEC_PATH 钉 v1.1 approved 导出件；18/18 为 N2 动工锚点） |

## 二、dy 平台段验收（链 v6 · 三条目 14 行）

| 稳定 id | 契约用例 | 判定口径 | 测试文件路径 |
|---|---|---|---|
| dr-acc-1 | dy 五件落点在盘，Node 侧条目查全绿 | 缺位=RED 不装绿 | `tests/dy/dy-runtime.spec.mjs` |
| dr-acc-2 | 复用门面零重抄 + tt.* 直调面收口 | storage/audio 走 T1 门面、时钟走 T3；`tt.*` 字面只许在 `src/platform/dy/` 内，门外即缺陷（源码扫描机判） | `tests/dy/dy-runtime.spec.mjs` |
| dr-acc-3 | 首启引导路径：首屏渲染完成→第一次有效操作 | 预算=`numeric.platform.dy.interactionBudgetMs`(400ms，J1 同源)；标记名逐字复用 `j1_settle_start/j1_feedback_done`；240 帧冒烟段内机判 | `tests/dy/dy-smoke.mjs`（冒烟段）+ `tests/dy/dy-runtime.spec.mjs` |
| dr-acc-4 | 行为差异按映射表执行（dy-diff-01/02/05/06/07）+ 缺位项 dy-diff-08 fallback | 每条 tt 行为有判定口径，零空洞行；dy 包零弹窗运行时件（反向断言） | `tests/dy/dy-runtime.spec.mjs` + `tests/dy/dy-submission.spec.mjs` |
| dr-acc-5 | 开发者工具 runbook 三节内嵌（步骤/预期输出/判定标准 G1–G4） | CLI 缺席=BLOCKED-ENV exit 2 显式披露；真机 G2=首屏后 60 秒内首次有效操作 | `tools/verify-dy-devtools.mjs`（runbook） |
| ds-acc-1 | shareNow 调 `tt.shareAppMessage` 绑 720×1280 + sid 零 PII | 卡规格=`numeric.platform.dy.shareCard` 机判；sid 正则 `^[A-Za-z0-9-]{1,32}$` | `tests/dy/dy-share.spec.mjs` |
| ds-acc-2 | 分享入口纯跳转 | share.ts 静态 import 面零 kernel/game/generated/numeric | `tests/dy/dy-share.spec.mjs` |
| ds-acc-3 | 降级两路（no-dy-container / share-failed） | 两路不抛错、入口保留 | `tests/dy/dy-share.spec.mjs` |
| ds-acc-4 | 被动通道 `tt.onShareAppMessage`+`tt.showShareMenu` | 回参同卡同参（title/imageUrl 一致） | `tests/dy/dy-share.spec.mjs` |
| dk-acc-1 | 组包三件套（game.json 可解析 + deviceOrientation 合法 + 零 PWA 三件） | 结构机判，字段值允许占位 | `tests/dy/dy-submission.spec.mjs` |
| dk-acc-2 | 主包红线 ≤4194304B 逐件实测 | 非估算；超线先实测后定分包并披露 | `tools/build-dy.mjs` + `tests/dy/dy-submission.spec.mjs` |
| dk-acc-3 | 材料清单 dy 段 v2 逐 id 对照 | dy-share-card / dy-icon / 截图≥3 / 主人侧占位；规格取映射表，表上没有=缺件 | `docs/platform/dy/dy-submission-kit.md` + `tests/dy/dy-submission.spec.mjs` |
| dk-acc-4 | 合规文案位双口径 | ①占位冻结（组包机判在位）②提审日最新规范人工核对（记录入清单）；缺一 reject | `tests/dy/dy-submission.spec.mjs` + 材料清单人工栏 |
| dk-acc-5 | 合规自查表逐条「条款编号+结论+证据路径」 | 无团队面红项；主人侧/环境侧显式披露 | `docs/platform/dy/compliance-visual-checklist.md` |

## 三、spec 链面（N1 已机判在档）

| 稳定 id | 契约用例 | 判定口径 | 测试文件路径 |
|---|---|---|---|
| v6-diff | v6 仅四点 diff（numeric.platform.dy / content.platform dy 三条目 / meta 双字段） | 玩法 numeric 十二组全等锚 `302e6336…`；wx 三条目零覆盖；v4 手感锚 `1720df8e…` 保留 | `tools/build-spec-v14-dy.mjs`（守卫 11）+ `tools/qa-spec-v14-recheck.mjs`（Q0–Q11 · 12/12 · gate-logs 04 号） |
