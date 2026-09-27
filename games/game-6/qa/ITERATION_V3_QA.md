# game-6 迭代 v3 复核轮 QA 取证（2026-09-27）

> 本轮性质：以上一轮（v2 磁吸/冲刺反馈链 + 美术提亮迭代）产物为基线的**独立复核 + 缺陷修复**。
> 取证方法：Godot Movie Maker 离屏逐帧抓帧（960×540）+ PNG 像素级取证 + 临时物理探针。
> 前后对比帧在本目录 `iteration-v3-evidence/`。

## 一、缺陷 ① 每局开屏「幽灵拾取」（修复前实机证据）

`before-phantom-dash-lit-frame1.png`（无输入开局 0.033s）：
- 距离 0m、无任何输入，HUD「冲 4.0s」已点亮 +「冲刺！」飘字 + 冲刺速度线；
- 下一局开屏同类触发变成磁铁 8s —— 白捡道具种类随局种子随机。

物理探针（修复前临时打印，已还原）：

```
[DBG] player frame=1 pos=(190, 268)          ← _ready 传送已生效
[DBG] body_entered kind=magnet frame=2 self=(120, 254) body_pos=(195.3333, 267.9253)
```

事件触发时玩家与道具圆心相距 **76.6px**（最大接触距离 = r22 + 玩家半宽 22 = 44px），
即「形状不相交仍发事件」—— 根因是 main.tscn 场景授权位 (140,268) 在首个道具圆内，
物理服务端对同帧「授权位入树 + _ready 传送」的配对同步滞后 1~2 步。

修复：场景授权位对齐 PLAYER_SPAWN (190,268)。
断言：smoke `_check_no_phantom_pickup`；负例探针改回 140 → `GODOT_SMOKE: FAIL …（幽灵拾取/
出生点压盒回归）：magnet=8.00 … frame=2`，还原 → PASS。

## 二、缺陷 ② 主角躯干被错位描边层盖成暗棕团（修复前像素取证）

`before-torso-dark-blob.png`：躯干区域直方图主色 `(96,52,21)` = OUTLINE(0.28,0.18,0.12)
× 冲刺调制 (1.35,1.15,0.7) 精确匹配；橙卫衣 `(255,182,45)` 为 0 像素。
探针：描边层临时染绿重渲染 → 整块暗影变绿（`暗影 = 描边层本体`）。
根因：`_build_block` 位移只设在填充层，描边层留在 holder 原点，头部描边圆（r≈16.6）叠死躯干。
修复：位移统一落 holder（`at` 参数 + HEAD_POS 常量）。
断言：player_move_contract 遍历 Outline↔Main 局部位移一致性 + 描边层数 ≥6。

## 三、修复后取证

- `after-clean-start-frame5.png`：距离 1m 时 HUD 三槽全灭、无飘字 —— 幽灵拾取消失。
- `after-player-closeup.png`：棕发 + 红发带 + 肤色脸 + 眼睛高光 + 橙卫衣（描边+高光）+ 蓝短裤 + 白鞋。

## 四、门禁（与门禁同源命令，本机实测）

| 步骤 | 结果 |
|---|---|
| preflight | PASS（13 类，76 文件） |
| GODOT_SMOKE_FRAMES=320 smoke | PASS（退出码 0，日志零 SCRIPT ERROR） |
| input-fuzz | PASS（seed=20260913） |
| 负例探针 | 幽灵拾取缺陷重现 → 冒烟 FAIL（精确签名）→ 还原复绿 |
| playtest | 模板仓库未预置 playtest.sh，延续上报，未伪造结果 |

## 五、真机验收状态（AC6 口径）

- **iOS Safari 真机实测：待验**。本轮视觉取证来自桌面离屏渲染（Movie Maker），
  不替代真机 —— 触屏跳跃/滑铲手势、移动端音频手势解锁、真机帧率仍需真机回填。
- 线上部署指纹核对（本轮部署后回填）：见下节。

## 六、部署指纹核对记录

- 部署前基线（复核轮实测，deployment v3 `cmujkhwcv001qm99ibwws5dv9` @ a08b6e3）：
  线上 `index.pck` sha256 `7986de20…`、`index.wasm` sha256 `fe5cebc5…`，
  与本地 HEAD 导出**逐字节一致**（base64+gzip 解码后比对）。
- 本轮修复后部署：**deployment `cmujm2j2d002am99iv7qtd572`（v6）** @ commit `50e90df`，
  gitRef `myrd/games-goal-cmuj6p1q2000em9hc4srodpkt`，liveUrl
  `https://leomac-studio.tail49399e.ts.net/apps/game-6/`（HostedApp `cmuj6p1py000cm9hcmqje9khr`）。
  `/health` 200；线上 `index.pck` sha256 `c1cd0342…`（2677200 字节）与本地 HEAD 导出**逐字节一致**。
- 过程性冗余部署 v4/v5（同 commit 50e90df，首次 API 调用未捕获响应与缺 triggeredById 的重试）
  已被 v6 正常 superseded —— 平台既有行为（知识文档 v3「504 冗余部署处置」口径）。
