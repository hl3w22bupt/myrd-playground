# N5 互查四清单 — 过审裁决（line4-unblock-jam · 2026-10-26 · QA）

> 开审前置三份输入：① **锁定 spec** = 链 v2 `cmvlrc0ma001tm94ialxeykjn` approved（平台 GET 200 实测 · 本地导出件 7/7 段零漂移）
> ② **自主基线工程实现** = `games/line4-unblock-jam/`（@ `bc3cd56` 工作树 + 本轮可玩面轮增量，全量入库）
> ③ **机器证据落黑板** = `.myrd/blackboard/gate-logs/line4-n4-verify-20261026/`（01..09 · manifest 命令原文+时刻+exit）
> 三份齐 → 开审。**结论：四清单全过，过审 = 可玩基线成立 → 交接工作流 deploy 节点。**

## 四清单（逐条给可核对路径）

### ① 一致性（工程 ↔ 锁定 spec）

| # | 项 | 可核对路径 | 结果 |
|---|---|---|---|
| 1 | entities 8 落点文件逐字对应 | `docs/spec/n1-skeleton-desk-check-20261026.md` §① + 契约门禁数值 10 键扫描（`gate-logs/…/01`） | ✅ |
| 2 | levels 3 / elements 8 编号唯一且 `<level.id>/<element.id>` 逐字 | 同上 §② + 门禁行「关卡元素编号唯一性核对完成（8 个）」 | ✅ |
| 3 | 数值链 spec ↔ 工程零手抄 | `src/generated/spec-data.mjs`（生成件）+ acc-04/06/07 数值锚断言 | ✅ |
| 4 | 视觉 token 单源（palette 8 色 ≡ 风格卡 ≡ spec） | `src/platform/theme.ts` + acc-05 白名单断言 + `assets/manifest.json` palette 字段 | ✅ |
| 5 | 本地导出件 ↔ 链上零漂移 | `gate-logs/line4-n0-gate-20261026/03-drift-check.log`（7/7 MATCH 机判） | ✅ |

### ② 完整性（交付面无缺件）

| # | 项 | 可核对路径 | 结果 |
|---|---|---|---|
| 1 | acceptance 8 auto 全部转真实跑 | `gate-logs/line4-n4-verify-20261026/02-check-*.log`（逐件 PASS · exit=0） | ✅ |
| 2 | assets 6 件量产在盘 + 门禁 | `assets/` + `gate-logs/…/06-assets-gate.log`（31 断言） | ✅ |
| 3 | 可玩面（web）构建产物在产 | `export/web/`（21 文件）+ `07-build.log` + `08-guard-landing-shell.log` | ✅ |
| 4 | 部署契约件（apphost manifestPath） | `games/line4-unblock-jam/apphost.toml`（assets_dir=export/web 定死） | ✅ |
| 5 | 一键复跑口 | `games/line4-unblock-jam/verify.sh`（17 步 · `gate-logs/…/manifest.txt`） | ✅ |

### ③ 可玩性证据（能玩、好玩证据面分开）

| # | 项 | 可核对路径 | 结果 |
|---|---|---|---|
| 1 | 20 局 bot 全通关（seeds 42..61 逐局） | `gate-logs/…/09-playable-smoke.log`（`42:WIN(1步) … 61:WIN(1步)`） | ✅ |
| 2 | F3 六键判读达标（≥0.90 / ≤100ms / =0 / ≤16 / ≥55 / ≥0.85） | 同上 + `docs/spec/f3-interpretation-20261026.md` §一.3 | ✅ |
| 3 | 红轮三边界接线（进入/预算内 clear/超预算 fail） | acc-04（11 断言）+ smoke-playable ④（resolveRedRound 接线 2 断言） | ✅ |
| 4 | **好玩终裁**（a3 真人 5 名重开意愿） | **待采（0/5）单列**——机器全绿不代采，deploy 后开采集窗 | ⏳ 主人侧 |

### ④ 新手引导（g-01 判据面）

| # | 项 | 可核对路径 | 结果 |
|---|---|---|---|
| 1 | 首 60s 三步（拖动→驶出→通关）判据机判 | g-01 check（20 局达成率 1.00 ≥0.90） | ✅ |
| 2 | 引导视觉挂件（a04-guide-hand 语义） | `assets/a04-guide-hand.png` + `src/web/render.ts` drawGuide（level-1 未拖动时显示） | ✅ |
| 3 | HUD 判读面在产（F1 三步 + 60s 余量读数） | `src/dev/hud.ts` + `src/main.ts` HUD 装配 | ✅ |
| 4 | 教学关难度（warmup 帖 1–3 步可解） | `director.ts` LAYOUTS + acc-01 全谱系可解断言 | ✅ |

## 裁决

- **过审**：四清单机判项全过、零打回项；a3 真人面按口径单列待采（不阻塞部署，阻塞「好玩」结论）。
- **过审含义** = 可玩基线成立；下一步 = 工作流 deploy 节点以 `games/line4-unblock-jam/apphost.toml` 上线 → 主人试玩 + a3 采集窗开。
- reject 通道（本轮未触发）：reject 必指文件与 spec 条目（判例口径保留）。

—— 游戏 QA（N5 互查 · 限制性核签：不判好玩，好玩终裁归主人）· 2026-10-26

> **〔驳回修复回执 2026-10-26 · 游戏程序署名 · 上文 QA 判定正文不动〕**续接核实轮被驳回两缺陷（均部署对账证据面）已修复并复证：缺陷1 部署 manifest 第 7 步虚记（4f8ad15）已按实物勘误为 bc3cd56（三值对账表 `../../../../.myrd/blackboard/gate-logs/line4-deploy-20261026/00-manifest.md` §三锚表；线上锚归档挂账具备 tailscale 通道方，一键命令在案）；缺陷2 共板巡检台账 PL4 行已补 `4f8ad155..0d40be6` 触达面机判（零触达 EXIT 0）。修复回执 `.myrd/blackboard/gate-logs/line4-rejection-fix-20261026/00-manifest.md`；修复后契约复跑 29/0 EXIT=0（`02-contract-postfix.log`）。QA 反馈「缺陷1/2 修复并复证后本轮 N5 结论可翻为 pass」——翻绿核签待 QA 按回执复核，程序不代行。
