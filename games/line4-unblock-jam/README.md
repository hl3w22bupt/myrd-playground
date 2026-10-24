# line4-unblock-jam — 《挪出一条路（工作名待主人定）》中性脚手架（五件工程准备 · 2026-10-24）

> **边界声明（红线）**：spec v0 = 链 v1 `cmvlpx0uf0019m94iyuroz578` **draft**（QA 七条缺陷 7/7 核销，待主人正式审查）。
> **审查通过前：零玩法逻辑、零 contract-check 断言**——本目录只含中性脚手架五件，空壳冒烟可跑，无任何挪车玩法。
> 契约件：`.myrd/spec/line4-unblock-jam/design-spec.json` · 版本链：同目录 `REVISIONS.md` · 人读版：`docs/design-spec-v0.md`

## 五件工程准备（本轮交付）

| # | 件 | 落点 | 验证 |
|---|---|---|---|
| 1 | 中性脚手架切单局制模板 | `src/kernel/loop.ts`（单局 ready→running→ended）· `src/kernel/session.ts`（**计数控名人**：moveCount/comboCount 唯一所有权）· `src/kernel/combo.ts`（pending 不计连击审计面）· `src/platform/`（门面+theme token 单源）· `tests/contract/ac-template.spec.mjs` | 冒烟 ①② 面 |
| 2 | telemetry 单一判读出口 | `src/telemetry/telemetry.ts`（键集合 ≡ spec numeric.telemetry 三列，fail-closed 拒旁路键）· 键来自生成件 `src/generated/spec-data.mjs`（零手抄） | 冒烟 ③ 面 + `port-gate P-05` |
| 3 | dev 性能 HUD（F1~F4 实时读数） | `src/dev/hud.ts`：F1 事件/引导（g-01 三步+60s 余量）· F2 局态/红轮预算 · F3 判读证据（局号/seed/采样帧）· F4 测量口径（时钟源/档位/p95/fps_min） | 模型面（渲染文本直读） |
| 4 | 构建 sha 指纹首笔注入 | `tools/gen-build-info.mjs` → `src/generated/build-info.mjs`（首笔 `8d345e6` @ 2026-10-24） | 冒烟 ④ 面 |
| 5 | 移植门禁 checklist 脚本化 | `tools/port-gate-checklist.mjs`（P-01..P-06：契约件/approved 资质/内核纯度/零贴图/键集合全等/宿主面） | exit=0（P-02 draft=GATE-NOTE） |

## 运行（零 npm 依赖 · node ≥22）

```bash
node games/line4-unblock-jam/tools/smoke.mjs                    # SCAFFOLD-SMOKE: PASS（4/4）
node games/line4-unblock-jam/tools/port-gate-checklist.mjs      # PORT-GATE: PASS（web 预检）
node games/line4-unblock-jam/tests/contract/ac-template.spec.mjs # 中性契约模板
node games/line4-unblock-jam/tools/gen-spec-data.mjs            # spec 改版后重生成（单源纪律）
node games/line4-unblock-jam/tools/gen-build-info.mjs           # 构建 sha 重注入
```

## spec 单源纪律

- 数值/telemetry 键一律由 `tools/gen-spec-data.mjs` 从契约件生成（`src/generated/spec-data.mjs`），**零手抄第二份**；spec revision 后重生成。
- 调色板 8 色冻结于 `src/platform/theme.ts` ≡ 风格卡 v1 ≡ spec `numeric.palette` 三面同值；色值改动必须走 spec revision。

## 审查通过后的转真顺序（下一轮备忘）

1. spec approved → `port-gate P-02` 转 ✓（契约面生效）。
2. 玩法落地：`src/entities/{car,lot,exit}.ts` + `src/levels/director.ts`（entities 落点见 spec，路径已写死）。
3. acceptance 8 条 auto check 薄壳转真（`tests/contract/checks/`，路径已写死），接 `scripts/contract-check.mjs --spec ... --project ...` 门禁。
4. 冒烟自测 N=20 局（seeds 42..61）+ dev HUD 读数对 numeric.telemetry 六键判读。
