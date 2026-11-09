# blender-video 门禁取证 · 阶段4 (终稿渲染 + 合成层 + 五道门禁) — 2026-11-09

> 节点职责：`--final` 终稿渲染（100% / 64spp，后台）→ ffmpeg crf17 yuv420p 合封
> `assets/blender/s1–s9.mp4` → 五道门禁逐道过 → 亲自抽帧看成片 → 变体派生 ≥2 → 提交推送。
> 前序：阶段3 草稿逐拍评审 P0=0（qa/review/ 21 张证据帧 + REVIEW.md §0–§9），终稿侧 Blender 零待修项。

## 0. 终稿渲染（门禁前置，后台执行）

- 命令：`blender -b -P blender/build_scene.py -- --final`（后台，日志 `blender/renders/final-render.log`）
- 配置：`resolution_percentage=100`（1920×1080）、`taa_render_samples=64`、Eevee Next、AgX Medium High Contrast
- 启动时刻 2026-11-09 17:46；实测速率 ~1.38 s/帧 × 1847 帧 ≈ 42 min（与变体配方预算 Eevee ~1.5s/帧 同量级）
- 产物：`blender/renders/s1..s9/` PNG 序列（gitignore，不入库）；`s1/frame0030.png`、`s3/frame0500.png`
  终稿档锚点帧已先行目验（100%/64spp，比草稿档更锐、AgX 观感一致、QA 要求内容全部可辨）

## 1. 混音预备测量（音频是测出来的不是听出来的）

data-volume 路径的不可行性证明（为何必须先做 VO 母带响度归一）：

| 量 | 实测（ffmpeg ebur128） | 推导 |
| --- | --- | --- |
| VO 各段整合响度（归一前） | −22.9 ~ −24.5 LUFS（中位 ≈ −23.4） | 混合轨预计 ≈ −23.4 − 10·log₁₀(55.272/61.567) ≈ −23.0 LUFS |
| 目标 | −16 LUFS（门禁窗 −18~−14 中点） | 需 +7 dB 增益 ⇒ data-volume ≈ ×2.24 |
| VO 各段真峰（归一前） | 最高 **s5 = −3.86 dBFS** | +7 dB 后 = **+3.1 dBTP ⇒ 必然削波**，门禁 d 的 truePeak ≤ −1 与 0 削波不可达 |

结论：`data-volume` 单杠杆在「响度达标」与「峰值 ≤ −1 dBTP」两个约束下**无解**（步进 ≤1.35× 的纪律
正是防顶破峰值线）。故按混音职责对 VO 母带做**两遍法 loudnorm**，再以 `data-volume=1.0` 基线合成。

### VO 母带响度归一台账（ffmpeg loudnorm 两遍法，linear=true 优先）

| 段 | 归一前 I (LUFS) | 归一前 TP (dBFS) | 归一后 I (LUFS) | 归一后 TP (dBFS) | 时长保持 |
| --- | --- | --- | --- | --- | --- |
| s1 | −23.31 | −6.02 | −16.2 | −1.4 | 6.528 = 6.528 ✓ |
| s2 | −24.10 | −5.39 | −16.3 | −1.3 | 5.856 = 5.856 ✓ |
| s3 | −24.52 | −5.93 | −16.2 | −1.4 | 5.784 = 5.784 ✓ |
| s4 | −24.28 | −4.62 | −16.1 | −1.5 | 6.024 = 6.024 ✓ |
| s5 | −23.78 | −3.86 | −16.5 | −1.3 | 6.888 = 6.888 ✓ |
| s6 | −23.57 | −7.62 | −16.0 | −1.4 | 6.792 = 6.792 ✓ |
| s7 | −24.41 | −6.49 | −16.3 | −1.5 | 7.032 = 7.032 ✓ |
| s8 | −23.23 | −5.78 | −16.0 | −1.4 | 5.256 = 5.256 ✓ |
| s9 | −23.27 | −7.32 | −16.0 | −1.5 | 5.112 = 5.112 ✓ |

- 段间响度散布：归一前 1.29 LU → 归一后 **0.5 LU**（一致性提升）；
- **VO 是时钟契约不受影响**：9/9 时长逐字节一致（上表）→ SCENES/KEYS/PLAN 三表零改动、Blender 零重渲；
  preflight VO-duration/VO-fit 复跑全过（§2 门禁 a）；
- 预计混合轨整合响度 ≈ −16.2 + 0.47 ≈ **−15.7 LUFS**（窗内）、峰值 ≤ −1.3 dBTP（≤ −1 ✓）；
  实测以门禁 d 成片读数为准（§4）。
- 原始 mp3 保留在 git 历史（stage-1 提交），manifest.json 的时长/边界字段零改动。

（以下门禁读数在合封后逐道回填）

## 2. 门禁 a · preflight 静态 23 项

- 彩排（草稿素材 + 混音后 VO，2026-11-09 17:58）：**23 ok / 0 warn / 0 fail**（VO-duration 9/9、
  VO-fit 全过、FOOTAGE 素材齐）
- **正式（终稿合封后，19:2x）：23 ok / 0 warn / 0 fail** —— SCENES 9 段边界、KEYS 20 键全部落段、
  尾帧 1847 对齐、PLAN↔SCENES 一致、VO 实测时长 9/9（混音后时长零漂移）、VO-fit 全过、
  根装配 9 视频 + 9 旁白完整、FONTS 404 子集 url 裸文件名、CAPTIONS 新于 srt、FOOTAGE 素材齐

## 3. 门禁 b · `npx hyperframes check --json`

- 彩排（合成层 + 混音后 VO，17:59）：ok=true，lint 0e/0w（3 files）· runtime 0e/0w · layout 0e/0w
  （9 samples, duration 61.567）· contrast 15/15 · craft 493 samples · audio ok
- **正式（终稿素材 + 合成层微调后）：3 连跑全绿** —— ok=true；lint 0e/0w（3 files）· runtime 0e/0w ·
  layout 0e/0w（duration 61.567）· contrast 0e/0w · craft 0e/0w · audio 0e/0w · motion 0e/0w

### 合成层微调记录（终稿素材替换后 check 暴露，均已修复并复验）

终稿 1080p 素材替换草稿后，check 首轮暴露 4 个告警（craft 1 + contrast 3），归因两处真实弱点：

| # | 告警 | 根因 | 修复 | 复验 |
| --- | --- | --- | --- | --- |
| F1 | contrast_aa_failure ×3（匾额 p4/p6/p2 文字，bg 被采到视频亮像素 1.5–2.6:1） | 匾额墨底是 `rgba(24,15,12,0.9)` 半透明板，机检对成页截图在文字 bbox 内采样真实合成像素，半透明底不能稳定作为「文字自身背景」被采到 | ①墨底板改全不透明 `rgb(24,15,12)`；②墨底随**文字元素自身**携带（`.pname/.psub/.name/.sub/.big/.stats` 负 margin + 同色 padding 铺满原板面，视觉输出零变化）——与字幕条同款稳定模式 | 抽帧目验 3.5s/30.8s/58.9s 三版式与阶段3锚点逐像素级一致 ✓；连跑 3 轮 contrast 0e/0w ✓ |
| F2 | contrast_aa_failure（字幕 g21 bg 2.56:1） | 字幕衬底 `rgba(14,8,6,0.62)` 半透明（同 F1 机理） | 生成器 `scripts/build-captions.mjs` 衬底改不透明 `rgb(24,16,12)`（改生成器不改生成物，P1-1 纪律），重新生成 21 组 | 3 轮 0e/0w ✓ |
| F3 | craft line_unread（尾卡 stats 行停留 2.451s < 2.625s 地板） | 尾卡窗 56.5–61.4s 提前 0.167s 摘卡 + stats 动画偏晚 | 尾卡窗延到片尾 56.0–61.567（data-start/duration），stats 动画 57.1→56.8 | 3 轮 craft 0e/0w ✓；同时消除「片尾 0.167s 裸场景」瑕疵 |

- 附注：check 的 contrast 采样存在与 seek/截图时序相关的偶发误采（同一页面状态下曾对
  **不同**匾额在不同轮次报 2 告警，而 `.hyperframes/artifacts/snapshots/73b04022*/frame-01-at-17.1s.png`
  实拍证明金字墨匾真实对比度 ≈11:1 远超 3:1 要求）；文字元素自带实底后该误采通道被消除（3 连跑 0 告警）。

## 4. 门禁 c · `npx hyperframes render` 成片

- 首渲（data-volume=1.0）：`renders/myrdplaygrou-2_2026-11-09_18-59-50.mp4`（被 §5 响度迭代替代删除）
- **正式成片：`renders/myrdplaygrou-2_2026-11-09_19-02-59.mp4`（24.5 MB）**
  - ffprobe：h264 1920×1080 @30fps，视频流 1848 帧 = 61.600s（容器取整，1848/30=61.6，与根
    `data-duration=61.567` 差 1 帧封装取整 ≤1/30s）；AAC 48kHz 立体声，封装完整可播放
  - 渲染耗时 34.4s（capture 23.3s + encode 0.7s + audio 2.6s，硬件 GPU）

## 5. 门禁 d · `npx hyperframes audio` 响度（实测一轮达标）

| 轮 | data-volume | LUFS integrated | truePeak | 削波 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1 | 1.0（基线） | **−13.2** | −1.3 | 0 | ✗ 超窗（窗 −18~−14） |
| 2 | **0.741**（= 1/1.35，一步之内） | **−15.8** | **−3.9** | **0** | **✓ 全部达标** |

- 轮 1 超窗根因（可复算）：VO 母带为 **mono**，逐段 ebur128 实测 −16.0~−16.5 LUFS；渲染混音把
  mono 复制成 stereo，ITU BS.1770 通道能量求和 **+3.01 dB** → −16.2 + 3.0 ≈ −13.2，与实测精确吻合。
  （§1 的预测 −15.7 误用了「mono 测量值直接进 stereo 混音」的口径——本条留痕防止后人复蹈。）
- 轮 2 修正：9 个 `<audio>` 统一 `data-volume="0.741"`（步进 = 1/1.35，符合 ≤1.35× 纪律），重渲后
  −15.8 LUFS 落窗中心、truePeak −3.9 dBTP（余量 2.9 dB）、0 削波。shortTermMax −14.9。
- 复跑 `check --json`（audio 元素变更后）：ok=true，0e/0w（含 audio 节）——本轮正式 check 读数。

## 6. 门禁 e · 亲自抽帧看成片

- 工具：`node scripts/extract-qa-frames.mjs renders/myrdplaygrou-2_2026-11-09_19-02-59.mp4`
  → `qa/final-frames/`（4 锚点 + 12 帧均匀网格，逐帧目验）
- **SPEC §7 四锚点复验（终稿档同帧号）：4/4 PASS**
  | 锚点 | 要求 | 判定 |
  | --- | --- | --- |
  | f30 → t=1.0s | 三件套 + 基座整板边缘 | PASS（`anchor-f30-t1.000s.png`） |
  | f500 → t=16.667s | 球 1 触瓶、≥1 瓶倒/倾、球藏青、无穿模 | PASS（`anchor-f500-t16.667s.png`：左 1 瓶已倒 + 右 1 瓶倾倒中 + 球贴前排） |
  | f950 → t=31.667s | 十只裹膜瓶全立、半透气泡可辨 | PASS（`anchor-f950-t31.667s.png`） |
  | f1840 → t=61.333s | 整板入画、倒瓶(左)/立瓶(右)同框 | PASS（`anchor-f1840-t61.333s.png` + 尾卡事实 F1/F2/F7 + 进度轴满格） |
- **风格覆盖核验（均匀 12 帧，t=0.5/5.5/…/55.5）：12/12 全部微缩模型质感 → 100% ≥ 80%**；
  16/16 帧无任何风格漂移片段，更无连续 >5s 漂移（全片 9/9 段同为 diorama 基座+暖纸天+AgX）。
- 同轮旁证：字幕/匾额与画面对应关系逐帧一致（grid 帧 caption 与 voAt 同源，无错位）。

## 7. 变体派生（≥2，共享素材基底）—— 2/2 验证通过

- 工具：`node scripts/make-variants.mjs renders/myrdplaygrou-2_2026-11-09_19-02-59.mp4`
- 派生出处：`variants/DERIVATION.json`（master 路径 + 共享素材池清单 + 两变体方法）
- 共享素材基底 = 终稿母带（= assets/blender/s1–s9.mp4 + assets/vo + compositions 烘焙合成）
  + SPEC 三契约表；两变体均 1920×1080 AAC，时长窗内，音频门禁同窗。

| 变体 | 差异化轴 | 方法（帧精确/参数见脚本） | ffprobe | audio 门禁 |
| --- | --- | --- | --- | --- |
| `variants/v2-tempo-cut.mp4` | **节奏**（STORYLINES 选型决议素材池：紧凑剪辑） | 9 段 trim+concat，每段界前删 8 帧（0.267s 段间静音，VO 尾后有 9 帧余量防切声）；视频与音频同表切割 → 音画同步按构造保持 | **59.167s**（1775 帧 = 59.167×30 精确）、1920×1080、AAC | −15.8 LUFS / TP −3.8 / 0 削波 ✓ |
| `variants/v3-dusk-grade.mp4` | **配色**（暮色蓝调：冷阴影/冷中间调 + 微暖高光） | `colorbalance=rs=-0.28:bs=0.38:rm=-0.16:bm=0.22:rh=-0.04:gh=0.02:bh=0.06, eq=saturation=0.92:contrast=1.06:brightness=-0.045`；音频 `-c:a copy` 与母带逐位一致；参数先在草稿片预验证再套终稿 | **61.600s**（全长）、1920×1080、AAC | −15.8 LUFS / TP −3.9 / 0 削波 ✓ |

- 变体抽帧验证：v3 t=0.5/30.5 帧（`/tmp/v3_cmp*.png` 对照母带同刻）冷调差异一目了然、墨匾金字
  与白字字幕可读性保持、diorama 质感不丢；v2 第一切点邻帧 208/209/210 连续无坏帧（慢速相机移动中
  删 8 帧的微小跳变即「紧凑节奏」本体效果）。
- 两变体时长 59.167s / 61.600s 均在 58–62s 验收窗 ✓；与母带共享同一工程目录与素材基底 ✓。

## 8. 续作会话全量复验（2026-11-09 19:28–19:35，提交前最后一道核验）

> 背景：§0–§7 由前一会话完成于 17:46–19:09（终稿渲染日志完整、Blender 正常退出），但该会话在
> 提交前中断，全部产物滞留工作区。本会话**不重渲、不重混**（渲染与混音产物已落盘且日志闭合），
> 对五道门禁与全部申报产物做全量机械复验 + 亲自抽帧，复验通过后提交。以下读数均为本会话实测。

| 门禁 | 本会话复验读数 | 结论 |
| --- | --- | --- |
| G-a preflight | `23 ok / 0 warn / 0 fail`（19:33 实跑；SCENES 9 段 / KEYS 20 键 / VO-duration 9/9 / VO-fit 全过 / FOOTAGE 素材齐） | ✓ |
| G-b check --json | ok=true；lint 0e/0w · runtime 0e/0w · layout 0e/0w（duration 61.567）· contrast 15/15 · craft 493 samples 0e/0w · audio ok · motion 0e/0w；report `8dfab2b7-b2f8-4c60-b9c8-e665794dbbd0` | ✓ |
| G-c 成片规格 | ffprobe：h264 1920×1080 @30fps、1848 视频帧、61.600s、AAC 48kHz 立体声、mp4 封装完整；根 `data-duration=61.567`，差 0.033s = 1 帧容器取整（与 §4 记录一致） | ✓ |
| G-d 音频 | 母带 −15.8 LUFS / TP −3.9 dBTP / 0 削波；v2 −15.8 / −3.8 / 0；v3 −15.8 / −3.9 / 0（三片均在窗 −18~−14、TP ≤ −1） | ✓ |
| G-e 亲自抽帧 | 亲验 10 帧：4 锚点（f30/f500/f950/f1840）4/4 PASS + 网格 t=10.5/25.5/40.5/55.5（动量匾额/倒向一致净空清晰/缓冲机制近观/整板后拉）全 PASS + 变体帧 v2 t=15.0（时间轴前移）与 v3 t=30.5（暮色冷调、可读性保持）——全部 diorama 质感、无风格漂移、无黑边 | ✓ |

- 合封素材回读：assets/blender/s1–s9.mp4 全部 1920×1080/30fps，9 段时长 Σ=61.567s（与 SCENES Σ帧÷30 严格一致）；
- 变体回读：v2 1775 帧 = 59.167s 精确、v3 1848 帧 = 61.600s，均在 58–62s 验收窗；
- 变体抽帧证据补档（本会话落盘入库）：`qa/final-frames/variant-v2-t15.0s.png`、`variant-v3-t30.5s.png`。

## 9. 提交

- 主提交：`b944c41`「feat(videos/myrdplaygrou-2): 阶段4 终稿渲染 + 五道门禁全绿 + 变体派生」
  （51 files：终稿成片 mp4 + 变体 2 mp4 + 合封素材 s1–s9 + VO 母带 + 合成层 + qa/final-frames 18 张
  + stage4-gates.md + REVIEW.md 阶段4 续章 + 派生/抽帧/回写脚本）
- 留痕回填提交：`110ca34`「docs(videos/myrdplaygrou-2): 阶段4 提交留痕回填（主提交 b944c41）」
- 分支：`myrd/video-yiroukegang-goal-cmw8yl0gs000xm9atm3ev9bzc` → push 成功（origin，2026-11-09）。
  本行记录写入时点状态 `7affc07..110ca34`；其后仅追加文档留痕类提交，分支终态以
  `git log` / `git ls-remote origin <分支>` 实读为准（阶段4 全部硬交付在主提交 `b944c41`）。
