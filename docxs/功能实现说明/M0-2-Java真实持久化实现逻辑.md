# M0-2 Java 真实持久化实现逻辑

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 功能名称 | 注册、登录、Cookie/CSRF、会话和消息 PostgreSQL 持久化 |
| 功能编号/阶段 | M0-2 |
| 实现状态 | 关键链路已实现并通过 local PostgreSQL E2E |
| 适用环境 | local |

## 2. 接口清单

| 接口地址 | 方法 | 接口名称 | 登录 | CSRF |
|---|---|---|---|---|
| `/api/auth/register` | POST | 用户注册 | 否 | 否 |
| `/api/auth/login` | POST | 用户登录 | 否 | 否 |
| `/api/auth/logout` | POST | 用户登出 | 是 | 是 |
| `/api/users/me` | GET | 当前用户 | 是 | 否 |
| `/api/users/me/profile` | GET/PUT | 个人资料查询/更新 | 是 | PUT 需要 |
| `/api/sessions` | GET/POST | 会话查询/创建 | 是 | POST 需要 |
| `/api/sessions/{id}/messages` | GET/POST | 消息查询/写入 | 是 | POST 需要 |

## 3. 实现逻辑

### 3.1 注册与登录密码持久化

- 入口是 `AuthController.register` 和 `AuthController.login`。
- Controller 校验必填字段、邮箱格式和密码长度。
- Controller 调用 `UserAccountService.register/login`。
- JDBC 可用时，Service 检查用户名或邮箱是否重复。
- Service 对新密码使用 BCrypt 生成哈希；登录校验同时兼容历史 PBKDF2-HMAC-SHA256 哈希，避免升级时强制重置账号。
- Service 将用户数据写入 `users`。
- 注册时额外初始化 `user_profiles`。
- 密码明文不写入数据库。
- 登录时查询用户并检查 `disabled/locked` 状态。
- 登录时验证密码哈希。
- 登录成功后更新 `last_login_at` 和失败计数。
- 校验通过后进入统一会话创建流程。

### 3.2 会话认证与 CSRF 校验

- `UserAccountService.issueSession` 生成随机会话令牌。
- 同一流程生成 CSRF 令牌。
- 只将两个令牌的 SHA-256 哈希写入 `user_auth_sessions`。
- 会话记录同时保存用户 ID、过期时间、设备信息和 IP。
- `AuthController.response` 将原始会话令牌写入 `foodmate_session`。
- `foodmate_session` 设置为 HttpOnly Cookie。
- 原始 CSRF 令牌写入可读的 `foodmate_csrf` Cookie。
- 退出登录时根据会话令牌哈希撤销记录。
- 退出登录时返回过期 Cookie。

- `CsrfProtectionFilter` 统一拦截 `/api` 下的非 GET 请求。
- 注册、登录和密码重置接口属于公开路径，可以放行。
- 其他请求必须先从会话 Cookie 找到用户。
- Filter 校验 `Origin` 是否同源。
- Filter 读取请求头 `X-CSRF-Token`。
- Filter 将请求头令牌哈希后与会话绑定哈希比较。
- 校验失败时直接返回统一 JSON 错误。
- 校验失败时不会进入业务 Controller。

### 3.3 会话、消息与资料读取

- `UserController`、`SessionController` 通过 `UserAccountService` 读写数据。
- 用户资料写入或读取 `user_profiles`。
- 会话数据写入或读取 `sessions`。
- 消息数据写入或读取 `messages`。
- 查询条件带当前用户 ID，避免跨用户读取。
- 消息写入时生成递增的 `sequence_no`。
- 消息读取时按 `sequence_no` 排序。
- 没有 `JdbcTemplate` 时才切换到内存 Map。
- 内存实现只用于 `local-stub` 原型运行。

## 4. 涉及的数据库表

- `users`
- `user_profiles`
- `user_auth_sessions`
- `sessions`
- `messages`

## 5. 安全与隐私

- 会话 Cookie 为 HttpOnly；CSRF Cookie 不设置 HttpOnly 以供前端读取。
- 密码哈希、会话哈希和 CSRF 哈希不返回 API。
- 用户只能访问自己的资料、会话和消息。

## 6. 验收记录

`LocalPostgresE2ETest` 已通过注册、登录、Cookie/CSRF、会话创建以及消息写入/读取；`LocalRuntimeRecoveryTest` 已验证持久化运行记录在应用状态丢弃后的读取能力。

## 7. 已知限制

当前测试的重启恢复是新测试上下文下的持久化读取验证，不是独立操作系统进程重启演练；前端除已接入的认证服务外，部分会话和业务页面仍保留 mock。
