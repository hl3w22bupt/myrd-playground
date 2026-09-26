# QA 轮次记录 · 零门槛试玩反馈中枢上线（feedback hub v1）+ smoke 帧预算默认上调 3000（2026-09-27）

## 本轮范围

1. **新增试玩反馈中枢静态页 `games/game-2/export/web/feedback.html`**（随部署发布）：
   目标 —— iPhone 上**不开任何开发者开关**：扫码 → 玩 1 分钟 → 点 3 下（右上/顶部「反馈」角标 →
   试听评分 → 提交复制）即同时完成真机操作取证、音效取证与试玩结论回填。
2. **`std-skills/godot-game-dev/scripts/smoke.sh` 默认 `GODOT_SMOKE_FRAMES` 120 → 3000**
   （只改兜底默认值 + 注释，判定逻辑零改动），并按三处同值纪律同步
   `games/game-2/verify.sh`（240 → 3000）与 `.myrd/routines.yaml` `smokeFrames`（240 → 3000）。
   依据：Bug cmuivv0vj00eam9l6oooockxr + 知识库 d10498b8（帧预算是机器相关量，
   game-2 实测默认 FAIL、放大 3000 即 PASS、代码零改动）。

## 反馈中枢设计（feedback.html，自包含零外部请求）

| 能力 | 实现 |
|---|---|
| liveUrl 二维码 | 内嵌 QR 编码器（byte 模式 / EC 级 M / 版本 1~5，GF(256) Reed-Solomon + 8 掩码评分 + BCH 格式信息），零 CDN 依赖；入口 URL 从 `location` 派生（部署到任何 host 都自洽），超 84 字符优雅降级为「复制链接」提示 |
| 四类音效试听 | `autoload/sfx.gd` 四段音色表 1:1 移植 WebAudio（同 MIX_RATE 22050 / 同波形函数 / 同指数衰减 + 5% 起音斜坡 / 同每键 dB：collect -8 / hit -4 / game_over -4 / restart -6），试听即游戏同款听感 |
| 逐类评分 | 四类音效 + 操作流畅度 + 整体满意度各 1-5 星；再点同一颗 = 清除；localStorage 草稿防误触丢失 |
| 真机取证（自动） | UA / platform / maxTouchPoints / viewport / 分辨率@DPR / isIOS / isIOS_Safari / 浏览器族 / 语言 / 在线态 / AudioContext 解锁态与 statechange 日志（复刻壳页解锁器三件套，`window.__fbAudioDebug()`） |
| 回填通道 | **复用既有 `?tuning=1` 通道**：反馈以 `fb_*` 参数搭车（壳页调参桥合并进 `window.__GAME_TUNING__`，游戏侧白名单忽略未知键，玩法数值不受影响）；无后端时 JSON 结构化回执一键复制兜底（clipboard API + execCommand 降级）；「在游戏里打开回填链接」现场验证通道闭环 |
| M1 网关红线 | 页面全部资源内联、零外部请求；server 侧 `/feedback` 路由把资产解成 `text/html` 文本响应（raw 直出 / gzip+b64 先解压），绝不触发 502 UNSUPPORTED_BINARY |

### 壳页接线（随下次部署生效）

- `server/src/index.ts`：新增 `/feedback` 与 `/feedback.html` 路由（从 asset-store 取 `feedback.html`）。
- `server/src/game-page.ts`：游戏壳页顶部居中新增「反馈 ★」角标（左上是得分 HUD、右上是调参面板，
  故放顶部居中；href 按 BASE_PATH 派生，无尾斜杠入口不 404）。
- 发布路径：`apphost.toml assets_dir = "games/game-2/export/web"` 整目录上传 → feedback.html 随部署发布。
- **重导出注意**：Godot `--export-release Web` 不会删除目录内无关文件；若有人 `rm -rf export/web` 重导，
  feedback.html 需从 git 恢复（本文件是唯一事实源）。

## 验证证据（全部本地实测）

| 项 | 结果 |
|---|---|
| preflight | ✅ `PREFLIGHT: PASS`（13 类 / 67 工程文件） |
| godot-smoke（**无 env，用新默认 3000 帧**） | ✅ `godot-smoke: PASS`（退出码 0，断言标记齐全，日志无脚本错误） |
| input-fuzz | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| server typecheck | ✅ `tsc --noEmit` 退出码 0 |
| QR 闭环解码（jsQR 独立解码器） | ✅ 7 pass / 0 fail：线上入口 `https://leomac-studio.tail49399e.ts.net/apps/game-2/`（50 字符 → v4）精确解码还原；v1/v3/v4/v5 全通过；93/96 字符超容量优雅返回 null |
| 无头 Chromium 渲染（390×844 iPhone 视口） | ✅ 控制台零报错、零失败请求；四行音效 + 30 颗星 + 取证 JSON + 回填链接全部渲染 |
| 交互冒烟 | ✅ 点「试听」AudioContext → running；星级点击 → 草稿落 localStorage 且跨页恢复；回填链接形态 `?tuning=1&fb=hub&fbv=1&r=20260927&sfx_collect=4&flow=5&ios=0&safari=0&touch=0&scr=390x844@1x` |
| 超容量降级 | ✅ 116 字符 file:// 路径下二维码区显示「超容量，请复制链接」提示（截图 /tmp/fb_hub.png） |

## 修复记录（自查发现并修复）

- RS 生成多项式乘法系数放置写反（`next[j] ^= gmul(gen[j],a)` 应在 `next[j+1]`）——
  会导致纠错码字全错、二维码不可解码；修复后 jsQR 闭环 7/7 通过。
- `playSfx` 内 `def.volumeDbFor(key)` 误写（方法挂在 `SFX_DEFS` 数组上）。

## 遗留与边界

- 反馈中枢页随**下一次部署**上线；部署后入口 = `<liveUrl>feedback`（如
  `https://leomac-studio.tail49399e.ts.net/apps/game-2/feedback`）。
- 本地 file:// 打开时入口 URL 过长（>84 字符）会走「复制链接」降级 —— 真实线上入口（50 字符）不受影响。
- smoke 帧预算长期根治（墙钟时间预算口径）仍归模板仓库运维（Bug cmuivv0vj00eam9l6oooockxr 跟踪），
  本轮把仓库内三处默认值先对齐到 3000。
