# blender-video 门禁取证 · 阶段1 (脚本节点) — 2026-11-09

## G1 环境
$ bash resolve-blender.sh
/opt/homebrew/bin/blender (转发脚本 exec /Applications/Blender.app/Contents/MacOS/Blender, 非软链接, 自带 Python 冒烟通过; Blender 5.2.3 LTS RC)
$ which uvx → /Users/leo/.local/bin/uvx ; which ffprobe → /opt/homebrew/bin/ffprobe ; node v26.7.0

## VO 实测台账 (VO 是时钟; 工具 ffprobe -show_entries format=duration)
s1.mp3: 6.528000s
s2.mp3: 5.856000s
s3.mp3: 5.784000s
s4.mp3: 6.024000s
s5.mp3: 6.888000s
s6.mp3: 6.792000s
s7.mp3: 7.032000s
s8.mp3: 5.256000s
s9.mp3: 5.112000s
Σ = 55.272s → 全片 1847f @30fps = 61.5667s (验收窗 58~62s)

## G2 preflight (静态 23 项)
$ python3 preflight.py videos/myrdplaygrou-2
[OK]   ROOT: 9 段视频
[OK]   ROOT: 9 段旁白
[OK]   ROOT: 宿主/轨道装配完整
[OK]   FONTS: 404 个子集, url 均为裸文件名
[OK]   CAPTIONS: 字幕文件新于旁白 srt
[WARN] FOOTAGE: 缺终稿素材 assets/blender/s1, s2, s3, s4, s5, s6, s7, s8, s9.mp4 (草稿可先行)

== preflight: 22 ok / 1 warn / 0 fail ==

## Blender 测试帧 (--test 档 50%/16spp, QA 锚点见 SPEC §7)
blender/renders/test_f1840.png 494654B
blender/renders/test_f30.png 481532B
blender/renders/test_f500.png 486441B
blender/renders/test_f950.png 566871B

## 产物落盘回读
assets/vo/manifest.json 4567B
assets/vo/manifest.json 解析 OK: scenes=9, voTotalSec=55.272, filmDurationSec=61.5667
captions.html written: 21 groups
