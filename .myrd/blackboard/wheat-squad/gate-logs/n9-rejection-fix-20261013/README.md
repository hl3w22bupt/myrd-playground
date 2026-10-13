# N9 驳回修复轮（2026-10-13 · 游戏程序 · QA 五条驳回处置）

> 驳回五条逐条核实全部属实；①②④⑤ 直修（先红后绿/显式取码），③ 属 spec 语义裁决升级主策划（不擅改）。
> 修复提交 `a0929c2`；本目录证据绑该 HEAD（02 号四件同包实跑于提交后新 HEAD）。

## 证据索引

| 文件 | 内容 |
|---|---|
| `01-rejection-fix-red-green.log` | 驳回①②先红后绿取证：R1 缺陷注入×旧面绿（机判缺失实证 MUTATED_EXIT=0）→ R2 同缺陷×新三方同名断言红（GUIDANCE_TEXT ≢ spec.copy）→ R3 延迟拖动 6s×新 statement 谓词红（6048ms > 5000ms 判定窗）→ R4 还原绿 + src 零变更佐证 |
| `02-verify-sh-four-pack.log` | 四件同包（HEAD `a0929c2`）：件1 spec 零变更（SPEC_DIFF_FILES=0，链 v4 未动）+ 件2 实现面清单 + 件3 统一契约 56/0 · 自有 16/0/1PEND + 件4 WS-SMOKE PASS——VERIFY_EXIT=0 |
| `03-live-smoke-exit1.log` | 驳回④修正版：显式取码（重定向非管道、紧邻命令）复跑线上冒烟，DIE READY（W-3 串线）→ **LIVE_SMOKE_EXIT=1**（fail-closed 红正确）；原件 `n0-rebaseline-20261013/11` 已加失实注记保留历史 |

## 处置对账

| # | 驳回 | 处置 | 状态 |
|---|---|---|---|
| ① | ac-a5 断言↔验收错位（first_tap 代 core_action + 窗值无 spec 锚 + 注释失实） | ac-16 补 ④′ statement 谓词逐字断言；窗值=approved statement 机器解析（fail-closed 零兜底）；注释改实引 numeric.guidance.note 口径 | ✅ 已修（R3 变异验证） |
| ② | 机判面虚报（回执称已机判、实为目核） | 三方 copy 逐字机判断言入 ac-16 ①′（R2 变异验证）；两回执三处失实归因就地更正并注明更正轮 | ✅ 已修 |
| ③ | ac-art-2 机判窄于 statement（manifest 四件 id 两处登记集皆无） | **升级主策划裁决**：A=revision 改 statement（entities∪assets）/ B=spec.assets 补登四件；ac-11 知情窄面披露，判据不扩不缩 | ⏳ 升级中（blockers.md 本轮区段） |
| ④ | 证据 exit 失实（DIE 红 × LIVE_SMOKE_EXIT=0） | wrapper 根因=取码隔管道；口径落死「取码紧邻被测命令、禁隔管道」；原件注记 + exit=1 重归档 | ✅ 已修 |
| ⑤ | README 悬空表格行（过时 20261012 引用） | 删除（信息由待裁决清单 #4→20261013 件覆盖） | ✅ 已修 |

## 冻结面声明

theme.ts / 色板 / spec 链 / 数值面零接触（SPEC_DIFF_FILES=0；src/ 仅 R1-R3 变异重演且已还原，SRC_DIFF_FILES=0）；本轮唯一代码面变更 = 契约断言面（ac-16 扩断言、ac-11 披露注释）。结论仅对 `a0929c2` 有效。
