# 《光路谜阵》零缺陷核销 · R2 复认轮（game-4 · iterate 节点）

- 复认时间：2026-10-02
- 性质：R1（`ZERO_DEFECT_CLOSURE.md`，commit `654f5d4`）之后的本节点复跑复认轮 —— exp-verify 修复清单仍为零确认缺陷，按降级路径**只复跑门禁 + 复验线上，零代码改动**
- 输入：`qa/ADVERSARIAL_FINDINGS.md` §五修复清单原文口径「零确认缺陷 → 无需修复项，无代码变更」（0 缺陷 / 0 误报 / 1 项 T5 双指 WebKit 驱动受限待真机，外部依赖不变）
- 分支：`myrd/game-4-goal-cmuieqj7o0031m9gyf4pbwptg`（实现基线）；线上 v19 构建基线 `aa2ec1e`（deploymentId `cmuixl00c00fsm9l6ac95ss6f`）
- 线上入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>

## 一、四门禁复跑（同源判定脚本，仓库内 `std-skills/godot-game-dev/scripts/`，零改动只读调用）

| 门禁 | 结果（本轮实测） | 退出码 | 日志 |
|---|---|---|---|
| preflight | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（132 个工程文件，不含 .godot/ 导入缓存）` | 0 | `gate-r2-preflight.log` |
| smoke（240 帧） | `godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）` | 0 | `gate-r2-smoke.log` |
| input-fuzz | `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` | 0 | `gate-r2-fuzz.log` |
| playtest | `GODOT_PLAYTEST: PASS 3 局全部通过`；METRICS：3 局 score=6/6/6，feedback_events=156/147/173，最大反馈间隔 0.95s（阈值 10s），seed 成绩 distinct 达标 | 0 | `gate-r2-playtest.log` |

环境：Godot 4.3.stable.official.77dcf97d8（`resolve-godot.sh` 实测解析）。

## 二、线上 v19 复验（全绿，产物零漂移）

| 核验 | 结果 |
|---|---|
| `GET /apps/game-4/gw/health` | 200 `{"ok":true,"app":"light-path-labyrinth","env":"development","assets":"lazy/object-storage"}` |
| 线上落地页 | 308 → 200 `text/html`（跟随跳转实测） |
| 线上 `index.js`（raw 文本资产） | 331,495B，sha256 `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075` = 仓内 `export/web/index.js` **逐字节一致** |
| 线上 `index.pck`（gzip+b64 文本通道） | 原始响应 3,454,988B（`H4sIAA…` 即 gzip 魔数 base64）；base64 解码 + gunzip 后 2,609,840B、魔数 `GDPC`、sha256 `2cb785e5576e975b9ffaa5739fe225d7f9f096d69570bda2baf7fd78720c670e` = 仓内 pck **逐字节一致** |
| 线上 `index.wasm`（gzip+b64 文本通道） | 响应头 `Content-Type: application/wasm`（部署硬约束达标）；b64 通道响应体 10,696,408B；解码 + gunzip 后 35,376,909B、sha256 `fe5cebc590758c10bc4469be5a591e28edbde5ec8f458f21baeb83db50d028b9` = 仓内 wasm **逐字节一致** |
| HEAD 相对 v19 基线 `aa2ec1e` 改动范围 | `git diff --name-only aa2ec1e..HEAD -- ':!games/game-4/qa'` 为空 —— 全部改动均落在 `qa/` 取证文档，gameplay 资产/场景/导出产物零改动 |

> 通道口径备注：pck/wasm 走「资产出 bundle」的 gzip+base64 文本通道（`server/src/index.ts` 资产路由注释），HTTP 响应体是 b64 文本而非原始二进制 —— **先解码再比对**才等于真实指纹；直接对响应体求 sha256 与仓内二进制不一致属通道形态差异，不是版本漂移。index.js 为 raw 文本资产，可直比。

## 三、本轮收口结论

1. **修复清单核销维持**：exp-verify 零确认缺陷结论在 R2 复认轮不反转，无修复项可执行，无代码变更。
2. **四门禁复跑全绿**（§一）：preflight / smoke(240) / input-fuzz / playtest 均 exit 0 且 PASS 标记齐全。
3. **线上 v19 仍全绿且零漂移**（§二）：health 200 + wasm Content-Type 达标 + js/pck/wasm 三产物 sha256 与仓内逐字节一致。
4. **不重导出、不重部署**：产物零漂移 + 无代码变更，重导出重部署属无意义改动，按任务降级路径跳过。
5. **遗留待办（外部依赖，不阻塞）**：T5 双指真机复测（步骤归档于 `ADVERSARIAL_FINDINGS.md` §五）；iPhone 实测卡已发用户频道（`qa/IPHONE_QA_CARD.md`），真机回填后按 `ios-safari-realdevice-qa.md` §四登记。
