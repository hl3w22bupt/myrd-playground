# 试玩验收包 · 植物人大战僵尸-网页版（2026-11-02，run cmvz7bqja0039m9w9fjbzm7sn）

> 节点：试玩验收（playtest）。职责边界：**「好不好玩」的判定只来自用户** —— 本包只交付
> 指引、量表与调参通道；四问量表全部「待用户试玩」，未回填前不得出现任何试玩结论。
> 依据口径：工程内**无** `.myrd/spec/design-spec.json`（`.myrd/` 仅 style-card.md），
> 按节点规则走**实现说明**：`docs/spec-acceptance-mirror-v6.md` + `docs/numeric-and-assets.md`
> + `.myrd/style-card.md`；平台链上最新 approved 策划案 = **v6 `cmvyol366005wm9y0kzkdz57d`**
> （2026-11-02 经 API 复核，与工程镜像声明一致）。

## 0. 试玩入口与前置门禁（preHook：mobile-web-smoke）

- **试玩入口（liveUrl，部署前即确定）**：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/
  - 手机浏览器直接开（触屏优先），桌面浏览器同样可玩（键盘等价）。
- **preHook 门禁证据（本 run 新鲜产出，落档 `qa/mobile/`）**：
  1. preHook 原始回执（无 `--project`，legacy 模式）：verdict **PASS**（10 pass + 1 warn；
     warn = `joystick-target`「未传 --project 回退固定坐标 swipe，仅取证不断言」——不构成 FAIL），
     截图三张（phase-load / phase-tap / phase-joystick）。原始报告备份 =
     `qa/mobile/report-prehook-legacy.json`（checkedAt 2026-11-02T12:46:23Z）。
  2. 本节点按脚本自身提示带 `--project games/myrdplaygrou` 复跑：**MOBILE_SMOKE: PASS，
     11/11 全 PASS、零 WARN**（网络全通 / console 零 error / canvas 挂载 / 首帧非纯色 /
     画面在动 / 触摸到达 DOM / 触摸后画面响应 / 摇杆断言按点按类玩法正确跳过——工程无
     virtual_joystick.gd / 音频手势解锁器在 / 无横向溢出 / FPS 25）。`qa/mobile/report.json`
     为本轮最终落档（checkedAt 2026-11-02T12:50 前后）。
  3. 对照：上一轮（release r6）带校准存档 `qa/gate-logs/20261102-release-r6/mobile/report.json`
     同为 11/11 零 warn PASS。**两代证据一致，无矛盾**。
- **部署身份链（本轮复验）**：deploymentId=cmvz8witi003sm9w9vj313cws（version=18，
  gitRef=`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`）；线上
  `api/public/assets/index.pck.gz.b64` → 解码 sha256 = `82d6303e470dbbc7703afc8d2cedb9da8e8705653b63f061becb02a8dd1dd1f0`
  （8,234,432 字节）与本地 HEAD 导出 `export/web/index.pck` **逐字节一致** —— 线上就是本分支产物。

## 1. 试玩指引（怎么玩、看什么）

### 1.1 三步上手（首次进入）

1. **先点一下屏幕任意处**：移动端浏览器首次手势才解锁声音（壳层音频解锁器；不点 = 全程静音）。
2. **选关页**：八关单页列出（波数/机制标签/星级/锁定态），通关一关解锁下一关；
   点卡片进入。第 1 关 = 教学关（首波前引导建成 ≥2 座布防：≥1 向日葵 + ≥1 射手，完成后提示淡出）。
3. **局内操作（触屏与键盘完全等价）**：
   - 点卡片选植物 → 点草坪格布防（放置即扣费 + 卡片进冷却 + 取消选卡）；
   - 点阳光收集（**天降 / 向日葵产出 / 击杀掉落**三个途径都只经点按入账）；
   - 键盘：`1-5` 选卡、`WASD/方向键` 移动布防光标、`空格/Enter` 放置/确认；
   - 顶栏常驻：阳光数 / 下一波 / 波次进度 / 生命 / 返回 / 重开 / 音效开关（窄视口自动折两行）。

### 1.2 一局多长、胜负怎么判（对照实现说明）

- **单局约 1-3 分钟**：第 1 关 4 波 12 僵尸起步，第 8 关 10 波 63 僵尸压轴；
  生命 5 点，僵尸进最左 2 列扣 1 点、归零失败；守完全部波次通关（星级 1-3 按剩余生命 1/3/5 档）。
- **八关机制差异化**（每关都有新东西可看）：
  | 关 | 机制看点 |
  |---|---|
  | 1 前院晨光 | 教学引导、全 walker 单一种类 |
  | 2 后院黄昏 | 疾跑/路障入场，难度第一道台阶 |
  | 3 屋顶疾风 | 全表最短波间隔（12s），节奏加快 |
  | 4 温室正午 | 阳光紧缩：天降节流 24s/15 + 卡槽禁双发（4 张） |
  | 5 后院深夜 | 夜幕迷雾：第 4 列起遮罩 + 剪影预显示 |
  | 6 屋顶风暴 | 混编高压，单波 ≥3 类同屏 |
  | 7 屋顶巨影 | boss 坦克巨尸 ×2：接触植物即碾压（含坚果墙） |
  | 8 终局夜幕 | 10 波全兵种 + 巨尸压轴；**通关解锁无尽模式** |
- **音画分层**（紧张感设计，可留意的反馈面）：基础 BGM ↔ 紧张版 BGM 在出场波次过半或末波
  0.9s 交叉淡入；僵尸低吼（在场 4-8s 随机）/ 啃食声 / 进最左 2 列危机警报 / 波次号角（末波急促变体）；
  命中 = hit thud + 击杀倒地尾音；全部反馈挂 Juice（pop/flash/shake/sfx）。

### 1.3 试玩建议动线（产出四问量表所需的最小覆盖）

1. 玩 **第 1 关**（教学）→ 感受首分钟能否看懂目标与操作（量表①）；
2. 玩一关 **中后段**（建议第 4 或第 5 关，机制差异明显）→ 感受难度压力与节奏（量表②④）；
3. 局内注意：命中/击杀反馈是否跟手、音效层次、HUD 窄屏折行后排版是否清晰（量表③）；
4. 结算后**顺着直觉决定要不要再来一局**，并记下理由（量表②的原因栏）。

## 2. 结构化试玩量表（四问，逐条回填；未回填前全部「待用户试玩」）

> 填写通道二选一：A. 直接回复本四问（agent 按回执回写）；B. 打开调参工作台
> `?tuning=1`，第二节「试玩反馈四问」面板亲手点选提交（无预选/默认值，四问缺一提交钮禁用）。

| # | 问题 | 口径 | 状态 | 回执 |
|---|---|---|---|---|
| ① | 首分钟能否看懂目标与操作 | 是/否 + 卡点（哪一步没看懂/误触在哪） | **待用户试玩** | — |
| ② | 结束时想不想再来一局 | 1-5 分 + 原因（一句原话即可） | **待用户试玩** | — |
| ③ | 手感、反馈与观感 | 1-5 分：打击感/音效/画面响应 + 风格统一与排版清晰（对照 §2.1 风格卡清单） | **待用户试玩** | — |
| ④ | 节奏有没有明显断档或无聊段 | 有/无 + 出现在第几秒（哪一关第几秒） | **待用户试玩** | — |

- 量表状态：**待回填**。本节点不代填、不虚构；收到回执后量表才产生结论，
  数值类调参结论经 spec revisions 入链（§3 数据流），下一轮工作流按新 spec 重部署。

### 2.1 量表③的风格卡对照检查清单（`.myrd/style-card.md` v5，人眼复核项）

机判面（smoke 五档视口 + CONTRAST_PAIRS）已全绿；以下留给人眼，偏离卡片即在③分值中体现：

- **字号**：标题 32 / HUD 正文 18 / 辅助 14（CSS 宽 <960 折两行、随视口在 18~24 / 12~16 带内缩放）；
  出战卡 64×44 两行式。留意：文字有没有被裁、过小或过大。
- **配色**：主绿 `#2ECC71` / 辅蓝 `#3498DB`（只上 UI，不上草坪前景）/ 强调橙 `#F39C12` /
  危险红 `#E74C3C` / 格底深绿棋盘 `#2B5436`·`#31603F` / 章节色四套（晨绿/暮橙/正午暖黄/夜蓝）；
  留意：同屏色相是否 ≤5、有没有荧光色或色板外取色。
- **描边与对比**：前景主体 2px `#1E3B25` 描边 + 投影；UI 深底 `#22313F` + 浅字 `#ECF0F1`。
  留意：主体与格底是否糊在一起。
- **点按热区**：全部按钮 ≥44px。留意：手机上有没有难点中的按钮。
- **已知留意项（模拟截图观察，非结论）**：390×844 移动仿真下选关页第 4 列卡片文字贴近视口
  右缘有贴边感（第 4/8 关卡名截断风险）—— 试玩时请留意真机是否影响辨识与点按。

## 3. 调参工作台入口与数据流

- **入口**：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1`
  - 打开后画面右上角出现调参面板，**拖滑杆即时改数值**；点「复制调参 URL」得到带
    `?tuning=<JSON>` 的链接 —— 把它发回来就是一次完整的调参结果。
  - 同页第二节 = 「试玩反馈四问」回填面板（答案只来自亲手点选；提交后壳层中继留痕，
    agent 侧经 `GET <liveUrl>/api/public/feedback/spec-revision/latest` 取回；
    本节点探测结果：`{"received":false,"reason":"no-submission-yet"}` —— 尚无用户提交）。
- **调参数值只认 TUNING_META 声明的 16 键**（`autoload/game_state.gd` 调参区）：

  | 键 | 现值 | 范围 [min~max]/step | 对应 spec.numeric |
  |---|---|---|---|
  | projectile_damage | 20.0 | 5~60 / 1 | combat.pea.damage |
  | projectile_speed | 480.0 | 120~900 / 20 | combat.pea.speedPxPerSec |
  | fire_interval | 1.5 | 0.15~3.0 / 0.05 | plants.*.fireIntervalSec 基准 |
  | bite_interval | 1.0 | 0.4~3.0 / 0.1 | combat.bite.intervalSec |
  | bite_damage | 30.0 | 10~90 / 5 | combat.bite.damagePerBite |
  | freeze_duration | 2.0 | 0.5~5.0 / 0.5 | combat.freeze.durationSec |
  | freeze_factor | 0.6 | 0.2~0.95 / 0.05 | combat.freeze.speedFactor |
  | sky_drop_interval | 12.0 | 4~24 / 1 | economy.skyDrop.intervalSec |
  | sky_drop_yield | 25.0 | 5~60 / 5 | economy.skyDrop.yield |
  | sunflower_interval | 10.0 | 1~20 / 1 | economy.sunflower.intervalSec |
  | sunflower_yield | 25.0 | 5~60 / 5 | economy.sunflower.yield |
  | sun_expire_sec | 8.0 | 3~15 / 1 | clickCollect.expireSec |
  | sun_fade_sec | 2.0 | 0.5~4 / 0.5 | clickCollect.fadeOutSec |
  | sun_tap_radius | 44.0 | 24~80 / 4 | clickCollect.hitRadiusPx |
  | cursor_move_speed | 520.0 | 120~900 / 20 | 工程内校准项 |
  | hint_show_seconds | 3.0 | 0.5~6 / 0.5 | 工程内校准项（操作提示停留秒数） |

  - URL 里未声明的键一律忽略，并在 diff 说明中标注；
  - 收到调参 URL → 解析 `?tuning=` JSON 与现值 diff → 经
    `POST /api/v1/game-design-specs/cmvyol366005wm9y0kzkdz57d/revisions` 入链
    （产生新版本，带 sourceTrajectoryId 溯源）→ approve 拍板 → 追加 `op=tuning_applied`
    产物回写；**下一轮工作流按新 spec 重部署，本节点不改代码默认值**。

## 4. 本节点收口状态

- 验收包交付 + 目标 artifacts 回写（op=playtest_kit，PATCH 合并不覆盖）= 本节点自主工作全部内容；
- 量表未回填 → spec revisions / approve / tuning_applied 三步**全部跳过**，不伪造；
- 用户结论属节点外人机回环：经目标迭代回流处理（四问面板中继留痕或直接回执两条通道均可）。

## 5. 证据文件清单（本目录 + 引用）

- `writeback-attempt.log` / `goal-patch-http.txt`：artifacts 回写请求与 HTTP 回执；
- `report-prehook-legacy.json`（复制自 preHook 原始回执）与 `qa/mobile/report.json`（校准复跑落档）
  + 三张分阶段截图（phase-load / phase-tap / phase-joystick）；
- 引用（不复制）：`qa/gate-logs/20261102-release-r6/mobile/report.json`（上一轮带校准存档对照）；
- 证据窗口声明：门禁证据（qa/mobile）与部署产物哈希比对均在 2026-11-02T12:43~12:52Z 窗口内
  本机实测；引用的 r6 存档为其落档时点证据。commit hash 以本轮收口提交为准（见 git log）。
