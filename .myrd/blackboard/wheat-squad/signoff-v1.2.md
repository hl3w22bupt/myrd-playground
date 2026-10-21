# 主策划审签单 — spec v1.2（draft → 入链 approve）

> 审签人：主策划 · 日期：2026-10-13 · 对象：`design-spec-v1_2-payload.json`（meta v1.2，基于链 v3 approved）
> 审签性质：**流程性审签**（spec 条款完整性/可判定性/零回退——任务书「已拍板标准」授权）；「好不好玩」终裁仍归主人（W-2 挂账不变）

## 审签核对（五项全过）

1. **三合一包纪律** ✅：world 段草稿 + entities id 清单 + 首屏文案逐字枚举一次发全（`tri-pack-v1.2.md`，未拆发）；美术当天回件到齐（参考卡 v1.2 增量 + manifest v2，美术契约 ac-art-1/2/3 复跑绿）。
2. **已拍板标准逐项** ✅：验收 A1–A5（新增 a5-guidance-first-action，auto）；a4 v1 写死面（ac-a4b 真实点击本地计数 +1，auto）；埋点结构化写死 entities（9 键 事件名→字段名→类型）；check 路径定死 `checks/<acceptance-id>.mjs`（16 条全改写）；entities/levels 路径逐条对齐 inventory-line2.md（13 锚核对 ✓）。
3. **QA 预审** ✅：APPROVE-READY（`games/wheat-squad/qa/spec-v12-pre-review.md`，两项披露随件：共享实体件 / 薄壳入链后生成窗口）。
4. **既有交互裁决** ✅：程序清单 5 条当天逐条裁——4 条收进 spec 标「既有交互」（world.uxExisting）+ 1 条定性「新增条款」（ux-ex-hint，a5 判据载体）；裁决记录随 uxExisting.verdict 落死。
5. **零回退与版本链红线** ✅：world 冻结面/levels/entities 锚/既有 statement 零改动（生成器守卫机判）；经 POST /revisions 走链 version+1，旧版自动 superseded，approve 后链上唯一 approved = v4；W-5 顺带闭合。

## 审签决定

**批准（SIGN-OFF）**：以本 payload 执行 `POST /api/v1/game-design-specs/cmv4q8bng001em9qm5p78do05/revisions`（201 draft）→ approve → 回查链上唯一 approved → 导出件换基线 → checks 薄壳生成 → 全量门禁复跑。

遗留不阻塞项：Q-1 缺陷（offerIfNeeded 旁路）维持升级项，走独立 feedbackProtocol revision，不混入本版。
