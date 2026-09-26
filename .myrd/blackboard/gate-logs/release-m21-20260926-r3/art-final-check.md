# 发布素材终检记录 — stack-tower M2.1 正式发布轮（第三轮 · r3）

> 终检人：T3 游戏美术 · 日期 2026-09-26 · 性质：**发布素材终检，只检不新做**（本轮零新资产、零工具链改动）
> 检对象：当前分支 HEAD `436be68b8be67fc146257ed8cd7255536594e4bd`（r2 收口后树）的 `games/stack-tower/` 发布面 `export/web/`；发布 tag 由程序侧门禁全绿后打，tag 树与本检对象树的一致性由程序侧「门禁树→tag 树 delta=0 字节」惯例兜底
> 结论：**四项全 PASS + sfx 注册表美术侧复签通过**；资产面相对 r1/r2 两轮已验证状态**逐字节零漂移**（见 ⓪），结论与 r1 终证同源不冲突
> 前轮关系：r1 终证 `gate-logs/release-m21-20260926/art-final-check.md`（tag `stack-tower-m2.1-release` @ `5a3284f`）；r2 沿用记录在 `assets.md` §r2 增记。本轮为发布对象变更（→ HEAD）后的独立复检，不覆盖前轮记录。

## ⓪ 零漂移证明（本轮检对象合法性前提）

命令与输出摘要（2026-09-26）：

| 命令 | 输出摘要 |
|---|---|
| `git diff --stat 75debf9..HEAD -- games/stack-tower/assets/` | **空**（9/25 已部署版 → HEAD 资产零漂移） |
| `git diff --stat 75debf9..HEAD -- games/stack-tower/src/render/ …/tools/gen-assets.mjs …/tools/gen-audio.mjs` | **空**（渲染面 + 生成器零漂移 ⇒ 画布首屏呈现与已验证轮次逐位一致） |
| `git diff --name-only stack-tower-m2.1-release-r2..HEAD` | 8 个文件，全部为 docs/blackboard 文档面，**无码无机** |
| `diff -rq assets export/web/assets` | 静默 = 源面 ≡ 发布面（25/25 字节全等） |
| `diff -q sw.js export/web/sw.js` · `diff -q manifest.webmanifest export/web/manifest.webmanifest` | 均字节全等 |

## ① maskable 安全区 — PASS (3/3)

- 方法：只读 PNG 解码（zlib + 手工 unfilter，零外部依赖）逐像素核验。安全圆 = 中心、d=80%；圆外像素必须为背景（背景按「逐行左右边缘参照 + 行内线性插值」识别，tol=8，适配渐变底）；圆内必须有内容。apple-touch-icon-180 无 maskable 语义，按全出血底核对。
- 命令：`node .myrd/blackboard/gate-logs/release-m21-20260926-r3/art-check-maskable.mjs`（检查器本轮入库于证据目录，自足可复现；r1 版为 /tmp 临时件未入库，本轮补齐可复现性）
- 输出（`1-maskable-pixel-check.log`）：
  - `icon-192-maskable.png` 192×192 → outsideCircleNonBgPx=0 · rowEdgeMismatch=0 · contentPx=5565 → MASKABLE-SAFE-PASS
  - `icon-512-maskable.png` 512×512 → outsideCircleNonBgPx=0 · rowEdgeMismatch=0 · contentPx=39592 → MASKABLE-SAFE-PASS
  - `apple-touch-icon-180.png` 180×180 → outsideCircleNonBgPx=0 · rowEdgeMismatch=0 · contentPx=4980 → FULLBLEED-PASS
- 交叉印证：contentPx 与 r1 终证（5565 / 39592）**逐位一致**，独立复核零漂移。

## ② 首屏对齐风格卡 — PASS

- 真源链：`src/render/palette.ts`（八色，文件头声明唯一真源 = moodboard §二）→ `tools/gen-assets.mjs` 解析 palette.ts 取值、缺键即 FAIL 拒生成（`gen-assets.mjs:19-24` 实查）→ 私设色值结构性不可能。palette.ts 相对 9/25 基线零漂移（见 ⓪）。
- 图标像素证据（本轮新测，`1-maskable-pixel-check.log`）：
  - 圆内内容色 top = `#9d572e` / `#833a27` / `#a98033`，分别 = 色板基色 `#c96f3b`(陶土橙) / `#a84a32`(砖红) / `#d9a441`(沙黄) × **0.78**（三面明度链正面系数）逐位吻合；
  - 次高色 `#6f3d20` / `#5c291c` = 基色 × **0.55**（= `LAYER_SHADE_MIN` 暗面系数）逐位吻合 → 风格卡「三面明度 100:78:55」在图标介质上完整成立；
  - 背景抽样 bgTop=`#a3b2c6` bgMid=`#96a4b7` bgBottom=`#8a97a8`——底色 = palette `SKY_BOTTOM` 逐位一致；顶/中为同族冷灰蓝小尺寸提亮（图标介质惯例，风格卡约束对象为画布首屏，同 r1 口径）。
- 画布首屏：渲染输入（贴图字节）与渲染代码（src/render）相对已验证轮次均零漂移 ⇒ 首屏呈现 = r1 已终证形态（冷灰蓝黄昏天空 + 暖色三循环塔块 + 白切面高亮）；本轮浏览器级装载新证：`assets:check` 零页面错误（`4-assets-check.log`）。

## ③ 资产零缺失 — PASS

- 源面 = 发布面 = **25/25**（sprites 6 + tileset 1 + ui 2 + icons 3 + sfx 12 + manifest.json），字节全等（⓪）。
- SW precache 覆盖（`2-precache-coverage.log`）：条目总数 55 = 壳 30（html/manifest/build 30 js）+ assets 25，**全量覆盖、零重复**；`CACHE='st-precache-v1'` · `REVISION = 1`（spec `numeric.deploy.PRECACHE_REVISION` 冻结未动）。
- 运行时可达：`npm run assets:check` → **PASS (browser)**：运行时 9 项贴图请求全 200 + 「[assets] 贴图就绪 9/9」+ 零页面错误 + 资产全 404 负面用例核心循环可玩（HUD「分数 45」）（`4-assets-check.log`）。
- sfx 注册表：见下节，6/6。

## ④ 无未压缩大图拖慢冷启动 — PASS

- 发布面最大单文件 = `assets/tileset/blocks-tower.png` **16.7KB**；次大 = `build/render/renderer.js` 7.7KB；sfx 单件最大 7.4KB（ogg）。
- 分组总量：assets 102.1KB · build 67.9KB · **发布面总计 174.6KB** < 风格卡预算 300KB。
- `>50KB` PNG 计数 = **0**；贴图全为程序化生成 PNG，音频全为 44.1kHz 单声道压缩格式（m4a/ogg）。
- 冷启动面：precache 55 项全小文件，install 一次拉满后离线零网络，首屏无网络瀑布。

## sfx-<事件id> 资产注册表 — 美术侧复签通过（双签之美术半签）

- 机器核对（`3-sfx-registry-check.log`）：spec `content.sfxPack.events`（6 事件）≡ `assets/sfx/manifest.json` events 键集；6 事件 × `sfx-<id>.{m4a,ogg}` 双格式在库、命名 kebab-case 合规；`critical` 旗标 = miss / game-over / restart，与 spec `sfxPack.priority` 逐条一致；`restart` 198ms ≤ `RESTART_SFX_MAX_MS=200` 红线；最长事件 level-clear 398ms < 400ms；`sampleRateHz/channels = 44100/1` 与 `numeric.audio.SAMPLE_RATE_HZ` 一致。判定 **ART-SFX-REGISTRY-PASS (6/6)**。
- 美术侧会签意见：六事件音色延续「克制反馈」哲学（perfect 一次性短叮 / critical 三事件短促），与风格卡情绪基调一致；音频内容相对已验证轮次零重生成（`audio:generate` 无内容变化不入库，沿 assets.md 既定纪律）。
- 双签合成：程序侧（`release-healthcheck-m21.md` §5 / r2 沿用）+ 美术侧（本节，2026-09-26）→ **注册表核对双签完成**。
- 口径备注：manifest 字段名 `durationMs` ↔ spec registry 契约文本 `duration_ms`，为生成器既定字段映射，acc-a1 断言点即 manifest 本体，契约门禁 B 段 22/22 PASS（`5-contract-check.log`）背书，非缺陷。

## 机器门禁取证清单（本轮，均入本目录）

| 文件 | 内容 | 结果 |
|---|---|---|
| `art-check-maskable.mjs` | maskable 像素检查器（入库可复现） | — |
| `1-maskable-pixel-check.log` | ① 安全区逐像素 | PASS 3/3 |
| `2-precache-coverage.log` | ③ precache 覆盖/重复/REVISION | PASS（55=30+25，0 缺 0 重） |
| `3-sfx-registry-check.log` | sfx 注册表逐条 | PASS 6/6 |
| `4-assets-check.log` | `npm run assets:check` 三态门禁 | **PASS (browser)** |
| `5-contract-check.log` | `node scripts/contract-check.mjs`（B 段 22 条实跑 + E 段资产登记） | **PASS**（E 段 7/7 全 generated 零外部资源） |

## 已知未收口项（单列，不阻断素材终检）

1. **U7**（线上壳形态）：boot 补丁使 `Image` 贴图经 base64 文本 blob 加载失败 → 线上贴图**呈现为程序化绘制形态**（在线/离线一致）。素材本体在库且字节正确（本轮 ⓪③ 复证），属壳/注册链路缺陷（修复点 `server/src/boot-script.ts`，约 3 行，待主人排期），**素材面无需重做**；因程序化绘制与贴图同出 palette 真源，风格卡符合性结论不受影响，但对外口径中「线上贴图形态」应如实表述。
2. **B6 真机三项**（iOS Safari 首触解锁 / 静音键 / 后台切回）：属 QA/真机面，素材侧无可检项，仍挂主人排期。
3. 本轮零范围外文件、零新做、零工具链改动；`spec` 零改动；v1 冻结数值未触碰（数值面属程序/策划线，本轮仅确认未因资产面引入漂移）。
