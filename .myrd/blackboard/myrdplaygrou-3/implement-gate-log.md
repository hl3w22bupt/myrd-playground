# game-3（实况足球 · myrdplaygrou-3）implement 节点门禁取证

- run：cmwar74im003km9m2cwb92xkq ｜ 分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h
- 时间：2026-11-11 ｜ 最终产物 SRC_SHA=e3df74b489a5f153（571KB，指纹范围 src + index.template.html + tools/build.mjs + tools/src-sha.mjs）

## 本轮玩法补全（对照验收标准的差距收口）

| 差距 | 收口 | 数值落点（spec.numeric 同步） |
|---|---|---|
| 难度无梯度 | 守门员相位速度随进球梯度上调（×(1+0.15·进球) 封顶 ×1.4，峰值横移 5.4→7.6m/s < 玩家 9m/s），进球横幅提示「守门员提速」 | KEEPER_RAMP_PER_GOAL=0.15 / KEEPER_RAMP_MAX=1.4 |
| 收集循环枯竭 | 金币收集当步即补位，场上恒 10 枚；补位点确定性采样（避玩家 3m/同伴 2.5m/守门员带/训练桩，guard 600 兜底环带） | COIN_RESPAWN_MIN_PLAYER_DIST=3 / COIN_RESPAWN_GUARD=600 |
| 射门出界外静默失败 | 场地贴图画射程白虚线（z=SHOOT_MIN_Z 空间语义）+ 线前起脚底部提示（0.8s 节流） | （复用 SHOOT_MIN_Z） |
| 胜负反馈弱 | 结算屏胜「胜利！」强调橙 / 负「比赛失利」主色蓝 + 规则说明；最后 10s 时间徽章转橙 + 每秒滴答音 | — |
| 重开盲操作 | title/paused/gameover 实体按钮（热区 ≥44px）+ 原键盘/右半屏点按保留 | — |
| 竖屏死天空（上半屏 ~50% 空） | 机位重定：俯仰 ≈70°（FOV 66）整场充满画幅；机位与视线同 x（零偏航）；z 前限钳制（门线前 12m 锁进攻三区构图）；远环带延展入雾 | CAM_HEIGHT=24 / CAM_BACK=6 / CAM_AHEAD=2.7 / CAM_LATERAL=0.5 / CAM_FRONT_LIMIT=12 |
| 洗灰 | 主光 1.8→1.15、Bloom 0.3→0.22 半分辨率、雾 0.007→0.012、阴影贴图 2048→1024 | — |

## 内核纪律核对

- 数值全部进 src/numeric.js（本轮 +9 键），spec.numeric 逐键同步；kernel/ 零 three/零 DOM/零系统随机时钟（preflight P3 机判 PASS）
- keeperSpeedFor(goals) 纯函数导出；补位 rng 消费在同 seed 同输入下确定（contract 机判：30s 补位序列逐位一致）
- createWorld keeper 初始化器修正（keeper.x 与 phase=0 自洽，tri(0)=1→x=+R；原 0 值首帧渲染失真 + 步级测量虚假位移）
- 冒烟协议修正：snapCamera（dt=0 时 lerp 不推进，截图须落真实机位防对角线假象）；终局文案由内核终态装配（原 smoke 路径丢事件流，终局屏显示模板默认文案）；fps 采样加 6 帧预热（着色器编译尖峰不进样本，门禁意图=稳态帧率）

## 门禁读数（最终 SRC_SHA=e3df74b4 全实跑）

| 门禁 | 结果 | 关键读数 |
|---|---|---|
| GAME-GATES（tests/run-all.mjs） | PASS 5/5 | 构建复现两次哈希一致 / singlefile 571KB 零外链 / kernel-determinism（含补位 rng 流消费断言）/ state-machine（含重开后布局=新开局逐位一致）/ football-contract（30 断言：事件守恒+步级开球重置+补位约束+梯度接线实测） |
| PREFLIGHT | PASS 0 WARN | P1-P8 全过（钉版/内核纯度/四态/双端输入/画质四件套/零外链/工具链） |
| BROWSER-SMOKE | PASS | desktop fps 16.4 / mobile fps 14.2（预热采样）；exceptions=0；截图 15/19 种量化色非纯色；性能快照 drawCalls 66/70 triangles 6724/6908 |
| ASSET_TRIPLE_CHECK | PASS（退出码 0） | 清单 7 项全 programmatic+reason，零位图入包 |
| LAYOUT-PROBE（QA 取证，非门禁） | OK ×2 | 真机 390×844（Emulation 真视口）：playing 态无横向溢出/HUD 2 行/热区 ≥44px；title 屏段落全在视口内（headless --window-size 有最小窗宽 ~500，--screenshot 直拍是裁切假象，必须走 Emulation override） |

## 产物与证据落盘

- games/myrdplaygrou-3/index.html + dist/web/{index,landing}.html（字节级同源，勿手改）
- qa/smoke/{report.json, smoke-desktop.png, smoke-mobile.png}（62s 正式档双视口）
- qa/layout/{report.json, report-title.json, layout-390x844.png, title-390x844.png}
- tools/layout-probe.mjs：窄屏排版取证工具（**非门禁**，判定器只有仓库内 std-skills 三脚本）
- spec 验收新增：ac-difficulty-ramp / ac-coin-respawn（check 指向 football-contract.spec.mjs）；ac-football-loop 升级为步级精断口径

## 部署就绪（部署动作归宿主）

- 分支 myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h 已推；deploy_playable 参数不变：sourceId=cmwaqvrnc002jm9m2nqwfsoie，gitRef=本分支（显式传）
- 部署后 liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/
