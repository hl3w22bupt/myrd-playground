# 直通车推送记录 · iOS 真机两开关解锁清单 + 试玩/调参回填入口（2026-09-27）

> 换思路：不再被动等待真机实测自动跑通，**主动**在目标频道向用户推送一条可执行消息。
> 本文件是该次推送的落盘存档（频道、消息 id、正文全文），便于后续审计与下轮引用。

## 1. 为什么推

`real-device-ios-20260927.md` 已证死：部署侧与代码侧全部就绪（线上 200、`gw/health` ok、
三件套资产可拉取），唯一阻塞是 **两个必须人工在系统设置里打开的开关**。自动化无法替用户开，
因此改为把「解锁步骤 + 试玩入口 + 回填模板」打包成一条消息推到用户面前，把等待变成可执行动作。

## 2. 推送落点

| 项 | 值 |
|---|---|
| 频道 | 星尘收集者 · 试玩反馈（`cmuiseju600brm9l6z7xh107f`，private，projectId=cmuiepud4001tm9gy0i5pk686） |
| 建频道方式 | `POST /api/v1/channels`（沿用 game-3《疾风忍者跑 · 试玩反馈》/ game-4《光路谜阵 · 试玩反馈》既有模式，game-2 此前无频道） |
| 消息 | `cmuisflq400bvm9l6xdcm1kkg`（type=text，1788 字符，2026-09-26T19:33:48Z） |
| 发送接口 | `POST /api/v1/channels/{channelId}/messages` |

备注：探测 `POST /api/v1/channels` 字段校验时误建过一个空频道 `cmuisclzw00bkm9l6374dnkye`，
已即时 `DELETE` 回收，未产生任何消息。

## 3. 消息正文（全文存档）

🎮 **《星尘收集者》iOS 真机实测只差两个开关**（人工约 2 分钟）+ 试玩/调参回填入口

部署与代码侧已全部就绪（线上 200、资产/健康检查全通），卡住的只是下面两个**必须人工打开**的开关，二者缺一不可（实测两种报错互补出现，已证实相互独立）。

**① 请开这两个开关**

1. **Mac 侧**：终端执行 `sudo safaridriver --enable`，回车后输入管理员密码
   （等同 Safari 设置 → 开发者 → 勾选「允许远程自动化」）
   ↳ 对应报错：`You must enable 'Allow remote automation' in the Developer section of Safari Settings`
2. **iPhone 侧**：设置 → Safari → 高级 → 打开「**网页检查器**」（同页「远程自动化」保持开启）
   ↳ 对应报错：`Web Inspector is not enabled on device`

**⚠️ 勘误（上一轮任务简报有误，已实测纠正）**
- `safaridriver` **没有 `--device` 参数**（实测 `unrecognized option '--device'`），选设备改用会话能力 `safari:deviceUDID`
- 真机 UDID = `00008140-000438141EA2801C`（简报给的 `09A8F8BF-2765-5EA4-9DAF-138F0DA8A574` 是 CoreDevice id，传给 `safari:deviceUDID` 匹配不到设备）

开关打开后即可直达实测（无需再排查）：
```bash
safaridriver -p 1337 &
curl -s -X POST http://127.0.0.1:1337/session -H 'Content-Type: application/json' \
  -d '{"capabilities":{"alwaysMatch":{"browserName":"safari","safari:deviceUDID":"00008140-000438141EA2801C"}}}'
```
完整操作手册（含全部报错原文）：`games/game-2/qa/real-device-ios-20260927.md`（commit `3e9ce70`）

**② 试玩 / 调参回填入口**
- 试玩：https://leomac-studio.tail49399e.ts.net/apps/game-2/
- 调参工作台：https://leomac-studio.tail49399e.ts.net/apps/game-2/?tuning=1 （打开即右上角面板；桌面也可按 **T**）
  改动后在面板点「**复制调参链接**」，把链接贴回本频道即可回填（契约形态 `?tuning=<json>` 与扁平形态 `?tuning=1&键=值` 均已支持）
- 网络提示：Tailscale 内网域名，iPhone 需在同一 Tailscale 网络；17 键数值表见 `games/game-2/qa/real-device-pending.md` 第三节

**③ 请按此模板回填**（操作 / 音效 / 数值三段结论 + 是否达成）

```
- 试玩人 / 日期 / 网络：
- 【操作】A 摇杆 A1-A8：pass/fail；B 确认钮 B1-B5：pass/fail（fail 写编号+现象）
- 【音效】C1-C3 首手势解锁：pass/fail；C4 听感：pass/fail；__audioDebug() JSON：<粘贴>
- 【数值】想改的键 + 新值（或直接贴调参链接）；最想改的一件事：
- 是否达成（判定基线：真机 P0 全 pass + 五维平均 ≥ 4.0）：达成 / 未达成 / 未验
```

一句话路径：**开两个开关 → 点链接试玩 → 按模板回填**。回填一到，工程侧即写回 `config/gameplay.cfg` 并重导出部署（tuning_applied 处置）。

## 4. 用户侧下一步（一句话路径）

**开两个开关 → 点链接试玩 → 按模板回填**。
回填（数值或调参链接）一到，工程侧写回 `config/gameplay.cfg` → 重导出 → 重部署，按 tuning_applied 处置。

## 5. 本轮引用的权威物料

- `games/game-2/qa/real-device-ios-20260927.md`（commit `3e9ce70`）：两个开关的确切报错与解锁步骤、
  `--device` 勘误与真机 UDID `00008140-000438141EA2801C`
- `games/game-2/qa/real-device-pending.md`：试玩入口表 + 17 键数值回填表 + 待验记录模板
- `games/game-2/qa/ios-checklist.md`：A/B/C/D/E 判定基线（真机 P0 全 pass + 五维平均 ≥ 4.0）
- 线上入口：`https://leomac-studio.tail49399e.ts.net/apps/game-2/`；调参页加 `?tuning=1`
