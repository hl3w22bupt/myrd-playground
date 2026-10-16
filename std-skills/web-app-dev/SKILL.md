---
name: web-app-dev
description: "Web 小应用自主开发技能包：静态优先的工程脚手架规范、AppHost 托管壳契约（M1 网关文本通道）、移动端可用性门禁（webapp-smoke：headless Chrome 移动仿真机判网络/console/首屏内容/触摸管线/视口）与「失败 → 定位 → 修复 → 重跑」迭代循环。当任务是创建、实现、修复或验证浏览器里运行的 Web 小应用（工具 / 看板 / 表单 / 落地页等非游戏应用）时使用。"
---

# Web 小应用开发技能包（web-app-dev）

> 目标：让 agent 独立产出一个**浏览器里真能用**的 Web 小应用，而不是「看起来像应用的代码」。
> 通用 agent 写网页应用的三大死法——白屏（JS 挂了没内容）、移动端溢出（桌面视角写死宽度）、
> 资源路径 404（绝对路径 / 登录墙拦截）——全部靠**静态工程规范 + 部署后机判门禁 + 证据化修复循环**拦住。

---

## 0. 何时用本技能 / 资产清单

**触发**：任务是创建 Web 应用工程、实现功能、修 Web 应用 bug、或「让应用能用起来」。

**本技能目录**（注入到 `.myrd-platform/.claude/skills/web-app-dev/`，或仓库内 `std-skills/web-app-dev/`）：

| 资产 | 用途 |
|---|---|
| `scripts/webapp-smoke.mjs` | 移动端可用性门禁：headless Chrome 移动仿真（390×844 / 触摸 / iPhone UA）打开部署后的 liveUrl，机判网络全通 / console 零错误 / 首屏有内容 / 触摸管线 / 视口健康。零 npm 依赖（CDP 直驱 Chrome，Node ≥22） |
| `scripts/webapp_smoke_selftest.mjs` | 门禁自身的判定力回归（好页全绿 / 坏页因正确检查项失败）：改完判定器必跑 |
| `references/webapp-smoke-routine.md` | `.myrd/routines.yaml` 的 `webapp-smoke` 门禁 routine 片段（参数化模板） |

**判定脚本来源纪律（与 godot-game-dev 同源）**：门禁判定脚本只能来自**项目仓库内**
`std-skills/web-app-dev/scripts/`（模板仓库预置），agent 绝不自造、不改写、不用等价命令替代 ——
被检方自己写判定器，门禁就不再独立，PASS 一文不值。平台注入目录
（`.myrd-platform/.claude/skills/web-app-dev/`）里的脚本是**阅读副本**，不得当判定脚本来源。
脚本缺失 = 环境缺陷，回写 `status=blocked` 上报，不要现场补。

---

## 1. 工程形态：静态优先，别上构建链

**规则：Web 小应用默认是「零构建的静态工程」** —— `index.html` + `styles.css` + `app.js`
（原生 ES Modules），不用 React/Vite/webpack 等构建链。理由：

1. 无构建 = 无构建失败面：AppHost 构建只装壳依赖，不跑前端构建；
2. M1 网关只透传文本响应：`html/css/js/svg/json` 全部天然文本，直出即可；
3. 小应用的复杂度（工具 / 看板 / 表单 / 落地页）原生 DOM 完全够用；确需框架时先在
   产物说明里写明理由，且构建产物必须提交进仓库（AppHost 不执行 npm build）。

工程布局（`webapps/<slug>/`，相对仓库根）：

```
webapps/<slug>/
  index.html          # 入口：viewport meta 必写（移动端硬要求，门禁 warn 项）
  styles.css          # 样式：CSS 变量承载风格卡色板
  app.js              # 逻辑：ES Modules，无外部依赖
  .myrd/style-card.md # 项目风格卡（palette / ui / 禁忌三段，见 §3）
  qa/mobile/          # 门禁证据（report.json + 截图，随仓库提交）
```

## 2. AppHost 托管壳契约（部署上线）

部署走 `POST /api/v1/apphost/apps/:id/deployments`（`mode=bundle`、`gitRef=目标功能分支`），
仓库内壳工程（apphost.toml + server/）优先复制 `templates/apphost/myrd-app/`，没有就按契约直接写出：

- `apphost.toml`：`name` / `runtime=node20` / `health=/health`，并声明
  `assets_dir = "webapps/<slug>"`（应用静态文件出 bundle：部署时上传对象存储，不占 25MB bundle 上限）。
- `server/`：Node20 + Hono，入口 `server/src/index.ts`、`export default app`、实现 `GET /health`。
- **资产读取用平台模板的 asset-store**（`server/src/lib/asset-store.ts`）：`getAsset(name)` 懒加载，
  `gzip+b64` → 回 `text/plain` base64（壳端 DecompressionStream 解压）；`raw` → 按 contentType 回原文。
- **M1 网关只透传文本**：`png/jpg/webp/woff2` 等二进制**不能**由 server 直接回 —— 图片一律
  SVG / CSS 绘制 / 内联 data-URI，或经 asset-store 的 gzip+b64 文本通道由前端解压渲染
  （`Uint8Array` → `Blob` → `URL.createObjectURL`）。直接回二进制 = 网关 502 UNSUPPORTED_BINARY。
- **页面内资源一律相对路径**（`./styles.css`、`api/public/assets/xxx`）：公网入口是
  `/apps/<slug>` 子路径，绝对路径（`/styles.css`）会 404 或被登录墙拦下 —— 白屏高发根因。

## 3. 风格卡与排版底线（观感不翻车的硬约束）

每个工程必须有 `.myrd/style-card.md`（palette / ui / 禁忌反例三段），且 **palette 以用户拍板的
视觉风格为基准**（创建向导的决策里带色板，可微调明度饱和度，不得换风格方向）。排版硬底线：

- 字号三档：标题 / 正文 / 辅助信息按比例（如 24 / 16 / 13px），正文行高 ≥1.5；
- 正文行长 ≤ 70 字符等价宽度，移动端单列布局，内容区左右留白 ≥ 16px；
- 对比度：正文与背景 ≥ 4.5:1（WCAG AA），辅助信息 ≥ 3:1；
- 无横向溢出（`scrollWidth ≤ clientWidth`）：禁止固定宽度大于视口的元素，图片 `max-width: 100%`；
- 交互元素命中区 ≥ 44×44px（移动端手指），按钮三态（默认 / 悬停 / 激活）齐全。

## 4. 验证协议：webapp-smoke 门禁

部署后的权威机判（判定协议：退出码 0 = 通过；1 = 门禁失败；2 = 环境不可用 —— 装 Chrome，
不要改代码）：

```bash
node std-skills/web-app-dev/scripts/webapp-smoke.mjs --url <liveUrl> --out webapps/<slug>/qa/mobile
```

检查项：网络全通（关键资源无 5xx/404/登录墙）/ console 零错误 / 首屏有内容（截图非纯色 +
DOM 非空）/ 触摸事件到达 DOM / 无横向溢出。证据落 `qa/mobile/`（report.json + 分阶段截图），
随仓库提交。诊断顺序：`report.json` 的 `networkFailures`（相对路径 / 资产清单）→
`consoleErrors`（JS 崩溃）→ `metrics`（colorCount=1 即白屏）→ 截图定位。

**修复循环**：门禁 FAIL → 读证据定位 → 修工程 / 壳 → 重新部署 → 重跑门禁；最多 3 轮仍 FAIL
→ 回写 `status=blocked` 并附证据路径。禁止：改判定脚本、把断言改松、伪造 PASS、跳过门禁交付。

## 5. 迭代纪律

- 每次改动后本地自检：`node` 起一个静态伺服（如 `npx serve`）打开自查再提交 —— 门禁跑的是
  部署后 URL，本地先过一遍能省一轮打回；
- 用户反馈的问题走目标迭代回流：修 → 部署 → 门禁复绿 → 回写产物；
- 数据留存按拍板决策执行：本地保存 = `localStorage`（键名加应用前缀防串味）；导入导出 = 文件
  下载 / `FileReader`；无状态 = 不写任何持久化。
