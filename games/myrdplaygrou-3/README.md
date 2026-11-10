# 实况足球 · GOAL RUSH（myrdplaygrou-3）

3D 实况足球 · 休闲收集：带球推进、顺路捡金币、看准守门员空当起脚 —— **90 秒一局（1-3 分钟设计带），
进 3 球提前获胜**。竖屏手机优先（触屏摇杆），兼容键盘。

## 玩法

- **移动**：WASD / 方向键，或触屏左半屏虚拟摇杆 —— 球吸附在球员朝向前方（带球）
- **射门**：进入射程（z ≥ 8）后按 空格 / 触屏右半屏点按；拖到 z ≥ 13.5 会自动起脚兜底
- **收集**：场上 10 枚金币（+5 分/枚），进球 +100 分
- **胜负**：进 3 球立即获胜终局；时间耗尽时进球数 >0 也算获胜（平缓判定）
- **守门员**：三角波相位巡逻（确定性），圆碰撞扑救 —— 瞄空当、抓时机
- **暂停 / 重开**：P/Esc 或右上按钮暂停；R 重开（整局全复位）

## 架构（threejs-game-dev 技能包铁律）

```
src/
├── numeric.js      # 数值唯一来源（spec.numeric 镜像；手感调参全在此处）
├── kernel/         # 确定性内核：零 three/零 DOM/零系统随机/零系统时钟，Node 可直接跑
│   ├── rng.js      #   mulberry32（内核唯一随机源）
│   ├── world.js    #   球员/足球/金币/守门员/进球判定（纯函数 stepWorld）
│   ├── loop.js     #   固定步长累加器 + 四态状态机 + fastForward 无头钩子
│   └── autopilot.js#   贪心进攻自动驾驶（冒烟/确定性测试共用）
├── levels/level-01.js  # 场地障碍 + 金币布局（内核碰撞与渲染同源）
├── render/         # three 表现层（场景/程序化贴图/WebAudio BGM+音效/HUD/触屏）
└── main.js         # 装配根（?smoke=<秒> 无头冒烟协议内置）
```

## 构建与门禁

```bash
npm install --no-fund --no-audit
node tools/build.mjs                                  # 单文件产物 index.html + dist/web/{index,landing}.html
node tests/run-all.mjs                                # 构建复现→单文件契约→内核确定性→状态机→玩法契约
node ../../std-skills/threejs-game-dev/scripts/preflight.mjs .       # 静态前置检查
node ../../std-skills/threejs-game-dev/scripts/browser-smoke.mjs .   # CDP 真浏览器双视口冒烟
```

## 部署形态（AppHost myrdplaygrou-3）

仓库根 `apphost.toml` → `assets_dir = games/myrdplaygrou-3/dist/web`；
`landing.html` = 游戏本体单文件（server 壳 `/` 路由优先伺服）。
产物字节级同源于一次构建（SRC_SHA 指纹进产物注释，QA 可复算比对）。

## 调参

手感/难度参数全部收口在 `src/numeric.js`（PLAYER_SPEED / AIM_GAIN / KEEPER_SPEED / GOALS_TO_WIN /
ROUND_SECONDS 等）—— 需人工试玩校准，试玩结论以真实手感为准，禁止用「手感好」伪装已验收。
