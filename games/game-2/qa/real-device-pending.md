# 《星尘收集者》真机待验记录 + 调参回填入口

> 给试玩者/验收人：照这份文件操作即可完成「真机试玩 → 记录 → 数值回填」全流程。
> 回填的数值由工程侧写回 `config/gameplay.cfg` 后重导出部署，**回填即触发 tuning_applied 处置**
> （详见第四节）。桌面侧已实测项的证据见 `measured-evidence.md`，真机操作细则见 `ios-checklist.md`。

## 一、试玩入口（线上 v7 部署，已核验含调参面板）

| 入口 | 地址 |
|---|---|
| 游戏地址 | `https://leomac-studio.tail49399e.ts.net/apps/game-2` |
| 调参工作台 | `https://leomac-studio.tail49399e.ts.net/apps/game-2?tuning=1`（打开即右上角面板） |
| 面板开关 | 桌面按 **T**；真机用带 `?tuning=1` 的地址打开 |
| 网络提示 | 该地址为 Tailscale 内网域名，请在可访问该域名的网络/设备上试玩 |

玩法：摇杆移动飞船收集星尘（+1 分），躲避陨石（-1 护盾，共 3 点）；护盾耗尽或达到目标分（默认 20）弹出结算，
「重新开始」/右下「确认」钮重开。

## 二、真机待验记录模板（复制填写）

```markdown
- 试玩人：           日期：           网络：
- 设备清单（每台一节）：
  - 机型：iPhone 13 / Pixel 7 …   系统：iOS 17.x / Android 14   浏览器：Safari / Chrome 版本
  - 清单结果：A 摇杆 A1-A8：pass/fail（失败编号+现象）
             B 确认 B1-B5：pass/fail
             C 音频 C1-C3：pass/fail；__audioDebug() JSON：<粘贴>
             D 安全区/横屏 D1-D6：pass/fail
             E 帧率 E1(平均/最低)：  /    fps；E2(平均/最低)：  /    fps；E3：pass/fail；E4：pass/fail
  - 证据：录屏链接/截图 ×N（每台至少覆盖 A3-A7、B2-B4 各一段）
- 好玩程度（playtest-kit 五维，各 1-5）：看懂 __  跟手 __  难度 __  反馈 __  想重开 __
- 调参链接：<从工作台「复制调参链接」粘贴，见第四节>
- 最想改的一件事：
```

判定基线：真机 P0 项全 pass（ios-checklist 判定节）+ 五维平均 ≥ 4.0 ⇒ 通过；
否则把「调参链接 + 抱怨原话」回填，进入第四节处置循环。

## 三、待回填 spec.numeric 数值表（17 键 = 面板全部滑杆）

当前值 = `config/gameplay.cfg` 默认（2026-09-27 基线）；量程 = 面板滑杆 min-max（step 内括号）。
回填列**只填真机试玩后确定的新值**；空 = 维持现值。方向建议引自 `playtest-kit.md` 第三节抱怨映射。

| # | 键 | 当前值 | 量程 | 调什么（试玩抱怨 → 方向） | 回填值 |
|---|---|---|---|---|---|
| 1 | max_crystals | 6 | 1-20 (1) | 晶体太难找 → ↑ | |
| 2 | max_asteroids | 5 | 0-20 (1) | 太简单闭眼玩 → ↑ | |
| 3 | score_per_crystal | 1 | 1-10 (1) | 没有爽点 → ↑（或配合 milestone_step ↓） | |
| 4 | damage_per_hit | 1 | 0-5 (1) | 被撞一下就没了 → ↓ | |
| 5 | initial_shield | 3 | 1-10 (1) | 被撞一下就没了 → ↑ | |
| 6 | player_speed | 240.0 | 80-600 (10) | 太滑/太飘 → ↓；指哪打哪不跟手 → 按 A4 实测调 | |
| 7 | asteroid_speed_min | 40.0 | 0-300 (5) | 没机会反应 → ↓ | |
| 8 | asteroid_speed_max | 110.0 | 10-400 (5) | 没机会反应 → ↓ | |
| 9 | respawn_delay_seconds | 1.5 | 0-5 (0.1) | 晶体断档 → ↓ | |
| 10 | difficulty_step | 8 | 0-30 (1) | 难度突变 → ↑；太简单 → ↓ | |
| 11 | difficulty_asteroids_per_level | 1 | 0-5 (1) | 难度太平 → ↑ | |
| 12 | difficulty_asteroids_cap | 10 | 1-30 (1) | 后期看不清 → ↓ | |
| 13 | difficulty_speed_per_level | 0.15 | 0-0.6 (0.05) | 陨石太快躲不开 → ↓ | |
| 14 | difficulty_speed_cap_scale | 1.8 | 1.0-3.0 (0.05) | 陨石太快躲不开 → ↓ | |
| 15 | score_target | 20 | 0-60 (1) | 目标太远 → ↓（0 = 无尽） | |
| 16 | milestone_step | 10 | 0-30 (1) | 反馈稀 → ↓（0 = 关闭） | |
| 17 | invincibility_seconds | 0.8 | 0-3 (0.05) | 连续受击挫败感强 → ↑ | |

## 四、回填流程（回填即触发 tuning_applied 处置）

```
真机试玩（ios-checklist A-E + playtest-kit 五维）
   │
   ① 面板调参：打开 ?tuning=1 → 拖滑杆到候选值（改数量类键自动重铺战场，即时可感）
   ② 复制链接：点「复制调参链接」→ 得到 ?tuning=1&key=value…（剪贴板被拒时面板会直接展示链接，手抄即可）
      —— 该链接再次打开即复现这套数值（回填闭环已由冒烟 F 段机判，见 measured-evidence.md §4.3）
   ③ 回填：把「调参链接 + 第二节记录 + 第三节表格回填值」贴回本文件对应试玩记录
   ④ tuning_applied 处置（工程侧自动接手）：
        回填记录登记 tuning_applied
          → 把定稿数值写回 config/gameplay.cfg（人改配置，不在面板里做；面板只改运行时内存，刷新即回 cfg 默认）
          → bash games/game-2/verify.sh（preflight/冒烟/fuzz 三段门禁）
          → 重导出 Web 产物并重新部署 → 通知试玩者在线上复测
   ⑤ 每组候选数值对应一条记录；定稿后回填表「回填值」列清空归档，cfg 成为新的当前值。
```

注意：`?tuning=1` 面板数值**只活在当前页面会话**（运行时覆盖），不写文件 —— 这是有意设计：
数值唯一来源始终是 `config/gameplay.cfg`，改配置即生效、无需改代码（需求验收标准 5）。

## 五、当前待验清单（提交本文件时点）

| 项 | 状态 | 责任 |
|---|---|---|
| ios-checklist A 摇杆 A1-A8 | 待验 | 真机试玩者 |
| ios-checklist B 确认 B1-B5 | 待验 | 真机试玩者 |
| ios-checklist C 音频 C1-C3（游戏内暂无 SFX，见 measured-evidence §5） | 待验 | 真机试玩者 |
| ios-checklist D 安全区/横屏 D1-D6 | 待验 | 真机试玩者 |
| ios-checklist E 帧率 E1-E4 | 待验 | 真机试玩者 |
| 音效上线后 C4 听感复测 | 待办（阻塞于 SFX 实现） | 工程 |
| 仓库内 export/web 产物重导出（现为旧快照，线上以部署管线重建为准） | 建议项 | 工程 |
| spec.numeric 17 键回填 | 待验（表见第三节） | 真机试玩者 → 工程 |
