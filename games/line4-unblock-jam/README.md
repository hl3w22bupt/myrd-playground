# line4-unblock-jam — 《挪出一条路（工作名待主人定）》可玩基线（2026-10-26）

> **当前态**：spec = 链 v2 `cmvlrc0ma001tm94ialxeykjn` **approved**（唯一现行；版本链见 `.myrd/spec/line4-unblock-jam/REVISIONS.md`）。
> 玩法已落地：内核/实体/导演 + web 可玩面（`src/main.ts` + `src/web/`）+ 资产六件量产 + `export/web/` 部署面。
> 契约件：`.myrd/spec/line4-unblock-jam/design-spec.json` · 人读版：`docs/design-spec-v0.md`
> 核签链：`docs/spec/n1-skeleton-desk-check-20261026.md`（N1）· `docs/spec/f3-interpretation-20261026.md`（F3 判读细则）· `docs/qa/n2-precheck-20261026.md`（N2）· `docs/qa/n5-crosscheck-20261026.md`（N5 过审裁决）

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
bash games/line4-unblock-jam/verify.sh                          # 一键全门禁（17 步 · GATE_LOG_DIR= 落证据）
node games/line4-unblock-jam/tools/smoke-playable.mjs           # 可玩面 bot 冒烟 20 局（F3 判读载体）
node games/line4-unblock-jam/tools/check-assets.mjs             # 资产门禁（存在性/hash/确定性/白名单 31 断言）
node games/line4-unblock-jam/tools/build.mjs                    # 确定性构建 → export/web/（部署面）
node games/line4-unblock-jam/ci/guard-landing-shell.mjs         # 部署壳契约门禁（landing.html 三条）
node games/line4-unblock-jam/tools/gen-assets.mjs               # 资产重生成（重跑 hash 不变=确定性）
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
