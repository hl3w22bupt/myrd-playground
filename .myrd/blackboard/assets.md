# assets.md — 资产清单（共享黑板）

> 更新时间：2026-09-23（美术资产批次 · 游戏美术）
> 负责人：主策划（资产增减须同步 spec.assets 段走版本链，禁止实现侧私加资产源）
> 下一步：QA 互查核对「资产引用与 spec.assets 一致」；主人试玩验收视觉（黑块修复是否可接受）
> 本批说明：**未新增资产源**（spec.assets 四条 id/落点未动，无需走版本链）——本批做的是
> ①风格卡四要素补全并落成代码真源；②资产引用层（`assets/`）+ 降级接线；③呈现层表现补齐。

---

## 风格卡（全团队唯一视觉基准 · 四要素）

| 维度 | 规定 | 依据（复刻样本） |
|---|---|---|
| 视角/画幅 | FPS 第一人称，横屏优先，canvas 全屏 | 运输船 B:L20108（世界 fov 78 / 武器 fov 58 双场景） |
| ① 调色板 | 冷灰金属舰体（`#6b7480` 系）+ 军绿集装箱（`#5a6b4a`）+ 土黄集装箱（`#7a6a4a`）+ 暖橙警示件（`#c9762e`）；天空黄昏三段（顶 `#2e4a63` / 霞 `#e2b58a` / 底 `#0d1c26`）+ 海雾 `#8fa4ae`；HUD 同一张色卡（青蓝描边 / 暖橙强调 / `#ff5a3c` 危险） | 运输船 3.1/3.3 渲染封装 + qa-crosscheck Q7 |
| ② 光照 | ACESFilmic 曝光 `0.95`（Q7 上调后口径）；单方向暖白主光（`#ffe6c2`×2.1，PCFSoft 阴影）+ 半球环境（天蓝/舰灰 ×1.7）+ 相机同侧补光（`#a9bfd2`×0.62）+ 甲板暖反弹（`#8a7a5e`×0.35）；雾 90→380 | 运输船 B:L23828 灯光层 + Q7 逆光修正 |
| ②-b 材质 | 全部 MeshStandardMaterial，贴图一律 Canvas 程序化生成（金属拉丝/集装箱波纹/甲板防滑纹/迷彩），同参数走键值缓存工厂全场景唯一；**同色自发光兜底 `ambientFloor=0.13`**（背光/掠射角的面永不读成纯黑剪影） | 知识文档 §1「缓存工厂」+ 本批复验（见 blockers.md B-5） |
| ③ 线条 | Canvas 笔触口径：舰体横向焊缝 `w3/pitch42`、甲板防滑斜筋 `w6/pitch32` + 铆钉 `r3/pitch48`、集装箱竖波筋 `w9/pitch24` + 高光 `w3`、资产边缘压暗描边 `w10/α0.35`、箱号喷字 `34px/α0.55`、全资产颗粒 `α0.14/step4`、停机坪 H 标线 `ring12/glyph16`、警示斜纹 `pitch22 暖橙` | 运输船程序化贴图拆解 |
| ④ 比例 | 圆角盒统一圆角 `r0.04/seg2`（风格卡「圆角盒拼装」）；枪模全长 `1.14m`、口径 `0.035`、后坐 `posZ0.06/rotX0.12`（q7 后整体 0.8x）；人形头身比 ≈1:6（头 `0.26`/躯干 `0.52×0.62`/腿 `0.72`）；围栏立柱间距 `2.2m`、高 `1.08m`；枪口火光 `0.34m/55ms`、命中火花 `7 颗/0.26s` | 运输船圆角盒拼装 + q7 枪模 0.8x |
| HUD | DOM 直写：DIN 数字字体栈、clip-path 斜切面板、青蓝描边 + 半透明黑底；小地图/雷达用独立 canvas 预渲染 | 运输船 HUD 层 |
| 禁止 | 任何 http(s) 外链资源、图片/音频/模型文件落盘；「生成更多」不是成果，过验收才算 | 知识文档 §1「全文件唯一网络请求是 HTML 本身」 |

> **纪律（本批新增）**：四要素已落成代码真源 `games/transport-ship-3d/assets/palette.mjs` ——
> 所有资产（贴图/材质/天空/HUD/特效）只准从这里取色取比例；逐资产另编色值 = 风格漂移，按缺陷处理。

---

## 资产清单（与 spec.assets 段一一对应）

| id | 品类 | 落点（相对工作区根） | 来源/生成器 | 用途 | 状态 |
|---|---|---|---|---|---|
| a01-textures | image | `games/transport-ship-3d/src/render/textures.js` | generated · procedural:canvas2d | 甲板防滑纹/舰体金属/集装箱波纹×2 色/迷彩/海面/停机坪 H 标线 | ✅ 已接线（7 条贴图资产 id 见 a01 条目表） |
| a02-geometry | model | `games/transport-ship-3d/src/render/geometry.js` | generated · procedural:rounded-box | 圆角盒工厂 + 枪模/舰桥/集装箱/人形/围栏拼装 | ✅ 已接线（枪模/人形 2 条资产 id） |
| a03-sfx | sfx | `games/transport-ship-3d/src/render/audio.js` | generated · procedural:webaudio | 射击/命中/爆头/换弹/受伤/波次开始/击杀（10 事件音色表） | ✅ 已接线（音色参数表数据表驱动） |
| a04-style-card | doc | `.myrd/blackboard/assets.md` | manual | 本风格卡（资产风格唯一基准） | ✅ 四要素补全 + 代码镜像落 `assets/palette.mjs` |

> 音频不落 .wav 文件（零外部资源红线）：WebAudio 运行时合成，落点即合成器模块本身。

## AppHost 部署产物（2026-09-24 部署就绪批次 · 游戏程序）

| 项 | 落点 | 说明 | 状态 |
|---|---|---|---|
| 部署产物 | `games/transport-ship-3d/export/web/index.html` | `apphost.toml` assets_dir 指向本目录；由 `tools/build.mjs` 与主产物 `index.html` **同批次写出**（单文件、零外部资源），勿手改 | ✅ 已接线（qa-audit ⑥ 断言逐字节一致 + 负向验证） |
| 壳落地页 | `server/src/game-page.ts` | `/` 直接回出 assets_dir 的 index.html（单文件游戏无需 wasm/pck 中转）；资产不可得 → 503 诊断页 | ✅ 已接线（`bash server/tools/verify-local.sh` 7 断言全过） |
| 壳应用清单 | `apphost.toml` | `name="transport-ship-3d"`、`assets_dir="games/transport-ship-3d/export/web"`（对齐 soccer 分支惯例） | ✅ 已接线 |
| 壳门禁 | `server/tools/verify-local.sh` + `server/tools/fake-s3.mjs` | 复刻平台构建链（tsc → esbuild bundle → 起服）+ 伪对象存储喂 assets_dir，断言 `/health` 与 `/` | ✅ 门禁证据 `gate-logs/transport-ship-3d/full-suite-004131-head-c3ad2cb-apphost-prep.log` 第 4 节 |

> 部署状态：**blocked 于平台无本目标 hostedApp**（三个 ready 应用均属其他目标线，不得抢占）—— 见 blockers.md B-6；分支内部署就绪改造全部完成。

## 资产引用层（本批新增 · 文件名与 spec 资产 id 对应）

| 落点（`games/transport-ship-3d/assets/`） | 职责 | 说明 |
|---|---|---|
| `palette.mjs` | **a04 风格卡的代码镜像**：调色板/光照/材质/线条/比例唯一真源 + `HUD_CSS_VARS`（HUD 与场景同一张色卡） | 纯数据零 import；消费方禁止解构另存副本 |
| `a01-textures.mjs` | a01 资产条目表：7 条贴图资产 id → 生成器参数（颜色/箱号）+ 平色贴图兜底 | 生成器本体仍在 spec 声明落点 `src/render/textures.js` |
| `a02-geometry.mjs` | a02 资产条目表：枪模/人形 id → 拼装器 + 同形兜底体（保持 `parts` 动画接口） | 生成器本体仍在 `src/render/geometry.js` |
| `a03-sfx.mjs` | a03 音色参数表：10 个内核事件 → 合成参数（数据表驱动，调音色改表不改代码） | 合成器本体仍在 `src/render/audio.js` |
| `index.mjs` | 资产台账（spec.assets[] → 落点/接线点/条目）+ `safe()` 降级入口 + `styleCard()` | `window.__game.assets` 可读台账 |

## 接线点（素材 → 工程）

| 资产 | 接线点（呈现层） | 降级兜底 |
|---|---|---|
| a01 甲板防滑纹/舷墙舰体金属/舰桥/停机坪/海面 | `src/render/map.js`（经 `gameTexture()` / `containerTexture()`） | 平色贴图 + 主题色 |
| a01 集装箱波纹 ×2 色 | `src/render/map.js`（掩体 id → 军绿群 A / 土黄群 B 自动分派） | 平色贴图 |
| a01 迷彩 | `src/render/geometry.js` `buildSoldier()`（uniform 贴图） | 平色迷彩底 |
| a02 枪模 | `src/render/player.js` `buildPlayerRig()`（双场景 vmScene） | 同形兜底枪管 |
| a02 人形 | `src/render/enemy.js` `EnemyPool.acquire()` | 同形兜底体（`parts` 接口不悬空） |
| a02 舰桥/集装箱/围栏拼装 | `src/render/map.js`（读 `levels/level-01-deck.js` 同一份布局真源） | 空组 |
| a03 音效 | `src/render/audio.js` `handle(events)`（事件 → SFX_TABLE） | 静音 |
| a04 调色板/光照/比例 | `map.js`/`geometry.js`/`player.js`/`enemy.js`/`hud.js`/`main.js`（曝光/天空/灯光/后坐/摆动） | 模板 `:root` 静态色卡 |
| 命中火花/命中标记/枪口火光 | `src/render/fx.js`（新）+ `main.js` 事件翻译 + `hud.hitMark()` | 空实现 / 无标记 |

## 本批呈现层改动清单（只动素材与呈现层，玩法逻辑与数值零改动）

1. `assets/` 引用层 5 个新模块（palette / a01 / a02 / a03 / index），spec.assets 落点未动。
2. 贴图生成器取色改走风格卡（`textures.js`），笔触参数化（`line.*`）——**视觉口径不变**。
3. 光照补齐：补光抬档 `0.4→0.62` + 新增甲板暖反弹（背光面可读性，Q7 同类问题复验）。
4. 材质兜底：贴图材质统一 `ambientFloor=0.13` 同色自发光底（修复集装箱背光面死黑剪影）。
5. **补齐 spec 元素 `lvl-01-deck/railing` 的视觉表现**（此前只有碰撞钳制无形体）：舷墙之上立柱（InstancedMesh 合批，1 draw call）+ 双横杆 + 踢脚板，暖橙扶手做边界读识。
6. 枪口火光（十字面片 + 点光脉冲，`fire()` 点亮 / 按 dt 衰减）、命中火花（THREE.Points 粒子池，1 draw call/簇）、准星命中标记（CSS 类切换，无新 DOM）。
7. 甲板防滑纹颗粒加密（4m/格 → 2m/格，FPS 视距下读得清）；HUD 色卡与场景同源。
8. 后坐衰减由「每帧固定 0.12」改为「按 dt 衰减」（帧率无关，60fps 手感不变，纯表现层）。
9. 调试/自检工具：`tools/artshot.mjs`（CDP 截图 + `--eval` 场景探针 + `--console` 采集 + `--gpu` 真显卡对照）；`window.__game` 增加 `scene`/`assets` 只读调试口。

## 美术批二：表现链路可取证化（?fire= 调试驱动）· 2026-09-23

> 背景：美术批一遗留「开火→命中→火光/火花/命中标记」链路无头不可验（合成事件驱动不了内核）。
> 本批在装配根加 `?fire=<秒>` 表现层调试驱动（对标样本「URL 参数即调试接口」，默认关闭、不碰内核不改数值），
> 并给 `tools/artshot.mjs` 加 `--query` 透传 —— 该链路自此可机判 + 截图取证。

| 项 | 内容 | 证据 |
|---|---|---|
| 新调试钩子 | `src/main.js`：`?smoke=<s>&fire=<s>` → 300ms 后按住扳机 N 秒（`inputState.firing`，纯表现层输入驱动） | 构建产物已重建（SRC_SHA 同步，qa-audit ④ PASS） |
| 自检工具 | `tools/artshot.mjs --query "&fire=N"` 透传查询串 | `ARTSHOT: PASS` |
| 链路机判 | 8 发 / 4 中 / 3 爆头 / 2 击杀 / 215 分 / wave 1，**零未捕获异常** | `artshot --eval` 读 `window.__game.world` 实时计数 |
| 链路截图 | 雷达双红点 + 集装箱后迷彩敌兵 + 弹药 20/150 消耗 + HP 79 受击反馈 | `gate-logs/transport-ship-3d/art-fire-hit-chain.png` |
| 门禁 | contract 71 PASS / 0 FAIL；ac-1~ac-4、ac-6 全 PASS；smoke 零异常 | 本批 HEAD 实跑 |

> 说明：`?fire=` 仅在显式带参时生效，正常玩家路径零影响；玩法逻辑/数值未动（内核快照测试全绿）。

## 美术批三：屏幕后处理补齐（uLowHP / uDeath）· 2026-09-23

> 依据 = 权威 lineage 文档 3.3 的胶片 shader 三件（uDamage / uLowHP / uDeath）。此前实现只有 uDamage
>（`#ts-damage` 受击红闪），本批补齐另两件 —— **纯呈现层**，阈值复用 hud 既有 `lowHp` 判定，零新增数值。

| 项 | 落点 | 接线点 | 机判证据（遵 QA 新规：computed style，不以截图作证） |
|---|---|---|---|
| 低血量暗角（uLowHP） | `assets/palette.mjs` `hud.lowVignette` + 模板 `#ts-vignette` CSS | `src/render/hud.js` `update()`：与血条 `low` 同一判定源 toggle | HP 51% → `opacity:"0"`；HP 低 → `opacity:"0.98"`（阈值行为两端夹取） |
| 阵亡灰度（uDeath） | `assets/palette.mjs` `hud.deathFilter` + 模板 `body.ts-dead #gl` | `src/main.js` gameover → `hud.setDead(true)`；重开 → `false` | `?smoke=60` → `dead:true`、`glFilter:"grayscale(0.85) brightness(0.75) contrast(1.05)"`、`hp:0` |
| 阴影口径修正 | `src/main.js`：`PCFSoftShadowMap` → `PCFShadowMap` | three r185 已弃用 PCFSoft（运行时警告并降级），显式声明实际生效口径，控制台零告警 | 构建后 `--console` 无 THREE 警告 |

> 色票/滤镜全部入 `assets/palette.mjs`（风格卡 ②-b / HUD 段），模板 `:root` 静态值降为 fallback。
> 工具：`artshot.mjs` 新增 `--sleep`（长局表现取证）。

## 门禁结论（本批复验，全部可复现）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 契约门禁 | `node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` | **71 PASS / 0 FAIL**（@368d242 22:59 补跑，`full-suite-225944-head-368d242.log`） |
| ac-1 单文件 | `node games/transport-ship-3d/tests/singlefile.contract.mjs` | PASS（零外链/零 CDN/three 内联） |
| ac-2 确定性 | `node games/transport-ship-3d/tests/kernel-determinism.spec.mjs` | PASS（内核零改动，快照逐字段一致） |
| ac-3 武器数值 | `node games/transport-ship-3d/tests/combat.spec.mjs` | PASS（数值表零改动） |
| ac-4 波次 | `node games/transport-ship-3d/tests/wave.spec.mjs` | PASS（波次零改动） |
| ac-6 QA 审计 | `node games/transport-ship-3d/tests/qa-audit.mjs` | PASS（16 个 HUD id / SRC_SHA 同步 / 元素 11 编号） |
| 真浏览器冒烟 | `node games/transport-ship-3d/tools/smoke.mjs` | PASS（零未捕获异常，核心循环可玩） |
| 美术自检截图 | `node games/transport-ship-3d/tools/artshot.mjs` | PASS（`gate-logs/transport-ship-3d/art-deck-after-assets.png`） |

> 产物 `games/transport-ship-3d/index.html` 已重新构建（SRC_SHA 与 src/ 同步，qa-audit 机判）。
> 注意：`assets/` 由 `src/` 引用打包进单文件，SRC_SHA 指纹只覆盖 `src/` —— 改 `assets/` 后须重跑 `node tools/build.mjs`。
