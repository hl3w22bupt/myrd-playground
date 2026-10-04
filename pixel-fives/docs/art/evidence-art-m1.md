# 美术线证据落文 · M1 冲刺（2026-09-12）—— 待归位

> 归属：MiniGame游戏工作室 · 游戏美术线
> 任务：参考卡 v1 锁定 + A06 改 9 帧 + 新增 A08 → 获批后量产，证据落文待归位
> 本文件为黑板不可达期间的证据暂存，黑板恢复后按 §6 清单归位。

## 1. 环境复核（美术线本人实测，2026-09-12）

| 项 | 结论 | 证据 |
|---|---|---|
| Open Design daemon `127.0.0.1:7456` | **不可达** | MCP 调用返回 "cannot reach the Open Design daemon"，与 Team Lead / QA / 主策划三方声明一致 |
| 黑板 `.myrd/blackboard/` | **不存在于工作区** | 目录遍历无该路径，无法写入 `assets.md` |
| 工作区分支 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`（已就位） | `.git/HEAD`；本地无新提交，位于 origin/main 同点 |
| 仓内 Pixel Fives 现状 | 零既有资产/文档（全仓 grep `fives|A0[1-8]` 零命中）；`src/` 为 pubg-web-core 原型 | 本线以独立顶层目录 `pixel-fives/` 落盘，不触碰现有代码 |

结论：执行「**证据落文待归位**」策略；美术产物全部落 `pixel-fives/`，不阻塞他线。

## 2. 决策记录（DR）

- **DR-1 风格卡 v1 锁定**：调色板 20 色全局锁（含终裁队色 赤焰 `#D93A2B` / 霜蓝 `#2B6BD9`）、左上 45° 单光源 ≤3 阶、1px 内描边禁纯黑、¾ 俯视 16px 公度网格。四要素一次确定，写入 `docs/art/style-card-v1.md`；此后所有资产提示词只允许「引用卡全文 + 差异段」（派生而非重编）。
- **DR-2 A06 锁 9 帧@12fps = 0.75s**：按终裁直接落 9 帧姿态链；`contact_frame=3`（≈250ms）标注为视觉触球帧，判定即时、动画不阻塞（对齐红线 `input_to_shot_latency_ms ≤ 50`）。原稿帧数记录随黑板不可达无法回溯，以终裁为准并在卡/表/manifest 三处留痕。
- **DR-3 新增 A08 `sfx-goal-hit`**：0.6s 三层确定性合成（seed=20260912），`goal_sfx_at_s` 字段归属 spec v1.2 策划线落文，美术侧默认偏移 0.0s——音效不删、变可测。
- **DR-4 A03 派生纪律落地**：霜蓝球员 = 赤焰网格逐像素换色 `r→b/R→B/x→y`，不重画；换色映射进入 manifest 由脚本校验，堵死双队风格漂移。
- **DR-5 体积纪律前置**：比分数字走系统像素字体不占美术位图预算；`gen-assets.mjs` 对总量 ≤1.5MB 强校验超线 exit 1（微信主包 ≤4MB 红线内）。

## 3. 交付物清单（本轮全部落盘）

```
pixel-fives/
├── docs/art/
│   ├── style-card-v1.md          # 风格参考卡 v1（锁定稿，四要素 + 编号表 + 派生模板 + 变更记录）
│   ├── asset-registry-v1.md      # 资产台账（编号→资产映射 + 程序接线约定 + 待归位清单）
│   └── evidence-art-m1.md        # 本文件
├── assets/
│   ├── a01-pitch-tileset.grid    # 4 tile（亮纹/暗纹/边线/中点）
│   ├── a02-player-red.grid       # 6 帧（idle×2 + run×4）
│   ├── a04-ball.grid             # 4 滚动帧（A03 由 A02 派生，无独立源）
│   ├── a05-goal-net.grid         # 32×24 球门+方格网
│   ├── a06-kick-shot.grid        # ★9 帧@12fps=0.75s，contact_frame=3
│   ├── a07-ui-hud.grid           # 48×16 记分牌九宫格
│   ├── a08-sfx-goal-hit.spec.json# A08 合成规格（机器可读）
│   └── manifest.json             # 机器可读清单（frames/fps/palette数/bytes + 风格锁 + 预算）
├── tools/
│   ├── gen-assets.mjs            # .grid→PNG + 三重校验 + A03 派生 + bytes 回填 + 1.5MB 红线（零依赖）
│   └── gen-audio.mjs             # A08 确定性 WAV 合成（零依赖）
└── preview.html                  # 零依赖审查页：四要素速览 + A01–A07 实时渲染 + A06 12fps 播放 + A08 试听
```

注：`tools/*.mjs` 为**资产生产线工具，非游戏运行时代码**——不触碰 `src/`、`package.json` 与任何既有文件，符合美术线红线。若程序线认为落点冲突，走 blockers 协调。

## 4. 验证方式（供 QA / 主策划复核）

1. `node pixel-fives/tools/gen-assets.mjs` → 应输出 7 张 PNG + 校验通过 + manifest 回填字节数；任何帧宽/帧数/调色板越界都会 exit 1。
2. `node pixel-fives/tools/gen-audio.mjs` → 生成 `a08-sfx-goal-hit.wav`（同 seed 复跑比特一致）。
3. 浏览器打开 `pixel-fives/preview.html` → 核对风格四要素、20 色板、A01–A07 渲染、A06 以 12fps 真速播放（9 帧 = 0.75s，f3 红标触球帧）、A08 试听。
4. 体积：脚本汇总行「合计 ≤ 1572864B」即红线达标。

## 5. 送审清单（主策划 5 项 yes/no，全部通过后状态改 approved 并启动量产）

1. 风格卡 v1 四要素是否批准；
2. A01–A08 编号表与 id 命名（kebab-case，对齐 `src/entities/<id>.js` 槽位）是否批准；
3. A06 = 9 帧@12fps=0.75s、contact_frame=3 仅视觉不阻塞判定，是否批准；
4. A08 三层合成参数 + `goal_sfx_at_s` 默认 0.0s（字段由策划案落文），是否批准；
5. 比分数字走系统像素字体不占美术位图预算，是否接受。

量产序列（获批后）：A02 方向扩展（上下朝向）→ A06 镜像校验帧 → A01 tile 扩展（角旗/禁区）→（如策划改判）A07 数字位图；每批过 `gen-assets.mjs` 预算闸门。

## 6. 待归位清单（黑板恢复后）

- [ ] `style-card-v1.md` + `asset-registry-v1.md` + 本文件迁入/挂链 `.myrd/blackboard/assets.md`
- [ ] 主策划 5 项审批结论回写黑板，同步 `manifest.json` 的 `status` 与 `approved_by`
- [ ] Open Design daemon 恢复后，将 `preview.html` 内容建成 OD 项目便于在线评审
- [ ] 若黑板资产命名表与现存 id 冲突：以黑板为准做一次脚本批量改名

## 7. 红线自检

| 红线 | 自检 |
|---|---|
| 不改代码 | ✅ 未触碰 `src/`、`package.json`、任何既有文件；新增内容限于 `pixel-fives/` 美术域 |
| 不改策划案 | ✅ `goal_sfx_at_s` 等字段归属 spec v1.2，仅登记默认值并注明归属，未代写策划案 |
| 风格统一优先于数量 | ✅ 单一风格卡派生全部资产；A03/A06 霜蓝版均为换色派生而非重编 |
| 获批前不量产 | ✅ 全部资产 `draft-pending-approval`；`manifest.approved_by = null` |
