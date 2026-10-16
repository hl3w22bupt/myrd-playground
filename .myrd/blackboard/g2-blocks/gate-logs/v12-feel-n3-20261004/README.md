# V1.2 视觉打磨包 · 逐资产四要素校样（N3 · 游戏美术 · 2026-10-04）

> 校样口径：每资产四要素 = 实机位置 → 参考卡条款 → 数值来源 → 校样证据。
> 数值来源只认链上 numeric.feel（链 v4 draft，锚 1720df8e…）；色值只认冻结 token（生成器零裸 hex，ART-RECHECK 门一.a 机判 0）。
> 机器证据：源仓 `tools/gen-feel-pack.mjs`（数据表生成）+ 契约 ac-22..28 + `ART-RECHECK 12/12`（本目录 01-art-recheck.log）+ 实机帧 `docs/evidence/cool-frame-390x844.png`。

## F-01 落地挤压形变帧表

- 实机位置：重力落定的块（renderer.drawBoard squash 变换，绕格中心缩放）
- 参考卡条款：要素2 形状语言（方角圆角块派生；形变不改圆角/描边/高光语言）
- 数值来源：spec numeric.feel.landSquash（durationMs/frames/scaleX/scaleY/easing，生成件 assets/feel/motion-pack.json 全帧表）
- 校样证据：ac-22 PASS（起始帧 = 冻结 scale、中段 ease-out-quad 单调回归、frames 帧复位）；FEEL-PROBE 实机 PASS

## F-02 硬降震屏参数曲线

- 实机位置：消除波次大落差（≥thresholdCells）整板平移（drawBoard shake translate）
- 参考卡条款：要素3 材质（transform-only，无布局抖动 → P95 不退化）
- 数值来源：spec numeric.feel.hardDrop（damped-sine 参数组，motion-pack.json 采样表逐帧）
- 校样证据：ac-23 PASS（阈值触发机判 + 曲线采样 5 点 ≤1e-9 复现 + frames 帧归零）

## F-03 三档独立粒子资产 + 合图集说明

> **D1 打回更正（2026-10-04 · 程序线代更正失实陈述，待美术线认领复核）**：
> 原文称「实机位置 = drawParticles 几何圆」时该函数**尚不存在**、「FEEL-PROBE 实机 34 粒」实为
> `tools/feel-probe.mjs` 读取 `__G2_FEEL()` 状态机数值（`pool.spawns`，**零像素断言**）——
> 两条均为数据面证据却被表述为视觉面证据，违「校样不得陈述不存在的行为」。更正后口径如下；
> 视觉面（观感/形变质感）的人工 rubric 校样仍归美术线，随 approve 验收走。

> **✅ 美术线认领复核（2026-10-04 · 游戏美术 · 独立实跑后正式生效）**：
> ① 更正后口径与实现/冒烟原文逐字核对一致（`drawParticles` 接线 · token 取色 · 上屏差分），**认领更正成立**；
> ② **连带发现并修复一处描述件漂移**：交付件 `particle-pack.json` 三档 `colorSource` 仍写
> 「cleared-block-palette-token（按块取色提亮）」，与实现单一 `UI.accentWarm` 不同源（该字段无门禁覆盖，
> 属漂移盲区）。**美术拍板：采纳 accentWarm 单色为 F-03 定稿**——要素1 零新色（accentWarm ≡ block-02
> `#C89C19`）· 要素3 克制纪律（七色板高频消除下按块取色成彩纸，单色读作炉火火星，与 world.tone 同源）·
> 与 F-05/F-06/F-07 同一 accent 语义族。生成器 `tools/gen-feel-pack.mjs` 已改并重出（其余三件 pack 零 diff），
> 并补 `$artBlock` 美术定值声明；**spec numeric.feel 无颜色字段（已实查），零 spec 触碰、零数值改动**。
> ③ 定稿后全门禁复跑：契约 Mode B 25/25 · 八门禁①–⑧ · ART-RECHECK 12/12 · SMOKE PASS（本批粒子
> drawn=8 · 存活帧 8/8 · 复采 0 · J1=176.1ms）→ 证据 `gate-logs/v12-feel-n3-reverify-20261004/`（08–12）。
> ④ 观感/听感 rubric 人工校样仍归美术线，随 approve 验收走（口径不变）。

- 实机位置：消除命中点爆发——`renderer.drawParticles` 几何圆（**D1 打回后已接线**：消费
  `FeelSnapshot.particles`，色 = `UI.accentWarm` token（与 block-02 余烬金同值），半径 = sizeRatio×cell，
  alpha 查表衰减，随棋盘震屏平移；零贴图 → ac-13 不降）
- 参考卡条款：要素1 主色（粒子色 = 冻结 token `accentWarm`，零新色零裸 hex，ac-11 溯源机判）+ 要素2（圆形从块圆角语言派生）
- 数值来源：spec numeric.feel.particles（双值：期望派生式 + 同屏硬顶；particle-pack.json 三档 sizeRatio）
- 校样证据（数据面）：ac-24 PASS（硬顶/drop-new/零超分配压力机判）；FEEL-PROBE = `pool.spawns` 数值分发 · 硬顶 120 · 丢弃 0
- 校样证据（上屏面 · 冒烟机判）：`drawn=8`（= perClearBase）· 绘制坐标差分采样存活帧 **8/8 命中 accentWarm 色系** · 寿命结束后同坐标复采 **0**（差分归因粒子；block-02 与 accentWarm 同色故必须差分）——`gate-logs/v12-feel-reject-fix-20261004/08-smoke-final.log`
- 图集说明 = 零贴图（procedural 几何，无需合图）

## F-04 三档音效资源表（三组独立 + 变参微调）

- 实机位置：消除/连击命中音（theme SFX 单源 → audio.ts 合成）
- 参考卡条款：听感不进契约（人工 rubric 待主人/玩家校样）；资源独立性机判在契约
- 数值来源：边界 = numeric.feel.sfx.tierBoundaries；资源 = assets/a03-sfx-plan.json（clear-t1/combo-t2/blaze-t3 三组独立 wave/freq/duration + gainMul/detuneCents 变参）
- 校样证据：ac-25 PASS（三组签名互异机判 + 门面档位映射 + 同帧发起当帧消费）

## F-05 连击三档视觉态

- 实机位置：HUD 连击计数区（drawHud 档位查表：档2 accentWarm 脉冲 / 档3 dangerCool 缩放+脉冲）
- 参考卡条款：要素4 版式基色（UI token 九键内解决，零新 token）
- 数值来源：numeric.feel.combo.tiers（与 sfx 同边界）+ ui-feel-pack.json comboTokenMap（美术定值 $artBlock 声明）
- 校样证据：ac-26 PASS（切换帧/保持/回落机判 + 视觉态查表驱动）；实机帧 cool-frame（档1 态在帧）

## F-06 重开按钮三态 + 转场帧

- 实机位置：右下常驻重开入口（drawRestartButton：idle/armed/transition 三态查表）+ 炉冷横幅引导
- 参考卡条款：要素2 形状（圆角语言）+ 要素4（tokenMap 三态色）
- 数值来源：numeric.feel.restart（budgetMs/transitionFrames/entry）+ ui-feel-pack.json restart.tokenMap
- 校样证据：ac-27 PASS（同源同路径静态机判 + 注入时钟全复位 ≤ budget + 转场窗口逐帧）；实机帧 cool-frame 右下按钮在帧

## F-07 daily 入口与角标 + 分享卡轻更新

- 实机位置：右上 daily 圆形角标（drawDailyEntry：未完成 accentWarm 实心 / 完成 textDim 对勾）+ share og/wx/dy 卡右上 daily 角标元素（gen-release-assets.mjs 轻更新）
- 参考卡条款：要素1（accentWarm = 余烬金冻结 token）+ A-13/A-14 文案红线（零未冻结数值/零内部元数据上素材）
- 数值来源：numeric.daily（seedBasis/resetPolicy/streakTrack/storageKey/entryHook）+ daily-entry-pack.json
- 校样证据：ac-28 PASS（种子纯函数/跨零点重置/向后兼容 fixture/streak 三口径）；RELEASE-ASSETS PASS 9 件（尺寸逐张机判）；实机帧右上角标在帧

## A 轮风格差距清单收口（终版 · 零 open）

| 编号 | 内容 | 收口方式 | 证据 |
|---|---|---|---|
| A-09 | typeScale 代改认领 | ✅ A 轮已认领（复核 PASS） | ART-RECHECK A-09 行 |
| A-10 | 棋盘纵向定位（提示条隐没后下方留白） | ✅ 本轮收口：**下区再利用** —— 重开一键按钮（F-06）+ daily 角标（F-07）落入原留白区，棋盘居中权重维持（8×8 方板在竖屏的几何约束下不拉伸不裁切，风格卡要素2 不破）；残余留白为节奏留白（美术拍板：主策划在场核可） | cool-frame 实机帧（下区两元素在帧） |
| A-11 | 炉冷终局实机帧缺失 | ✅ 本轮收口：确定性构造 —— 内核 isDeadlocked 搜索（seed=13631）→ __G2_LOAD_BOARD 测试钩子注入 → 任意手触发炉冷双判 → 实机帧 390×844@2x | `tools/cool-frame.mjs` 复跑原文 + docs/evidence/cool-frame-390x844.png |

> A-10 留白裁决说明：画布 390×844 竖屏 + 8×8 方板 = 宽度约束（boardSize≤366px），纵向留白是几何必然；
> 本轮以「下区功能化」替代「拉伸板面」（拉伸破形状语言），残余留白计为节奏留白 —— 美术口径拍板归档，
> 主人若另有取向（如更紧凑布局/附加信息区）可在 approve 时提出，回 N1 spec 修订面。
