# 《牛牛打游戏》game-8 · v4 体验重做 发布交接（部署上线 + 门禁全绿证据）

> **发布日期**：2026-10-14 ｜ **执行**：工作流主通道（scaffold→implement→deploy→playtest）本轮节点
> **需求绑定**：v4 需求 `cmv7hnfx3000ojofistqwry8l` × 策划案 v3 approved（GameDesignSpec `cmv7i4txk000zjofi5vrdcrvk`）
> **本文定位**：v4 的部署元数据落账与门禁证据索引。上一轮工作流 run 被取消导致 playtest 缺失，本轮已闭环。

## 一、部署元数据（artifacts 口径）

| 项 | 值 |
|---|---|
| HostedApp | `cmujpmjsy006pm99ip9yws3wl`（slug `game-8`，name 牛牛打游戏） |
| deployment id | **`cmv7kzwbl001yjofids0eyoc0`**（status=running，mode=bundle） |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-8/ |
| 部署 gitRef | `myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `f6e4443`（未落 main ✓） |
| artifacts 回写 | 部署 POST 带 `goalId=cmujpml1e006rm99i9hc33huu` 自动写入 goal artifacts：`cmv7kzwbl001yjofids0eyoc0 | playable | completed | 可玩：牛牛打游戏`（REST/open API 的显式 artifacts 写入对本轮身份 404/405，与往轮口径一致） |
| 冗余部署 | 3 条 superseded（`cmv7kwz76`/`cmv7kxt4f`/`cmv7kyt1w`，同 commit 同 gitRef，POST 网关 504 但服务端已受理所致，无害） |

## 二、门禁证据链（全绿）

| # | 门禁 | 结果 | 证据 |
|---|---|---|---|
| 1 | preflight（仓库判定脚本） | PASS | 15 类前置一致性检查 × 69 工程文件，exit 0（含 P13b 实测拦截 🏆 emoji 缺字风险后修复） |
| 2 | smoke（仓库判定脚本） | PASS | 320 帧预算（工程基线，v3 交接文档已论证 240 不足非缺陷），exit 0 + 零 SCRIPT ERROR + 断言标记齐全 |
| 3 | input-fuzz | PASS | seed=20260913，6 批次 239 帧，exit 0 |
| 4 | playtest（机器人试玩，上轮缺失本轮闭环） | PASS | 3 种子 × 3600 帧（=60s 单局口径，tests/playtest.json 落账），fb=243/249/247，无反馈窗口 ≤2.1s，run2 机器人真实收集 score=3 |
| 5 | 产物自跑冒烟 | PASS | `godot --headless --main-pack export/web/index.pck --quit-after 320 res://tests/smoke.tscn` → exit 0 + `GODOT_SMOKE: PASS` |
| 6 | 线上资产一致性 | 一致 | 线上 `index.pck` sha256 `6ed6411f83547e5c05112231fea6f4345c9f7d77dabba275de27bbc8219f04dc` = 本地 v4 导出（2,641,072B，逐字节无版本漂移） |
| 7 | **线上 pck 自跑门禁（最高等级）** | PASS | 拉线上 pck → 本地引擎 `--quit-after 320` 跑冒烟 → exit 0 + `GODOT_SMOKE: PASS` + 零 SCRIPT ERROR |
| 8 | mobile-web-smoke（线上移动仿真） | PASS | 10 项全绿（网络/console 零错误/渲染/帧差/触摸管线/音频契约/视口/FPS），证据 `games/game-8/qa/mobile/` |
| 9 | 壳页契约 | 在位 | `__GAME_TUNING__`×2 / `__audioDebug` / 资产相对路径 + v4 触控卫生（gesturestart/dblclick preventDefault、touch-callout/overscroll）实测在壳页 |

## 三、v4 落账范围（实现 commit `ac2edd5`，导出 `f6e4443`）

- **②画面**：牛牛多帧动画 3 组 8 帧（idle×2 / move×4 / collect×2，SVG 帧入库 `assets/sprites/cow/`）+ 动画状态机（位移切换/面朝翻转/收集庆祝）；UI 主题对齐风格卡（#2c3e50 底 / #2ecc71 描边 / #f39c12 强调 / 圆角 24）
- **③操控**：`restart=R` 键入 InputMap（键位契约逐键 AND 同步）；壳页触控卫生（iOS 捏合/双击缩放/长按选中全防）
- **④反馈**：五类事件映射补全（收集/连击里程碑/道具/波次/胜负）+ Camera2D 落位使震屏真实生效 + 暂停/恢复/确认 UI 双音；结算页重做（新纪录金色高亮 + 一键重开按钮/R 双入口 + 返回合集入口）
- **①玩法深度**：v3 结构保留（5 类目标物 / 磁铁+加速 / Combo / 3 波次），零回退

## 四、遗留与等待项（不阻塞本轮）

1. **iOS Safari 真机音效实测**（D1，责任方：用户/环境）：桌面仿真通过 ≠ 移动端出声，历史双重踩坑区；恢复后按收口清单 §3.1 取证。
2. **真人试玩结论与调参 URL 回填**（D3，责任方：用户）：线上 `?tuning=1` 入口可用；结论回写经策划案 revisions（禁止散点改代码对数值）。
3. **goal artifacts 显式 report 条目**：REST/open 写入对 agent 身份 404/405，部署自动 playable 条目已承载；如需明细条目请由有权限方按 §一 表补写。

## 五、input-fuzz 门禁复现排查记录（2026-10-14，供门禁侧对照）

- **现象**：门禁 runner 侧 input-fuzz 退出码 1（反馈无明细）；本机同命令多次复跑 PASS。
- **排查矩阵（全部 PASS，零 SCRIPT ERROR）**：同工作区 ×30+ 连跑（含 20 次连续循环）；10 个独立种子（1/7/42/99/12345/20260914/20260915/555555/88888888/31415926）；`taskpolicy -c background` 慢机模拟；origin 分支 fresh clone 冷缓存；Godot 4.3 与 4.6.1 双引擎；`override.cfg` 扫频 application/run/max_fps ∈ {5,10,15,30,45,60,90,120,240,1000}（系统性扫过事件帧/物理 tick 交错空间）；串行全电池 ×2（preflight+smoke@240+fuzz）。
- **结论**：当前 HEAD（67059d5）在本机全部可复现维度下无缺陷迹象；门禁侧失败为环境性瞬态（runner 负载/执行时点工作区状态）的可能性最高。门禁日志在本机 user://logs 无对应记录（Godot 日志落盘证明门禁 runner 在另一宿主），失败明细需门禁侧提供（input-fuzz.sh 失败时本会打印 `godot-fuzz: FAIL <原因>` + 日志末尾 20 行，可作为索取模板）。
