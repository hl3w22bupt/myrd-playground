# 工作区可用技能

以下技能已由平台注入本工作区（目录型技能已软链到 .claude/skills/ 与 .agents/skills/，接入各 CLI 原生技能发现）。
任务涉及对应领域时，**优先通过 Skill 工具按名调用**；若当前 CLI 没有技能调用工具（或工具被白名单移除），再用 Read 完整读取该技能的入口文件，并遵循其中的规范与验证协议。

- **myrd-platform-skill** — `.myrd-platform/.claude/skills/myrd-platform-skill.md`
- **Verification** — `.myrd-platform/.claude/skills/Verification.md`
- **godot-game-dev** — `.myrd-platform/.claude/skills/godot-game-dev/SKILL.md`
- **verification** — `.myrd-platform/.claude/skills/verification/SKILL.md`
- **webgame-prototype** — `.myrd-platform/.claude/skills/webgame-prototype/SKILL.md`
