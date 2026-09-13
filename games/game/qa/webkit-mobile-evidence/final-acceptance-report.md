# 终验报告：线上 liveUrl 四项验收硬标准（全绿）

终验时间：2026-09-13 · 终验人：目标 cmto0g28w0008m9sq0cyms729 子任务（四项终验：字体/音频/无效交换/一致性）
线上对象：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game/`
当前部署：AppHost **v17** `cmtyq8dv20019m9k7wubvgx9o`（status=running，commitHash `6076043` = 分支 HEAD，mode=bundle，assets=lazy/object-storage）

> 本报告为独立终验（区别于 v5 取证 README）：四条标准逐项机械取证，证据全部由本次
> 新鲜运行产生；任一条不达标即录 Bug 打回。结论：**四项全绿，无需录入缺陷**。

## ① /health 200 且 app=candy-crush-legend — PASS

- `GET /apps/game/health` → **HTTP 200** `{"ok":true,"app":"candy-crush-legend","env":"development","assets":"lazy/object-storage"}`
- 留证：`health-final.json`

## ② 落地页音频手势解锁器（源码 + 真实触摸行为）— PASS

**源码断言**（`final-page-source-live.html` 存档，本次运行 page.content()）：9 个解锁器标记齐全
`__audioDebug(1) / unlockAudio(3) / WrappedAudioContext(3) / touchstart(1) / pointerdown(1) /
webkitAudioContext(2) / statechange(2) / visibilitychange(1) / audioAddModules(3)`

**真 WebKit 行为断言**（Playwright 独立构建 **webkit-2359**，非 Chromium shell）：
- 环境：iPhone 13 描述符 → UA `…(iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15…`，
  `maxTouchPoints=5`（见下方披露）、`ontouchstart ✓`，视口 390×664@3x
- 线上落地页：加载期 60ms 高频采样捕获 AudioContext **诞生首态 `suspended`**（addModules=2，双 worklet 已加载）
  → `page.touchscreen.tap(195,370)` **真实触摸**「开始游戏 START」→ **`window.__audioDebug().state === 'running'`**
  （suspended → running 因果链成立，`final-verify.json` phases[0]）
- 静态导出页同源解锁器（本地伺服 `export/web/`）：同样 **suspended →（真实触摸）→ running** 实录
  （statechange 日志：`worklet×2 → running`，phases[1]）
- 留证：`final-verify.json`、`final-page-source-live.html`

**环境披露**：Playwright WebKit 1.58 已知 quirk 为 context `hasTouch:true` 不映射到
`navigator.maxTouchPoints`（恒 0），脚本以 `addInitScript` 按 iPhone 13 描述符补齐为 5——
仅恢复页面可见的设备仿真相位，触摸输入仍为真实 touchscreen 管线（引擎对触摸的响应即旁证）。

## ③ 线上 pck 解码检出无效交换反馈标识 + 与分支 HEAD 导出 sha256 一致 — PASS

线上 pck 经壳页资产通道 `GET /apps/game/api/public/assets/index.pck.gz.b64` 获取，解码链全程可复现
（`scripts/final-pck-decode.py`）：base64 → gunzip → **GDPC v3 头解析**（file_base@0x18、目录@尾部）
→ 52 条目提取（offset + file_base 校正）→ `.gdc` = `GDSC` 头 12 字节 + zstd 帧 → `-d` 解压 → 令牌流检索。

- **sha256 一致性**：线上解码后 pck `8c2841be78426bc35b6a96d440f1f3c6f2f6078a8bf13d8a56f1147025c1c7f3`
  （2604788 字节）**== 分支 HEAD 本地 `games/game/export/web/index.pck`**（逐字节一致）
- **无效交换反馈标识**（解码后明文常量，Godot 4.6 GDSC v101 标识符哈希化、唯字符串常量可 grep）：
  | 标识 | 命中 |
  |---|---|
  | `play_invalid_swap_fx` / `Board.play_invalid_swap_fx` | tests/smoke.gdc |
  | `_flash_invalid_swap_message` | tests/smoke.gdc |
  | `Invalid swap - needs a match of 3`（HUD 大字提示） | scripts/main.gdc |
  | `invalid.wav` 音频资产 | assets/audio + .godot/imported |
- 留证：`final-pck-decode.json`

## ④ HUD 中文（标题/分数/剩余步数）非缺字方块 — PASS

进入对局后真 WebKit 3x 截图（`final3x_hud-chinese.png`，本局为新鲜独立运行，非复用旧图），
机械判定（`scripts/final-tofu-check.py`）：三区域字形分割 → 归一化位图两两皮尔逊相关。
原理：字体缺 CJK 时 Godot 渲染 .notdef 空心方框，每个字符位图完全相同（相关 ≈1.0）；
真实字形彼此差异显著（相关 ≪1.0）。判据：区域 max 相关 > 0.90 判 tofu。

| 区域 | 期望文本 | 字形块 | 墨水占比 | 两两相关 max | 判定 |
|---|---|---|---|---|---|
| title | 糖果粉碎传奇 | 3 | 0.363 | 0.233 | distinct_glyphs |
| score_label | SCORE 分数 / 目标 | 8 | 0.400 | 0.314 | distinct_glyphs |
| moves_label | MOVES 剩余步数 | 2 | 0.419 | −0.032 | distinct_glyphs |

人工复核：标题金色「糖果粉碎传奇」、`SCORE 分数 / 目标`、`MOVES 剩余步数`、底部
「点按选中糖果…」「重新开始 RESTART」「音效 ON」全部为 Noto Sans SC 真实字形（内嵌字体
`.godot/imported/NotoSansSC-Regular.otf-*.fontdata` 2.4MB 在 pck 内，见 ③ 条目清单）。
区域裁剪留证：`final3x_hud-title.png`、`final3x_hud-score_label.png`、`final3x_hud-moves_label.png`；
量化留证：`final-tofu-report.json`。

## 结论

四项验收硬标准全部达标（/health 200 ✓ / 双页面音频解锁源码+行为+suspended→running 因果链 ✓ /
线上 pck 无效交换标识+sha256 字节一致 ✓ / HUD 中文非缺字方块机械+人工双判定 ✓），
**无需录入缺陷，不触发打回**。终验结论回写目标 artifacts。

## 复现

```bash
WEBKIT_EXEC=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh \
NODE_PATH=$(npm root -g) node scripts/final-verify.cjs          # ② 线上+静态双相位行为取证、④ 截图素材
python3 scripts/final-tofu-check.py                             # ④ 缺字方块机械判定
python3 scripts/final-pck-decode.py                             # ③ pck 解码 + sha256 一致性
curl -sS https://leomac-studio.tail49399e.ts.net/apps/game/health   # ①
```
