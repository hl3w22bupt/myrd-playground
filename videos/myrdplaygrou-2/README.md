# myrdplaygrou-2 ·《以柔克刚》讲解视频工程目录

需求：**《以柔克刚视频工程（diorama·60s·16:9·云健男声·巡礼叙事）》**（id=`cmw8ysdbz001pm9at1m66m02a`）。
本目录是全流水线（分镜 → Blender diorama 渲染 → 配音 → HyperFrames 合成 → 成片/变体）的唯一工程根，
按 blender-video skill 的 pipeline Step 0 结构初始化（2026-11-09，环境自检见 [ENV-CHECK.md](ENV-CHECK.md)）。

## 目录契约（需求硬约束 7 · 七类产物映射）

| # | 产物类别 | 路径 | 状态 |
|---|---|---|---|
| 1 | 工程文件 | `blender/build_scene.py`（SCENES/KEYS 两表）、`index.html`、`overlay.html`、`compositions/` | 骨架就位（模板版） |
| 2 | 分镜脚本 | `STORYLINES.md`（每景一行：id/景别/旁白≤40字/预估秒 + 实测边界帧表） | 待分镜节点创建 |
| 3 | 旁白文案 | `BRIEF.md`、`SPEC.md`、`assets/vo/*.srt`（edge-tts 同步产出） | 待下游创建 |
| 4 | 配音音频 | `assets/vo/*.mp3`（zh-CN-YunjianNeural 云健男声） | 待配音节点填充 |
| 5 | 素材 | `assets/blender/`（合封段视频）、`assets/fonts/`（Noto SC 子集）、`blender/renders/`（帧序列） | 目录就位 |
| 6 | 成片 | `renders/*.mp4`（hyperframes render 产物，60s·1920×1080） | 待渲染 |
| 7 | 变体 | `variants/`（≥2 个差异化变体，共享同一工程目录与素材基底） | 待产出 |

辅助位：`scripts/`（build-captions.mjs / fetch-fonts.mjs）、`qa/envcheck/`（环境自检冒烟证据）。

## 路径语义（沿 blender-video pipeline 契约，勿改名）

- 渲染产物文件名取自目录名 `myrdplaygrou-2`（英文+数字，符合命名要求）。
- `assets/vo/<id>.mp3|.srt` 成对，`<id>` 与分镜景 id 一一对应；旁白时长实测（ffprobe）先于画面定稿——VO 是时钟。
- `assets/fonts/` 中 `noto-sc.css` 的 url 是相对 CSS 自身的裸文件名，禁止加目录前缀。
- `blender/build_scene.py` 保留 `SCENES` 与 `KEYS` 两张表，段边界必须与旁白实测边界一致。

## 门禁（每轮交付前全部跑一遍）

```bash
bash .myrd-platform/.claude/skills/blender-video/scripts/resolve-blender.sh   # G1 环境
python3 .myrd-platform/.claude/skills/blender-video/scripts/preflight.py .    # G2 静态 23 项
npx hyperframes check --json                                                  # G3 合成, 0错0警
npx hyperframes snapshot --review                                             # G4 视觉逐拍
npx hyperframes audio renders/<file>.mp4 --json                               # G5 音频, -16±2 LUFS
```

## 硬约束速查（验收以此为准）

1. 时长 60s（58~62s，ffprobe 实测）；2. 16:9 1920×1080 无黑边；3. diorama 质感 ≥80% 时长、无连续 >5s 漂移；
4. zh-CN-YunjianNeural 男声旁白覆盖 ≥90%、音画偏移 ≤200ms；5. 巡礼四段式（启程→途经→抵达→回望）节拍可定位；
6. ≥2 变体（节奏/镜头顺序/配色至少一处差异化）；7. 本 README 七类路径可追溯。

真实地点标注「微缩示意模型 · 非真实影像」（overlay 片头小字必须保留）。
