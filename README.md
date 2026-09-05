# FoodMate

## Security checks

Run the local high-confidence secret and repository hygiene check with:

```powershell
.\script\security\security-scan.ps1
```

Optional dependency checks are explicit because they may need network access and vulnerability
databases: add `-RunNpmAudit`, `-RunPythonAudit`, or `-RunMavenDependencyCheck`. Use `-Strict` in a
CI/security gate so missing scanners are failures. Never put real provider keys in the repository;
use an ignored `.env` file or the runtime secret store.

FoodMate 是面向饮食记录、营养分析与备餐规划的任务型 Agent 产品。它不提供医疗诊断、治疗、处方或紧急健康决策；涉及高风险健康判断时，系统应安全降级并提示用户咨询医生或注册营养师。

## 项目架构

![FoodMate 当前架构](./docxs/架构/图/FoodMate当前架构.svg)

核心边界：

- `foodmate-ui` 负责用户界面、认证交互、SSE 展示以及追问/写确认状态。
- Java 控制面是用户、授权、饮食业务数据、工具执行、写确认和审计的唯一权威。
- Python `agent-runtime` 负责受控 Agent 编排、模型适配与结果组装，不能直连 FoodMate 业务数据库。
- PostgreSQL 是业务真值；Redis 保存协调、租约和 checkpoint 等技术状态；RocketMQ 提供至少一次异步传输。

![FoodMate Agent 运行闭环](./docxs/架构/图/FoodMateAgent运行闭环.svg)

完整的边界、状态机、预算、Eval、写确认与退回规则见：[架构总览](./docxs/架构/架构总览.md)、[Agent 运行架构](./docxs/架构/Agent运行架构.md)、[M1-5 实施方案](./docxs/项目/M1-5核心饮食业务与写确认实施方案.md)、[ADR-0005](./docxs/决策/ADR-0005-RocketMQ异步主通道.md)。

## 当前真实状态（2026-09-06）

以下仅记录已经运行验证的事实；“已实现”不等于已经完成完整生产闭环。

| 范围 | 已验证事实 |
|---|---|
| 本地基础设施 | Docker 中 PostgreSQL、Redis、MinIO、Milvus、RocketMQ NameServer/Broker/Proxy 均可 healthy；M2-1 `local-stub` 不依赖 Milvus。 |
| M1-2/M1-3 基础链路 | PostgreSQL E2E 已验证注册、登录、Cookie/CSRF、会话创建、消息持久化和读取；Java -> Python deterministic stub -> Java -> SSE 最小闭环已验证。 |
| 异步传输 | Java PostgreSQL Outbox -> RocketMQ -> Consumer 的真实 E2E 已验证 envelope、`request_hash`、`dispatch_id` 与 `run_id`。 |
| Tool/SQL 闭环 | Proposal -> Java Tool Gateway -> 只读 SQL / 审计 -> Result 的真实 E2E 已验证；SQL 失败会记录 `SQL_EXECUTION_FAILED`，重复 Proposal 不重复执行。 |
| M1-5 饮食业务 | 饮食记录创建、查询、编辑、删除、恢复，today/7d/30d 分析，餐食计划生命周期和购物清单已接入 Java/SQL/API；本地 PostgreSQL 当前有 1,000 条 approved/official USDA 食材和 1,518 条 approved USDA foodPortion 换算，规范键、来源 ID 和换算规则均通过校验，matched/pending 分支保持可用。 |
| M1-5 写确认 | `meal_plan.save_plan` 和 `food_log_writer` 的 create/update/delete/restore 已完成 Proposal -> Confirm -> Execute；reject、failed、superseded、revision 冲突、失败回滚/审计和幂等重放已通过真实 PostgreSQL HTTP/RocketMQ 回归。 |
| Agent、Eval 与 RAG | `run.eval_decided`、预算、checkpoint、continuation、追问和安全降级已进入运行路径；公共知识库已完成批量上传、异步索引、发布可见性和 `public_published` 安全引用。默认仍是 `deterministic:local`；Docker Runtime 的启动、readiness、配置契约和历史凭据下的 SiliconFlow Chat/双 Embedding 单次证据已验证。D114 使用当前凭据请求两个 Embedding profile 均返回 HTTP 401（`Api key is invalid`），因此当前凭据下不能宣称真实 Embedding 调用成功；两个 profile 仍使用独立 Milvus collection，长稳、正式价格审计和生产 RAG 治理仍未完成。 |
| 恢复与 M1-6 本地门禁 | 已验证 Runtime readiness、Redis AOF 探针恢复、RocketMQ 重启/Topic 初始化、双 JVM 有界读取和 Java 重启回读；完整 PostgreSQL/Outbox/Inbox/SSE 故障矩阵仍未完成。 |
| 前端 | G1-G6 页面代码边界、追问/确认/失败/取消/SSE 状态、真实管理查询和知识库批次/RAG 引用接入已完成；2026-09-02 当前工作区 typecheck/build 通过，Vitest 为 38 个测试文件、236/237 通过，`RunsTab` 详情加载测试仍有 1 项失败。 |
| Java 回归 | 当前 Java 全量业务门禁、Spotless、ArchUnit 和 Alibaba 可执行规范子集均通过；HTTP 与 RocketMQ `food_log_writer` 回归各 11/11，包含官方 foodPortions 换算 matched/pending 数据库断言。具体运行批次和跳过项以 [`EXECUTION_RECORD.md`](./script/sql/FoodMate/EXECUTION_RECORD.md) 为准。 |

当前不能宣称完成的内容：

- 真实云 embedding/Chat 的长稳、生产 RAG 质量/容量和统一生产 Trace/指标治理。
- 营养目录的人工营养学复核、复合菜配方和生产级目录治理仍未完成；当前本地目录已导入 1,000 条可追溯 USDA 食材。
- 生产资源上的长时间压测、P95/P99 容量结论、跨节点故障切换、PostgreSQL 进程故障和持续业务 Agent 流量验证。
- 供应商正式价格表核准、账单抽样对账、人工 Eval 校准样本、成本异常告警和完整生产监控治理。
- 真实付费 embedding/模型的长稳与成本对账、生产浏览器兼容矩阵和发布级知识库运维验收。

## 本地启动

### 1. 启动基础设施

先参考 [`docker/.env.example`](./docker/.env.example) 补齐本地根目录 `.env`，尤其是 MinIO 管理员凭据；不要把真实云模型密钥提交到仓库。

```powershell
docker compose --env-file .env -f docker/compose.yml up -d
docker compose --env-file .env -f docker/compose.yml ps
```

`rocketmq-namesrv` 与 `rocketmq-broker` 分别是名称服务和消息存储/投递节点；`rocketmq-proxy` 是 Python RocketMQ 5.x gRPC 客户端使用的协议代理，不是额外的 Broker。

### 2. 启动 Java 控制面

```powershell
.\mvnw.cmd -pl foodmate-bootstrap -am package
& java -jar '.\foodmate-bootstrap\target\foodmate-bootstrap-0.1.0-SNAPSHOT.jar' '--spring.profiles.active=local'
```

`local` 连接本地真实 PostgreSQL 等基础设施；`local-stub` 只用于不依赖真实基础设施的兼容/开发场景。

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health
```

### 3. 启动前端

```powershell
cd foodmate-ui
npm install
npm run dev
```

### 4. 运行已使用的验证命令

```powershell
.\mvnw.cmd verify
.\mvnw.cmd -pl foodmate-bootstrap -am '-Dfoodmate.local-e2e=true' '-Dtest=LocalPostgresE2ETest' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\mvnw.cmd -pl foodmate-bootstrap -am '-Dfoodmate.local-mq-e2e=true' '-Dtest=M14RocketMqTransportE2ETest' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\mvnw.cmd -pl foodmate-bootstrap -am '-Dfoodmate.local-mq-e2e=true' '-Dtest=M14ProposalResultE2ETest' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\mvnw.cmd -pl foodmate-bootstrap -am '-Dfoodmate.local-e2e=true' '-Dtest=M14RuntimeCheckpointRecoveryE2ETest' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\mvnw.cmd -pl foodmate-bootstrap -am '-Dfoodmate.local-mq-e2e=true' '-Dtest=M15FoodLogWriterHttpE2ETest,M15FoodLogWriterProposalResultE2ETest' '-Dsurefire.failIfNoSpecifiedTests=false' test
```

## 文档

[文档索引](./docxs/文档索引.md) 是唯一导航入口。发生冲突时，以实际代码、迁移和测试事实优先；内部 Java/Python 消息以[双运行时内部契约 V1](./docxs/契约/双运行时内部契约V1.md)为准。

## 2026-09-02 历史进度补充

- D112（2026-09-02）使用当时有效的历史凭据验证 Docker `agent-runtime` 的 `BAAI/bge-m3` 与 `Qwen/Qwen3-Embedding-0.6B` 均返回 1024 维向量，容器 readiness 正常并恢复为 Qwen profile。切换到 BGE 必须使用 BGE 专用 collection、重新创建容器并重新索引，不能混写两个模型的向量；该结果是历史凭据下的单次协议/业务证据，不代表当前密钥或生产能力。
- D114（2026-09-02）使用当前本地凭据复验两个 Docker Embedding profile，供应商均返回 HTTP 401 `Unauthorized`，响应摘要为 `Api key is invalid`。Runtime、配置和 readiness 正常，但当前密钥需要在 SiliconFlow 控制台确认有效性或轮换后再复验；未自动换回旧密钥，也未继续重复请求。
- D109-D111 已确认 Docker Python 入口为 `python runtime_server.py`，容器 Python 为 `3.12.14`，宿主端口为 `9002 -> 9000`，live/readiness 均返回 HTTP 200；安全扫描和显式 `-EnvFile .env` 预检通过。当前本地 JWT 服务开关关闭，JWT 重叠轮换检查按脚本规则跳过。
- Docker `agent-runtime` 支持通过 `FOODMATE_DOCKER_HTTP_PROXY`、`FOODMATE_DOCKER_HTTPS_PROXY` 显式配置外部代理，并用 `FOODMATE_DOCKER_NO_PROXY` 隔离 Compose 内部服务；默认不启用代理，未配置可用出站路径时真实请求保持 fail-closed。
- M1-5 的饮食记录、营养分析、餐食计划、购物清单和写确认核心范围已进入真实 Java/SQL/API 链路；`food_log_writer` 已覆盖 create/update/delete/restore，并完成 HTTP 与 RocketMQ 各 11/11 跨进程回归；当前本地目录含 1,000 条 approved/official USDA 食材和 1,518 条 approved foodPortions 换算规则，V32/V33 validation 已通过。
- Agent 运行路径已支持 `run.eval_decided`、预算、checkpoint、continuation、追问和审批确认；写入仍由 Java 授权和执行，Python/模型不直连业务库。
- M1-6 已完成本地 Actuator/metrics 配置回归、Runtime readiness、Redis AOF 探针恢复、RocketMQ 重启恢复、双 JVM 有界读取和 Java 重启回读；生产故障矩阵和容量门禁仍待目标环境执行。
- M2-1 已在 Docker 应用容器中复验 `local-stub` Redis 索引和 local deterministic Milvus 路径，覆盖批次上传、RocketMQ 索引、结果回写、显式发布/下线/恢复、用户检索、AgentRun 引用和批次 SSE；D112 保留历史凭据下两个真实 SiliconFlow Embedding profile 的单次 Docker 协议证据，D114 已记录当前凭据 401 边界。
- Python 使用项目 `agent-runtime/.venv` 的全量 pytest 为 `189 passed、2 skipped、6 subtests passed`；前端当前工作区为 `38` 个测试文件、`236/237` 通过，另有 1 项 `RunsTab` 详情加载测试失败，typecheck/build 通过。local RAG Worker 启动前会等待 Milvus `/healthz`，stub 模式不会探测 Milvus；这些结果不等于生产人工校准、统一指标系统或长期稳定性结论。
- 营养目录 V8 已新增 USDA 食材 `12/12` 和 `foodPortions` 规则 `12/12`；V8 validation 的无效食材、无效规则、食材外键不匹配和规则形状错误均为 `0`。当前本地目录为 `60` 条 approved 食材、`60` 条 approved USDA foodPortion 规则、`75` 条精确质量换算，active conversion 合计 `135` 条；V8 定向 Java 测试为 `2/2` 通过。

## 2026-09-06 真实营养目录基线

- 使用 USDA FoodData Central SR Legacy 数据集生成 V33 目录，清单记录源文件 SHA-256、筛选数量、分类分布和版本快照；原始压缩包未保留在仓库或数据库中。
- V32 结构契约与 V33 seed 已在本地 Docker PostgreSQL `FoodMate` 执行；当前活动数据为 `1,000` 条 approved/official 食材和 `1,518` 条 approved foodPortion 换算。
- V33 validation：活动食材与规范键均为 `1,000`，活动换算与食材/单位组合均为 `1,518`，非法目录值、重复规范键、非法换算值均为 `0`；rollback 前置检查显示本版本暂无饮食明细引用。
- 重新筛选时淘汰的旧生成记录仅做软删除（食材 `9` 条、换算 `12` 条），没有执行 `TRUNCATE` 或宽泛删除；清理前备份保存在 Git 忽略目录 `script/sql/FoodMate/backups/`。
- 本轮只完成真实营养目录数据基线，不调用真实 Chat/Embedding，不写入 Milvus，也不代表 RAG 发布或生产质量验收已完成。

## M1-5 / M1-6 收尾边界

已完成本地真实基础链路、跨进程 checkpoint 恢复、RocketMQ Proposal/Result、Eval Gate、饮食记录与餐食计划、M2-1 公共知识库 RAG、M2-2 Tool/SQL、M2-3 管理核心切片、写确认和本地营养目录扩展。当前仍不能宣称生产完成：真实云模型/embedding 长时间稳定性、生产资源长压与容量结论、队列防饥饿、多实例业务流量、完整依赖故障矩阵、正式价格/账单对账，以及人工校准驱动的生产 Eval 指标告警仍需在目标环境执行。
