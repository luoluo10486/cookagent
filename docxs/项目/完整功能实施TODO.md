# FoodMate 完整功能实施 TODO

## 1. 文档目的

本文定义 FoodMate 从当前工程状态走向可正式交付产品的总待办清单。它明确产品边界、阶段目标、依赖、风险和完成门槛；具体框架、库、表字段和接口细节以实施时评审为准。

## 当前复核状态（2026-09-06）

> 本节覆盖下方历史复核记录。完成状态必须以实际测试证据判断，不能由设计或单元测试替代。

### 当前真实云业务证据边界

- R1 公共知识库、R2 饮食记录、R3 餐食计划和 R4 只读 SQL Agent 均已有真实云业务闭环证据；对应 Docker 验收入口分别为 `real-rag-e2e.ps1`、`real-food-log-e2e.ps1`、`real-meal-plan-e2e.ps1` 和 `real-sql-agent-e2e.ps1`。
- 四条入口都保留云 provider、预算、无 fallback、无自动重试和安全清理门禁；只有显式付费执行才会调用供应商，普通预检不能替代业务证据。
- 当前任务只推进业务正确性和可复现验收，不把性能压测、依赖重启、ACK 丢失、重复投递、生产部署、备份恢复、硬删除和发布回滚写成已完成。

- [x] 本地 Docker PostgreSQL E2E：注册、登录、Cookie/CSRF、会话创建、消息持久化/读取。
- [x] Java PostgreSQL Outbox -> RocketMQ -> Consumer：真实传输、`request_hash`、`dispatch_id`、`run_id` 已验证。
- [x] Proposal -> Java Tool Gateway -> 只读 SQL / 审计 -> Result：成功、失败 `SQL_EXECUTION_FAILED` 和重复 Proposal 幂等已验证。
- [x] Proposal Inbox claim lease：超过 5 分钟的 `claimed` 记录可回收，避免旧失败消息造成消费者饥饿。
- [x] 浏览器真实登录、会话、消息、RocketMQ command/event、Java PostgreSQL Inbox、最终 SSE E2E 已通过；恢复入口也已完成一次 Python 重启后的跨进程验证。
- [x] Python deterministic Runtime、知识索引 Worker、Eval Gate、Proposal/Result 回注和 Java Tool Gateway 的本地真实跨进程链路已通过；M2-1 公共知识库 RAG、M2-2 只读 SQL Agent 和 M2-3 管理核心业务已取得当前业务证据，生产强化仍后置。
- [x] 本地双 JVM 子项已复验：`script/local/m1-6-dual-jvm.ps1` 启动 `18080/18081` 两个独立 Java JVM，共享 PostgreSQL 完成认证会话读取；最近一次 160/160 成功、错误率 0%、吞吐 51.538 req/s、P50/P95/P99 为 17.107/57.937/94.523 ms，并完成 Java 重启后的 PostgreSQL 回读。
- [x] 本地依赖恢复子项已验证：Python readiness HTTP 200，Redis checkpoint、Redis、RocketMQ event/proposal producer、command/result consumer 均 ready；Redis AOF 探针在容器重启后保留，RocketMQ NameServer/Broker/Proxy 重启后 healthy 且 Topic/group 初始化成功。
- [ ] 生产级长压、多实例 Agent 业务吞吐、队列积压/重复执行、PostgreSQL 进程重启，以及 Outbox/Inbox ACK 丢失、租约接管和 SSE 故障恢复仍待执行。
- [ ] 真实供应商生产价格表仍待人工从官方价格表确认并配置；代码已增加价格审计 fail-closed，默认继续使用 deterministic stub。
- [x] D112 使用历史凭据完成 Docker `agent-runtime` 的 SiliconFlow `BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B` 显式 `/v1/embeddings` smoke，两个模型均返回 1024 维向量；运行时仍一次选择一个 profile，并使用独立 Milvus collection。该证据不替代当前密钥认证、长稳、成本对账或生产容量验收。
- [x] D114/D122 曾记录的旧密钥 HTTP 401 已处理；2026-09-05 当前 Docker Embedding 密钥使用 `Qwen/Qwen3-Embedding-0.6B` smoke 返回 1024 维向量，Chat `DeepSeek-V4-Flash` smoke 也已通过。该证据不替代真实业务长稳、成本对账或生产容量验收。
- [x] M1-5 第一切片已完成本地代码和真实 HTTP E2E：饮食记录创建/查询/编辑/删除/恢复，today/7d/30d 分析，计划创建/查询/修改/校验/保存/删除/恢复/购物清单，以及 `meal_plan.save_plan` Proposal -> Confirm -> Execute。
- [x] `food_log_writer` 已完成：Proposal -> Confirm -> Execute、`confirmation_ref`/AgentRun/用户归属/参数摘要/幂等校验、复用饮食记录写入用例、`food_log_id` 回填、rejected/failed/superseded 和 create/update/delete/restore 均已有定向测试，并已通过真实 PostgreSQL HTTP 和 RocketMQ writer 回归。
- [x] 本地 PostgreSQL 已存在 V13/V14/V15/V32 结构；本轮只读复核确认 `food_logs` 旧 JSON 字段已移除、关键表/约束/索引存在。V33 已导入 1,000 条 approved/official USDA 食材和 1,518 条 approved foodPortion 规则，V32/V33 validation 通过，规范键、来源 ID、规则唯一性和非法值均为 `0`；未覆盖的密度单位仍不推断。旧生成版本中不再入选的记录只做软删除，未执行 `TRUNCATE` 或宽泛删除。
- [x] M1-5 Java 写确认扩展已实现：`food_log_writer` 支持 create/update/delete/restore，确认状态支持 rejected/failed/superseded，Tool Gateway 校验工具名/type 并映射结果状态；Java 定向测试覆盖拒绝、失败回滚记录、supersede 和三种资源写操作。
- [x] 完成 M1-5 写确认扩展的真实 HTTP/MQ 跨进程回归：HTTP 与 RocketMQ 各 11 个用例通过，覆盖 rejected、failed 回滚与失败审计、superseded、update/delete/restore、revision 冲突、成功 Proposal 幂等重放，以及官方 foodPortions 换算 matched/pending 和数据库快照断言；每个用例使用随机用户、Session、AgentRun、Proposal 和幂等键隔离。
- [x] M2-1/M2-2/M2-3 业务范围已完成：公共知识库真实 Embedding/Milvus 上传/索引/发布/检索/引用、真实云只读 SQL Agent、多数核心管理查询/写操作/模型治理和受控脱敏导出均已有代码与业务证据；性能和故障验证不属于当前完成门槛。
- [x] M3 业务治理代码切片已完成：运营审计快照、DLQ 安全摘要/人工重放契约、保留策略、legal hold、审批、对象/向量清理、失败补偿和受控数据库清理已具备定向业务测试；`hard_delete_enabled=false` 默认关闭。

### 当前前端业务复核（2026-09-06）

- [x] 管理端真实模式已收口工具注册表、工具调用、用户详情、知识库批次和运行治理的真实数据路径，覆盖加载中、空数据、错误和重试；真实接口失败不会回退到 fixture。
- [x] 聊天页真实模式已展示 `run.completed.citations`，并保留 SSE `Last-Event-ID` 去重恢复；知识库批次上传、进度恢复、失败重试、发布/下线/恢复和软删除继续由真实 API 驱动。
- [x] 前端集中业务复核：`npm.cmd test -- --maxWorkers=1` 为 `43/43` 测试文件、`264/264` 测试通过；`npm.cmd run build` 通过。
- [ ] 本项不包含性能压测、长稳、依赖故障矩阵、生产部署、备份恢复、Kubernetes 或发布回滚。
- [ ] M3 真实生产依赖清理、数据库不可逆硬删除、生产压测、漏洞扫描、密钥轮换、渗透测试、发布回滚和生产告警仍未完成；本地隔离 PostgreSQL 硬删除和 Docker 备份恢复已有证据，但不得替代生产演练。

本文不替代现有 ADR、外部 API 契约、Java/Python 内部契约和数据库设计。发生冲突时，优先级为：实际代码与测试事实 > ADR/契约 > 本 TODO > 其他设计文档。

## 当前执行状态

| 阶段 | 当前结论 | 说明 |
|---|---|---|
| M0 | 最小可验证基线已完成 | 数据库、真实持久化和安全配置已有实现与验证；下方未勾选项只表示环境隔离、生产复验等强化工作。 |
| M1-1 | 已完成 | 账户、授权与个人数据能力已有真实实现和验收记录。 |
| M1-2 | 已完成 | 真实认证、会话、消息、前端 API 接入和 Cookie/CSRF 已验收。 |
| M1-3 | 最小真实闭环已完成 | Java -> Python 确定性 stub -> Java -> SSE、取消、续传和越权校验已验证。 |
| M1-4 | 本地闭环完成，生产收尾中 | 已具备受控模型适配、LangGraph 白名单图、独立 Eval/预算、Redis 准入、摘要 CAS、记忆候选、MQ Transport、Proposal/Result、浏览器 SSE 和跨进程恢复；生产长压、真实云稳定性、价格/账单审计和生产 Eval 治理仍未完成。 |
| M1-5 | 核心范围已完成，扩展持续 | 饮食记录、营养 seed、分析、餐食计划完整资源生命周期、`meal_plan.save_plan`、1,000 条 USDA 食材、1,518 条官方 foodPortions 换算和 `food_log_writer` 的 HTTP/MQ 各 11/11 回归已验证；营养学人工复核、生产长压和生产治理仍后置。 |
| M1-6 | 本地子项已验证，整体未完成 | Actuator/metrics、双 JVM 有界 PostgreSQL 读取、Java 重启回读、Python readiness、Redis AOF 探针和 RocketMQ 重启恢复已验证；完整 PostgreSQL/Outbox/Inbox/SSE 故障矩阵、队列统计和生产治理仍后置。 |

## 2. 已确认的产品边界

| 项目 | 当前决策 |
|---|---|
| 产品定位 | 饮食与营养辅助工具，不是医疗诊断、治疗、处方或紧急健康决策系统。 |
| 租户模型 | V1 为单租户正式系统；保留 `tenant_id` 扩展位，但不实现多组织隔离。 |
| 客户端 | V1 以 Web 浏览器为正式入口；原生 App、第三方开放平台和 OAuth2/OIDC 后置。 |
| 数据权威 | Java 是用户、授权、业务数据、工具执行、SQL 执行和审计的唯一权威。 |
| Agent 边界 | Python 只负责 Agent 编排、模型调用、检索编排和 proposal 生成，不直连业务数据库。 |
| 模型调用 | 允许第三方云模型；必须最小化传输、脱敏、可审计且可替换。 |
| 写操作 | 默认需用户确认；明确、低风险且参数完整的创建操作可直接执行；修改、删除、批量和覆盖必须二次确认。 |
| 隐私权利 | V1 包含会话撤销、数据导出、内容软删除、账号注销申请和延迟物理清理。 |
| 数据库变更 | 所有 SQL 均人工执行；Java 不自动执行建表、迁移或回滚。 |

## 3. 当前事实与主要缺口

当前已具备的基础：

- PostgreSQL FoodMate 已执行基线及 V2-V6 追加迁移；账号、会话、消息、continuation、预算基础结构与 MQ 运行时表均已用于真实联调。
- Java 已实现账号、认证会话、会话、消息、AgentRun、dispatch outbox、事件 inbox、取消和 SSE。
- Python agent-runtime 已实现 V1 Service JWT、RocketMQ command/event/proposal/result、Redis Inbox/Outbox、固定 Workflow、模型适配、Eval Gate、预算、checkpoint 和确定性默认 provider；M1-3 HTTP 回调仅保留兼容和契约测试用途。
- 前端真实模式已接入认证、会话、消息、AgentRun SSE 和取消；知识库检索、管理端批次上传/进度/重试、聊天引用、饮食记录、营养分析、餐食规划和主要运营页面已有 real 业务路径。M2-1 deterministic 知识库跨运行时业务闭环和 M2-2 SQL Agent 真实本地数据库联调已完成；生产强化仍未完成。

当前不能宣称完成的部分：

- Python Runtime 的 Router、Planner、Tool Proposal、Result 回注、Eval 和恢复闭环已具备本地实现与验证；生产 RAG、完整业务 Tool/SQL 场景、云模型长时间稳定性和生产级治理仍未形成完整闭环。
- 业务知识库的 Java/Python 核心索引、stub/local 检索、可见性和前端引用已实现并通过业务测试；deterministic 本地依赖下的上传/索引/发布/引用闭环已验证。真实云 embedding、统一生产可观测性、账单审计和发布流程仍未形成生产闭环。

## 4. 里程碑与发布门槛

| 里程碑 | 目标 | 必须完成 | 不阻塞项 |
|---|---|---|---|
| M0 工程可信基线 | 让真实环境可重复验证 | 数据库手工脚本、Java 真实连接、测试与配置门禁、密钥边界 | 复杂业务能力 |
| M1 正式核心版 | 用户可安全使用核心饮食助手 | 认证、会话、真实 Agent、饮食记录、分析、计划、确认、审计、前端真实接入、部署与监控 | SQL Agent、完整 RAG、运营后台深度能力 |
| M2 扩展能力版 | 完成受控数据与知识能力 | RAG、文件知识库、Java Tool Gateway、只读 SQL Agent、管理后台、成本治理 | 原生 App、开放平台、多租户 |
| M3 生产强化版 | 可持续运维与扩展 | 压测、灾备、告警、数据生命周期自动化、安全演练、发布回滚演练 | 新功能扩张 |

## 5. M0：工程可信基线

状态说明：M0 的本地最小基线已经通过并有功能实现说明。以下清单将“已验证基础”和“生产强化”分开记录，不能因为仍有生产强化项就把 M0 解释为从未完成，也不能因为本地验证通过就宣称具备生产发布条件。

### M0-1 数据库与本地环境

- [x] 固定 `script/sql/FoodMate/baseline`、`migration`、`rollback` 目录，迁移、校验与回滚脚本按版本管理。
- [x] 建立人工执行和执行后校验流程；Java 各环境关闭 Flyway 自动迁移。数据库备份恢复暂不纳入当前开发阶段。
- [x] 已用数据库脚本测试和本地 PostgreSQL E2E 验证核心表、索引、约束及软删除基础语义。
- [x] 清理应用内过时迁移资源，Java 启动不自动执行建表、迁移或回滚。
- [ ] 后置：在未来建立独立测试、预生产和生产环境后，再完成数据库隔离、备份恢复及人工执行记录演练；当前没有这些环境，也不复用生产数据做本地调试。
- [ ] 扩大 PostgreSQL 集成测试，完整覆盖全部中文注释、软删除恢复和每个后续迁移的回滚前置条件。

风险：手工 SQL 容易遗漏执行、执行顺序错误或环境漂移。控制方式：每份脚本必须有校验查询、执行记录、版本号和回滚说明。

### M0-2 Java 真实持久化验证

- [x] 用 `local` profile 启动 Java，验证连接 `FoodMate` 且不自动运行 SQL。
- [x] 跑通注册、登录、登出、Cookie/CSRF、个人资料、会话创建、消息写入与持久化恢复读取。
- [x] 正式路径使用 Repository/JDBC 持久化，内存实现只用于 `local-stub`。
- [x] 已为并发消息序号、唯一用户名/邮箱、会话撤销和幂等写入补充数据库级测试；隔离真实 PostgreSQL 上的 26 个人工迁移可执行且二次执行为 no-op。

风险：内存与数据库双写产生数据不一致；并发请求造成消息序号或幂等冲突。控制方式：单一权威存储、事务、唯一约束和冲突错误映射。

### M0-3 安全与配置基线

- [x] 完成环境变量、Secret 注入、日志脱敏、错误输出和前端环境变量基础边界。
- [x] 验证 Service JWT 签名、`kid`、过期时间、受众和 scope，并建立缺失配置时的启动拒绝门禁。
- [x] 完成 Web 会话 HttpOnly、Secure 配置、SameSite、CSRF 和会话撤销测试。
- [x] 建立开发弱配置与生产启动拒绝的自动化配置矩阵。
- [ ] 使用真实 prod Secret、正式域名和跨源浏览器环境完成生产级复验与 `kid` 轮换演练。

风险：真实密码、私钥、会话 token 或模型输入泄漏。控制方式：Secret 管理、禁止日志输出、启动校验、依赖漏洞扫描和最小权限。

## 6. M1：正式核心版

### M1-1 账户、授权与个人数据

- [x] 完成注册、登录、登出、当前用户、密码变更、密码重置和设备会话管理。
- [x] 完成 `user/admin/operator` RBAC，资源查询校验当前用户归属，operator 保持只读。
- [x] 完成个人资料、营养偏好、过敏原、忌口和单位偏好管理。
- [x] 完成头像 MinIO 私有对象存储、文件类型/大小校验、替换和删除流程。
- [x] 完成数据导出、账号注销申请、立即禁用、会话全部撤销和异步物理清理。

边界：不实现第三方登录、原生 App 登录或开放 API token。

### M1-2 会话、消息与前端真实接入（已完成）

- [x] 统一前端 HTTP Client、错误码、Cookie 认证、CSRF 头、401 刷新与 403 展示策略。
- [x] 用真实 API 替换登录、个人资料、会话列表、消息列表和消息发送 mock。
- [x] 实现会话重命名、归档、软删除、恢复、分页和搜索；限制用户只能访问本人资源。
- [x] 实现消息稳定排序、分页、重试和附件入口的清晰降级状态。
- [x] 完成前端路由守卫、未授权跳转、加载/空态/错误态和网络中断处理。

风险：Cookie 跨域、CSRF、刷新并发和 SSE 断线重连容易造成隐性安全或体验缺陷。控制方式：浏览器 E2E、契约测试和跨浏览器验证。

### M1-3 Java 权威 AgentRun 与 SSE（最小真实闭环已完成）

- [x] 统一 AgentRun 状态机、合法状态转换、失败码与取消语义；超时的生产级收敛留待后续强化。
- [x] 完成 Java dispatch、cancel、事件 inbox、事件去重、缺口/乱序拒绝与终态保护。
- [x] 将事件持久化、AgentRun 更新和 SSE outbox 纳入事务边界。
- [x] 实现 SSE 订阅、断线恢复、事件序号、客户端取消和资源释放。
- [ ] 补齐超时、网络失败、Python 不可用等完整故障注入与浏览器级 E2E；不阻塞最小闭环结论。

边界：Java 不替代 Python 推理；Python 不直接修改 AgentRun 或业务表。

### M1-4 Python Agent Runtime 与模型能力（本地闭环完成，生产收尾中）

当前已完成的基础闭环：Java PostgreSQL Dispatch Outbox -> RocketMQ command -> Python Redis Inbox -> 确定性 stub -> Redis Event Outbox -> RocketMQ event -> Java PostgreSQL Inbox/AgentRun/SSE Outbox。以下清单只记录尚未完成的 M1-4 Agent 能力，不把这次传输闭环重复列为待办。

M1-4 前置门禁已完成：Python pytest 通过，Java 全模块 Maven 测试通过，Compose 示例配置校验通过；本地单 NameServer、单 Broker、Proxy、四个 Agent Topic 和 Redis/PostgreSQL 依赖均已启动并完成一次真实消息往返。历史过期 Outbox/Run 只保留为故障验证记录，不作为当前闭环成功依据。

- [x] Java PostgreSQL AgentRun/Dispatch/Outbox -> RocketMQ command。
- [x] Python Redis Inbox 幂等消费 -> 确定性 stub -> Redis Event Outbox -> RocketMQ event。
- [x] Java PostgreSQL Event Inbox/AgentRun/SSE Outbox 消费落库，重复消息和 request hash 冲突有自动化测试。
- [x] 本地 RocketMQ Topic/consumer group 初始化、Compose 配置和 Java/Python 基础测试门禁。

- [x] 固定 Python 版本与依赖、配置加载、健康检查、结构化日志和 pytest 基础门禁；真实模型依赖锁随 Agent 能力实现继续收紧。
- [x] 在现有 Compose 中接入本地单 NameServer + 单 Broker，并初始化 command/event/proposal/result 四个 Agent Topic；本阶段不建设生产高可用集群。
- [x] 实现 Java PostgreSQL Outbox Relay、MQ Event Consumer、Inbox 事务和基础 DLQ 对账；Proposal/Result 业务处理随 Tool/SQL 阶段补齐。
- [x] 实现 Python Redis AOF Inbox、Event Outbox 与 Relay；Redis 不可用时停止消费。Proposal Outbox 和 LangGraph checkpoint 原子写入仍属下列 Agent 能力任务。
- [x] 使用固定 `WorkflowGraph` 完成 Router、Planner、Execution、Composer、Final Eval Gate 和终态裁决；`langgraph_adapter.py` 提供可选原生 LangGraph 白名单包装，Reflector 和 Step Validator 已在当前依赖无关图中实现。
- [x] 完成短期记忆 Context Builder：Java 装配最近 8 条有效消息、摘要、长期记忆和来源 ID，Python 执行上下文 Token 裁剪；消息更正/删除后的摘要失效与最小重建已验证。
- [x] 完成摘要压缩：第 9 条有效消息写入后增量更新摘要；摘要保存覆盖消息范围、来源数量、Prompt 版本和 digest，并使用版本/CAS 防止并发覆盖。当前为确定性短摘要，摘要模型替换和更正后的自动重建仍需强化。
- [x] 完成摘要失效与重建的最小链路：消息被删除或更正后摘要失效，下一次超过 8 条有效消息时从权威消息重建；摘要缓存和长期缓存联动仍需强化。
- [x] 完成长期记忆候选链路：Python 只产生带来源、类型、置信度、作用域和有效期的候选，Java 校验后写入 `user_memories`，不得把模型推测、一次性参数、审批或医疗判断自动记忆。
- [x] 提供长期记忆查看、更正、删除和冲突确认 API；冲突记忆默认不进入 Agent Context，用户确认后才恢复可用。
- [x] 将确定性文本摘要升级为结构化摘要：已输出 `goals`、`constraints`、`decisions`、`open_questions` 和 `source_message_ids`，并保留摘要版本、来源 digest 与 CAS；摘要模型和失败降级策略仍属于后续增强。
- [x] 长期记忆读取已按用户归属、白名单类型、确认状态、有效期和当前 AgentRun 意图过滤，当前查询/注入上限为 8 条；检索仍是确定性的类型分层，不引入高成本语义向量。
- [x] 建立最小记忆治理：计划型记忆已自动分配 7 天 TTL，临时型记忆已自动分配 24 小时 TTL，过期记录已从冲突判断和 Context 读取中排除；V31 增加来源消息与删除/更正抑制标记，防止被撤回事实重新生成。推断衰减、用户遗忘和 active memory 上限配置化仍待完成。
- [x] 明确三层数据边界：周食谱、饮食日志、Profile、过敏/医疗限制等保留在领域表；Java 记忆候选白名单拒绝权威实体类型/字段和高影响健康事实，Context 查询只读取允许的长期记忆类型。
- [x] M1 不引入 `pgvector`；仅当结构化检索经 Eval 证明召回不足后作为可选增强评估。
- [x] 删除或更正长期记忆后使相关摘要和 Context 引用失效；V31 通过来源消息抑制、摘要重建过滤和关闭查询缓存防止旧事实再生。V31 迁移需在目标本地数据库人工执行并按执行台账留证。
- [x] 为每次 Context 装配保存可审计来源 ID：Python 通过非终态 `run.context_assembled` 只回传 `message_id/summary_id/memory_id/citation_id`，Java 在同一事件事务写入统一审计；不保存 Chain-of-Thought、完整 Prompt 或正文。
- [x] 完成 Redis 协调：用户默认最多 2 个 Session 并发、全局默认 20 个 active Run、全局队列默认 100；同 Session 单 active Run 由 PostgreSQL 保证，不创建 Session 级 Redis permit。当前已接入 Lua/ZSET lease，未引入进程内 semaphore。
- [ ] 完成生产级优先队列、permit lease、aging、防饥饿和 Redis 故障关闭；当前已实现有限 priority + FIFO aging 基础和协调不可用 503，仍缺 Redis 故障注入与长期防饥饿验证。
- [x] 完成 queue、execution、node、waiting_user、cancel drain 超时，Run 接受时固化 `TimeoutSnapshot`，取消或超时后可靠释放 permit。当前已实现 queue/execution 扫描和终态释放，node/cancel drain 的独立执行器与 waiting_user 专用 deadline 仍需强化。
- [x] Python 已接入供应商无关的受控模型适配器，支持逻辑层级路由、兼容云端点、超时/限流 fallback、用量采集与失败归因；真实云单次调用已验证，默认仍是 `deterministic:local`。
- [x] 完成 Token/成本预算快照、70%/85%/100% 分级降级和用户显式追加预算；每次追加生成新 revision 和 dispatch attempt。生产成本告警和账单对账仍待完成。
- [x] 完成 Redis checkpoint 的 AOF 配置、CAS、TTL、加密和 Java 对账；`tool_wait/execution` 关键恢复点、Java 恢复入口和本地跨进程恢复已验证。
- [x] 完成任务恢复执行器：Python 校验旧 dispatch、checkpoint version/digest、预算 revision、deadline 与已完成 invocation；Java 完成所有权/终态/取消/fencing 对账和跨进程本地 E2E。生产自动触发器和恢复指标仍待完成，详见[Python 智能体运行时设计](../架构/Python智能体运行时设计.md)。
- [x] 建立确定性硬规则、LLM Judge、Prompt/评测版本、离线 golden 样例、回归评测和安全策略测试；Eval 通过前不得发送候选答案正文。
- [x] 实现可配置 150ms 时间触发的回答分片：Eval 通过后按 UTF-8 字节上限切片，并按 `FOODMATE_AGENT_STREAM_CHUNK_INTERVAL_MS`（默认 150ms）调度 `run.answer_stream`；不逐 Token 发布 RocketMQ。
- [x] 当前无人审核时，`request_review` 返回安全降级答案并记录原因，不新增虚假的 `waiting_review`。
- [x] 普通缺参补充创建 continuation Run，旧 Run 进入 `superseded`，并完成 V5、Java 事务、SSE 和前端状态映射。
- [x] 工具审批和预算追加按原 Run + 新 `dispatch_id + attempt` 处理，并完成预算确认前端交互与恢复测试；预算追加已接入 Redis 准入。当前跨进程 Proposal 主要覆盖只读 SQL，通用写工具审批仍属于后续业务阶段。
- [x] 完成结构化 Trace、预算与 Eval 指标、脱敏策略和用户反馈入口；当前以本地 Run/ToolCall/SQLAudit/ModelUsage 关联、低基数 Runtime/Eval 指标、统一脱敏审计和结构化反馈业务测试为证据，不保存 Chain-of-Thought、完整 Prompt 或默认原始模型响应。生产统一指标系统和长期告警仍后置。
- [x] 只允许 Python 产生 Tool/SQL Proposal；Java Tool Gateway 不向 Python 暴露 PostgreSQL 业务库凭据。
- [x] Java 已接入独立 Proposal consumer、只读 SQL Guard、审计和 Result producer；`runtime_tool_proposal_inbox` 固化 `proposal_id + request_hash` 幂等事实。
- [x] Python Result consumer 已接入 Redis 幂等 Inbox；Java command RocketMQ 真实传输 E2E 已通过。
- [x] Python Proposal Publisher/Result consumer 与 Java Tool Gateway 的业务往返已通过本地真实 E2E；验证只读 SQL、PostgreSQL 审计、Result 和 Proposal Inbox 幂等。
- [ ] 只读数据库账号和真实云模型价格表审计仍待完成；真实云调用已通过，Proposal/Result Broker 故障注入已完成，生产级 Outbox 长时间重试容量仍待验证。

M1-4 的上述治理项均属于最小真实模型闭环的完成门槛，不得把“能调用一次模型”标记为 M1-4 完成。状态、wire 和数据库扩展必须先更新契约与迁移，再进入实现。

风险：模型幻觉、供应商故障、成本失控和敏感数据外发。控制方式：输入最小化、脱敏、预算/频率限制、模型日志摘要、降级回答和人工可追溯。

### M1-5 核心饮食业务与工具确认

- [x] V13/V14/V15 结构已落地并经本地只读校验确认：`food_logs`、`food_log_items`、`nutrition_foods`、`nutrition_unit_conversions`、`approval_requests`、计划生命周期字段，以及 `operation_audits` 幂等字段和索引。
- [x] 实现饮食记录创建、查询、编辑、删除、恢复与幂等键；编辑/删除/恢复使用 `revision`，编辑采用整条内容替换并重新生成明细营养快照。
- [x] 实现 today/7d/30d 营养分析、覆盖率、不完整提示和非医疗免责声明；V33 已导入 1,000 条 approved/official USDA 食材和 1,518 条 USDA foodPortions 单位换算，并通过 V32/V33 本地 validation，已有 matched/pending 分支保护。
- [x] 实现餐食计划创建、查询、修改、校验、保存、软删除、恢复和购物清单生成；V15 `revision`/幂等迁移及本地 HTTP 回归已通过。
- [x] 实现 `meal_plan.save_plan` 的 Proposal -> Confirm -> Execute、过期/参数摘要校验、CAS 执行和审计重放。
- [x] 实现 `food_log_writer` 的本地写入能力：确认绑定、AgentRun/用户归属、幂等/摘要校验、复用 `FoodLogService` create/update/delete/restore、资源 ID 回填和重放保护。
- [x] 完成营养 seed V1/V2 的人工导入和校验，以及 `food_log_writer` `food_log.create` 的真实 PostgreSQL HTTP/RocketMQ Proposal/Result 回归。
- [x] 完成 Java 写确认状态机的拒绝、失败、superseded 分支，以及 `food_log_writer` 的 update/delete/restore 扩展；失败时业务事务回滚，独立事务记录 `failed` 和失败审计。
- [x] 完成上述扩展的真实 HTTP/MQ Proposal/Result 回归：HTTP 与 RocketMQ 各 11 个用例通过，覆盖拒绝无写入、失败事务回滚与失败审计、superseded、update/delete/restore、revision 冲突、成功 Proposal 幂等重放，以及官方 foodPortions 换算 matched/pending 和数据库快照断言。

实施顺序：手工录入 -> 营养目录和确定性计算 -> 日报分析 -> 计划和购物清单 -> Agent Proposal/Confirm 复用同一 Java 写入用例。

边界：不把模型输出直接写数据库；不承诺疾病诊断、处方或紧急饮食方案。

### M1-6 审计、可观测性与核心部署

- [x] 完成 M1-6 范围内统一审计代码覆盖：通过 `OperationAuditPort` 单适配器覆盖账户、记忆、个人数据、预算/取消/恢复、审批和核心饮食写操作；审计摘要脱敏且失败关闭。真实 PostgreSQL 全量覆盖计数仍随流量/故障矩阵记录。
- [x] 保留 Java Actuator liveness/readiness，增加本地可访问基础 metrics，并补充 local 配置回归测试。
- [x] 本地运行两个独立 Java JVM，共享 PostgreSQL，完成有界认证会话读取的 P50/P95/P99、吞吐和错误率统计；结果不外推生产容量。
- [ ] 扩展到共享 Redis/RocketMQ、Agent 业务流量、队列积压和重复执行统计。
- [ ] 完成 Java、Python、PostgreSQL、Redis、RocketMQ 重启及 Outbox/Inbox 重试、幂等和 SSE 恢复验证。

后置范围：staging/production、Kubernetes、云部署、完整生产监控、数据库备份恢复、灾备切换和发布回滚流程。

当前本地门槛：核心用户路径可在本地真实依赖重复跑通；关键安全、权限、写确认、数据持久化、取消/超时、浏览器 E2E 和进程重启恢复均有证据。生产发布门槛属于后置阶段，不能用本地结果替代。

## 7. M2：扩展能力版

### M2-1 知识库与 RAG

- [x] 完成对象存储、文档批量上传、PDF/DOCX/Markdown/TXT 解析、分块、版本、删除、恢复和异步索引任务的核心实现与业务测试。
- [x] 完成 stub/local 向量与关键词检索、metadata 权限过滤、引用返回、索引失败手动重试和下线可见性同步的核心实现与业务测试。
- [x] 将 RAG 引用展示接入前端，支持 run.completed 安全引用和可展开引用块；无命中时不编造引用。
- [x] 完成文档格式、基础恶意文件/来源/PII/索引成本策略的代码门禁与稳定错误码。
- [x] 完成 deterministic 本地依赖下 Java -> RocketMQ -> Python -> Redis/Milvus -> Java 的上传、索引、发布、检索和 SSE 引用联调，并已在 Docker `foodmate`/`agent-runtime` 应用容器中复验 stub 与 local deterministic 两种业务路径；真实云 Embedding 两个 profile 已补充单次 Docker 协议证据，性能、长稳与故障矩阵按当前决策后置，不作为本轮业务门禁。

风险：未授权文档泄露、过时引用、索引任务堆积和存储成本。控制方式：权限元数据、版本化、队列监控、配额和数据保留策略。

### M2-2 Java Tool Gateway 与 SQL Agent

- [x] 实现 Tool Registry、版本、输入输出 Schema、scope、风险等级、启停、超时、重试和幂等策略。
- [x] 完成 Proposal -> Policy -> Confirm -> Execute -> Audit 的 Java 受控执行链路。
- [x] 实现只读 SQL Guard：AST 解析、单语句、只读、schema/字段白名单、敏感字段遮蔽、用户过滤、行数与超时限制。
- [x] 实现 SQL 审计、结果脱敏、错误分类、攻击样例和越权回归测试。
- [x] 完成 deterministic Java/Python/PostgreSQL/RocketMQ SQL Agent 跨运行时业务联调；`time_parser -> database_query -> Composer` 多轮 Run、SQL 审计、空数据语义和事件连续性已验证。真实云模型稳定性和性能/故障门禁后置。

边界：Python 只能提议，不能访问数据源账号或绕过 Java Policy；SQL Agent 不允许任何写操作。

### M2-3 管理后台与模型治理

- [x] 用真实接口替换用户、AgentRun、工具、知识库、审计、软删除资源和模型用量页面 mock；Trace 列表与 `/api/admin/queries/traces/{traceId}` 脱敏明细接口已接入，生产 Trace 平台和告警仍后置。
- [x] 实现分页、筛选、权限、状态变更、审计追踪和高危操作二次确认。
- [x] 实现模型供应商、模型路由、预算、配额、成本汇总和阈值状态提示；不建设生产告警平台。
- [x] 为管理员/运营人员增加最小权限、操作留痕和导出控制；管理员导出资源/字段白名单、幂等、过期和一次性下载均已接入，superadmin 才可导出高敏资源。

## 8. M3：生产强化版

- [ ] 完成接口、SSE、模型调用、数据库和队列的生产压测与容量基线（本地双 JVM 基线属于 M1-6，生产压测后置）。
- [ ] 完成依赖漏洞扫描、密钥轮换、权限审计、渗透测试和安全事件预案。
- [ ] 后置：完成数据库备份恢复、跨环境迁移、灾难恢复和发布回滚演练；当前明确不做数据库备份。
- [x] 完成数据保留策略、legal hold、审批、对象/向量清理任务、失败重试、DLQ 安全摘要/人工重放契约和实时审计快照代码及业务测试；数据库硬删除默认关闭，实际删除与生产演练后置。
- [ ] 完成浏览器兼容性、可访问性、移动 Web 适配和性能优化。

## 9. 跨阶段质量门禁

- [ ] Java：单元测试、PostgreSQL 集成测试、架构依赖测试、API 安全测试全部通过。
- [ ] Python：pytest、契约测试、离线评测、无业务数据库凭据检查全部通过。
- [ ] 前端：lint、typecheck、单元测试、API 契约测试、浏览器 E2E 全部通过。
- [ ] 数据库：每次人工执行脚本均有执行人、环境、版本、校验结果、备份位置和回滚结论。
- [ ] 安全：权限越权、CSRF、会话撤销、敏感日志、模型输入脱敏、Tool/SQL 绕过均有回归用例。
- [ ] 发布：上线前必须完成 Smoke、监控检查、错误预算检查和回滚演练；没有实际证据不得标记完成。

## 10. 明确后置的事项

- 原生 iOS/Android 客户端。
- 对外开放 API、第三方开发者平台、OAuth2/OIDC。
- 多租户 SaaS 的组织、账单、隔离与运营能力。
- 医疗诊断、治疗、处方、紧急建议和医疗器械相关能力。
- 任何绕开 Java 授权层、让 Python 直接读写业务数据库的设计。

## 11. 推荐执行顺序

1. M0-1 至 M0-3 的本地最小可信基线已完成；剩余生产复验和隔离演练与后续发布准备并行推进。
2. M1-1、M1-2，先完成真实账号、会话和前端接入。
3. M1-3、M1-4，完成 Java/Python Agent 可靠主链路。
4. M1-5、M1-6，完成用户能感知的核心业务、审计和部署。
5. M2-1 至 M2-3，逐步扩展知识、工具、SQL 和运营能力。
6. M3，在实际用户量和运维需求出现后强化可靠性与安全性。

每个小项开始前只需补充该项的接口、数据和验收细节；未完成其前置依赖，不应并行推进高层功能。
## 历史 M1-4 复核记录（不覆盖顶部当前状态）

> 以下记录保留历次测试的原始结论，便于追溯失败和修复过程；当前唯一状态入口是本文顶部的“当前复核状态”和 M1-4 最新执行结果。

### 2026-07-28 最新复核
- [x] PostgreSQL、Redis、RocketMQ Proxy/Broker 进程停止、端口不可达、重启恢复 healthy 的本地演练；未删除数据卷。
- [x] 新增长压测试 `M14AdmissionLongStressTest`，30 秒真实 Redis 基线采集 P50/P95/P99、active 峰值、容量拒绝和协调错误。
- [x] 两个独立 Java JVM 在 18082/18083 启动并通过 liveness；正式多实例业务流量验证仍未完成。
- [x] SiliconFlow 单次真实云调用成功：模型列表、真实回答、provider request ID 和 usage 均已验证；完整 Runtime 的 composer 在 90 秒超时，Eval 未启动，不能据此宣称云编排验收完成。
- [x] Proposal/Result Broker 故障注入：Broker 停止时发送得到 `No route info of this topic`；恢复后真实 Proposal/Result 成功，Inbox 幂等测试通过。
- [ ] 浏览器完整登录、会话、消息、SSE E2E；当前 RocketMQ 消费链仍有 queued/routing 停滞证据。
- [ ] 生产级容量结论、队列防饥饿和多 Java 实例业务流量验证；120 秒结果仍只是本地单 Redis 基线。

- 已完成：模型适配器 fixture 契约、Proposal/Result 幂等单测、真实模式会话路由修复、64 位 ID 字符串契约、代理 Origin 修复。
- 已验证：Python pytest 27 项、Java API/依赖模块测试 27 项、前端 typecheck/build。
- 仍未完成：真实云供应商价格表审计、浏览器完整真实 SSE E2E、生产级并发/队列防饥饿/多实例业务流量验证。
- 最新阻塞：完整 Runtime 的真实 SiliconFlow composer 在 90 秒内超时，Eval 尚未启动；生产价格尚未配置，长压仍只有本地单 Redis 基线。

### 历史记录：2026-07-29 追加验证

- [x] 价格治理代码：支持供应商级价格、供应商+模型级覆盖、价格版本和缺价 fail-closed；Python 单测 9 项通过。
- [x] 长压本地基线：`M14AdmissionLongStressTest` 运行 120 秒通过，`operations=518`，`active_max=10`，`queued=196`，`capacity_rejected=1573694`，`P50=2.468ms`，`P95=112.731ms`，`P99=113.219ms`。这是本机单 Redis 基线，不是生产容量承诺。
- [ ] 真实云完整编排：单次 Chat Completions 已成功，但完整 Runtime composer 在 90 秒内超时并记录 `MODEL_TIMEOUT`，未进入 Eval；需要供应商侧响应稳定性或专用短 prompt/timeout 策略后重新 gated 验证。
### 历史记录：2026-07-29 价格审计校正

- [x] Python 价格解析支持供应商 + 模型级覆盖，兼容旧供应商级变量；每条 `run.model_usage` 记录实际命中的 `price_version`。
- [x] `FOODMATE_MODEL_PRICE_AUDIT_REQUIRED=true` 时，云模型缺少非负输入/输出价格或价格版本会在发出请求前返回 `MODEL_PRICE_UNCONFIGURED`；本地 `deterministic:local` 不受影响。
- [ ] SiliconFlow 当前模型价格尚未从官方价格表核准，因此没有擅自填入价格；生产价格表审计和账单抽样对账仍未完成。
- [ ] 30 秒压力测试仍只是本地单 Redis 基线；长时间容量、P95/P99 目标和生产拓扑结论仍未完成。
### 历史记录：2026-07-29 最终本地验证补充

- [x] SiliconFlow `deepseek-ai/DeepSeek-V4-Flash` 已完成真实 composer 与独立 Eval 调用：composer 33.561 秒、Eval 14.282 秒，两个 request ID、Token、价格版本与成本均已记录。该次 Eval 返回拒绝并安全降级，证明 Gate 生效；不把拒绝结果伪装成通过。
- [x] 价格表采用用户提供的 SiliconFlow 控制台数值：普通输入 ¥1.000/M Token、缓存命中输入 ¥0.020/M Token、输出 ¥2.000/M Token，版本为 `siliconflow-console-2026-07-29`。运行时支持缓存输入独立计价，并已开启缺价 fail-closed。
- [x] `M14AdmissionLongStressTest` 重新运行 120 秒通过：579 次准入、`active_max=16`、0 次协调错误、P50 2.513ms、P95 136.629ms、P99 137.273ms。该结果只代表本机 Docker Redis 基线，不构成生产容量承诺。
- [x] 两个独立 Java JVM (`18080`、`18081`) 共享 PostgreSQL/Redis 验证：A 注册/登录与写消息，B 创建会话并读取同一消息，跨实例业务数据一致。
- [ ] 生产结论仍需接近生产的部署资源、持续更长时段负载、业务 Agent 全链路并发和故障期间的恢复指标；不能由本地单机结果替代。
### 历史记录：2026-08-01 本轮执行裁决

### 已完成并有验证证据

- [x] Python 事件顺序修复：所有模型调用前先发布 `run.routed(event_seq=2)`；模型失败从 `event_seq=3` 开始，不再生成 Java `RUNTIME_EVENT_GAP`。
- [x] Runtime readiness：真实报告 Redis、checkpoint backend、RocketMQ event/proposal producer、command/result consumer；协调依赖不可用返回 `503/RUNTIME_COORDINATION_UNAVAILABLE`。
- [x] Eval 基础统计：记录 pass/degrade、Eval provider failure、schema invalid、P95/P99 gate latency；Python 回归测试覆盖 schema、provider failure、统计分位数。
- [x] Eval 运行时回归：复杂请求在独立 Judge 前不发布正文，Judge schema/分数/provider 失败均 fail-closed；Golden、模型失败、工具失败和安全降级路径均有自动化测试。
- [x] 本地真实浏览器闭环：真实登录态、会话、消息、RocketMQ command/event、Java PostgreSQL Inbox、最终 SSE 已通过；成功 Run 事件序列为 `accepted -> routed -> model_usage -> model_usage -> answer_stream -> completed`。
- [x] SiliconFlow 云调用失败可观测：本轮 Composer 超时记录为 `run.model_usage(status=timeout) -> run.failed(MODEL_PROVIDER_UNAVAILABLE)`，且序列连续；这不等于云模型稳定性通过。
- [x] Java 恢复生产入口：Python checkpoint 保存后发布 `run.checkpoint_saved`，Java 从 PostgreSQL Inbox 对账版本/digest/预算 revision/节点；新增认证入口 `/api/agent-runs/{runId}/recover-from-checkpoint`，创建新的 dispatch attempt。
- [x] 恢复契约回归：Java 单测、控制器鉴权测试、Python CAS/recovery 校验测试和 PostgreSQL `M14RuntimeCheckpointRecoveryE2ETest` 已通过；该证据覆盖 Java Inbox 对账和新 attempt，不等同于 Python 进程重启后的业务恢复。

### 仍未完成，不得提前勾选

- [x] Python Runtime 进程重启后的本地依赖恢复：重启后 readiness HTTP 200，Redis checkpoint 后端和 RocketMQ producer/consumer 全部 ready；本轮未制造带未完成业务 Run 的中断，因此不替代完整 checkpoint 业务恢复 E2E。
- [ ] 生产级长压、P95/P99 容量结论、队列防饥饿和多实例业务流量验证；本地单机 Redis/单 Broker 基线不能替代生产结论。
- [ ] 正式 SiliconFlow 价格表核准和账单抽样对账；代码已支持 `price_version`、成本记录和价格缺失 fail-closed，但未把任何价格表视为正式审计结论。
- [ ] RAG 生产检索、完整 Tool/SQL 业务场景和真实云 Composer + Eval 长时间稳定性重复验证。
- [ ] 生产 Eval 质量闭环：本地 Golden 与运行时指标已完成，仍需固定版本的人工校准样本、通过率/降级率告警和统一指标存储后才能形成生产质量结论。

本轮 Python 验证使用 `agent-runtime/.venv`，结果为 `51 passed, 1 skipped`。本地 deterministic 闭环通过不代表 M1-4 整体完成，M1-4 的发布门槛仍由上述未完成项决定。
### 历史记录：2026-08-01 Eval Gate 与迁移修正补充

- [x] Python 发布独立 `run.eval_decided` 质量门事件；Java 作为非终态事件写入 Inbox/SSE，正文仍在 Eval 通过后才发布。
- [x] Eval 本地 Golden、Judge schema/provider fail-closed、安全降级、P95/P99 指标回归已用项目 `.venv` 执行：`56 passed, 1 skipped`。
- [x] 前端 Vitest `4 passed`、typecheck 通过；Java 受影响模块编译通过。
- [x] 修正并幂等执行 V12 迁移；此前运行中的旧进程曾在补列前报告 `runtime_event_inbox_v2.attempt` 缺失，重启后应以当前 schema 为准。
- [ ] 生产 Eval 质量闭环仍未完成：需要固定 Prompt/模型/价格版本、人工 reviewed calibration、统一指标存储、通过/降级/失败告警和账单对账。

### 历史记录：2026-08-01 最新执行结果

### 已完成并有本轮证据

- [x] Python Eval 回归：使用 `agent-runtime/.venv` 执行，`56 passed, 1 skipped`；覆盖 Golden、Judge schema/provider fail-closed、安全降级、正文延迟发布、模型失败、工具失败和 P95/P99 指标。
- [x] Java Redis 并发回归：`M14AdmissionConcurrencyE2ETest` 为 `6 passed, 0 failed`；测试使用 Redis logical DB 15，已隔离运行中服务的后台续租任务。
- [x] Java Redis 30 秒长压：`M14AdmissionLongStressTest` 通过，`operations=268`、`active_max=20`、`queued=140`、`coordination_errors=0`、P50 `5.227ms`、P95 `121.163ms`、P99 `121.733ms`。该结果仅是本机 Docker Redis 基线。
- [x] Java 恢复服务真实入口、浏览器真实登录/会话/消息/SSE、RocketMQ 主链路和 Python 重启后的 checkpoint 恢复已完成本地闭环验证；恢复使用新的 `dispatch_id + attempt`。
- [x] 前端 typecheck、Vitest `4 passed` 和生产构建通过；`run.eval_decided` 在正文前发布，正文只有在 Eval 通过后才进入 `run.answer_stream`。

### 仍未完成的生产收尾项

- [ ] 生产资源上的长时间压力、容量 P95/P99 目标、队列防饥饿、多 Java 实例真实 Agent 业务流量和 Redis/RocketMQ/PostgreSQL 故障期间的恢复指标。
- [ ] 真实云模型的长时间、重复运行稳定性；默认模型仍是 `deterministic:local`，不能把一次云调用当作稳定性验收。
- [ ] SiliconFlow 正式价格表核准、价格版本人工复核、账单抽样对账和成本异常告警；代码已有价格缺失 fail-closed 与 `price_version` 记录，但配置值不是审计结论。
- [ ] 生产 Eval 质量闭环：固定 Prompt/模型/价格版本、人工 reviewed calibration、统一指标存储、通过/降级/provider failure/schema invalid/P95/P99 告警和账单关联。
- [ ] 生产 RAG 检索与完整业务 Tool/SQL 场景的真实云 Composer + Eval 长时间重复验证。
