# N2 预核回话（游戏 QA · 四看标准 · QA-L3-N2-PRECHECK-20261018-01）

> UTC 2026-10-18T01:22Z · 输入 = N1 pending 样例 `00-pending-sample.log`（绑定采样锚 HEAD `0870263b`）· 输入 spec = 链 v2 `cmvbqgzbl0029m9ax64foxd37` approved（导出件零漂移实查 PASS）
> 结论：**放行 N4**（实现轮转真）· 附 1 口径登记项（非打回）

## 四看逐条

| 看 | 标准 | 结果 | 证据 |
|---|---|---|---|
| ① 显式状态非假绿 | 薄壳未实现必须显式失败，不得静默 0 退出 | **PASS** | run-all exit=1 + `PENDING-IMPLEMENTATION` 文案；单条 a1 薄壳 exit=1 同口径；0 条静默绿 |
| ② pending 与 fail 不混计 | 未实现 ≠ 判据红 | **PASS** | acceptance 15 条分账 auto 14 + manual 1；14 条薄壳状态 = PENDING（非 FAIL）；runner 头部文案显式「不可判绿」 |
| ③ 判据编号与 spec acceptance 一一对应 | 文件名 ≡ auto id 集合 | **PASS（机判全等）** | `sorted(files) == sorted(auto ids)` = True（14/14） |
| ④ 清单可核销 | 每条 auto 带可执行命令且命令文件在盘 | **PASS** | 14/14 命令形如 `node games/line3-tower-defense/tests/contract/checks/<id>.mjs` 且文件在盘；manual a3 命令指向 qa 记录卡（0/5 未判定·待采，正确挂起） |

## 口径登记项（非打回 · 转程序 N4 落实）

- **inventory 路径口径差**：`docs/inventory.md` 登记行用工程相对路径（`src/kernel/loop.ts`），spec.entities[].script 用仓根相对路径（`games/line3-tower-defense/src/kernel/loop.ts`）。inv-1 检查器实现时按「剥 `games/line3-tower-defense/` 前缀归一化映射」口径核对（不回改 spec、不回改 inventory 双向零改动），映射规则须写进检查器注释并在判定输出可见。

## 红线重申

- 本回话只放行「实现轮机判面开工」，不构成 a3 真人面代采（0/5 维持未判定·待采，负责人=主人+QA 采卡）。
- N4 交付若出现「全 pending 报全绿」或「0 红 = 绿」口径，本节点打回不核签。
