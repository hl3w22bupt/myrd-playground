# 实况足球 · GOAL RUSH（myrdplaygrou-3）

3D 实况足球 · 休闲收集：带球推进、顺路捡金币、看准守门员空当起脚 —— **90 秒一局（1-3 分钟设计带），
进 3 球提前获胜**。竖屏手机优先（触屏摇杆 + 实体按钮），兼容键盘。

## 玩法

- **移动**：WASD / 方向键，或触屏左半屏虚拟摇杆（带可视化锚环）—— 球吸附在球员朝向前方（带球）
- **射门**：带球**压过场地白虚线**（z ≥ 8）后按 空格 / 触屏右半屏点按；线前起脚会有底部提示；
  拖到 z ≥ 13.5 会自动起脚兜底
- **收集**：金币**场上恒 10 枚，捡到即补位**（+5 分/枚，补位点确定性采样、不白给），
  收集循环贯穿全局长
- **进球**：+100 分；**每进 1 球守门员提速一档**（相位速度 ×(1+0.15·进球)，封顶 ×1.4，
  峰值横移 ≈7.6m/s 始终追不上 9m/s 的球员 —— 平缓大众的成功驱动梯度，并有横幅提示）
- **胜负**：进 3 球立即获胜终局；时间耗时时进过球即算获胜；**整场未破门 = 失利**
  （结算屏胜=强调橙 / 负=主色蓝，一眼可辨）
- **紧迫感**：最后 10 秒时间徽章转橙 + 每秒滴答音
- **暂停 / 重开**：P/Esc 或右上按钮暂停；R 重开；title/paused/gameover 屏均有实体按钮（热区 ≥44px）

## 难度曲线（平缓大众）

开局最平缓（守门员基准相位速度 0.45，峰值横移 ≈5.4m/s）；进球越多守门员越快（梯度只奖励成功，
不惩罚挣扎玩家）；封顶后峰值 ≈7.6m/s 仍低于球员 9m/s —— 永远可以把他晃开。全部数值在
`src/numeric.js`（KEEPER_SPEED / KEEPER_RAMP_PER_GOAL / KEEPER_RAMP_MAX），需试玩校准。

## 架构（threejs-game-dev 技能包铁律）

```
src/
├── numeric.js      # 数值唯一来源（spec.numeric 镜像；手感/难度/机位调参全在此处）
├── kernel/         # 确定性内核：零 three/零 DOM/零系统随机/零系统时钟，Node 可直接跑
│   ├── rng.js      #   mulberry32（内核唯一随机源）
│   ├── world.js    #   球员/足球/金币补位/守门员梯度/进球判定（纯函数 stepWorld + keeperSpeedFor）
│   ├── loop.js     #   固定步长累加器 + 四态状态机 + fastForward 无头钩子
│   └── autopilot.js#   贪心进攻自动驾驶（冒烟/确定性测试共用）
├── levels/level-01.js  # 场地障碍 + 金币布局/补位采样（内核碰撞与渲染同源）
├── render/         # three 表现层（场景/程序化贴图/WebAudio BGM+音效/HUD/触屏/摇杆可视化）
└── main.js         # 装配根（?smoke=<秒> 无头冒烟协议内置，payload 含排版溢出指标）
```

## 构建与门禁

```bash
npm install --no-fund --no-audit
node tools/build.mjs                                  # 单文件产物 index.html + dist/web/{index,landing}.html
node tests/run-all.mjs                                # 构建复现→单文件契约→内核确定性→状态机→玩法契约
node ../../std-skills/threejs-game-dev/scripts/preflight.mjs .       # 静态前置检查
node ../../std-skills/threejs-game-dev/scripts/browser-smoke.mjs .   # CDP 真浏览器双视口冒烟
node ../../std-skills/threejs-game-dev/scripts/asset-triple-check.mjs --game . --spec .myrd/spec/design-spec.json
```

## 部署形态（AppHost myrdplaygrou-3）

仓库根 `apphost.toml` → `assets_dir = games/myrdplaygrou-3/dist/web`；
`landing.html` = 游戏本体单文件（server 壳 `/` 路由优先伺服）。
产物字节级同源于一次构建（SRC_SHA 指纹进产物注释，QA 可复算比对）。

## 调参

手感/难度/机位参数全部收口在 `src/numeric.js`（PLAYER_SPEED / AIM_GAIN / KEEPER_SPEED /
KEEPER_RAMP_* / GOALS_TO_WIN / ROUND_SECONDS / CAM_* 等）—— 需人工试玩校准，试玩结论以
真实手感为准，禁止用「手感好」伪装已验收。
