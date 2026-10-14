# game-8 · v5 试玩验收节点 blocked 落账（run `cmv7snbpq000nm9tiuyizp98o`，2026-10-14）

> **一句话**：v5 修复本身本地全绿，但**线上仍是 v4 不可玩包**——部署身份错位在本轮（新 run）第三次独立复现，goal 产物回写通道同样 403；本节点如实 blocked，不替门禁背书、不发起无效试玩。
> 本文是试玩验收节点（playtest）的一手核查记录；修复技术细节见 `docs/v5-release-handoff.md` §一，试玩验收包本体见 `docs/playtest-kit.md`（v5 版）。

## 一、节点执行前提核查

| 项 | 结果 |
|---|---|
| 门禁判定脚本（7 件） | 仓库 `std-skills/godot-game-dev/scripts/` 全部在位（preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs + 自测件）→ **不触发「模板未预置」型 blocked** |
| `.myrd/routines.yaml` | 在位，含 `godot-smoke`（5 步含 playtest@3600 帧）与 `mobile-web-smoke` |
| references 两份模板 | `godot-smoke-routine.md` / `mobile-smoke-routine.md` 在位 |
| preHook 证据 | `games/game-8/qa/mobile/report.json` verdict=PASS @ 2026-10-14T09:43:07Z（本轮 preHook 实跑产出，工作区 3 文件变更）——证据存在、与 preHook 结论一致 |

## 二、关键实锤：preHook PASS ≠ 线上可玩（适用边界实证）

本轮 preHook 的 mobile-web-smoke 对**线上 v4 不可玩包**同样跑出 verdict=PASS。原因：其断言集（网络/console/canvas/渲染/动画/触摸管线/触摸响应/音频解锁/视口/FPS）不覆盖 v4 缺陷 A（零刷出）/B（移动失效）/C（结算重叠）/D（触屏 UI 泄漏）中任何一项。

**结论**：mobile-web-smoke 只机判「移动端壳层能不能加载、触摸管线通不通」，单独不能自证「线上可玩」；上线判定必须联用工程探针 `games/game-8/tools/playability-probe.mjs`（P1/P2/P3，CDP 真实事件驱动）。这是 v5 需求「禁止只以引擎级注入的门禁结果自证线上可玩」的又一实证——**该探针本轮尚未对线上跑过**（`qa/mobile/playability.json` 不存在），因为部署未完成、线上没有 v5 可验。

另如实注记：本轮 preHook 未带 `--project`，joystick-target 校准断言为 legacy 取证模式（status=warn，`joyAreaDiff=0` 无断言意义）；线上门禁应按 mobile-smoke-routine.md 模板带 `--project games/game-8`。

## 三、线上实况（一手实测）

- 线上 `index.pck`（经 `api/public/assets/index.pck.gz.b64` 下载，base64 → gunzip）：**3,210,752 B，sha256 `7738850ae98ff92f1893024e337f38c8dd43bcc2ec4443a62a4985fecc5d8502`** —— 与 v4 部署锚点（deployment `cmv7oa022000im9700bqwktfj` @ `9bda2c1`）记录**逐字节一致**；不是 v5 预期值（≈2,613,856 B / `3ca34b43…`）。
- 即：v5 部署在上一 run blocked 之后**仍未发生**，liveUrl 现服务的仍是 v4 不可玩包。

## 四、阻塞本体：平台授权身份错位（第三次复现）

| # | 轮次 | 证据 | 结果 |
|---|---|---|---|
| 1 | v5 开发轮第二轮 | req_1791968912360 | 部署 POST 403 |
| 2 | v5 开发轮第三轮 | req_1791969367365 | 干跑再证 403 同型 + 读平台源码/查库三方互证（详见 handoff §五） |
| 3 | **本轮（试玩验收节点）** | **req_1791971169333**（部署干跑）/ **req_1791971123121**（goal GET） | 部署 403「仅应用所有者或系统管理员可操作」；goal GET/PATCH 403，列表接口对该 goal 不可见 |

- 错位机制（沿用 handoff §五）：部署授权（`assertAppAccess`）要求有效身份 == app owner（`cmuimu6w…`）或系统管理员；本项目级 run 的节点 token 有意不带 actFor（2026-09-22 安全收窄），有效身份=目标大师 ≠ owner，fail-closed。
- **影响面**：① v5 无法部署（线上维持不可玩）；② 本节点 `op=playtest_kit` 产物无法经 HTTP 回写 goal artifacts。**已备好回写脚本** `.myrd/patch_playtest_kit.py`（v5 版，GET→追加→整组 PATCH 合并语义，含重复执行幂等保护），待 owner/admin 或 goal 委派轮一键执行；部署路由带 goalId 时平台自动 upsert 合并（R6/D5 语义，优先走它）。
- 未绕过、未自造判定、未直改平台库。

## 五、本节点处置（对齐「blocked 比空烧有用」）

1. **不发起试玩**：线上是已知零刷出、移动失效的 v4 包，把用户引去试玩无意义且浪费用户轮次；试玩验收包（playtest-kit.md v5 版）已备好，部署解阻即生效。
2. **不伪造结论**：量表四问全部标「待回填」；detail 无任何「试玩通过/好玩」表述。
3. **不空转等人**：按节点纪律直接收尾，等人是节点外的人机回环；解阻后由下一轮（goal 委派发起）复验 A/B/C/D 四项 + 跑 mobile-web-smoke（带 --project）+ playability-probe 双验，再交付试玩。
4. 本轮全部产出已落盘并随本 commit 推送：playtest-kit.md v5 版、本报告、`.myrd/patch_playtest_kit.py` v5 版、preHook 复跑证据（qa/mobile/ 3 文件）。

## 六、解阻清单（给有权限的人）

```bash
# 以 app owner（cmuimu6w…）或 admin 身份执行（goal 委派发起的 run 亦可）：
# ① 部署 v5（gitRef 红线：功能分支，绝不落 main；带 goalId 自动回写产物）
curl -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  "http://localhost:3111/api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments" \
  -d '{"mode":"bundle","deployedBy":"agent","gitRef":"myrd/game-8-goal-cmujpml1e006rm99i9hc33huu","sourceId":"cmujpml1e006rm99i9hc33huu","goalId":"cmujpml1e006rm99i9hc33huu"}'
# ② 双验（部署受理后）：
node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url "https://leomac-studio.tail49399e.ts.net/apps/game-8/" --project games/game-8 --out games/game-8/qa/mobile
node games/game-8/tools/playability-probe.mjs --url "https://leomac-studio.tail49399e.ts.net/apps/game-8/" --out games/game-8/qa/mobile
# ③ 回写试玩验收包产物（若部署未带 goalId）：
python3 .myrd/patch_playtest_kit.py
# ④ 通过后发起试玩：按 games/game-8/docs/playtest-kit.md §一/§二 收集用户量表与调参 URL
```
