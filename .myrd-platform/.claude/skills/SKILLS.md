# 工作区可用技能

以下技能已由平台注入本工作区（目录型技能已软链到 .claude/skills/ 与 .agents/skills/，接入各 CLI 原生技能发现）。
任务涉及对应领域时，**优先通过 Skill 工具按名调用**；若当前 CLI 没有技能调用工具（或工具被白名单移除），再用 Read 完整读取该技能的入口文件，并遵循其中的规范与验证协议。

- **快速全栈交付SOP：先勘察复用，基线对照后再申报完成** — `.myrd-platform/.claude/skills/快速全栈交付SOP-先勘察复用-基线对照后再申报完成.md`
- **外部依赖阻塞处置 SOP：单次取证、标注阻塞、止损退出** — `.myrd-platform/.claude/skills/外部依赖阻塞处置-SOP-单次取证-标注阻塞-止损退出.md`
- **限时验收节点韧性交付与 goal.artifacts 回写完整性技能（myrd-acceptance-resilient-delivery）** — `.myrd-platform/.claude/skills/限时验收节点韧性交付与-goal-artifacts-回写完整性技能-myrd-acceptance-resilient-delivery.md`
- **myrd-platform-skill** — `.myrd-platform/.claude/skills/myrd-platform-skill.md`
- **验收探针自研先复用现成工具并设硬时间盒** — `.myrd-platform/.claude/skills/验收探针自研先复用现成工具并设硬时间盒.md`
- **平台接口落账 SOP：临时文件构造 JSON+幂等检查先行** — `.myrd-platform/.claude/skills/平台接口落账-SOP-临时文件构造-JSON-幂等检查先行.md`
- **myrd-standard-code-review** — `.myrd-platform/.claude/skills/myrd-standard-code-review.md`
- **时窗交付节点收尾SOP：必交项前置、增量回写、探针止损** — `.myrd-platform/.claude/skills/时窗交付节点收尾SOP-必交项前置-增量回写-探针止损.md`
- **限时验收节点预检门、通道降级与 goal.artifacts 回写闭环 SOP** — `.myrd-platform/.claude/skills/限时验收节点预检门-通道降级与-goal-artifacts-回写闭环-SOP.md`
- **experience-harness** — `.myrd-platform/.claude/skills/experience-harness/SKILL.md`
- **experience-review** — `.myrd-platform/.claude/skills/experience-review/SKILL.md`
- **style-card-library** — `.myrd-platform/.claude/skills/style-card-library/SKILL.md`
- **threejs-game-dev** — `.myrd-platform/.claude/skills/threejs-game-dev/SKILL.md`

以下兼容参考技能**未注入**本工作区（垂类包声明为索引条目，不为「可能用得上」付注入成本）：需要时到平台仓 `std-skills/<名>/` 阅读原文，不要在工作区内找目录。
- **godot-game-dev**（未注入，仅索引）
- **webgame-prototype**（未注入，仅索引）
