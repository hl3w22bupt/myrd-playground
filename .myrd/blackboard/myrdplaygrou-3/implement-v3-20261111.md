# v3 全链收口记录：《实况足球》缺陷修复 + 新手引导 + 打磨项（implement-v3 → deploy → playtest，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；代码收口 HEAD=**c906e96**，取证收口 HEAD=**d76b72a**（远端同步）
- 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn，approved）+ 缺陷单 cmwbumwrj000qm9bb4s5v0lm6（抢断切换闪烁卡顿）/ cmwbumwtv000sm9bbmm3zs0kc（传球切换无可发现性）
- 前置处置：上轮 stalled run **cmwbl6h6e008am97aetlijmmv** 实查=completed 终态（08:16:52Z，非在飞），无双 run 并飞风险，免 cancel；其遗留=shutdown checkpoint 提交 d7dc434（v3 实现半成品，working tree clean）

## ① checkpoint 遗留盘点（先核对后动手）

- 已立：selection-ring.js（全场唯一池化环全套规范）、教学卡/常驻标签/气泡（index.template.html + hud.js）、蓄力音调/hit-stop/BGM duck/比分弹跳（audio.js/main.js）、kernel 庆祝冻结、numeric.js v3 镜像、kernel-determinism 已适配庆祝头顶
- 缺口三件（本轮补齐）：
  1. **hud.flashBanner 丢失**——checkpoint 重写 hud.js 时把 goal 横幅方法从返回 API 掉了，main.js 仍调用 → goal 事件抛 TypeError → 冒烟快进中断 → browser-smoke 双视口 timeout（**门禁红镜像根因**，实局则表现为进球无横幅）
  2. **football-contract 未适配庆祝冻结**——自动驾驶循环恰跑 90s 固定步，进球庆祝冻结秒数不消耗比赛时间 → 永不 gameover（2 断言 FAIL）；修法与 kernel-determinism 同形：循环上限 90+30s（spec 120s 产品窗）
  3. **spec 镜像停在 v2**——.myrd/spec/design-spec.json 无 v3 章节/实体/验收，本轮升 v3 全量对齐（v3Delta+onboarding/selectionHighlight/gameFeel+4 实体+8 验收+goal-net-texture 回补登记，round-7 遗漏）

## ② 门禁（全部本轮实跑）

- tests/run-all：**7/7 PASS**（smoke-payload 扩 v3 断言面：切换单环 instanceCount=1/switchCount≥1、教学卡+双按钮、常驻标签 移动/传球/射门、庆祝冻结、再来一局主按钮）
- preflight：PASS（21 项 0 WARN）；asset-triple-check：PASS（7 项 programmatic）
- browser-smoke：双视口 PASS（12.4/13.2 fps，exceptions=0，52/38 色）——flashBanner 修复后复跑由 FAIL 转 PASS
- 构建复现：PASS（SRC_SHA=d9e8dca0a0ec8e18，606,863B ×2 逐字节一致）

## ③ 部署链（v10）

- c906e96 推送 → POST /api/v1/apphost/apps/cmwaqvrnc002jm9m2nqwfsoie/deployments {gitRef=本分支, manifestPath=games/myrdplaygrou-3/apphost.toml}
- 首发 **cmwc1029w** HTTP 422 failed：`git clone --depth 1 --branch` exit 128（推送 tip 与构建侧 clone 疑似竞速的瞬时失败，如实留痕）
- 重发 504（网关 30s 截断判例形态，已受理）→ **v10=cmwc10na3000qm9bh18cu3lvp** 轮询 running，commitHash=c906e96f 与推送 HEAD 全等；v9（cmwbubpyu）转 superseded
- 线上复证：GET /health 200；GET / 200=606,863B 与 dist/web/index.html **逐字节一致（cmp）**；liveUrl=https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/

## ④ 试玩取证（round-10/11/12）

- 线上 mobile 门禁：MOBILE_SMOKE PASS（10 PASS + 1 WARN=--project 读 Godot 字段的结构性降级，与 v9 同形态）
- 取证包 mobile（v3 专用场景 14 步）：教学卡 tutorialVisible=true/四操作/双按钮 → 三常驻标签 visible + 已读标记写入 → 倒计时走表 88.4→80.1→72.5 → 环数恒 1/切换 5 次/气泡文案在链 → consoleErrors=0
- 取证包 desktop（default 场景 8 步）：consoleErrors=0
- sessiond 实局 12 步：跳过路径开局（已读标记同步写）、摇杆推进（MF#3→FW#5 持球至进攻半场）、射门沿、切换 15 次全程单环恒定（缺陷单 cmwbumwrj 线上不复现）
- playtest-summary：rounds=12/screenshots=37/consoleErrors=0/versionSha=d76b72a2，**valid=false 唯一 C4**（平台级 schema 漂移：mobile-web-smoke 写 {id,label,status} vs playtest-summary 读 c.name/c.pass，判定器红线禁改；原始 touch-pipeline/touch-response=pass 在档）——回写 autoPassSuggested=false + 完整归因
- visual-ratchet（advisory）：OK——v9→v10 移动配对 1 对 0 回归（摇杆态 0.7188≥0.7）；初始画面未配对=v3 教学卡刻意重设计（MAPPING.md 在档）

## ⑤ 判定器/门禁配置零触碰声明

- std-skills/threejs-game-dev/scripts/ 6 件判定脚本零改动；.myrd/routines.yaml 零改动；改动全部在 games/myrdplaygrou-3/{src,tests,index*,qa,.myrd/spec}

## ⑥ 如实透出

- 实局进球庆祝线上实拍未捕获（sessiond 两脚射门未进）；以 ?smoke 确定性取证四要素同框 + 内核契约断言（celebrationLeft）为准
- 手感听感（蓄力升调/hit-stop/BGM duck）机判面只锚数值与代码位，人工量表待用户打分卡（不重发不代答）
- 平台 spec v3 levels 2~5 关卡递进维持既有披露：可玩面=90s 单局 level-1 语义 + v3 引导/切环/打磨层
