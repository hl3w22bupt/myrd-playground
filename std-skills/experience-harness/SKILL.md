---
name: experience-harness
description: "体验证据包与浏览器交互会话：对部署后的 web 产物（游戏/应用）留证——带标签步骤截图、帧序列（录屏契约形态）、FPS 时间序列、网络瀑布、console 错误、逐步输入证据；以及常驻 headless Chrome 会话（看一步打一步）。只记录不判定（判定归 G3 判定层与人类），永不阻断工作流。当任务需要『看看产物长什么样/玩起来什么样』的证据时使用。"
---

# 体验证据 harness（experience-harness）

> 目标：让「看得见」成为可能。评估体系在「真/活」轴上有门禁（mobile-web-smoke 等），
> 在「体验」轴上需要的是**证据**——本技能只产证据，不打分、不拦截。
> 判定（审美/好玩）是判定层（G3）与人类的职责；**摄影师不当裁判**。

## 两个工具

### 1. pack.mjs — 批量证据包（离线消费：人看 / 判定器读 / 回归对比）

```bash
node scripts/pack.mjs --url <liveUrl> [--out <目录根，默认 ./qa/experience>] \
  [--scenario default|<scenario.json>] [--viewport mobile|desktop] [--label <标签>]
```

- 退出码 `0` = 证据包生成成功（**不代表页面合格**）；`1` = 生成失败；`2` = 环境不可用。
- 证据包落 `<out>/<时间戳>-<label>/`，布局与 pack.json 字段见 `references/scenario-format.md`。
- 每步截图 ≤720 宽、全部 PNG ≤5MB（image-read-guard 口径，可直接 Read 给视觉模型）、单包 ≤25MB。
- 场景（scenario）是游戏无关的动作脚本（tap/swipe/drag/pressKey/probe/wait/navigate/screenshot），
  同一 runner 服务 canvas 引擎页与纯 DOM 页；**不得往本技能里加引擎专属知识**。

### 2. sessiond.mjs + session-step.mjs — 交互会话（在线消费：试玩 agent 的手脚）

```bash
node scripts/sessiond.mjs --url <liveUrl> [--ttl 900] [--session-file <路径>]
#   → 就绪后打印 XH_SESSION_READY <会话文件>
node scripts/session-step.mjs --session <会话文件> --tap 195,422     # 单步，返回证据 JSON
node scripts/session-step.mjs --session <会话文件> --probe '<js 表达式>'
node scripts/session-step.mjs --session <会话文件> --status | --stop
```

- 试玩循环 = **看一步打一步**：读上一步返回的 `screenshot`（Read 图片）→ 决定下一步 → 打 → 再看。
- 每步返回：`screenshot`（steps/NNN-action.png，落会话状态目录）、`dom` 摘要、`inputArrived`、
  `frameDiff`、`responded`。
- 会话只绑 127.0.0.1 + 令牌（会话文件内）；stop / TTL / 信号三条路都回收 Chrome 与临时目录。

## 纪律（与平台门禁同源）

1. **只记录不判定**：pack.json 里没有任何「合格/不合格」字段，观测字段（色数/帧差/输入到达）
   只描述事实，怎么解读是消费方的事。
2. **脚本仓库版本化**：正本在平台仓 `std-skills/experience-harness/`（注入副本仅供阅读）；
   项目仓执行副本由模板仓预置——**被检方不得改写本技能脚本当自己的判定/取证依据**。
3. **自证**：`node scripts/selftest.mjs` 全本地（fixtures 内置伺服），负向夹具四类
   （没渲染/有画面不活/冻结/输入被吞）验证观测字段能如实区分——生成器不许瞎。改脚本后必跑。

## 谁消费这些证据

| 消费方 | 用法 |
|---|---|
| 人类 | 直接看 `steps/*.png` 与 `video/frames/`（帧序列逐张翻即录屏） |
| G3 判定层（审美官，advisory） | 读 pack.json（manifest+观测摘要）+ steps 截图，锚定 style card 出意见 |
| G4 试玩 agent | 用 sessiond/session-step 真实玩法取证（反应式） |
| 回归对比（视觉棘轮） | 相同 scenario 的两个证据包互 diff：画面改没改坏一眼可见 |

## 与既有门禁的分工

| | mobile-web-smoke（门禁） | experience-harness（本技能） |
|---|---|---|
| 职责 | 判定「移动端能不能玩」，不通过打回 | 记录「看起来/玩起来什么样」，永不拦截 |
| 输出 | PASS/FAIL + report.json | 证据包（无判定字段） |
| 触发 | workflow preHook（拦截语义） | routine `experience-pack`（gate: false）或手动 |
