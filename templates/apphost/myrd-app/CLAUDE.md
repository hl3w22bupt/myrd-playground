# myrd-app —— agent 操作指引

你是被 MyRD apphost 托管的应用的开发 agent。本文件是你在这套契约下工作的操作手册。

## 应用形态契约（违反 = 部署失败）

- **Node 20 + Hono (TypeScript)**，入口 `server/src/index.ts`，必须 `export default app`。
- 必须实现 `GET /health` → 200（平台健康探针依据）。
- **业务路由必须位于 `/api/*` 下**，否则 route analysis（部署步骤 4）直接判失败：
  - `/api/*` → 需要登录（平台网关在请求到达你的代码**之前** 401，你无需也无法自行关闭）
  - `/api/public/*` → 公开（登录可选，身份在 `x-myrd-user-id` 头，可能为空）
  - `/api/webhooks/*` → 免检（自行验签）
  - `/health` 与 `/` 是仅有的两个豁免路径。
- 用 `import { vars, secrets, ctx } from "#apphost"` 读平台注入物；
  可用的 key 只能是 `src/defs/runtime.ts` 里 `as const` 声明过的——拼错在类型检查阶段就失败。

## 大体积资产：出 bundle（小游戏 / 静态资源）

应用要带大文件（游戏 wasm/pck、素材包）时，**不要内联进 bundle**（bundle 上限 25MB，内联还会 b64 膨胀），走平台资产通道：

1. `apphost.toml` 声明资产目录（相对仓库根）：`assets_dir = "games/<slug>/export/web"`。
2. 部署时平台自动把目录内文件上传对象存储（`.wasm`/`.pck` 会 gzip），并注入 `APPHOST_ASSET_*` env。
3. server 里用平台模板模块读取：`import { getAsset, assetStoreConfigured } from "./lib/asset-store.js"`。
   路由示例：`const a = await getAsset(name); if (!a) return c.notFound();` →
   `a.encoding === "gzip+b64"` 时回 `text/plain` 的 base64（客户端解压），`"raw"` 时按 `a.contentType` 回原文。
4. **响应铁律：文本类 content-type**（`text/plain` / JSON / HTML / SVG）。`application/gzip|octet-stream|image/*`
   会被网关 502 拒（proxy 的二进制拦截），二进制一律 base64 文本回传。
5. `getAsset` 返回 null = 清单里没有（未声明 assets_dir 的部署 / 文件名错）→ 回 404，不要猜。
6. 未声明 `assets_dir` 的部署没有 `APPHOST_ASSET_*` env，`assetStoreConfigured === false`——
   此时按「小文件直接进代码/bundle」的旧方式处理。

## 部署-自测紧循环

1. 改代码 → `npm run typecheck`（本地先过一遍 tsc，别等部署报错）。
2. 提交并 push 到分支。
3. 部署（二选一）：
   - 平台 API：`POST /api/v1/apphost/apps/<appId>/deployments`，body `{"mode":"bundle","gitRef":"<分支>"}`（带平台 JWT）。
   - 让用户在 MyRD 控制台点「部署」。
4. 读响应：`status` 为 `running` → 拿 `liveUrl` 自测；为 `failed` → 读 `errorMessage`，
   按错误信息修复后从第 1 步重来（错误信息就是给你看的，别猜）。
5. `dryRun: true` 只跑校验（manifest / tsc / route analysis），不拉起实例——适合 CI 卡点。

## Secrets 人机分离（重要）

- **你可以注册 key 名，但永远拿不到、也不要尝试获取 secret 的值**：
  `POST /api/v1/apphost/apps/<appId>/secrets` body `{"key":"OPENAI_API_KEY"}`。
- 注册后告诉用户去 MyRD 控制台（或 API）填值；值填好并**重新部署**后才注入你的运行 env。
- 代码里用 `secrets.OPENAI_API_KEY` 读取；值不存在时它就是 `undefined`，请做防御处理。
- 不要把 secret 值写进日志、错误信息或返回体——平台会在构建日志里做脱敏，但别依赖兜底。

## 限制（M1）

- 应用被视为**无状态**：实例随部署重建，本地文件/内存数据不保留。需要持久化请用外部服务（连接串走 secrets）。
- 出口网络当前不限制（M1 简化），但请只调用必要的 API。
- 响应请返回 JSON/HTML/SVG 等文本类型；二进制（图片/文件下载）暂不被网关支持。
- 变更 vars/secrets 后需要重新部署才能生效。
