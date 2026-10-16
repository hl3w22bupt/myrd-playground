# B0 收口态 AppHost 部署证据（2026-09-28 · 程序/deploy）

## 对象
- 坑：`cmugttipt000km9299oej5z9b`（platformSlug `stack-tower-3`，sourceId `stack-tower`，黑板 §B7/§E0 登记，沿用不新建）
- manifestPath：`games/stack-tower/apphost.toml` · mode=bundle · sourceId=`stack-tower`
- gitRef：`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `3ff05c3`（push 后远端=本地，ls-remote 实证）

## 部署前门禁基线（本轮实测，全部绿）
| 门禁 | 结果 |
|---|---|
| `node scripts/contract-check.mjs` | PASS（v1.3 approved · acceptance 31/32 实跑 + acc-a7 not-runnable 单列，口径不变） |
| `scripts/check-numeric-freeze.mjs` | PASS（现行 ≡ v1.2 载荷 ≡ 存档 `c3af773b…74957d`，三向对账） |
| `scripts/check-wx-bundle-size.mjs` | PASS（主包 317.8KB≤4MB / 开放数据域 5.7KB≤1MB 分列；manifest 62 件漂移 0） |
| `npm run smoke` | PASS (browser)（核心循环 seed 落块 + HUD + 重开 + 零页面错误） |

## 导出（产物 ≡ 代码）
- B0 落码后 `npm run build` 产物多出 4 个 wx 适配模块（`app/boot-wx` / `audio/bgm` / `platform/share` / `platform/wx`），在库 `export/web/build` 未同步 → 本轮补齐，恢复发布配方口径 **`build/ ≡ export/web/build/` 34 文件逐字节全等**（diff -rq 为空）。
- web 入口对这 4 个模块**零静态引用**（grep 实证：无 import 方；wx 侧由 `tools/build-wx.mjs` 组包取用）→ 行为零变化，web 回归结论不受影响。
- commit：`3ff05c3`（chore(stack-tower): web 导出对齐 B0 适配层）。

## 部署过程（如实留痕）
- 第 1 次 POST deployments：响应空 → 重试带 `-w` 得 **HTTP 504**（本地代理 30s 网关超时），但服务端**实际受理**（部署单 `cmul7blzr000mm9lfcqhz6gd3` 12:06:08 已建）。
- 第 2 次 POST：受理为 `cmul7cf4r000om9lftgu63lmw`（12:06:46），第 1 单被 superseded（载荷完全相同，无副作用）。
- 终态：`cmul7cf4r000om9lftgu63lmw` status=**running**（本平台在服形态，startedAt→finishedAt 0.8s，errorMessage=null；与 v16 成功单同形态，v16 现为 superseded）。app.status=ready。
- 教训（供平台侧参考）：deployments POST 异步受理但代理 30s 截断返回 504，**504 ≠ 失败**，必须以 GET 复查为准，不得盲目重试（本次重试产生了第二张同载荷单）。

## 线上自测
- `/health` → **200** `{"ok":true,"app":"stack-tower",…}`；`/` → **308**（尾斜杠规范化）→ 跟随 **200** 出壳（共享壳 + boot 自愈，assets=lazy/object-storage）。
- 对象存储侧新产物 4/4 指纹全等（线上 sha256-16 ≡ 本地 `3ff05c3` 产物）：`build/main.js` / `build/platform/wx.js` / `build/app/boot-wx.js` / `build/audio/bgm.js` → **部署物即本轮代码**。
- `tests/live-smoke.mjs <gw>`：**核心循环 PASS**——画布 480×720 / HUD「分数 0」→3 次点击→「分数 45」→ R 重开「分数 0」；PNG 字节通道 ✓（1011B 魔数正确）/ M4A ✓（4711B）/ 音效可解码 ✓（48000Hz/1ch）。
- **FAIL 三项 = 既有立案 U6/R2（非本轮回归）**：SW 未控制页面 + 断网 reload 异常 + SW scope console.error（scope `/apps/stack-tower-3/` 不在 max scope `/apps/stack-tower-3/api/public/assets/` 之下）。成因在共享壳 `server/`（boot-script / sw 托管形态），2026-09-26 r1 已立案升级，待主人三选一裁决（代理放行头 / 放宽路由护栏 / 指认非代理托管形态）；v16 线上同形态。**不属游戏产物缺陷，不在本轮擅自改壳。**

## 登记回写
- 团队产物区：POST artifacts 201（artifact `cmugut4ck000vm929ufwgefhl`，hostedAppSlug `stack-tower-3`，幂等入口）。
- 黑板 blockers.md：§「B0 收口态 deploy（第 7 次）」条目已增记。
