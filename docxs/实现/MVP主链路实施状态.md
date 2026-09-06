# FoodMate MVP 主链路实施状态

更新时间：2026-09-06

> 模板提示：后续 AI 阅读本文档时，必须按功能点拆分为独立小节；只记录已实现和已验证的事实，不得把真实模型、RAG、工具调用或饮食业务写入提前写成已完成。

> 当前状态（2026-09-06）：M1-5 核心业务已接入本地真实 Java/SQL/API：饮食记录创建/查询/编辑/删除/恢复、today/7d/30d 分析、餐食计划创建/查询/修改/校验/保存/删除/恢复/购物清单，以及 `meal_plan.save_plan` Proposal -> Confirm -> Execute。`food_log_writer` 的 create/update/delete/restore 已完成本地 application/Tool Gateway/Runtime Proposal，并已通过真实 PostgreSQL HTTP/RocketMQ 各 11/11 跨进程回归，覆盖 rejected/failed/superseded、revision 冲突、幂等重放和官方 foodPortion 换算 matched/pending。营养目录当前为 1,000 条 approved/official USDA 食材和 1,518 条 approved foodPortion 换算规则，V32/V33 seed/validation 已验证。M2-1 公共知识库 deterministic 上传/索引/发布/检索/引用、M2-2 deterministic Tool/SQL 和 M2-3 管理核心切片已有本地业务证据；Docker Runtime 启动/readiness 已验证，并保留真实 Chat/Embedding 的独立业务证据；真实云长稳、性能和故障门禁后置。M1-6 已完成 Actuator/metrics 配置回归、双 JVM 有界读取与 Java 重启回读，并完成 Python Runtime readiness、Redis AOF 探针恢复和 RocketMQ 重启/Topic 初始化复验；完整 PostgreSQL/Outbox/Inbox/SSE 故障矩阵、生产容量和恢复指标仍未完成。前端页面视觉验收不等于完整生产完成。

## 1. 当前结论

- M1-2 已完成真实认证、会话、消息持久化和前端真实 API 接入。
- M1-3 已完成 Java -> Python 确定性 stub -> Java -> SSE 的最小真实闭环。
- M1-4 已完成 RocketMQ/Redis 基础传输、模型适配、预算、LangGraph 白名单图、Eval Gate、Proposal/Result 回注、结构化摘要和恢复入口；本地真实浏览器闭环与 Java 恢复入口已验证，Runtime 进程重启后的 readiness 和 Redis checkpoint 后端可用性也已复验。生产级容量、完整进程故障恢复指标、价格审计、真实云长时间稳定性和生产 Eval 治理仍未完成。
- M1-5 已完成上述基础 Java/SQL/API 实现；计划资源 V15 生命周期迁移和 HTTP 回归已完成，`food_log_writer` create/update/delete/restore 及 rejected/failed/superseded、revision 冲突和幂等重放已完成真实 HTTP/MQ 各 11/11 回归；1,000 条营养食材 seed 和 1,518 条官方 foodPortion 换算 seed 已导入并通过校验。M2-1 公共知识库和 M2-2 deterministic Tool/SQL 已形成本地业务闭环，真实云服务、性能和故障门禁后置。

## 2. 已完成主链路

用户注册或登录。

用户创建会话并发送消息。

Java 在同一事务中创建 AgentRun、dispatch 和 dispatch outbox。

Java 使用 PostgreSQL Dispatch Outbox 将 RunCommand 发布到 RocketMQ command topic；Python 通过 Redis Inbox 幂等消费。

Python 默认 `deterministic:local` 产生 `run.accepted`、`run.routed`、`run.model_usage` 和 `run.eval_decided`；Eval 通过后才产生 `run.answer_stream`，最后发布 `run.completed`，全部经 Event Outbox 进入 RocketMQ event topic。

Java RocketMQ consumer 校验事件身份、摘要、顺序和状态，再写入 PostgreSQL 事件 Inbox、AgentRun 投影和 SSE Outbox。

前端用 agent_run_id 订阅 SSE，展示分段文本、完成、失败或取消。

## 3. 已验证的小点

### 3.1 主链路

- 真实 PostgreSQL 下已验证注册、创建会话、发送消息、创建 AgentRun、Java/Python 回调和 SSE。
- 成功 deterministic run 的状态为 `completed`；事件 Inbox/SSE Outbox 会按当前是否包含 Eval、模型用量和分片产生对应的连续事件，不能再用固定 5 条作为所有场景的断言。

### 3.2 取消

- 已验证事件顺序为 run.accepted、run.cancel_acknowledged、run.cancelled。
- 取消后 AgentRun 为 cancelled，取消记录状态为 resolved。

### 3.3 SSE 恢复和越权

- Last-Event-ID 按持久化 stream_seq 恢复，不重复推送已消费事件。
- 用户 B 查询、订阅或取消用户 A 的 run 均返回 HTTP 403。

### 3.4 自动化验证

- 历史 M1-3 验证曾记录 Python pytest、Java 全模块测试和前端 typecheck 通过；具体旧计数只对应当时提交，不作为当前测试总数。
- M1-4 基础设施阶段另有 RocketMQ 真实往返、Redis/PostgreSQL 状态、continuation `superseded` 和 MQ transport E2E 记录；依赖当前是否在线必须现场检查。
- 本轮实际通过：`M14RocketMqTransportE2ETest` 1/1、`M14ProposalResultE2ETest` 2/2、`M14RuntimeCheckpointRecoveryE2ETest` 1/1、`M14ContinuationE2ETest` 3/3、`M14DlqReconciliationE2ETest` 3/3；Python Runtime 全量 pytest 为 `189 passed, 2 skipped, 6 subtests passed`。这些测试覆盖 MQ envelope、Proposal/Result Inbox 幂等、Java checkpoint 对账、新 attempt、continuation 和 DLQ 裁决，不等同于生产级故障恢复或容量验收。

## 4. 当前架构边界

- Java 是用户、授权、业务数据、AgentRun 状态和 SSE 的唯一权威。
- Python 不持有业务数据库凭据，不直接写业务表。
- 默认 Python 运行 `deterministic:local`；显式配置云 tier 时支持真实 OpenAI-compatible 模型调用，但默认不会联网。
- Java 当前根 POM 采用 5 个 Maven 模块；未来能力先按包组织，避免预建空模块。

## 5. 未完成项与下一步

### 5.1 M1-4

- Python 基础版本、依赖、配置、健康检查、结构化日志、模型适配器、预算、checkpoint 和 pytest 门禁已建立；默认仍使用 deterministic stub。
- LangGraph 白名单图、独立 Eval、正文延迟发布、模型用量事件、Redis 并发与队列基线已实现并有测试证据。
- 普通缺参 continuation 与 `superseded`、预算追加、恢复入口和 Eval 后交付已由 Java、Python 与前端共同落地。
- 仍需在生产目标环境完成真实云长时间重复稳定性、长压容量结论、多实例业务流量、故障恢复指标和正式价格/账单审计。
- 已实现最近 8 条消息、结构化摘要、摘要 CAS、计划型/临时型记忆 TTL 与过期过滤；消息更正/删除后的最小摘要失效与重建、Java 恢复对账已验证。按意图精细检索、删除防再生和完整缓存传播仍未实现。
- 当前无人审核，`request_review` 只能安全降级，不建设 `waiting_review`。
- 继续禁止 Python 直接访问业务数据库或绕过 Java 授权。

上述未完成项属于生产收尾与后续 Agent 能力目标；本地代码和测试已具备可用闭环，但不代表 M1-4 已达到生产发布门槛。

### 5.2 后续阶段

- 饮食记录、营养分析、餐食计划完整资源生命周期、饮食记录编辑、`meal_plan.save_plan` 写确认和 `food_log_writer` create/update/delete/restore 已完成；当前真实营养目录、60 条官方单位换算规则和 writer 各 11/11 跨进程回归已完成。M2-1 公共知识库 deterministic 业务闭环、M2-2 Tool/SQL 和 M2-3 管理核心切片已有业务证据；生产强化继续后置。
- M1-6 当前已完成本地 Actuator/metrics 配置回归、双 JVM 有界认证会话读取基线和 Java 重启后的 PostgreSQL 回读；共享 Redis/RocketMQ 的 Runtime readiness、Redis AOF 探针恢复、RocketMQ 组件重启恢复和 Topic 初始化已复验。Agent 业务流量、队列积压/重复执行统计、PostgreSQL 进程重启、完整 Outbox/Inbox/SSE 故障恢复仍未完成。生产监控、部署、备份恢复和发布回滚后置。
- M2-1 deterministic 知识库/RAG、M2-2 SQL Guard/Tool Agent 和 M2-3 管理核心切片已形成业务闭环；真实云服务、生产容量、完整故障矩阵和 M3 生产治理仍后置。

## 6. 2026-08-01 收尾复核

### 已验证

- Java 恢复入口、浏览器真实闭环、Python 重启后的 checkpoint 恢复、RocketMQ 传输和最终 SSE 已完成本地真实验证。
- Eval Gate 已进入正式运行路径；Python `56 passed, 1 skipped`，前端 Vitest `4 passed`、typecheck/build 通过。
- Redis 准入并发 `6 passed`；30 秒长压 P50/P95/P99 已采集，结果仅作为本机 Docker 基线。

### 仍待生产收尾

- 生产级长压与容量结论、队列防饥饿、多实例 Agent 业务流量、进程级故障恢复、真实云长时间稳定性和正式价格/账单审计。
- 生产 Eval 还需要固定版本、人工校准样本、统一指标存储和告警；本地 Eval 测试不等同生产质量结论。
