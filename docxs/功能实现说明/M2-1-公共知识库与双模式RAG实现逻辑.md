# M2-1 公共知识库与双模式 RAG 实现逻辑

## 当前真实资料基线（2026-09-06）

`script/data/knowledge/public/` 已准备 3 份来自 WHO 中文事实表的公共营养资料快照：健康饮食、减少钠摄入、肥胖和超重。每份资料均保留来源 URL、页面日期、检索日期和文件 SHA-256，`manifest.json` 记录去重与完整性信息；资料校验器和定向业务测试已通过。

这 3 份资料当前只作为待导入的真实数据，不代表已经进入运行中的知识库。manifest 明确标记 `embedding_status=未构建向量`；在获得确认前不调用真实 Embedding、不写入 Milvus/Redis、不通过管理员 API 上传或发布。后续正式导入仍必须经过管理员批次、索引结果回写和显式发布流程。

## 1. 业务边界

首期知识库只支持管理员维护的公共文档。文档固定使用 `tenant_id=0` 和 `knowledge_scope=public_published`；普通用户只能检索已发布、已索引、当前版本且未删除的内容。私有文档、OCR、表格/PPT、网页抓取和跨租户检索不在本阶段范围内。

支持格式为 PDF、DOCX、Markdown 和 TXT。管理员批次最多 20 个文件，单文件最多 20 MB。接收时校验扩展名、MIME 与文件签名，拒绝空文件、路径穿越、基础 PII 命中和不在允许列表中的来源。

## 2. Java 控制面

`KnowledgeServiceImpl` 编排批次上传、文档版本、显式发布/下线/软删除/恢复和管理员重试。Java 是元数据、ACL、状态和索引结果的权威方；Python 不能修改 PostgreSQL 业务状态。

数据库结构由 `V16__m2_1_knowledge_import.sql` 至 `V29__m2_1_embedding_trace.sql` 逐步建立：

- `knowledge_import_jobs`：批次状态、操作者、幂等键和批次摘要。
- `knowledge_import_items`：文件接收、解析、索引状态、尝试次数、lease 和错误摘要。
- `knowledge_documents`：来源、版本、授权说明、可见性和当前版本。
- `knowledge_chunks`：chunk 序号、章节路径、版本、固定 ACL metadata 和稳定 `embedding_id`。
- `knowledge_index_outbox`、`knowledge_visibility_outbox`：向 Python 投递可重放事实。
- `knowledge_import_sse_outbox`：批次状态变化的持久 SSE 事实。

业务写入、MinIO 私有对象写入、统一审计和 Outbox 在同一事务边界内完成；数据库失败时补偿删除本次新对象。索引结果按 `item_id + version` 幂等回写，并在成功时保存 chunk 数、模型版本、Token/成本摘要和 provider trace 摘要。自动重试最多 3 次，超过后进入 `index_failed`，只有管理员可以手动重试。

主要外部接口为：

- `POST /api/admin/knowledge-documents/upload-batches`
- `GET /api/admin/knowledge-upload-batches/{batchId}`
- `GET /api/admin/knowledge-upload-batches/{batchId}/events`
- `POST /api/admin/knowledge-upload-batches/{batchId}/documents/{documentId}/retry`
- 文档的发布、下线、软删除和恢复接口
- `GET /api/knowledge/search`

发布只允许当前版本且索引完成的文档。恢复只回到 `draft`，不会自动发布。状态变化同时产生统一审计和可见性 Outbox。

## 3. Python Worker

`knowledge_worker.py` 消费 `foodmate-knowledge-index-v1`，通过受限 MinIO namespace 读取对象，调用 `knowledge_rag.py` 的安全解析器和分块器，然后写入配置的索引后端。消息只包含 ID、版本、模式、尝试次数和关联摘要，不包含文件原文、对象凭据、预签名地址或 API Key。

任务去重键为 `item_id + version + mode`。Worker 使用 Redis 完成事实防重复领取；stub 索引使用稳定的 chunk/embedding ID，Milvus 使用相同的稳定 ID upsert。因此，Milvus 已成功但 Java 结果回写重试时不会产生重复实体。

发布、下线、删除和恢复消费 `foodmate-knowledge-visibility-v1`。stub 更新 Redis 中的文档可见性 metadata，local 更新 Milvus metadata；重复消息只重复设置同一事实，不新增 chunk 或 vector。Python 只接受公共 scope，不能由模型文本、前端参数或消息 metadata 扩大检索范围。

## 4. 两种 Embedding 模式

### 4.1 local-stub

`FOODMATE_DOCKER_RAG_MODE=stub` 时使用共享 Redis 的隔离前缀保存确定性关键词索引，不读取 Embedding API Key，也不连接 Milvus。该模式适合离线业务测试和无外网开发。

### 4.2 local + OpenAI-compatible

`FOODMATE_DOCKER_RAG_MODE=local` 且 `FOODMATE_DOCKER_RAG_EMBEDDING_PROVIDER=openai-compatible` 时，Worker 调用 OpenAI-compatible `/embeddings` 协议。SiliconFlow 的 endpoint 为 `https://api.siliconflow.cn/v1`，模型 profile 为：

| profile | model | collection |
|---|---|---|
| `bge-m3` | `BAAI/bge-m3` | `foodmate_knowledge_chunks_bge_m3` |
| `qwen3-embedding-0.6b` | `Qwen/Qwen3-Embedding-0.6B` | `foodmate_knowledge_chunks_qwen3_embedding_0_6b` |

两个 profile 互斥启用，必须使用独立 collection。集合维度以第一次真实响应为准，不固定假设 1536；当前两个 SiliconFlow 模型实际返回 1024 维。模型切换后必须重新索引文档，禁止把不同维度写入同一 collection。

真实模式缺少 endpoint、API Key、模型、Milvus、预算、价格或价格版本时失败关闭，绝不自动回退到 stub。Embedding 密钥与 Chat 密钥使用不同环境变量，不能相互继承。

### 4.2.1 营养目录向量索引

营养目录不直接混入公共知识文档 collection。`nutrition_foods` 仍是食材名称、营养数值和来源版本的 PostgreSQL 权威表；全量语义索引由 `script/local/index-nutrition-catalog.ps1 -ExecutePaid` 从当前 `approved + official + 未删除` 目录读取，按批次调用 Embedding 并写入独立的 `FOODMATE_RAG_NUTRITION_MILVUS_COLLECTION`。当前 Qwen profile 的实际集合为 `foodmate_nutrition_foods`，每条目录记录生成一个稳定的 `nutr_<sha256>` embedding ID，重复执行使用 upsert，不新增重复向量。

local 模式的营养向量和名称、形态、来源、目录版本等检索 metadata 存在 Milvus；stub 模式使用独立的 `FOODMATE_RAG_NUTRITION_STUB_REDIS_PREFIX`，默认值为 `foodmate:rag:nutrition:stub`。两种模式不混写，切换 Embedding profile 时必须使用新的营养 collection 并重新构建。

Runtime 的内部入口为 `POST /foodmate/internal/v1/nutrition/search`，查询只在营养 collection 中做候选召回，并固定过滤公共、已发布、已索引、当前版本和未删除条件。返回的是 `nutrition_food_id` 等候选信息；Java 写入饮食记录时仍先走 `nutrition_foods` 的标准名/中文名/别名精确匹配，并从 PostgreSQL 回读营养值和单位换算，向量候选不会直接成为营养事实。公共知识问答的 `knowledge_search` 仍只查询普通知识文档 collection，不会因为营养目录建索引而混入两类结果。

Compose 中 Python 服务名为 `agent-runtime`，容器内入口为 `python runtime_server.py`，端口为 `9000`；宿主机默认映射到 `9002`。修改 Python 源码使用：

```powershell
docker compose --env-file .env -f docker/compose.yml up -d --build agent-runtime
```

修改运行配置使用 `--force-recreate`，仅 `restart` 不会更新容器环境变量。切换 profile 可使用 `script/local/switch-rag-embedding-profile.ps1`，真实单次协议检查使用 `script/local/siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile <profile> -ExecuteRequest`。脚本不会接受命令行密钥，也不会打印或保存密钥。

接口依据：SiliconFlow Embeddings API 文档 <https://api-docs.siliconflow.cn/docs/api/embeddings-post>。

### 4.3 Docker 启动与切换操作

Docker Compose 的 `agent-runtime` 服务直接构建 `docker/python.Dockerfile`，容器入口为
`python runtime_server.py`，容器监听 `9000`，宿主机映射为 `9002`。Java 容器通过
Compose 网络中的 `agent-runtime:9000` 调用 Python；宿主机只使用 `localhost:9002` 做
readiness 或 smoke 检查。

启动或更新 Python 镜像：

```powershell
docker compose --env-file .env -f docker/compose.yml up -d --build agent-runtime
```

只修改 `.env` 中的 profile、endpoint、模型或密钥映射时，必须强制重建容器：

```powershell
docker compose --env-file .env -f docker/compose.yml up -d --force-recreate agent-runtime
```

`restart` 只会重启旧容器，不会重新读取新的环境变量。实际切换通过
`script/local/switch-rag-embedding-profile.ps1` 完成：`bge-m3` 使用
`foodmate_knowledge_chunks_bge_m3`，`qwen3-embedding-0.6b` 使用
`foodmate_knowledge_chunks_qwen3_embedding_0_6b`。切换后必须重新索引需要检索的文档，
不能把两个模型的向量写入同一个 collection。真实请求使用
`script/local/siliconflow-docker-embedding-smoke.ps1 -EmbeddingProfile <profile> -ExecuteRequest`；
脚本只打印脱敏的模型、维度、token、延迟和状态。

2026-09-01 当前轮次已在 Docker 中分别验证两个 profile：`BAAI/bge-m3` 和
`Qwen/Qwen3-Embedding-0.6B` 均返回 `1024` 维向量，随后恢复 Qwen 配置并确认 Runtime
健康。该验证只证明当前凭据、网络和协议链路可用，不替代生产稳定性或成本审计。

## 5. 检索与引用

每个 AgentRun 的 Java `V1RunCommand` 固定携带 `knowledge_scope=public_published`。Python 检索前固定过滤 tenant、scope、visibility、索引状态、当前版本和删除标记；最多召回 12 个候选，rerank 至 6 个，最终最多 4 条引用，每个文档最多贡献 2 条。

引用只包含标题、版本、章节路径、chunk ID、分数和安全片段，不包含 MinIO 地址、对象键、预签名 URL 或完整原文。无命中或证据不足时不注入知识上下文，也不生成伪造来源。Java 在 SSE 投影前再次校验文档可见性，避免发布后下线的竞态泄漏。

## 6. 前端与恢复

管理端使用批次上传表单，展示批次/条目状态、失败摘要、重试和 SSE 进度；离页后通过批次详情和 `Last-Event-ID` 恢复。聊天页从 `run.completed.citations` 展示可展开引用区，不改变主回答流；重连按 `sse_event_id` 去重。

## 7. 安全与证据

对象存储凭据和 Embedding API Key 只从本地忽略 `.env` 或 Secret Store 注入。执行记录只保存模型、维度、Token、延迟和状态，不保存 Key、向量正文或供应商原始响应。Docker 真实 smoke 已分别验证两个 profile 返回 HTTP 200 和 1024 维向量；这只证明协议和配置链路可用，不代表供应商长稳、容量或生产成本审计完成。
