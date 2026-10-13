---
name: experience-review
description: "审美官判定技能：读 experience-harness 产出的体验证据包（截图/帧序列/观测摘要），按五维 rubric（配色风格/排版可读/构图层次/动效质感/完成度）打分并出结构化改进意见——每条意见必须引用包内证据文件。只出建议不拦截（advisory-only），总分机械推导，落库前必须过 validate-review 证据链门禁。当任务需要评估 web 产物「画面质量」时使用。"
---

# 体验评审（experience-review）—— 审美官

> 定位：**裁判不摄影**。experience-harness 只产证据（截图/帧序列），本技能只出意见；
> 意见永远仅供参考（advisory-only），不进 reject 循环、不影响 goal verdict——
> 「分数不够打回」的拦截权要等金标校准（calibrate.mjs，≥20 对且 ±1 一致率 ≥90%）证明
> 品味与人足够一致后，由人类另行授予（ENFORCE）。

## 评审协议（逐步执行，不许跳步）

### 1. 输入

- `<packDir>`：证据包目录（含 pack.json / steps/*.png / video/frames/*.jpg）——必填
- `<styleCardPath>`：风格卡（.myrd/style-card.md，palette/ui/禁忌）——可选，有则 palette 维必须对照它
- `<pitch>`：一句话玩法/产品定位——可选，用于判断构图意图

### 2. 看什么（视觉输入的取用纪律）

1. `Read <packDir>/pack.json` —— 先看观测摘要（色数/帧差/每步响应），这是「画面在不在动、有没有响应」的机器事实。
2. `Read` 步骤截图（steps/*.png，全部；超过 8 张取最新 8 张）——静态质量主依据。
3. `Read` 帧序列抽样（video/frames/ 等距抽 3-4 张）——动效/反馈质感依据。
4. 截图损坏/超限会被 image-read-guard 拦——那是环境问题，如实注明后中止，不要硬编。

### 3. 打分（五维，每维 1-5 整数，锚点见 references/rubric.md）

`palette`（配色与风格一致性）· `typography`（排版与可读性）· `composition`（构图与信息层次）· `motion`（动效与反馈质感）· `polish`（完成度与杂讯）。

**铁律：**
- **每条 issue 必须带 evidence**：包内相对路径 + 位置描述（如 `steps/03-点击屏幕中心.png（左上 HUD 区域）`）。引用的文件必须真实存在于包内——凭空意见、泛泛而谈（"画面可以更好看"）一律不许写。
- **只评画面可感质量**。好不好玩、数值手感、乐趣深度不归你（G4 试玩与人类问卷的职责）——即使你顺带有看法也不写进 review。
- **overall 不许手填**：`overall.score = Math.round(五维平均)`，由落库门禁机械核对。
- 打不出把握的分（如截图中该维度信息不足），该维 score 照给但 summary 里写明依据不足，不许虚构依据。

### 4. 产物：`<packDir>/review.json`（与证据同目录同版本）

```json
{
  "schemaVersion": 1,
  "kind": "perceptual-advisory",
  "advisoryOnly": true,
  "generatedBy": "experience-review@0.1.0",
  "target": { "url": "<liveUrl>", "packDir": "<packDir>", "styleCardPath": "<path|null>", "pitch": "<可选>" },
  "dimensions": [
    { "id": "palette", "score": 3, "summary": "一句话依据", "issues": [
      { "severity": "major", "finding": "看到了什么", "evidence": "steps/02-初始画面.png（描述位置）", "suggestion": "怎么改" }
    ] }
  ],
  "overall": { "score": 3, "verdictText": "≤60字结论" },
  "topIssues": [ { "severity": "major", "finding": "…", "evidence": "…", "suggestion": "…" } ]
}
```

### 5. 落库门禁（不过不许写目标产物）

```bash
node scripts/validate-review.mjs <packDir>
# exit 0（REVIEW_VALID: PASS）→ 才可以做第 6 步；exit 1 → 按清单修正 review.json 后重跑
```

### 6. 通知人类（仅当该产物有 goal 归属）

GET `/api/v1/goals/:id` 读现有 artifacts → 数组追加一条后 PATCH 合并（读-改-写，不覆盖他人条目）：

```json
{ "op": "perceptual_advisory", "artifactType": "perceptual_advisory", "artifactId": "<包目录名>",
  "title": "审美官建议 3/5 · <verdictText>",
  "status": "completed",
  "detail": "{\"packDir\":\"<packDir>\",\"overall\":3,\"verdictText\":\"…\",\"topIssue\":\"最重的一条 finding\"}" }
```

写入后消息中心会出现 `perceptual_advisory` 条目，深链直达目标产物区——**人类及时看到**是 advisory 的存在意义（用户拍板 D1）。无 goal 归属（舰队巡检等）只落 review.json，不写产物。

## 校准（转正考核，人类评分出现后）

```bash
node scripts/calibrate.mjs --packs <包根目录> --human <人类评分.json>
# 人类评分.json：{ "<包目录名>": { "score": 1-5 } }
# 输出：配对数、±1 一致率、exact 率、SHADOW / ENFORCE_ELIGIBLE（≥20 对且 ≥1 内 ≥90%，对齐 eval-core S1 协议）
```

ENFORCE_ELIGIBLE 只是「有资格申请转正」，转正与否由人类拍板。改 rubric / 改打分习惯后必须重跑校准——校准数据不会说谎，但会过期。

## 纪律

1. **advisory-only**：review.json 与产物 detail 里不得出现 pass/fail、放行/打回类结论字段。
2. **rubric 不外流**：五维锚点是本技能内部资产，不要把它复述进游戏开发 agent 的提示词——盲评（被评者不知道评分标准）是防迎合的第一道墙。
3. **改脚本必跑自测**：`bash scripts/selftest.sh`（合法样本过、五类非法样本全拦、calibrate 形状检查）。
