# 环境自检报告 · videos/myrdplaygrou-2

- 日期：2026-11-09
- 分支：`myrd/env-check-goal-cmw8yl0gs000xm9atm3ev9bzc`
- 依据需求：《以柔克刚视频工程（diorama·60s·16:9·云健男声·巡礼叙事）》（id=`cmw8ysdbz001pm9at1m66m02a`）
- 结论：**五项检查全部通过，环境就绪**；1 个已知签名（#G2）记录在案，非阻断。

## ① Blender 解析（resolve-blender.sh）

```
$ bash .myrd-platform/.claude/skills/blender-video/scripts/resolve-blender.sh
/opt/homebrew/bin/blender      # stdout 输出，退出码 0
```

- 版本：Blender **5.2.3 LTS Release Candidate**（build 2026-10-18）。
- 解析结果 `/opt/homebrew/bin/blender` 是 70 字节 zsh **转发脚本**（非软链接），
  exec 指向 `.app` 内真实二进制 —— 正是 gotchas **#G1** 要求的安全形态，
  脚本未触发软链接告警，自带 Python 冒烟 `PY-OK` 通过（encodings 导入正常）。
- **无需安装**：Blender 已就位，跳过安装分支。

## ② Blender 渲染冒烟（Cycles 出图实证）

`blender -b --python-expr` 渲默认场景一帧：960×540、CYCLES、samples=1、PNG。

- 证据：`qa/envcheck/envcheck-render-smoke.png` —— **418,135 字节**，`PNG image data, 960 x 540, 8-bit/color RGBA`。

## ③ FFMPEG 输出模块（已知签名 #G2，非阻断）

```
TypeError: bpy_struct: item.attr = val: enum "FFMPEG" not found in ('AVIF','JPEG','OPEN_EXR','PNG',…)
```

- 与 skill `references/gotchas.md` **#G2** 完全一致（`file_format` 枚举无 `'FFMPEG'`）。
- 既定对策：**PNG 帧序列 + 系统 ffmpeg 合封**（pipeline Step 4/5 与模板 `build_scene.py` 均按此路径）。
- 系统 ffmpeg/ffprobe 就位：`/opt/homebrew/bin/ffmpeg`、`/opt/homebrew/bin/ffprobe`。
- 结论：不触碰管线，无需修复。

## ④ edge-tts 配音链（uvx）

- `uvx` 0.10.9（`/Users/leo/.local/bin/uvx`）。
- `uvx edge-tts --list-voices` 成功，需求指定音色在列：
  **`zh-CN-YunjianNeural  Male  Sports,Novel  Passion`**（云健男声）✅
- **真实合成冒烟**（--rate=-6%，与 pipeline Step 2 同参）：
  证据 `qa/envcheck/envcheck-vo-smoke.mp3` —— **22,752 字节**，ffprobe 实测 **3.792000 s**；
  同步字幕 `qa/envcheck/envcheck-vo-smoke.srt` —— **76 字节**，1 条（00:00:00,100 → 00:00:03,786，与音频时长吻合）。
  冒烟文本「以柔克刚，环境自检冒烟测试。」

## ⑤ 合成层工具链

| 工具 | 读数 |
| --- | --- |
| hyperframes | **0.9.26**（init/check/render 全命令就绪） |
| node | v26.7.0 |
| ffmpeg / ffprobe | /opt/homebrew/bin 下均可用 |

## ⑥ 工程目录结构（需求硬约束 7）

`videos/myrdplaygrou-2/` 已按 pipeline Step 0 初始化（结构契约见 [README.md](README.md)）：

```
blender/{build_scene.py, renders/}   assets/{vo/, blender/, fonts/}
scripts/{build-captions.mjs, fetch-fonts.mjs}
compositions/  variants/  renders/
index.html  overlay.html  hyperframes.json  meta.json  package.json（name=myrdplaygrou-2）
AGENTS.md / CLAUDE.md（init 生成）    README.md（七类产物映射）    ENV-CHECK.md（本报告）
qa/envcheck/{envcheck-render-smoke.png, envcheck-vo-smoke.mp3, envcheck-vo-smoke.srt}
```

- hyperframes init：`--non-interactive --skip-skills --skill=hyperframes --resolution=landscape --example=blank`，退出码 0。
- 画幅预设 landscape = 1920×1080（硬约束 2）。
- 分镜/旁白/配音/成片/变体五类由下游节点按 README 契约填充，本节点只锁结构与路径。

## 遗留事项（对下游的提示）

- 无阻断项。唯一注意点：Blender 直出 mp4 不可用（#G2），渲染一律 PNG 序列 → ffmpeg 合封。
- 云健男声 PASSION 风格偏激昂，60s 巡礼旁白若需克制可加 `--rate=-6%` 起步微调（冒烟已验证该参数可用）。
