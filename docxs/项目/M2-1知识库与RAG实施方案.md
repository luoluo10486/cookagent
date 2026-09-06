# M2-1 知识库与 RAG 实施方案

状态：deterministic 本地业务闭环已验收，生产强化与性能/故障验证后置

对应路线图：[完整功能实施TODO.md](完整功能实施TODO.md) 的 M2-1；上位执行顺序见 [M2剩余功能执行计划.md](M2剩余功能执行计划.md)。数据和接口字段以 [数据库设计.md](../数据/数据库设计.md) 与 [接口与数据规范.md](../契约/接口与数据规范.md) 为准。V16/V17、Java 知识投递、Python 解析/Redis stub/Milvus adapter、管理批次入口和 AgentRun citation 已完成 deterministic 本地业务闭环，Docker 应用容器的 stub/local deterministic 业务复验也已完成；真实 embedding/云模型、性能和故障矩阵继续后置。

## 当前实现状态（2026-08-27）

| 能力 | 当前状态 | 剩余门槛 |
|---|---|---|
| 数据与任务 | V16/V17 已建立导入任务、索引/可见性 Outbox、结果 Inbox 和批次 SSE；本地迁移与状态收敛已核验 | 生产级迁移编排和故障矩阵后置 |
| Java 投递 | 索引/可见性 relay、结果消费、状态回写和管理 API 已在 PostgreSQL/RocketMQ 业务路径验证 | Docker 应用容器启动和业务复验已完成，长期运行与生产化编排后置 |
| Python Worker | 四格式解析、Redis stub、Milvus 与 visibility 消费已验证；stub Worker 实际完成 MinIO 读取和结果回写 | 真实 embedding provider 和 Milvus 生产强化后置 |
| Agent 引用 | RunCommand 固定公共 scope，Runtime 输出 citations，Java 二次可见性过滤已验证 | 云模型、性能和组件故障验证后置 |
| 管理端 | 批次上传、进度查询、SSE/重试、发布/下线/恢复和聊天引用已完成业务验收 | UI 视觉细节和生产发布治理后置 |

2026-08-27 当前业务门禁复核：Java 全量 `clean verify` 的 Application `200/200`、Infrastructure `81/81`（17 skipped）、API `64/64`、Bootstrap `58/58`（37 skipped）通过；Python `.venv` 为 `124 passed、1 skipped、2 warnings`；前端 38 个测试文件 `196/196`，lint/typecheck/build 通过。上述结果只证明功能版业务正确性，不扩大为真实云服务、性能或故障恢复门禁。

当前 M2-1 完成门槛只要求业务正确性。吞吐、延迟、队列容量、依赖重启和组合故障测试统一后置。

## 1. 范围与决策

首期实现管理员维护的公共知识库。`admin`/`superadmin` 可以上传、索引、发布、下线、恢复和重试；普通用户只可检索已发布的公共文档，不提供私有文档上传、网页抓取、自动第三方导入或跨租户能力。

| 项目 | 决策 |
|---|---|
| 文档格式 | `PDF`、`DOCX`、`Markdown`、`TXT`；不处理图片 OCR、Excel、PPT、压缩包或网页 |
| 上传限制 | 单文件 20 MB，单批最多 20 个；服务端还应限制总字节数并拒绝空文件、伪造 MIME 和路径穿越文件名 |
| 可见性 | 首期固定 `tenant_id=0`、`visibility=public`、`owner_scope=public`；只有已发布、已索引且未删除/下线的版本可召回 |
| 发布 | 上传与索引完成不自动对用户可见；管理员显式发布后才可检索。新版本发布后下线旧版本 |
| 检索模式 | `local-stub` 使用确定性 embedding + 本地关键词检索；`local` 使用 OpenAI-compatible `/embeddings` provider + Milvus。通过环境变量切换，不在代码中写 API Key |
| 引用 | 实际使用 RAG 片段的回答必须给出标题、版本、章节路径和片段引用；无命中或证据不足时明确说明，不编造来源 |
| 内容治理 | 仅限已授权内部 SOP、原创菜谱、营养手册和公开可再利用资料；上传须写来源、版本/日期和授权说明；基础 PII 扫描命中身份证号、手机号或邮箱时拒绝 |
| 重试与成本 | 每文档最多 3 次自动重试并递增退避；超限转 `index_failed`，仅管理员手动重试。并发配置化：stub 默认 4，真实 embedding 默认 4，允许 1-8；真实模式必须配置单批/单日 Token、价格版本和金额上限，缺失失败关闭 |
| 依赖交付 | `docker/compose.yml` 新增 FoodMate 本地 Milvus standalone 与持久卷；`local-stub` 不依赖 Docker/Milvus |
| 真实依赖故障 | `local` 的 API Key、Embedding endpoint 或 Milvus 缺失/不可用时失败关闭，绝不自动降级至 stub 或混用两种索引 |
| 召回边界 | 每次检索最多 12 个候选、rerank 后最多 6 个片段、最终最多 4 条引用；单文档最多贡献 2 条最终引用 |

明确不在本期实现：生产容量基线、云模型长期稳定性、私有知识库、OCR/表格/网页抽取、数据库备份恢复、Kubernetes、staging/production 与发布回滚。

## 2. 架构与边界

```text
Admin browser -> Java API -> MinIO + PostgreSQL transaction/outbox
                                  -> RocketMQ knowledge indexing job
                                  -> Python parser/chunker/embedder/indexer
                                  -> Milvus + Java-visible job result

User chat -> Java derives public_published scope -> RunCommand
          -> Python RAG hybrid retrieval -> cited RunEvent -> Java SSE -> UI
```

- Java 是文档元数据、发布/删除状态、权限、任务状态和业务审计真值；application 通过 port 调用对象存储、持久化和消息基础设施。
- Python Runtime 只接收 Java 下发的授权范围，在该范围内解析、分块、embedding、Milvus/关键词检索、rerank 和引用组装；不能直接访问业务数据库，也不能自行扩大 ACL。
- PostgreSQL 是文档/任务状态真值，Milvus 是可重建的检索可见性副本。软删除或下线先提交 PostgreSQL，再异步标记 Milvus metadata 不可见。
- 原始文件和解析后的临时产物使用私有 MinIO bucket；前端、模型输出和 SSE 均不得包含 `storage_key`、预签名 URL 或对象存储凭据。

## 3. 持久化与状态

复用并补全 `knowledge_documents`、`knowledge_chunks`，新增版本化迁移的 `knowledge_import_jobs` 和 `knowledge_import_items`。不修改 V1 基线，不在本计划阶段执行迁移。

`knowledge_import_jobs` 记录批次操作者、幂等键、总数、进度、状态、成本/Token 摘要和关联 trace；`knowledge_import_items` 记录 `job_id`、`document_id`、原文件名、上传状态、索引状态、尝试次数、错误码、错误安全摘要、幂等键和 lease/更新时间。为 `(operator_id,idempotency_key)`、任务可领取状态和 `document_id + version` 建立唯一/查询索引。

状态规则：

- 批次：`queued -> uploading -> uploaded -> indexing -> completed`，异常终态为 `partial_failed`、`failed`、`cancelled`。
- 文件上传：`queued -> uploading -> uploaded` 或 `upload_failed`。
- 文件索引：`pending -> parsing -> parsed -> indexing -> indexed` 或 `index_failed`。
- 发布状态独立于索引状态：`draft -> published -> disabled -> deleted`。只有 `published + indexed` 可检索。
- 重试复用相同 `document_id` 和版本；不得重复写 chunk 或向量。发布新版本后旧版本的 PostgreSQL/Milvus metadata 下线，不立即物理删除。

批次、文件元数据、业务审计和 indexing Outbox 必须同一数据库事务提交。重复消息由 `job_id + item_id + attempt/idempotency_key` 吸收，Worker 必须能够从已完成事实重放结果。

### 3.1 迁移清单

创建下一个可用序号的 Flyway 手工迁移、对应 validation SQL、rollback 前置说明和变更记录。迁移必须：

1. 新建 `knowledge_import_jobs`，保存 `job_id`、操作者、状态、幂等键、来源/授权摘要、并发/模式快照、计数、Token/成本摘要、trace/request ID、软删除字段与时间戳。
2. 新建 `knowledge_import_items`，保存 `item_id/job_id/document_id`、文件安全元数据、上传/索引状态、尝试次数、下一次尝试时间、lease token/截至时间、稳定错误码、安全错误摘要和索引模式/模型版本。
3. 为同一操作者的批次幂等键建立部分唯一索引；为可领取索引项、`document_id + version`、文档当前发布版本与 SSE 查询建立索引及状态 CHECK 约束。
4. 扩展 `knowledge_documents` 的发布/来源元数据和当前版本标识；`knowledge_chunks.metadata_json` 固定包含 visibility、文档状态、版本和授权来源，但不写原始文件或用户隐私内容。
5. 不改写 V1 或已执行迁移；回滚脚本只在迁移未被真实环境依赖且无保留任务/向量时允许执行，禁止以删除既有业务数据作为回滚手段。

### 3.2 一致性与幂等

- Java 创建批次事务：验证 -> 写私有对象 -> 写 job/item/document -> 写统一审计 -> 写 `knowledge.index.requested` Outbox。对象上传失败时不得创建可领取 item；数据库事务失败时删除本次新对象，删除失败写补偿记录而不是静默忽略。
- Worker 先以 `item_id` 和 attempt 领取 lease，再读取 document/version；已经 `indexed` 的相同模式/版本必须返回既有完成事实，不重复插入 chunk 或 Milvus entity。
- 索引成功时，chunk 行、Milvus metadata、item `indexed`、document `indexed` 的收敛通过可重放任务完成；Milvus 成功但 PostgreSQL 状态未提交时，下一次按稳定 `embedding_id` upsert，不新增重复实体。
- 发布、下线、删除和恢复均创建可重放的 `knowledge.visibility.changed` 任务。Milvus 更新延迟期间以 Java 文档状态作最终检查，禁止返回已下线文档。

## 4. 接口与前端

以 `POST /api/admin/knowledge-documents/upload-batches` 作为首期正式批量入口，使用 `multipart/form-data`：`files[]`、`source_type`、`source_name`、`source_version`、`license_notice`、`start_indexing` 与 `Idempotency-Key`。完成文件接收和任务创建后返回 `202 Accepted`、`batch_id`、每个文件的 `document_id/upload_status/index_status`；不得在 HTTP 请求中同步解析或 embedding。

提供：

1. 批次详情与分页文件状态查询。
2. 批次 SSE 进度，使用既有 Java SSE 机制，事件包含批次/文档 ID、阶段、进度、安全错误码、request/trace ID；支持 `Last-Event-ID` 回放。
3. 单个失败文档的管理员重试接口，返回 `202`。
4. 管理员发布、下线、软删除、恢复和新版本上传接口，均写统一业务审计。
5. 已认证用户的检索接口，返回受权限过滤的标题、版本、章节、受限 snippet 和分数；不返回对象存储地址。

前端管理页接入批次提交、离页后状态恢复、失败重试、发布/下线确认和进度展示。聊天页将最终答案的引用渲染为可展开的标题/版本/章节/片段；无命中只展示事实性提示。

### 4.1 外部接口契约

| 接口 | 行为与权限 |
|---|---|
| `POST /api/admin/knowledge-documents/upload-batches` | `admin/superadmin`；校验并创建批次，返回 `202` 与稳定批次结果；重复 `Idempotency-Key` 必须返回同一批次 |
| `GET /api/admin/knowledge-upload-batches/{batchId}` | `admin/superadmin`；返回汇总、每项状态、可重试动作和安全错误码 |
| `GET /api/admin/knowledge-upload-batches/{batchId}/events` | `admin/superadmin`；SSE 支持 `Last-Event-ID`，只推送任务进度，不推送原文或密钥 |
| `POST /api/admin/knowledge-upload-batches/{batchId}/documents/{documentId}/retry` | 仅重试当前 `index_failed` 项，返回 `202`，不创建新 document/version |
| `POST /api/admin/knowledge-documents/{documentId}/publish` | 仅 `indexed` 当前版本可发布；写审计和可见性任务 |
| `POST /api/admin/knowledge-documents/{documentId}/disable` | 下线当前发布版本；立即阻断后续检索，异步同步 Milvus |
| `DELETE/POST .../{documentId}/restore` | 软删除/恢复与索引可见性同步；恢复不自动发布 |
| `POST /api/knowledge-base/search` | 已认证用户；Java 派生公共授权范围，返回受限 hit，不返回对象键或 URL |

更新契约文档中原有 `/foodmate/...` 目标路径与当前 `/api/...` 应用路由，选定单一外部前缀后统一 controller、前端和文档；不得让同一能力长期暴露双路径。

## 5. RAG 与配置

Java 创建 Run 时从权威身份派生 `tenant_id=0` 和 `knowledge_scope=public_published`，并在内部命令中下发。Python 对 Milvus 与关键词候选集先过滤：tenant、可见性、发布状态、索引状态、删除标记和当前版本；ACL 过滤不能留给 rerank 或模型判断。

`local-stub` 实现稳定可重复的分块、确定性向量和关键词排序，用于无 API Key 的开发及核心业务测试；它只写 Redis。`local` 通过显式 `FOODMATE_RAG_EMBEDDING_PROVIDER` 选择 deterministic 或 openai-compatible provider，并写入 Milvus。deterministic provider 在本地生成稳定向量，不访问外部服务；openai-compatible provider 才读取 endpoint/API Key。两种 provider 共用 chunk、metadata、引用和结果 DTO，切换仅改变 adapter 配置，禁止隐式回退。真实 provider 在提交任务前估算字符/Token，超过预算或超时不启动下一次尝试。

分块采用配置化的字符/Token 上限和 overlap，保留 `section_path`、chunk 序号、文档版本、来源/授权 metadata。检索片段始终是 `untrusted_content`，不得作为系统指令执行；引用需随 Runtime Event 回传并由 Java 持久化/SSE 输出。

### 5.1 配置契约

`local-stub` 固定使用 `FOODMATE_RAG_MODE=stub`，不读取真实 API Key，也不连接 Milvus。需要本地向量业务验证时使用 `FOODMATE_RAG_MODE=local` 和 `FOODMATE_RAG_EMBEDDING_PROVIDER=deterministic`；需要真实 embedding 时将 provider 明确改为 `openai-compatible`。local 两种 provider 都必须配置 Milvus、预算和价格版本，openai-compatible 额外要求 endpoint/API Key/model；任何缺失都失败关闭，不能回退到其他 provider：

| 配置 | 含义 |
|---|---|
| `FOODMATE_RAG_EMBEDDING_PROVIDER` | `deterministic`（本地无费用）或 `openai-compatible`（显式外部服务） |
| `FOODMATE_RAG_EMBEDDING_BASE_URL` | openai-compatible 服务根地址或完整 `/embeddings` 地址；deterministic 留空 |
| `FOODMATE_RAG_EMBEDDING_API_KEY` | 仅 openai-compatible 使用的环境变量 API Key，不写日志/审计/响应 |
| `FOODMATE_RAG_EMBEDDING_MODEL` | 模型名；deterministic 默认 `deterministic-local-v1`，同一 document version 的模型快照不可变 |
| `FOODMATE_RAG_DETERMINISTIC_DIMENSION` | deterministic 向量维度，`8-4096`；首次写入集合后以实际维度校验 |
| `FOODMATE_RAG_MILVUS_URI` | Compose Milvus endpoint 或外部 endpoint |
| `FOODMATE_RAG_MILVUS_COLLECTION` | 默认 `foodmate_knowledge_chunks`；stub 禁止使用此 collection |
| `FOODMATE_RAG_INDEX_CONCURRENCY` | `1-8`，默认 `4` |
| `FOODMATE_RAG_ITEM_TIMEOUT_SECONDS` | 单次解析/embedding 上限 |
| `FOODMATE_RAG_BATCH_MAX_INPUT_TOKENS` / `...DAY_MAX_INPUT_TOKENS` | 真实模式必填 Token 上限 |
| `FOODMATE_RAG_INPUT_CNY_PER_MILLION_TOKENS` / `...PRICE_VERSION` | 真实模式必填价格和版本 |
| `FOODMATE_RAG_BATCH_MAX_COST_CNY` / `...DAY_MAX_COST_CNY` | 真实模式必填成本上限 |

真实模式的 provider adapter 必须复用现有 OpenAI-compatible HTTP 错误分类：认证、限流、超时、服务端错误和格式错误产生稳定 `RAG_*` 错误码。索引模式、模型、维度和价格版本写入 document/item/chunk 元数据；切换模型必须创建新文档版本或显式重建任务，不能覆盖已发布向量。

### 5.2 Compose 与运行时依赖

在 Compose 中添加 Milvus standalone、其 metadata/object-store 依赖和命名卷，并为 readiness 提供健康检查；服务只暴露必要本地端口，加入 `foodmate` network。Python 新增受限客户端依赖和四类解析依赖，全部锁定版本；解析器禁止执行宏、外部链接、脚本或嵌入对象。Java 不直接依赖 Milvus SDK。

RocketMQ 新增 `knowledge.index.requested`、`knowledge.index.completed`、`knowledge.index.failed` 与 `knowledge.visibility.changed` topic/group 配置；消息仅包含 ID、版本、模式、授权范围、摘要和关联 ID，不携带原文、API Key 或预签名 URL。Worker result 由 Java 消费后更新权威 PostgreSQL 状态和批次 SSE outbox。

### 5.3 检索和引用算法

1. Python 接受 Java 下发的 `public_published` scope，先构建 Milvus expression 和关键词过滤，再检索；模型不能修改 scope。
2. stub 使用确定性 token/哈希向量与关键词评分；真实模式使用 dense embedding，并保留相同 metadata filter 和结果 DTO。
3. 两种模式最多召回 12 个候选，去除重复 chunk/失效版本后 rerank 至 6 个，交给 Composer 的证据最多 6 个。
4. Composer 最多输出 4 条引用、每文档最多 2 条；每条包含 `document_id`、标题、版本、章节路径、chunk ID 与安全片段。Java 在投影 SSE 前重新确认 document 仍处于可见状态。
5. 没有足够证据时输出确定性无命中/证据不足状态；不让 Composer 把模型常识包装为知识库来源。

## 6. 实施顺序

1. 先评审并更新接口/数据文档，使批次上限 20、公共可见性、发布门禁和来源元数据成为唯一契约；新增稳定 `KNOWLEDGE_*` / `RAG_*` 错误码。
2. 以新 Flyway 增量落地导入任务表、约束和索引；补齐 application port/DTO/repository，删除或兼容现有同步单文件上传路径。
3. 实现 Java 批次接收：格式与内容治理校验、私有对象存储、事务 Outbox、统一审计、查询/重试/发布/下线/恢复。
4. 实现 Python indexing worker：安全解析器、分块、PII 扫描、幂等状态回写、重试/退避、`local-stub` 索引 adapter。
5. 接入 `local` 的真实 embedding provider 和 Milvus adapter，配置化并发/预算/超时；实现新旧版本可见性切换和异步下线。
6. 将授权检索范围放入 RunCommand，接入 Python hybrid retrieval、引用组装和 Java Event/SSE 投影。
7. 接入管理端批次进度与聊天引用 UI；随后更新执行记录和路线图，仅记录实际运行证据。

### 6.1 分阶段交付

| 阶段 | 交付物 | 完成门槛 |
|---|---|---|
| A. 契约与迁移 | API/状态/错误码统一；新增数据库迁移、校验和回滚前置说明 | 空库迁移与迁移 SQL 测试通过；不改 V1 |
| B. Java 摄入控制面 | 批次上传、私有 MinIO、Outbox、状态查询、审计、发布/下线/恢复 | 幂等批次、事务边界、权限和审计单测通过 |
| C. Stub 索引闭环 | Python 安全解析、分块、确定性检索、任务消费/结果回传 | 无 API Key 完成上传到可引用检索的业务路径 |
| D. 真实索引模式 | Compose Milvus、OpenAI-compatible adapter、配置/成本门禁 | 正确配置时索引可用；任何真实依赖缺失时失败关闭 |
| E. 用户体验 | 管理端进度/SSE/重试/发布，聊天引用渲染 | 离页恢复、Last-Event-ID、无命中和下线状态正确 |

## 7. 验收与测试

测试投入聚焦业务主路径：

- Java：上传校验、幂等批次、事务 Outbox、发布门禁、下线/恢复、新版本切换和统一审计。
- Python：四种格式的安全解析、确定性分块/检索、重复 job 不重复入库、3 次重试上限、stub/local adapter 配置切换和 ACL filter 不可绕过。
- 跨运行时：管理员上传 -> 异步索引 -> 显式发布 -> 用户 Run 检索 -> 带引用 SSE；无命中、下线、失败重试各一条可重复路径。
- 安全：非管理员上传/发布拒绝，未发布/下线/已删除文档不可召回，PII/格式/大小/授权 metadata 校验失败不落可见索引，审计不保存原文或 API Key。

不把长压、组合故障、生产容量、云服务成本实测或 Docker 重启矩阵列为本期通过条件；这些继续作为后续本地/生产验证。

## 8. 完成条件

- 管理员可以提交受限格式的公共文档批次，并获得可恢复的异步状态。
- 文件只在索引成功且管理员发布后可被用户检索。
- `local-stub` 无 API Key 可完成端到端确定性检索；提供 API Key 后 `local` 能只靠配置切至真实 embedding/Milvus。
- 引用完整、可追溯且不泄露对象存储细节；无命中不编造。
- 索引、重试、版本、下线和重复投递最终收敛且不产生重复可见 chunk/vector。
- 关键业务路径测试通过；实际执行证据、环境和结果写入执行记录后才可更新 M2-1 状态。

## 2026-09-06 K1 正式资料与 local-stub 业务证据

批次 `354847677655027712` 已导入 `9` 份 WHO 中文公共营养资料。9 个条目均为 `indexed`，批次为 `completed`；9 个文档均已由管理员显式发布，PostgreSQL 记录 `58` 个有效 chunk，Redis stub 索引也为 `58` 条，且全部带有公共范围、已发布、已索引、当前版本 metadata。

已通过 Java 公共检索接口核验健康饮食、钠摄入、食品安全和身体活动等查询，以及完全随机 ASCII 无命中查询；已通过批次 SSE 读取 `18` 个持久化事件，并使用首事件游标回放得到 `17` 个后续事件，无旧游标重复。索引 Outbox 与可见性 Outbox 各 `9/9` 发布，统一审计包含批次创建和 9 次发布事实。

本次 K1 使用 `FOODMATE_RAG_MODE=stub`，未调用真实 Embedding、未写入 Milvus，未执行性能或故障恢复测试。真实 Embedding/Milvus、生产质量和可靠性验证继续以后置范围处理；后续重新导入资料必须继续通过批次上传、索引和显式发布接口。
