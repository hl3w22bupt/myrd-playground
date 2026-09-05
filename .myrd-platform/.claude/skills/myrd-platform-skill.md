# MyRD Platform Skill

> **平台使用说明书** — 帮助 AI Agent 理解和使用 MyRD 研发工作流自动化平台。
>
> 所有 API 基于 III Engine，通过统一的 HTTP 接口对外暴露。

---

## 一、基础信息

### 1.1 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| III Engine (API 网关) | `http://localhost:3111` | 所有 API 入口 |
| 前端 (Next.js) | `http://localhost:3001` | 用户界面 |
| 数据库 (PostgreSQL) | `localhost:5432` | 数据持久化 |
| MyAgent (AI 引擎) | `http://localhost:3000` | AI 执行引擎 |

### 1.2 认证方式

所有受保护 API 使用 **JWT 认证**，通过 `Authorization: Bearer <token>` 请求头或 `token` Cookie 传递。

**Token 有效期**: 7 天。过期后需重新登录。

---

## 二、登录与获取 Token

### 注册第一个用户（初始管理员）

```bash
curl -X POST http://localhost:3111/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password",
    "name": "Admin"
  }'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "user": { "id": "user_xxx", "email": "admin@example.com", "name": "Admin", "role": "admin" },
    "isFirstUser": true,
    "token": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

> 第一个注册的用户自动成为 `admin`。后续注册的用户默认为 `developer`。

### 登录获取 Token

```bash
curl -X POST http://localhost:3111/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "user": { "id": "user_xxx", "email": "admin@example.com", "name": "Admin", "role": "admin" },
    "token": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

### 获取当前用户信息

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3111/api/v1/auth/me
```

### 退出登录

```bash
curl -X POST -H "Authorization: Bearer <token>" http://localhost:3111/api/v1/auth/logout
```

---

## 三、通用规则

### API 路径格式

```
/api/v1/{资源名}[/{资源ID}][/{动作}]
```

### 请求头

| 请求头 | 说明 | 是否必须 |
|--------|------|----------|
| `Authorization: Bearer <token>` | JWT Token | 是（登录/注册除外） |
| `Content-Type: application/json` | 请求体格式 | POST/PUT/PATCH 需要 |

### 统一响应格式

**成功**：
```json
{ "success": true, "data": { ... } }
```

**错误**：
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误描述",
    "requestId": "req_1234567890"
  }
}
```

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未认证 / Token 无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如邮箱已注册） |
| 500 | 服务器内部错误 |

### POST 请求体

所有变更操作（创建、更新）使用 JSON 请求体。Query string 和 path params 用于筛选和定位资源。

---

## 四、角色权限体系

**两个独立的角色维度**，切勿混淆：

| 维度 | 来源字段 | 层级 | 值 |
|------|----------|------|-----|
| 账户级（系统）角色 | `User.role` | 跨项目 | `viewer` / `developer` / `admin` |
| 项目内角色 | `ProjectMember.role` | 单个项目 | `viewer` / `developer` / `admin` / `owner` |

权限边界：

| 操作 | admin（系统） | developer（系统） | viewer（系统） |
|------|-------------|-----------------|---------------|
| 查看所有项目 | ✅ | ❌（仅已加入的） | ❌（仅已加入的） |
| 创建项目 | ✅ | ✅ | ❌ |
| 管理账户/角色 | ✅ | ❌ | ❌ |
| 查看/编辑项目内容 | 视项目内角色而定 | 视项目内角色而定 | 视项目内角色而定 |

---

## 五、API 分类概览

### 5.1 用户与认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录获取 Token |
| POST | `/api/v1/auth/register` | 注册新用户 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| PATCH | `/api/v1/auth/me` | 更新个人信息 |
| POST | `/api/v1/auth/logout` | 退出登录 |

### 5.2 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 获取项目列表 |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/:id` | 获取项目详情 |
| PATCH | `/api/v1/projects/:id` | 更新项目 |
| DELETE | `/api/v1/projects` | 删除项目（需要 `{ "ids": [...] }`） |
| POST | `/api/v1/projects/pin` | 置顶项目 |
| POST | `/api/v1/projects/unpin` | 取消置顶 |
| GET | `/api/v1/projects/:id/members` | 项目成员列表 |
| GET | `/api/v1/projects/:id/resources` | 项目资源列表 |
| GET | `/api/v1/projects/:id/routines` | 项目流程模板列表 |

### 5.3 Bug 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/bugs` | Bug 列表（支持分页和筛选） |
| POST | `/api/v1/bugs` | 创建 Bug |
| PUT | `/api/v1/bugs` | 更新 Bug（需要 `{ "id": "...", ... }`） |
| DELETE | `/api/v1/bugs` | 删除 Bug(们)（需要 `{ "ids": [...] }`） |
| PATCH | `/api/v1/bugs/status` | 批量变更 Bug 状态 |
| POST | `/api/v1/bugs/run` | 执行/触发 Bug 自动化流程 |

### 5.4 需求管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/requirements` | 需求列表 |
| POST | `/api/v1/requirements` | 创建需求 |
| PUT | `/api/v1/requirements` | 更新需求 |
| DELETE | `/api/v1/requirements` | 删除需求(们) |

### 5.5 频道（讨论/沟通）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/channels` | 频道列表 |
| POST | `/api/v1/channels` | 创建频道 |
| GET | `/api/v1/channels/:id/messages` | 频道消息列表 |
| POST | `/api/v1/channels/:id/messages` | 发送消息（含 AI 对话功能） |
| POST | `/api/v1/channels/:id/join` | 加入频道 |
| GET | `/api/v1/channels/:id/members` | 频道成员列表 |
| POST | `/api/v1/channels/by-focus` | 按 focus 创建或查找频道 |

### 5.6 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/knowledge` | 知识文档列表 |
| POST | `/api/v1/knowledge` | 创建知识文档 |
| GET | `/api/v1/knowledge/doc` | 获取单篇文档详情 |
| PATCH | `/api/v1/knowledge/doc` | 更新文档 |
| DELETE | `/api/v1/knowledge` | 删除文档(们) |
| GET | `/api/v1/knowledge/tree` | 知识库分类树 |

### 5.7 工作流

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflows` | 工作流列表 |
| POST | `/api/v1/workflows` | 创建工作流 |
| POST | `/api/v1/workflows/:id/run` | 执行工作流 |
| GET | `/api/v1/workflows/:id/versions` | 版本列表 |
| POST | `/api/v1/workflows/runs/:runId/rerun` | 重新执行 |
| POST | `/api/v1/workflows/runs/:runId/iterate` | 迭代运行 |
| POST | `/api/v1/workflows/runs/:runId/stop-loop` | 停止循环 |

### 5.8 探索

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/explorations` | 探索会话列表 |
| POST | `/api/v1/explorations/messages` | 发送探索消息 |
| GET | `/api/v1/explorations/detail` | 探索详情 |
| POST | `/api/v1/explorations/actions` | 探索动作（展开/收起） |

### 5.9 原型

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/prototypes` | 创建原型 |
| GET | `/api/v1/prototypes/:id` | 原型详情 |
| PUT | `/api/v1/prototypes/:id/content` | 更新原型内容 |
| POST | `/api/v1/prototypes/generate` | 生成原型（调用 AI） |

### 5.10 目标管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/goals` | 目标列表 |
| POST | `/api/v1/goals` | 创建目标 |
| POST | `/api/v1/goals/:id/execute` | 执行目标 |
| POST | `/api/v1/goals/:id/pause` | 暂停目标 |
| POST | `/api/v1/goals/:id/resume` | 恢复目标 |
| POST | `/api/v1/goals/:id/evaluate` | 评估目标 |

### 5.11 技能（Skill）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/skills` | 技能列表 |
| POST | `/api/v1/skills` | 创建技能 |
| GET | `/api/v1/skills/:id` | 技能详情 |
| PUT | `/api/v1/skills/:id` | 更新技能 |
| DELETE | `/api/v1/skills/:id` | 删除技能 |
| POST | `/api/v1/skills/:id/copy` | 复制技能 |
| GET | `/api/v1/projects/:projectId/skills` | 项目已安装技能 |
| POST | `/api/v1/projects/:projectId/skills` | 安装技能到项目 |
| DELETE | `/api/v1/projects/:projectId/skills/:installationId` | 从项目卸载技能 |

### 5.12 人才盘点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:id/talent-review` | 获取人才盘点 |
| POST | `/api/v1/projects/:id/talent-review/start` | 启动盘点 |
| POST | `/api/v1/projects/:id/talent-review/analyze` | 分析阶段 |
| POST | `/api/v1/projects/:id/talent-review/generate` | 生成报告 |
| POST | `/api/v1/projects/:id/talent-review/tests` | 测试阶段 |

### 5.13 人才模板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/talent/templates` | 模板列表 |
| POST | `/api/v1/talent/templates` | 创建模板 |
| GET | `/api/v1/talent/templates/:id` | 模板详情 |
| PUT | `/api/v1/talent/templates/:id` | 更新模板 |
| DELETE | `/api/v1/talent/templates/:id` | 删除模板 |

### 5.14 Agent 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agents` | Agent 列表 |
| GET | `/api/v1/agents/:id` | Agent 详情 |
| POST | `/api/v1/agents/scan` | 扫描 Agent 能力 |
| GET | `/api/v1/agents/:agentId/memories` | Agent 记忆列表 |

### 5.15 统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats` | 平台统计概览 |
| GET | `/api/v1/activities` | 近期活动 |
| GET | `/api/v1/activities/calendar` | 活动日历数据 |

### 5.16 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/healthz` | 健康检查（简洁版） |
| GET | `/api/v1/conventions` | 开发规范列表 |
| GET | `/api/v1/decision-records` | 决策记录列表 |
| GET | `/api/v1/system/info` | 系统信息 |
| GET | `/api/v1/devbox/templates` | Devbox 模板列表 |
| GET | `/api/v1/members` | 团队成员列表 |

---

## 六、典型使用示例

### 创建项目

```bash
curl -X POST http://localhost:3111/api/v1/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的项目",
    "description": "项目描述"
  }'
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "proj_xxx",
    "name": "我的项目",
    "description": "项目描述",
    "createdAt": "2026-07-30T10:00:00.000Z"
  }
}
```

### 创建 Bug

```bash
curl -X POST http://localhost:3111/api/v1/bugs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_xxx",
    "title": "登录按钮不响应点击",
    "description": "在 Chrome 120 上点击登录按钮无反应",
    "priority": "high",
    "status": "open"
  }'
```

### 创建需求

```bash
curl -X POST http://localhost:3111/api/v1/requirements \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_xxx",
    "title": "用户注册功能",
    "description": "支持邮箱+密码注册",
    "priority": "medium"
  }'
```

### 查询 Bug 列表（带分页和筛选）

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3111/api/v1/bugs?projectId=proj_xxx&status=open&page=1&pageSize=20"
```

### 在频道中发送消息

```bash
curl -X POST http://localhost:3111/api/v1/channels/:channelId/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "这是一条测试消息"
  }'
```

### 创建知识文档

```bash
curl -X POST http://localhost:3111/api/v1/knowledge \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_xxx",
    "title": "API 设计规范",
    "content": "# API 设计规范\n\n所有接口使用 RESTful 风格...",
    "tags": ["规范", "API"]
  }'
```

### 执行工作流

```bash
curl -X POST http://localhost:3111/api/v1/workflows/:workflowId/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": { "requirementId": "req_xxx" }
  }'
```

---

## 七、关键数据模型

### User（用户）

```json
{
  "id": "user_xxx",
  "email": "user@example.com",
  "name": "用户名",
  "role": "admin | developer | viewer",
  "createdAt": "2026-07-30T10:00:00.000Z"
}
```

### Project（项目）

```json
{
  "id": "proj_xxx",
  "name": "项目名称",
  "description": "项目描述",
  "createdAt": "2026-07-30T10:00:00.000Z",
  "ownerId": "user_xxx"
}
```

### Bug

```json
{
  "id": "bug_xxx",
  "projectId": "proj_xxx",
  "title": "Bug 标题",
  "description": "Bug 描述",
  "status": "open | in_progress | resolved | closed",
  "priority": "low | medium | high | critical",
  "assigneeId": "user_xxx | null",
  "createdAt": "2026-07-30T10:00:00.000Z"
}
```

### Requirement（需求）

```json
{
  "id": "req_xxx",
  "projectId": "proj_xxx",
  "title": "需求标题",
  "description": "需求描述",
  "status": "draft | active | resolved | closed",
  "priority": "low | medium | high | critical",
  "createdAt": "2026-07-30T10:00:00.000Z"
}
```

### Channel（频道）

```json
{
  "id": "ch_xxx",
  "name": "频道名称",
  "projectId": "proj_xxx",
  "focus": "general | bug | requirement | knowledge | ...",
  "type": "direct | group | channel"
}
```

### Workflow（工作流）

```json
{
  "id": "wf_xxx",
  "projectId": "proj_xxx",
  "name": "工作流名称",
  "description": "工作流描述",
  "status": "active | draft | archived",
  "createdAt": "2026-07-30T10:00:00.000Z"
}
```

### Skill（技能）

```json
{
  "id": "sk_xxx",
  "title": "技能标题",
  "description": "技能描述",
  "content": "SKILL.md 内容（Markdown）",
  "scope": "global | project",
  "tags": ["标签1", "标签2"],
  "version": 1
}
```

---

## 八、边界情况与注意事项

### 认证相关

1. **Token 失效**：返回 `401`，需要重新登录获取新 Token。
2. **权限不足**：返回 `403`，检查账户角色和项目内角色是否满足要求。
3. **会话管理**：Token 不存储于数据库，服务端无法主动使其失效（除了等待 7 天过期）。注销操作仅通知客户端清除本地存储的 Token。
4. **请求头大小写**：`Authorization` 头的大小写是标准 HTTP 行为。`Bearer ` 前缀后跟空格再跟 Token。

### API 调用

5. **分页**：列表接口通常支持 `page` 和 `pageSize` 参数。默认值通常为 1 和 20。
6. **时间格式**：所有时间使用 ISO 8601 字符串（如 `2026-07-30T10:00:00.000Z`），均为 UTC。
7. **批量删除**：删除操作通常接收 `{ "ids": ["id1", "id2"] }` 而非单个 ID（特别是在 Bug、需求、知识文档等资源上）。
8. **更新操作**：PUT 请求体只需包含要修改的字段，不需要发送全部字段。
9. **路由参数**：路径中的 `:id`、`:projectId` 等是占位符，调用时替换为真实 ID。例如 `/api/v1/projects/:id` → `/api/v1/projects/proj_xxx`。

### 数据模型

10. **项目概念**：所有 Bug、需求、知识文档、工作流等资源都属于某个项目。创建资源时必须指定 `projectId`。
11. **用户角色**：始终理解「系统角色」（`User.role`）和「项目内角色」（`ProjectMember.role`）是两套独立体系。系统 `admin` 可以查看所有项目，但项目内的具体操作权限由项目内角色控制。

### 服务状态

12. **服务依赖**：III Engine 必须在 Worker 之前启动。如果 API 返回连接拒绝，通常是 III Engine 未运行或启动顺序不对。
13. **健康检查**：始终通过 `GET /api/v1/health` 确认服务是否正常运行。

---

> **文档维护**: MyRD Team
> **最后更新**: 2026-07-30
