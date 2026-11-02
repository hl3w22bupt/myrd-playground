# 试玩反馈四问回填面板（?tuning=1）契约与数据流

> 面板入口：线上 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1`
> （调参工作台同页第二节）。对应实现：`scripts/tuning_panel.gd`（UI/提交）+
> `scripts/tuning_feedback.gd`（答案 → spec.numeric 修订建议的纯映射层）+
> `server/src/index.ts` `/api/public/feedback/spec-revision`（壳层中继）+
> 冒烟第 19 项机判（`tests/smoke.gd::_check_four_questions_contract`）。

## 1. 硬约束（本节点的红线）

1. **面板只收集用户亲手点选**：四问控件无任何预选/默认值；四问缺一 → 提交按钮禁用；
   `TuningFeedback.derive` 对不完整答案拒绝产出（双保险）。冒烟机判「空答案的缺答清单 = 4 项」。
2. **不代填、不虚构**：全「刚好 / 3 星」→ 建议 0 条（不虚构调参诉求）；面板文案明示
   「答案只来自你的点选」。
3. **不直接改代码默认值**：映射层全程只读 —— 冒烟快照 `TUNING_META` 全键 + `LEVELS`
   四个可调键（hp_scale/speed_scale/first_wave_delay/wave_gap），跑完全部映射逐键比对不变。
   `tuning_applied` 恒为 false，拍板权在目标 owner。

## 2. 四问口径

| 问 | 问题 | 选项 | 附加（可选） |
|---|---|---|---|
| Q1 | 单局时长感受 | 太短 / 刚好 / 太长 | — |
| Q2 | 难度感受 | 太容易 / 刚好 / 太难 | 开始吃力的关卡号（下拉「不填 / 第 1-8 关」） |
| Q3 | 音效紧张感 | 1-5 星 | — |
| Q4 | 整体好玩度 | 1-5 星 | 一句话建议（≤120 字，原样透传） |

触屏口径：全部点按控件（无键盘必经路径；Q4 文本框为可选输入），
按钮高度/星级按钮宽度均 ≥44px（acc-touch-only「点按目标 ≥44px」硬口径）。

## 3. 答案 → spec.numeric 修订建议（确定性映射，可机判）

基准：提交时链上最新 approved = **策划案 v6**（`cmvyol366005wm9y0kzkdz57d`，
载荷 `basis.spec_chain_head` 记录；入链前以平台最新 approved 重算差异）。

| 答案 | 建议方向 | 数值档位 | spec 依据 |
|---|---|---|---|
| Q1 太短 | 节奏上调 | 首波延迟/波间隔各 **+3s**（钳制 8-20s / 9-24s） | difficulty.durationRule 60-180s |
| Q1 太长 | 节奏下调 | 各 **-3s**（同上钳制） | 同上 |
| Q2 太难 | 曲线下调 | 自吃力关卡起 hpScale **×0.85** / speedScale **×0.95** | difficulty.curveRule |
| Q2 太容易 | 曲线上调 | 自第 2 关起 hpScale **×1.15** / speedScale **×1.08** | 同上 |
| Q3 1-2 星 | 紧张感上调 | BGM 加压层提前进入（ceil(总波次/2)→ceil(总波次/3)）+ 基础层音量 0.4→0.45 | audio.bgm（v6 紧张感音画分层） |
| Q3 4-5 星 | 紧张感下调 | 加压延后（最后一波前 1 波）+ 音量 0.4→0.32 | 同上 |
| Q4 ≤2 星 | 内容扩容方向 | 不出数值定稿；用户一句话原文进修订说明 | numeric.plants/zombies/content |

映射硬规则（全部进冒烟机判，注入偏差会红）：
- Q2 附「第 1 关」→ 起点钳制到第 2 关（**第 1 关教学入口不动**，curveRule 基线）；
  未附关卡号默认自第 2 关起。
- 曲线建议**强制逐关严格递增**（hpScale 级差 ≥0.05 / speedScale ≥0.02），
  单调性从第 1 关现行值起验 —— 禁止相邻关卡整体回落。
- 建议逐关列出 `from → to`（from = GameState 现行值 = spec.numeric 的工程实现）。

## 4. 数据流（面板提交 → 平台策划案入链）

```
[用户] 打开 liveUrl/?tuning=1 → 玩完一局 → 四问点选 → 一键提交
   │ 面板（tuning_panel.gd）
   ├─ 发布 window.__TUNING_FEEDBACK__ = <修订建议 JSON>（页面全局，取证出口）
   ├─ POST <页面基路径>/api/public/feedback/spec-revision（壳层中继，尽力送达）
   │    └─ 服务端校验答案形态（不信任客户端）→ 内存留痕（最近 10 条）
   └─ 面板显示：建议条数 + 中继 ACK（不可达时引导「复制修订建议 JSON」）

[goal agent] GET /api/public/feedback/spec-revision/latest 取回用户提交
   ↓ [目标 owner] 在 goal 会话拍板 tuning_applied
[goal agent] POST /api/v1/game-design-specs/<最新 approved id>/revisions
   body = { spec: <最新 approved 全量 spec + 建议修订 numeric>, detail: <载荷 detail> }
   ↓ 入链产生新版本（旧版自动 superseded）
[goal agent] 同步 game_state.gd 默认值 + docs/numeric-and-assets.md → 重跑门禁复证
```

职责边界：
- **中继不连平台、不持任何凭证、不代做修订** —— revisions 会产生新 approved 版本，
  拍板权在目标 owner；中继只做「留痕 + 取回」。
- **数值权威在 GDScript 映射层**（冒烟第 19 项机判）；服务端只校验形态，不校验数值。
- 路径常量两端同源：`tuning_feedback.gd RELAY_PATH` ↔ `server/src/index.ts` 路由；
  任一改名必须同改（冒烟机判常量不漂移）。

## 5. agent 入链 runbook（下轮 owner 拍板后执行）

```bash
# ① 取回用户提交（部署含本节点改动后可用）
curl -s "$LIVE_URL/api/public/feedback/spec-revision/latest"
# ② 取平台最新 approved spec，按建议逐条落 numeric（amounts 以建议 payload 为准）
# ③ POST revisions（design-spec:write；产生新版本，owner 已拍板 tuning_applied 才执行）
curl -s -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  -d "{\"spec\": <新 spec 全量>, \"detail\": <载荷 detail>}" \
  "$PLATFORM_API_URL/api/v1/game-design-specs/<最新 approved id>/revisions"
# ④ 同步 game_state.gd 默认值 + 本目录 numeric-and-assets.md → verify.sh 全绿 → 导出部署复证
```

## 6. 门禁映射

| 判定 | 位置 |
|---|---|
| 面板脚本工程内可编译可实例化（拦「有类无实例」盲区） | `tests/smoke.gd::_check_four_questions_contract` |
| 无头不创建面板（`is_enabled()` = false，网页门禁） | 同上 |
| 缺答拒产出 / 全刚好零建议 / 方向与单调性 / 第 1 关不动 | 同上（注入偏差实证会红） |
| 用户原话逐字透传 / tuning_applied 恒 false / 默认值快照不变 | 同上 |
| 中继答案形态校验（枚举/星值/缺答 422；坏 JSON 400；超限 413） | `server/src/index.ts`（tsc --noEmit + app.request 实测） |
