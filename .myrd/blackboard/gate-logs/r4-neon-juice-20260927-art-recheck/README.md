# r4 美术线复检轮证据（T3 美术 · 2026-09-27）

> 范围：N2/N3 交付「只检不新做」独立复检 + 缺陷 F1 修复取证。检对象 = 本轮工作树（`games/stack-tower/assets/` + `tools/gen-neon-*` + `docs/style-card-neon-night-v1.md`）。

## 1. 开工首笔环境复核（证据条款：时间 + 通道 + 原文）
- 2026-09-27（本轮开工）：open-design MCP `get_active_context` → 报错原文 `cannot reach the Open Design daemon at http://127.0.0.1:7456. Is it running? Start it with 'pnpm tools-dev'.` —— **OD 守护进程仍不可达，跨轮累计第 3 次独立复现，维持升级主人待修**；本轮产物以 repo 文件 + hash 为准。
- cwd 非 repo root：未复现（本轮 shell 初始 `pwd` = `git rev-parse --show-toplevel` = run 工作区根）。

## 2. N3 查表复跑（命令 + 输出摘要）
- 命令：`node games/stack-tower/tests/assets-neon-check.mjs`
- 输出摘要：逐件 PASS a08..a20 → `RESULT: PASS (13/13) — P0 资产逐件查表`
- 另证：`assets/neon/manifest.json` 13 件 sha256 与磁盘逐件比对全等（python3 hashlib 抽全量，bad=[]）。

## 3. N2 基准四联图复检 + F1 修复（命令 + hash 链）
- 确定性复现：`node tools/gen-neon-assets.mjs && node tools/gen-neon-reference.mjs` → 修复前重生成 `git status/diff` 全空（**零漂移证明**，与已提交基线逐字节一致）。
- **F1（物证缺陷）**：四联图塔吊剪影 2 道 ≠ 风格卡 §3「3 道」≠ runtime `src/render/backdrop.ts` ×3（0.18/0.52/0.84）。
- 修复：`tools/gen-neon-reference.mjs` 剪影坐标 `[[0.2,90,40],[0.78,110,55]]` → `[[0.18,90,32],[0.52,108,43],[0.84,76,25]]`（对齐 backdrop 三道分布）。
- 重生成：`node games/stack-tower/tools/gen-neon-reference.mjs` → `484x724 sha256=098e28b7f1a29479…`；manifest 随生成同步。
- 像素级抽验（自写解码器，filter0 逐行还原）：四面板剪影立柱列簇 x=43/125/202（P2/P4 镜像 +244）全命中，相对位 0.18/0.52/0.84；天空渐变抽样 (12,31,45,255) 与 NEON 表插值吻合。
- hash 变更：`01ea413e15e4c6ed…`（作废）→ **`098e28b7f1a29479a2a8e22377339b52e921d0d3b5b631045d4a819a47fa6c72`**（现行）。风格卡条款零变更、版本维持 v1.0，勘误留痕 = 卡 §5。

## 4. 机器门禁复跑（命令 + 输出摘要）
- 首跑：`node scripts/contract-check.mjs` → B 段 `acc-d2 实跑失败（exit=1）`，RESULT: FAIL (1 项)。**定性 = 浏览器并发负载抖动**（acc-d2 单独复跑 `node tests/contract/m21-acc-d2-offline-smoke.spec.mjs` → PASS 2/2；与 E0b 记录的 acc-j1 同源现象），判据零放松、无重试豁免。
- 独立复跑：`node scripts/contract-check.mjs` → **RESULT: PASS（spec ↔ 工程一致）**；A 段 platformSpecId=`cmuj5f6ik00hkm9l64r5uickm` v4 approved，assets=20；B 段 31/32（acc-a7 not-runnable 具 spec 挂账背书）；C 段 8↔9 元素 + 23↔31 契约；D 段 entities 20/20；E 段 assets 20/20 全 generated。
- 复跑后终证：查表 13/13 PASS + contract-check PASS 同轮取证（F1 修复后）。

## 5. 结论
- N2 = PASS（含 F1 已修复，物证现符卡）；N3 = PASS（13/13）；机器门禁全绿。
- N6 首图定稿对象 = `assets/reference/neon-night-quad-v1.png` @ `098e28b7…`，定稿权在主人（机器不替人判断）。
