# 《线上抓娃娃机 game-11》画质 v2 专项验收报告（2026-10-07）

- 验收角色：主策划（画质 v2 验收节点）· 分支 `myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn`（HEAD = eac331b 快进对齐后）
- 验收对象：画质升级 v2 重制后的**线上版**（对照需求 cmuxi89i3000km9oeyc2y2mle 三专项 + 兼容红线）
- 结论：**机器侧验收全绿，三专项证据闭环；目标关闭仍差两件人工项**（真机/桌面 HIGH 档观感走查 + 试玩拍板，见 §6）
- 本节点动作：快进对齐 v2 分支（4528083 → eac331b）+ 独立复跑四门禁与移动门禁（round5）+ 线上指纹取证 + 三专项逐项核对 + 回写 goal artifacts

## 1. 线上产物标识（回写 goal artifacts 的三条）

| 项 | 值 | 本节点核验方式 |
| --- | --- | --- |
| **HostedApp id** | `cmuwf171v000vm9lg2vqldhwy`（slug: game-11） | `/health` 实测 `app=claw-machine-game-11` 身份互证 |
| **deployment id** | `cmuxl0nam001dm9oetz0i10xi`（version 7，commit `07bba07`） | 部署黑板 `.myrd/blackboard/game-11-deploy-v2.md` + 线上 pck 指纹与 HEAD 构建逐字节一致双源印证 |
| **liveUrl** | https://leomac-studio.tail49399e.ts.net/apps/game-11/ | 本节点实测 200（§2）；免登录可玩 |

## 2. liveUrl 实测取证（本节点独立取证，2026-10-07T12:2xZ）

| 检查 | 结果 |
| --- | --- |
| `GET /apps/game-11/health` | 200，`{"ok":true,"app":"claw-machine-game-11","assets":"lazy/object-storage"}` |
| 壳页 v2 特征 | `__SOFT_RENDER__`（软渲染结论桥）×3、`UNMASKED_RENDERER_WEBGL`（GPU 探测）、`CAPPED_DPR`（分级钳制）×4 全部在场；v1 壳契约（`__audioDebug` / `__GAME_TUNING__` / `DecompressionStream`）未回退 |
| **线上 index.pck 指纹** | 经资产通道 gzip+b64 解码 3,459,648 B，sha256 `603865ed03dccfb3…c7c972a6` 与仓库 `games/game-11/export/web/index.pck` **逐字节一致**，GDPC 魔数正确 → **线上跑的正是 v2 构建** |
| 线上 index.js 指纹 | 331,495 B，sha256 `8b649683…720824075` 与仓库导出产物一致（引擎引导层，v1→v2 不变属预期，游戏代码在 pck 内） |

## 3. 本节点独立复跑门禁（非转抄前序声明）

### 门禁 A：本地四门禁（`bash games/game-11/verify.sh`，Godot 4.3.stable，本次实跑 EXIT=0）

| 门禁 | 结果 | 明细 |
| --- | --- | --- |
| preflight | PASS | 14 类静态一致性（79 文件，含 Godot 3→4 机判 / res:// 存在性 / Juice 引用完整性） |
| GODOT_SMOKE | PASS | headless 240 帧；**画质七断言**（FILMIC 色调映射 / Glow 开 / 深度雾开 / 颜色调整开 / MSAA 3D≥2× 已声明 / headless 不降档 / UI 主题挂矢量中文字体）+ 契约断言全过 |
| GODOT_FUZZ | PASS | seed=20260913，6 批 239 帧，对抗事件序存活 |
| GODOT_PLAYTEST | PASS | 3 局 × 900 帧：首奖励 6.5 / 2.72 / 2.47 s（≤10s），反馈 210 / 253 / 251 次（≥2），最大间隔 ≤0.63s（≤10s），score 0/300/0 |

### 门禁 B：移动端模拟门禁 MOBILE_SMOKE（headless Chrome，iPhone 17.5 UA / 390×844 / DPR3，对 liveUrl 实测）

| 轮次 | 结果 | 证据 |
| --- | --- | --- |
| round2（部署节点，checkedAt 04:07:31Z，晚于 version 7 部署创建 04:02:46Z） | PASS 10/10，fps=17 | `qa/mobile/` |
| **round5（本验收节点独立复跑，checkedAt 04:31:59Z）** | **PASS 10/10，fps=17**，console 0 错误、网络 0 失败 | `qa/mobile-round5/`（report.json + 3 张截图） |

两轮跨 24 分钟结论一致（同 fps=17）→ **移动端可判定可复现**。口径注明：阈值 ≥8 为 **SwiftShader 软渲染口径**；
需求红线「真机 ≥30fps」模拟门禁无法机判，归入人工验收（§6）。

## 4. 画质 v2 三专项逐项核验

### 专项一：字体清晰 —— 机器侧 PASS

| 验收点 | 证据 |
| --- | --- |
| hidpi 高分渲染 | `project.godot` `display/window/dpi/allow_hidpi=true` 显式声明；390×844@3x → 背板 1170×2532（两张门禁截图实际分辨率即 1170×2532） |
| 矢量重排不位图拉伸 | stretch `mode=canvas_items` + `aspect=expand`（任意窗口占比铺满无黑边；round5 metrics `scrollWidth=390=clientWidth` 无横向溢出） |
| 全矢量中文 + 字号加大 | `gui/theme/custom_font` NotoSansSC 子集 + `scripts/ui_theme.gd` 代码主题（`_apply_ui_theme()` 挂两个 CanvasLayer 全部顶层 Control，smoke 断言 theme.default_font 非空）；Label3D 挂同一矢量字体，font_size 96→256 / pixel_size 0.00082（文字纹理密度 ≈5×） |
| 截图观感 | 3x 背板下标题/HUD（币·时间·目标·爪型·得分）/换爪按钮/操作提示文字边缘锐利无糊边（§5 截图证据），无缺字方块（灯箱中文正常渲染） |

### 专项二：画面精美 —— 机器侧 PASS（观感项归人工，见 §6）

| 验收点 | 代码/配置锚点 | 浏览器实渲染证据 |
| --- | --- | --- |
| MSAA 2× | `anti_aliasing/quality/msaa_3d=1`（smoke 断言在位） | HIGH 档截图边缘无明显锯齿楼梯（叠加 3x DPR） |
| Filmic 色调映射 | `main.gd:103 TONE_MAPPER_FILMIC`（exposure 1.05 / white 4.0） | HIGH 档截图灯泡高光有滚落层次、不死白截断 |
| Glow 辉光 | `main.gd:107 glow_enabled`（intensity 0.55 / hdr_threshold 1.05） | **round1-fail HIGH 档截图灯泡光晕可见**（`qa/mobile-round1-fail/phase-tap.png`）；round2/round5 LOW 档光晕消失（平面白盘）——**两张对照即辉光真实渲染 + 档位契约显式生效的双向证据** |
| 雾效 | `main.gd:114 fog_enabled`（FOG_MODE_DEPTH begin1.6/end7.0/curve1.4 暗蓝） | HIGH 档截图机台内空间蓝紫空气层次可辨 |
| 颜色调整 | `main.gd:123 adjustment_enabled`（contrast 1.06/saturation 1.10/brightness 0.98） | smoke 断言在位 |
| 反射等效替代 | 玻璃 metallic 0.55/rough 0.04/specular 0.9 + 金属件 metallic 1.0 + 两盏彩色补光（暖金/冷青 OmniLight） | HIGH 档截图玻璃罩斜向反光条可见；SSR/体积雾不可用→等效替代已记录于 `docs/graphics-v2.md`（不做无声降级） |
| 软阴影 | 主光 `shadow_blur=1.6 + shadow_opacity=0.72`；玻璃/自发光件 `cast_shadow=OFF` | smoke 断言在位；PCSS 兼容渲染器不可用→shadow_blur 近似，已记录 |

### 专项三：3D 表现力 —— 机器侧 PASS

| 验收点 | 证据 |
| --- | --- |
| PBR 按部件分级 | `machine.gd`：机身烤漆金属 0.78/0.38/0.62、包边导轨镀铬 1.0/0.18、内衬绒面 0.97/0.2、灯罩灯泡自发光 2.4/3.2（`_process` 正弦呼吸 2.7±1.1 / 2.1±0.7）；`doll.gd` 绒布高 rough + 眼睛亮面 rough 0.12 + 高光点 |
| 夹爪多部件圆滑 | `claw.gd` 滑车(滚轮/螺栓)→吊缆→爪头(缆夹/颈柱/环座/圆盘)→每臂(胶囊上臂→肘球→锥形下指→指尖胶垫)，12 处 Capsule/Sphere/Cylinder/Torus 曲面件无硬棱；剪刀爪压扁成刃、双爪上臂加粗 |
| 娃娃多部件立体 | 细分 20/10→22/11（`radial_segments=22/rings=11`），身体/肚皮/头/耳型分支/手臂/脚掌/口鼻/眼睛高光；HIGH 档截图中 6+ 只娃娃耳/口鼻/腮红立体层次可辨 |
| 材质缓存纪律 | 仍按 `色值\|roughness` 静态缓存共享，DrawCall 不因精细度回退 |

## 5. 兼容红线核验（玩法/内容/音频/性能无回退）

| 红线 | 机器侧证据 | 截图/实渲染佐证 |
| --- | --- | --- |
| 玩法闭环保留 | smoke 240 帧覆盖布货→移动→下爪→闭合→提起→落洞入账→结算→重开；playtest 3 局零脚本错误 | round5 触摸管线/触摸响应 PASS（点按下爪+重开路径通） |
| ≥3 夹爪参数互异 | smoke `_check_claw_variety`：3 爪型 radius/power 两两不同断言过 | 截图「标准三爪/强力双爪/剪刀爪」三按钮在场 |
| ≥8 娃娃布货 | smoke：Dolls 子节点 ≥ `Doll.KINDS.size()` 断言过 | HIGH 档截图单屏可见 6+ 只（多款造型/体积/色系） |
| BGM 循环 + 音效 ≥5 + 静音开关 | smoke：SFX_BANK ≥5、BGM LOOP_FORWARD 在播、静音翻转可还原断言过 | 截图「音效: 开」开关在场；round5 audio-unlock（`__audioDebug`）PASS |
| 移动端门禁不回退 | round2 + round5 双轮 PASS 10/10（§3 门禁 B） | fps=17 ≥ 8（swiftshader 口径） |
| 体积无显著回退 | pck 3,444,848 → 3,459,648 B（**+0.43%**，v1→v2 全程序化资产策略不变） | — |
| 真机帧率 ≥30fps | **无法机判**（模拟门禁为软渲染口径）→ 归人工验收（§6） | — |

## 6. 遗留差距（供下一轮决策，按影响排序）

| # | 差距 | 性质 | 建议去向 |
| --- | --- | --- | --- |
| 1 | **专项二观感最终裁决缺人工一环**：辉光亮度/雾浓度/反射可信度/软阴影观感是否达「可商用演示水准」，机器侧只有配置断言 + round1-fail（SwiftShader HIGH 档）截图旁证，真机/桌面 GPU 观感无人走过 | 人工验收缺口（红线：机器不替人判「好不好」） | owner 按 `qa/playtest/PLAYTEST_KIT.md` §画质看点，在桌面浏览器（真 GPU 自动 HIGH 档）或真机走查；可用 `?dpr=3 vs ?dpr=1` 对比字体锐度 |
| 2 | **真机 ≥30fps 红线未实测**：门禁 fps=17 是 SwiftShader 软渲染口径（阈值 ≥8），真机帧率无数据 | 人工验收缺口 | owner 真机试玩时体感确认；若卡顿，看门狗会显式降档（quality_tier 可查），反馈降档触发时机即可 |
| 3 | spec↔实现已披露差异 2 项：①hidpi spec `dpr_max=3` vs 实现真 GPU 钳 2（`?dpr=` 可到 3）；②MSAA spec 桌面 4x/移动 2x vs 实现统一 2×（gl_compatibility 单值取舍） | 已记录的工程取舍（`docs/graphics-v2.md` + PLAYTEST_KIT §3），非无声降级 | 若 owner 认定须对齐 spec 字面 → 走 `game-design-specs/:id/revisions`（version+1）改 spec 或改实现，二选一，禁止两头各改 |
| 4 | 画质数值（rendering/materials/modeling/ui_theme）不进 `?tuning=1` 面板（面板只覆盖 7 个玩法键） | 设计边界已披露 | 试玩若指向画质数值问题 → spec.numeric.rendering/materials 修订，不在调参面板 |
| 5 | 试玩四问量表**待用户回填**（好玩与否 + 最想调的一个数值） | 人工拍板未完成 → **目标不能关** | 等 owner 回填；回流后按黑板 `.myrd/blackboard/game-11-playtest.md` §给下一轮 走 revisions → 重部署 → 再复核 |

## 7. goal artifacts 回写记录（本节点）

- 追加 artifact：`game-11-graphics-v2-acceptance`（op=`acceptance_review`），内容 = 本报告 §1/§4/§5/§6 浓缩：
  HostedApp id / deployment id（cmuxl0nam001dm9oetz0i10xi, v7, 07bba07）/ liveUrl / 三专项机器侧结论 / 兼容红线结论 / 遗留差距 5 项。
- PATCH 合并追加，不覆盖前序 13 条（playtest-kit-v2 的「待用户试玩」状态保持，不伪造任何人工结论）。

## 8. 移交人工验收（最终裁决，机器不可代判）

@ai-verse-bot 画质 v2 机器侧验收已全绿（三专项证据闭环 + 双门禁多轮收敛），目标关闭还差你两步：
1. **画质走查**（桌面浏览器即可，真 GPU 自动 HIGH 档全效果）：打开 https://leomac-studio.tail49399e.ts.net/apps/game-11/ ，重点看 ①灯罩灯泡辉光光晕 ②机台内雾效空气感 ③金属爪/玻璃罩反光 ④文字锐度（可加 `?dpr=3` 对比）；真机顺手感受帧率是否 ≥30fps 流畅。
2. **试玩拍板**：按 `games/game-11/qa/playtest/PLAYTEST_KIT.md` 玩 1–2 局，回填四问量表（好玩与否 + 最想调的一个数值）；调参工作台 https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1 。
未拍板前目标不算完成；画质观感若不达标 → spec revisions（version+1）→ 重部署 → 再复核。
