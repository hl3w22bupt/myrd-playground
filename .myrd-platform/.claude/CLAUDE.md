# 项目规范

执行任务时必须严格遵守以下规范。

体检收口报告产出后、评审（goal-review 等）完成后，对当轮产出的产物（至少覆盖体检报告自身与其引用产物）按当前版本提交评分（复用现成 artifactsApi.rateArtifact，1-5 星 + 可选文字反馈，负反馈即 rating≤2）；下轮验收判据：health.json feedbackSamples.current > 0 且 negativeFeedbackReason 退出 'no-data'。不新建采集通道、不改任何代码、不设评分门槛（评分不作为产物下架依据，避免抑制真实负反馈）。

---

凡 file:line 类证据结论：①产出时钉 commit hash，收口时 re-read 分支 ref，若漂移则对变更文件重验或加标「已知未修且有改动」；②git/reflog 证据必须声明覆盖窗——reflog 仅对 clone 之后时间段有作证能力，clone 前时间段一律记「不可证」而非「零事件」；③Unix epoch 换算必须用工具（date -u -d @<epoch>）并以已知 UTC 锚点（如 health.json generatedAt）交叉验证，禁止人工心算。本条不触碰任何护栏与评分标准。
