# FoodMate Java 业务控制面工程骨架与跨语言边界设计

> M1-5 当前实现口径（2026-09-06）：Java application 已编排手工记录创建/查询/编辑/删除/恢复、分析、餐食计划完整资源生命周期和 `meal_plan.save_plan` Agent 提案共享的业务用例；`food_log_writer` 的 create/update/delete/restore 已接入 Proposal/Confirm/Execute，复用同一 `FoodLogService` 并回填资源 ID，且已通过真实 PostgreSQL HTTP/RocketMQ 各 11/11 跨进程回归，覆盖 rejected/failed/superseded、revision 冲突、幂等重放和 foodPortions 换算分支。计划生命周期已通过本地 PostgreSQL HTTP 回归，覆盖幂等重放、revision 冲突、购物清单失效和恢复。infra 负责 `food_logs`、`food_log_items`、营养目录、计划和 `approval_requests` 持久化；api 只做 HTTP 参数转换。当前仍本地优先，营养目录已有 1,000 条 approved/official USDA 食材和 1,518 条 approved USDA foodPortion 换算，V32/V33 seed/validation 已验证，更广泛 Tool/SQL、生产部署与备份恢复不属于本轮。

版本：v1.2
维护基线：2026-07-25
对应总设计：[系统设计与技术方案](./系统设计与技术方案.md)
对应接口文档：[接口与数据规范](../契约/接口与数据规范.md)
对应行为协议：[智能体行为与工具协议](../契约/智能体行为与工具协议.md)

文档定位：本文件描述 Java 业务控制面的工程边界、Java 与 Python 的内部契约，以及旧 Java Agent 模块的迁移方式。产品边界、工具优先级、查询主路径和模型治理总原则，仍以总设计文档为准。

---

## 0. 先说结论

FoodMate 目标架构采用两个运行时：

- **Java 业务控制面**：继续采用模块化单体，负责认证、RBAC、业务 API、事务、业务数据库、AgentRun、工具执行、SQL Guard、审计和前端 SSE。
- **Python Agent 智能执行面**：从第一阶段就是独立进程，负责编排、Prompt、模型、RAG、记忆策略、SQL proposal、结构化输出和评测。

这不是让 Java 和 Python 成为两个业务后端。Java 是业务真值和最终授权点，Python 只能提出动作与查询建议。Python 不持有业务数据库写权限，不直接执行业务工具，也不向前端提供接口。

当前 Java 根 POM 实际保留 5 个 Maven 模块；仓库中旧 Java Agent 占位目录不属于当前 Reactor 构建。Router、Planner、RAG、模型和 SQL Planner 归 Python Runtime，Tool/SQL Guard 在有真实实现前先按现有 Java 模块内的包组织。

采用双运行时的原因是系统的智能复杂度集中在：

- Agent 编排
- 查询理解
- RAG 检索
- SQL Agent
- 工具调用
- 模型接入与模型治理

这些能力需要 Python Agent 生态的快速迭代；同时业务权限、事务和审计必须继续由 Java 稳定治理。边界限定为两个部署单元，避免演化成任意微服务拆分。

- 领域边界会频繁变化
- 接口协议会反复改
- 调试链路变长
- 部署、联调、排障成本明显上升

当前阶段的推荐形态是：

- **Java 内部按模块化单体设计**
- **Python 内部按单一 Agent Runtime 设计**
- **两个运行时通过同一版本化消息契约协作；目标异步主通道为 RocketMQ，HTTP 保留为兼容和测试适配**
- **前端、业务数据库和业务工具只面向 Java**

RocketMQ 采用普通消息，不使用事务消息。Java 以 PostgreSQL Outbox/Inbox 保证本地事务和幂等；Redis 负责准入，不替代 MQ。完整决策见[ADR-0005](../决策/ADR-0005-RocketMQ异步主通道.md)。

---

## 1. 工程定位与演进策略

### 1.1 当前目标

第一阶段的工程目标不是“平台化”，而是先把下面 6 条主链路跑稳：

1. 会话问答链路
2. RAG 检索链路
3. SQL Agent 查询链路
4. 工具调用链路
5. 记忆写入链路
6. 模型调用链路

### 1.2 为什么现在就拆 Agent Runtime

当前 Java Agent 模块只有占位代码，也没有接入 Spring AI，因此现在迁移没有实质沉没成本。若先在 Java 中完成编排、RAG 和模型接入，复杂后再迁移 Python，会形成重复建设。

- Agent、RAG、模型和评测归一个 Python 运行时，不继续细拆微服务。
- Java 只增加一个 Runtime Client 和内部工具入口，保持业务模块稳定。
- 跨进程复杂度通过固定命令、事件、取消、幂等和错误契约控制。

### 1.3 什么时候继续拆服务

除 Java 控制面与 Python Runtime 这次必要拆分外，只有满足下面任一条件才继续拆服务：

- 单次发布经常被不同模块相互阻塞
- `worker` 的异步负载和主 API 竞争资源
- Python Runtime 内的 RAG 或模型负载需要独立扩容
- 模型网关出现多租户、多配额、多供应商策略治理需求
- 团队已经拆成至少两个稳定协作小组，需要独立发布节奏

### 1.4 后续拆分顺序

FoodMate 推荐的拆分顺序如下：

1. Java `worker`
2. 独立 `model-gateway`
3. Python `rag/knowledge` worker
4. Java `tool/sql-access` gateway
5. Java `api/bff`

这个顺序的原则是：

- 先拆异步和高资源模块
- 再拆有明确治理边界的模块
- Python 编排主链路保持完整，除非有明确的独立扩缩容证据

---

## 2. 目标工程结构

### 2.1 根工程

根工程建议使用 Maven 聚合工程，`packaging` 固定为 `pom`。

根工程职责：

- 管理依赖版本
- 管理插件版本
- 管理 Java 版本与编码
- 管理统一构建规则
- 聚合所有业务模块

目标顶层结构：

```text
foodmate/
  ├── pom.xml
  ├── README.md
  ├── docxs/
  ├── agent-runtime/             # Python，待创建
  │   ├── pyproject.toml
  │   ├── src/foodmate_agent/
  │   │   ├── api/
  │   │   ├── orchestrator/
  │   │   ├── rag/
  │   │   ├── model/
  │   │   ├── sql_planner/
  │   │   └── evaluation/
  │   ├── prompts/
  │   └── tests/
  ├── foodmate-bootstrap/
  ├── foodmate-api/
  ├── foodmate-application/
  ├── foodmate-gateway-client/   # 调整为 Python Runtime Client
  ├── foodmate-infra/
  └── foodmate-shared/
```

当前 Java 控制面采用 5 个 Maven 模块。Tool、Worker、领域规则、RAG、模型、编排和 SQL 的未来职责先在现有模块内以包组织；在出现独立部署、稳定边界或足够实现量前，不预建空 Maven module。

### 2.2 模块清单与角色

| 模块/运行时 | 类型 | 目标职责 |
|---|---|---|
| `foodmate-bootstrap` | Java 启动模块 | Spring Boot 启动、配置和 Bean 装配 |
| `foodmate-api` | Java 接入层 | 外部 HTTP/SSE、鉴权、内部 Agent 事件接收 |
| `foodmate-application` | Java 应用层 | 用例、事务、AgentRun 状态机、DTO 和事件映射 |
| `foodmate-gateway-client` | 历史/过渡目录 | 不参与当前根 POM Reactor；Runtime Client 的现行装配以实际 Java 模块和代码为准 |
| `foodmate-infra` | Java 基础设施层 | PostgreSQL、Redis、对象存储、SQL Guard/只读执行适配 |
| `foodmate-shared` | Java 共享层 | 稳定公共对象、错误、Trace；不共享 Java 类给 Python |
| `agent-runtime` | Python 智能执行面 | 编排、Prompt、模型、RAG、SQL proposal、checkpoint 和评测 |

### 2.3 模块依赖方向

Java 目标依赖方向固定如下：

```text
foodmate-bootstrap
  -> foodmate-api / foodmate-application / foodmate-gateway-client
  -> foodmate-infra / foodmate-shared

foodmate-api
  -> foodmate-application
  -> foodmate-shared

foodmate-application
  -> foodmate-gateway-client
  -> foodmate-shared

foodmate-gateway-client
  -> foodmate-shared

foodmate-infra
  -> foodmate-shared
```

### 2.4 明确禁止的依赖

下面这些依赖一律禁止：

- `api -> infra`
- `api -> Python Runtime SDK/供应商 SDK`
- `domain -> application`
- `domain -> infra`
- `tool -> api`
- `application -> 旧 Java Agent 模块`
- `Python Runtime -> 业务数据库或 Java Mapper`
- `shared -> 任何业务模块`

解释：

- `api` 不应直连数据库、Milvus、模型 SDK 或 Python 内部组件
- `domain` 必须保持纯领域语义，不依赖框架实现
- `shared` 只放稳定公共对象，不能反向侵入业务
- Java 与 Python 通过 OpenAPI/JSON Schema 等语言无关契约协作，不共享编译期领域类

---

## 3. Java 包结构建议

### 3.1 根包

根包统一使用：

```text
com.foodmate
```

### 3.1.1 ID 约束

FoodMate 的主键方案统一为 Snowflake BIGINT，工程实现必须遵循：

- Java 实体内部可以使用 `Long`
- API DTO、SSE 事件、外部集成 DTO 一律把 ID 序列化为字符串
- 前端禁止把 Snowflake ID 当数值参与计算
- 新增表和新增 DTO 不允许再引入 UUID 口径

### 3.2 顶层包结构

```text
com.foodmate
  ├── api
  ├── application
  ├── domain
  ├── infrastructure
  ├── agentclient
  ├── agentevent
  ├── sqlaccess
  ├── tool
  ├── gateway
  ├── worker
  ├── security
  └── shared
```

### 3.3 包路径模板

#### `api`

```text
com.foodmate.api
  ├── controller
  ├── sse
  ├── request
  ├── response
  ├── assembler
  └── advice
```

职责：

- 处理 HTTP / SSE 入站协议
- 参数校验
- 身份上下文解析
- 响应结构封装
- 异常转标准错误码

#### `application`

```text
com.foodmate.application
  ├── service
  ├── command
  ├── query
  ├── dto
  ├── assembler
  └── facade
```

职责：

- 承接 API 发起的用例
- 调用领域层、工具层与 Agent Runtime Client
- 控制事务边界
- 组装 DTO

#### `domain`

```text
com.foodmate.domain
  ├── session
  ├── message
  ├── agent
  ├── memory
  ├── foodlog
  ├── mealplan
  ├── knowledge
  ├── datasource
  ├── tool
  ├── model
  └── common
```

职责：

- 实体和聚合定义
- 领域规则
- 领域服务接口
- 仓储接口

#### `agentclient` 与 `agentevent`

```text
com.foodmate.agentclient
  ├── client
  ├── command
  ├── auth
  ├── config
  └── error

com.foodmate.agentevent
  ├── contract
  ├── handler
  ├── dedup
  ├── statemachine
  └── sse
```

职责：

- 向 Python 派发 Run、取消和恢复命令
- 验证服务身份、契约版本、deadline 和 trace
- 接收、去重并校验内部运行事件
- 更新 Java AgentRun 权威状态并映射前端 SSE

#### `sqlaccess`

```text
com.foodmate.sqlaccess
  ├── catalog
  ├── guard
  ├── tenantfilter
  ├── mcp
  ├── audit
  └── executor
```

职责：

- 返回授权后的 Schema Catalog
- 校验 Python SQL proposal
- 强制只读、敏感字段、用户过滤、LIMIT 和超时策略
- 执行并记录 SQL 审计

#### `tool`

```text
com.foodmate.tool
  ├── registry
  ├── executor
  ├── contract
  ├── calculator
  ├── timeparser
  ├── knowledgesearch
  ├── databasequery
  ├── foodlogwriter
  └── planvalidator
```

职责：

- 维护工具注册表
- 维护输入输出 schema
- 调用具体适配器
- 输出统一 ToolResult

#### `gateway`

```text
com.foodmate.gateway
  ├── client
  ├── config
  ├── header
  └── converter
```

职责：

- Python Runtime HTTP 客户端
- 服务身份与 Header 注入
- Trace、超时和取消透传
- Run/Event 协议转换

#### `worker`

```text
com.foodmate.worker
  ├── job
  ├── handler
  ├── mq
  ├── schedule
  └── listener
```

职责：

- 消费 RocketMQ 消息
- 执行异步任务
- 处理索引构建、摘要、批量任务

#### `infrastructure`

```text
com.foodmate.infrastructure
  ├── persistence
  ├── redis
  ├── milvus
  ├── mq
  ├── minio
  ├── mcp
  ├── external
  └── config
```

职责：

- 具体技术接入
- MyBatis-Plus Mapper、PO、持久化服务实现
- Milvus、RocketMQ、MinIO、MCP 客户端封装

### 3.4 六类核心角色职责边界

| 角色 | 允许做什么 | 不允许做什么 |
|---|---|---|
| `Controller` | 入参校验、鉴权、SSE 输出、错误映射 | 直接访问 DB、直接调模型 |
| `Application Service` | 用例编排、事务控制、DTO 组装 | 写复杂多轮推理逻辑 |
| `Domain Service` | 领域规则、聚合协调 | 依赖框架实现 |
| `Mapper / Persistence Service` | 持久化和查询，封装 MyBatis-Plus Wrapper 与 SQL 细节 | 承担业务决策，或被 API / Orchestrator 直接调用 |
| `Tool Adapter` | 确定性执行 | 负责路由和最终答复 |
| `Worker Handler` | 异步任务处理 | 直接承接用户同步请求 |

持久化调用固定遵循 `Application Port -> Infra Repository/Mapper -> PostgreSQL`。Controller 和 Application Service 不允许直接注入 `JdbcTemplate`、MyBatis Mapper 或 Wrapper。简单 CRUD 使用 MyBatis-Plus；`FOR UPDATE`、CAS、JSONB、Outbox 抢占和 Inbox 去重等依赖数据库语义的查询允许在 Infra Mapper XML/注解中保留显式 SQL，但 SQL 不得散落到业务编排类。

---

## 4. 核心边界与对外接口

### 4.1 Java Runtime Client

`foodmate-gateway-client` 目标上承接 Python Runtime Client，对 Java Application 暴露：

- `dispatchRun(...)`
- `cancelRun(...)`
- `resumeRun(...)`
- `health(...)`

它负责服务身份、契约版本、超时、重试、取消传播和 Trace Header，不负责业务状态迁移。Java Application 创建并持久化 `AgentRun` 后才能派发；重复派发必须使用相同 `dispatch_id` 幂等处理。

### 4.2 内部运行事件

Python 回传事件至少包含：`schema_version`、`event_id`、`event_seq`、`run_id`、`dispatch_id`、`trace_id`、`occurred_at`、`event_type` 和 `payload`。

Java API/Application 负责：

- 验证 Python 服务身份和契约版本。
- 按 `run_id + event_id` 去重并拒绝非法状态回退。
- 持久化 AgentRun、ToolCall、SQLAudit、模型用量和最终结果。
- 将内部事件映射为前端 `run.*` SSE。

Python 可以保存节点 checkpoint 以恢复执行，但 checkpoint 不是业务状态真值。

### 4.3 `foodmate-tool`

Java 工具执行面至少公开：

- `ToolRegistry`
- `ToolPolicyChecker`
- `ToolExecutor`
- `ToolResult`

所有注册工具统一由 Java 执行，Java 是工具契约、启停、授权、幂等和审计状态源。Python 只能提交 `proposed_tool_call`。Java 从已认证会话派生用户和 scope，校验工具版本、输入 schema、确认状态、幂等键和 deadline 后执行。`knowledge_search` 由 Java 强制 ACL 后返回候选结果，Python 可以继续重排和组装引用；`food_log_writer` 等写工具必须通过 Application/Domain 事务。

M1-5 的手工保存不需要 Agent confirmation，但仍必须经过同一 application 用例；Agent/自然语言提案必须校验 `approval_requests` 的用户、资源、操作、参数摘要和有效期，不能把非空 `confirmation_ref` 当作确认事实。

### 4.4 SQL Planning 与 SQL Access

固定主链路：

```text
Python Query Understanding / SQL Planner
-> sql_proposal
-> Java Schema Authorization / SQL Guard / Tenant Filter
-> Java MCP or Readonly Executor
-> Audit
-> Python result interpretation
```

旧 `foodmate-sql-agent` 不再承载 SQL 生成。迁移后，其 Java 能力应归入清晰命名的 SQL access/guard 组件；Python 永远不获得 JDBC 凭据。

### 4.5 Python Agent Runtime

Python Runtime 内部包含 `IntentRouter`、`TaskPlanner`、`ExecutionEngine`、RAG、模型适配、质量校验、`AnswerComposer` 和评测。它决定“建议做什么”，但不能决定“是否有权做”或直接产生业务副作用。

### 4.6 旧模块处置

| 旧模块 | 处置 |
|---|---|
| `foodmate-orchestrator` | 冻结；能力迁移到 `agent-runtime` |
| `foodmate-rag` | 冻结；推理和检索编排迁移到 `agent-runtime` |
| `foodmate-model` | 冻结；Prompt 和模型适配迁移到 `agent-runtime` |
| `foodmate-sql-agent` | 拆分；SQL Planner 迁 Python，Guard/执行迁 Java 基础设施 |
| `foodmate-tool` | 保留；作为 Java 权威工具执行面 |

---

## 5. 关键运行链路

### 5.1 会话问答链路

| 步骤 | 组件 | 输入 | 输出 |
|---|---|---|---|
| 1 | Java `api/application` | 用户消息 | 持久化 Message 与 AgentRun |
| 2 | Java `runtime-client` | 最小权限上下文、工具快照 | `RunCommand` |
| 3 | Python Runtime | 上下文与命令 | 执行事件、工具/SQL proposal |
| 4 | Java Tool/SQL Gateway | proposal | 已授权执行结果或拒绝原因 |
| 5 | Python Composer | 证据与执行结果 | 结构化最终答复 |
| 6 | Java Application | 内部事件与答复 | 权威状态、审计和持久化 |
| 7 | Java `api.sse` | 已校验事件 | 前端 SSE |

### 5.2 RAG 检索链路

1. Java 下发经过授权的知识范围，不把用户声明当可信 ACL。
2. Python 完成查询理解、改写、混合检索编排、Rerank 和引用组装。
3. 文档/ACL 控制状态由 Java 管理；Python 只在授权范围内访问索引。
4. 检索片段作为 `untrusted_content` 返回 Python 编排。
5. 引用随内部事件回传 Java 持久化并输出。

### 5.3 SQL Agent 查询链路

1. Python 判断目标数据域并请求 Java 提供授权后的 Schema Catalog。
2. Python 生成带参数和意图说明的只读 SQL proposal。
3. Java 校验服务身份、schema 版本、AST、敏感字段、用户过滤、LIMIT 和超时。
4. Java 通过 MCP 或内部只读执行器执行并写 `sql_query_audits`。
5. Java 将脱敏结果返回 Python 解释，Python 不接触凭据或 JDBC 连接。

### 5.4 工具调用链路

1. Python 输出 `proposed_tool_call`。
2. Java 验证调用身份、run、工具版本、scope、确认状态和输入 schema。
3. Java `ToolPolicyChecker` 决定 allow、deny 或 require_approval。
4. Java Tool Adapter 在业务事务内执行。
5. Java 写入 `tool_calls` 并把 `ToolResult` 返回 Python。
6. Python 根据执行结果继续编排，不能把拒绝伪装成成功。

### 5.5 记忆写入链路

1. Python 提交候选记忆及来源、置信度和作用域。
2. Java `MemoryService` 校验用户授权、显式性、冲突和敏感性。
3. Java 持久化 `user_memories` 或 `session_summaries`。
4. Python 后续只能通过 Java 提供的授权上下文读取记忆。

### 5.6 模型调用链路

1. Python Runtime 的模型适配层装配 Prompt、模型参数和结构化输出约束。
2. Python 调用供应商或独立模型网关。
3. Python 统一处理流式输出、重试、usage、latency 和 cost。
4. 模型用量事件回传 Java，Java持久化治理记录。
5. Java 业务模块不直接依赖模型供应商 SDK。

---

## 6. 配置与环境设计

### 6.1 配置文件分层

固定使用：

- `application.yml`
- `application-local-stub.yml`
- `application-local.yml`
- `application-dev.yml`
- `application-prod.yml`

`local-stub` 是 B3 默认启动 profile，用于在没有 PostgreSQL、Redis、Milvus、MinIO、RocketMQ 时启动最小应用和健康检查；真实数据库连接从 `local/dev/prod` profile 开始启用。

### 6.2 建议配置树

```yaml
spring:
  application:
    name: foodmate
  datasource:
    url: jdbc:postgresql://localhost:5432/FoodMate
    username: postgres
    password: ${DB_PASSWORD}
  flyway:
    enabled: false # 数据库脚本由运维人员手动执行
  data:
    redis:
      host: localhost
      port: 6379
mybatis-plus:
  global-config:
    db-config:
      logic-delete-field: isDeleted
      logic-delete-value: true
      logic-not-delete-value: false

foodmate:
  agent-runtime:
    base-url: http://localhost:8090
    service-token: ${AGENT_RUNTIME_SERVICE_TOKEN}
    connect-timeout-ms: 2000
    run-timeout-ms: 120000
    contract-version: v1
  mcp:
    read-timeout-ms: 5000
  sql-access:
    readonly-enforced: true
    max-rows: 500
  tool:
    enabled:
      calculator: true
      database-query: true
  audit:
    enabled: true
```

### 6.3 配置职责

| 配置域 | 作用 |
|---|---|
| `foodmate.agent-runtime` | Python Runtime 地址、服务身份、契约版本、超时和取消 |
| `foodmate.mcp` | MCP 调用超时与重试 |
| `foodmate.sql-access` | Java SQL Guard、只读执行和阈值 |
| `foodmate.tool` | 工具开关 |
| `mybatis-plus` | 逻辑删除、字段映射、分页插件等 MyBatis-Plus 行为 |
| `spring.flyway` | PostgreSQL schema 版本迁移 |
| `foodmate.audit` | 审计与落库控制 |

---

## 7. 工程治理约束

### 7.1 Trace 规范

所有请求必须具备：

- `request_id`
- `trace_id`
- `session_id`
- `agent_run_id`

日志打印最少包含：

- 请求入口
- 模型调用
- 工具调用
- SQL Agent 调用
- 错误码
- 耗时

### 7.2 错误码分层

错误码前缀固定如下：

- `API_`：接口层错误
- `APP_`：应用层错误
- `RAG_`：检索错误
- `TOOL_`：工具错误
- `SQL_`：SQL Agent 错误
- `MODEL_`：模型调用错误
- `AUTH_`：权限错误

### 7.3 审计字段

需要审计的对象至少包含：

- `agent_runs`
- `tool_calls`
- `sql_query_audits`
- `model_usage_logs`

统一审计字段：

- `request_id`
- `trace_id`
- `session_id`
- `operator_id`
- `source`
- `status`
- `error_code`
- `created_at`

### 7.4 幂等、重试、超时

固定规则：

- 写接口必须支持幂等键
- 模型调用默认开启超时
- 工具调用只有幂等工具允许重试
- SQL proposal 执行失败只有在幂等且仍通过 `SQL Guard` 时才允许重试
- Python 运行事件必须按 `run_id + event_id` 去重
- 服务间请求必须携带 deadline，禁止无限等待
- Worker 任务重试次数由 RocketMQ 统一控制

### 7.4.1 Mapper、Service 与软删除约束

固定规则：

- MyBatis-Plus 逻辑删除字段固定为 `is_deleted`
- 所有 Mapper / Service 默认查询必须附带 `is_deleted = false`，优先通过 MyBatis-Plus 逻辑删除能力统一实现
- 只有显式的管理接口查询才允许绕过软删除条件
- 业务代码禁止手写“全量查”来跳过软删除
- `DELETE` 操作统一走软删除更新，不允许默认物理删除
- 恢复操作必须记录 `operator_id`、`request_id`、`trace_id`
- Mapper 只能放在 `foodmate-infra`，`api`、`application` 和 Python Runtime 不直接使用 MyBatis-Plus Mapper 或 Wrapper
- 生产代码中的直接 `JdbcTemplate` 访问属于待迁移技术债；测试夹具用于准备数据和断言时可以继续使用 JDBC
- 数据库组件缺失时不得使用 `if (jdbc == null) return` 静默关闭业务能力；可选能力必须由显式配置控制，必选能力缺失应启动失败或返回明确错误

推荐抽象：

- `BasePo`
- `SoftDeleteSupport`
- `RestoreCommandHandler`

### 7.5 Python Prompt 工程化目录

```text
agent-runtime/prompts/
  ├── system/
  ├── router/
  ├── planner/
  ├── query-understanding/
  ├── tool/
  ├── sql-agent/
  ├── validator/
  └── composer/
```

Prompt 加载规则：

- Prompt 不进入 Java 工程，也不写死在 Python 代码常量里
- 每个 Prompt 带 `name`、`version`、`owner`
- 变更必须可回滚

---

## 8. 运行时与后续服务映射

### 8.1 目标映射

| 当前/目标模块 | 未来服务 | 拆分时机 |
|---|---|---|
| `foodmate-api` | `api-bff` | 前后端迭代频率明显分离时 |
| `agent-runtime` | 保持单服务 | 编排、RAG、模型先不继续拆分 |
| `agent-runtime/rag` | `knowledge-runtime` | 检索和索引负载有独立扩容证据时 |
| `foodmate-tool` + Java SQL access | `tool-service` | 工具数量和数据源种类显著增长时 |
| `foodmate-worker` | `worker-service` | 异步任务压缩主实例资源时 |
| Python model adapter | `model-gateway` | 需要独立治理模型路由和配额时 |

### 8.2 拆前条件

每次拆服务之前必须满足：

- 边界已经稳定 2 个迭代以上
- 接口已经标准化
- 日志、指标、审计链路完整
- 调用量足够支撑拆分收益

### 8.3 拆后边界

拆分后固定原则：

- `api-bff` 不直接访问 Milvus 和模型供应商
- Python Runtime 可以持有模型 SDK，但不得持有业务数据库凭据
- `knowledge-service` 只负责查询理解、检索、引用
- `tool-service` 只暴露工具执行能力
- `model-gateway` 只负责路由与治理，不承接业务语义

---

## 9. 迁移与第一版实施顺序

建议按下面顺序真正搭工程：

1. 保持已完成的 Java B3/B4-1 基线，继续完成业务 PO、Mapper、认证和会话。
2. 冻结旧 Java Agent 模块，不再向其中添加实现。
3. 创建 `agent-runtime` Python 工程、项目虚拟环境、健康检查和测试基线。
4. 定义 Run 命令、内部事件、工具调用、SQL proposal、取消和错误的版本化契约。
5. 将 `foodmate-gateway-client` 调整为 Runtime Client，打通最小 Run 与 SSE。
6. Java 实现 ToolPolicy、SQL Guard、只读执行和审计；Python 实现 Router、Planner、Model、RAG 与 Composer。
7. 增加 Maven、pytest、契约和跨运行时端到端测试后，再收缩根 `pom.xml` 中的旧模块。

---

## 10. 最终落地原则

这份工程骨架文档最终只服务一件事：  
**让 Java 稳定治理业务真值，让 Python 专注智能执行，并用版本化契约把两个运行时约束成一个可审计系统。**
