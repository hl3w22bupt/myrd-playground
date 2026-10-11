# 资产清单黑板 — wheat-squad（二线孵化骨架）

> 更新时间：2026-10-11 · 负责人：游戏美术
> 下一步：占位资产零状态维持（零贴图纪律）；icon/分享卡等下批资产从参考卡色值派生 + spec revision 登记

| 资产 | 状态 | 说明 |
|---|---|---|
| style-card-v0（参考卡三件套） | ✅ N4 入黑板 | `.myrd/blackboard/wheat-squad/style-card-v0.md`（palette 8 色带色值 + 角色几何 + 氛围；对标《向僵尸开炮》/《超能下蛋鸭》色板取样反向差异化）= spec assets[0] 落点 |
| 渲染 token（theme.ts） | ✅ 与卡逐值一致 | `src/render/theme.ts` 8 色 = spec numeric.palette（零贴图，几何派生） |
| 位图资产 | 🚫 纪律性为零 | tex-1 契约机判零位图文件 + 零贴图构造（ac-07 PASS） |
