# FoodMate 数据库增量变更目录

本目录仅存放经评审、编号递增的人工执行增量 SQL，例如 `V2__add_runtime_outbox.sql`。

- 不由 Java 启动自动扫描或执行。
- 新增脚本必须同时提供对应的校验 SQL、回滚前置条件和变更说明；历史脚本的配套完整性以本文末尾矩阵为准。
- 已执行脚本不得原地修改；修正必须创建新的递增版本。
- 执行前先备份并记录数据库、执行人、时间、版本和校验结果。

当前增量顺序：

- `V4`：双运行时 dispatch、事件 Inbox、SSE Outbox 和取消结构。
- `V5`：continuation、`superseded` 和预算快照。
- `V6`：RocketMQ 发布状态与 DLQ 对账。
- `V7`：Redis admission 对应的 `queued` Outbox 状态。
- `V8`：摘要覆盖范围、CAS 版本、Prompt 版本和 digest。
- `V9`：预算追加确认摘要的幂等唯一约束。

`V7`-`V9` 仍需在 PostgreSQL 实例上人工执行并完成校验后，才能开启本地真实 Redis admission 和预算追加恢复。
`V10__m1_4_memory_confirmation.sql`：长期记忆确认状态、冲突隔离索引和用户确认后的 Context 放行。

`V12__m1_4_event_attempt_compatibility.sql`：为已有 `runtime_event_inbox_v2` 补齐 `dispatch attempt` 字段，兼容恢复 Run 的事件顺序校验。该脚本使用 `IF NOT EXISTS`，可重复执行；执行前仍需按项目规则完成备份和执行记录。

`V13__m1_5_food_log_nutrition_approval.sql`：M1-5 饮食记录主表、食材明细、营养目录、单位换算和写确认事实。该脚本要求 `food_logs` 为空，删除旧 `items_json/nutrition_json`，不包含任何营养种子数值；当前本地库已存在该结构，本轮只读复核且未重复执行。营养目录数据另由 `seed/V1__nutrition_usda_seed.sql` 至 `seed/V8__nutrition_usda_directory_expansion_seed.sql` 人工导入，当前合计 60 条 approved 食材、60 条 approved USDA foodPortion 规则和 75 条精确质量换算，并通过校验。配套校验为 `validation/V13__m1_5_food_log_nutrition_approval_validation.sql`、各版本 nutrition seed validation，回滚为 `rollback/R13__m1_5_food_log_nutrition_approval.sql`。

`V14__m1_5_operation_idempotency.sql`：为 `operation_audits` 增加统一写操作幂等键、参数摘要和唯一索引，覆盖创建、删除、恢复等不应重复执行的业务写入。当前本地库已存在该结构，本轮只读复核且未重复执行。配套校验为 `validation/V14__m1_5_operation_idempotency_validation.sql`，回滚为 `rollback/R14__m1_5_operation_idempotency.sql`。

`V15__m1_5_meal_plan_lifecycle.sql`：为 `meal_plans` 增加计划写入幂等键、乐观并发 `revision` 及对应索引，支持计划修改、软删除、恢复和状态变更。该脚本已在当前本地库人工执行并通过校验，保留现有 2 条计划和其余数据。配套校验为 `validation/V15__m1_5_meal_plan_lifecycle_validation.sql`，回滚为 `rollback/R15__m1_5_meal_plan_lifecycle.sql`。

`V19__m2_2_database_query_structured_contract.sql`：在不修改 V18 的前提下，为 `database_query` 发布结构化输入、候选 SQL、规划模式和 SQL 审计 ID 的 v2 注册表 Schema，并将当前版本切换到 v2；通信包的 `schema_version` 仍为 v1。执行前必须确认 V18 的 `database_query` 注册表当前版本为 v1。配套校验为 `validation/V19__m2_2_database_query_structured_contract_validation.sql`，回滚为 `rollback/R19__m2_2_database_query_structured_contract.sql`。

`V20__m2_3_admin_management_contract.sql`：为管理员状态写入、工具启停和软删除恢复增加 `revision` 乐观并发版本；管理写接口同时要求 `Idempotency-Key`，高风险工具和恢复操作要求确认摘要。该脚本仅人工执行，不由 Java 启动自动迁移；配套校验为 `validation/V20__m2_3_admin_management_contract_validation.sql`，回滚为 `rollback/R20__m2_3_admin_management_contract.sql`。

`V21__m1_model_governance_contract.sql`：增加供应商/模型目录、价格版本和预算策略，并为路由和模型用量事实补齐路由、价格与预算版本快照。治理表不保存 API Key、Secret 或可逆凭据；当前运行时没有匹配的数据库路由时仍使用显式配置的 deterministic/stub 默认快照。该脚本仅人工执行，不清理已有路由或用量；配套校验为 `validation/V21__m1_model_governance_contract_validation.sql`，回滚为 `rollback/R21__m1_model_governance_contract.sql`。

`V22__m1_model_provider_revision.sql`：为供应商启停补齐乐观并发版本，已有供应商从 revision 1 开始。配套校验为 `validation/V22__m1_model_provider_revision_validation.sql`，回滚为 `rollback/R22__m1_model_provider_revision.sql`。

`V23__m2_3_admin_export_jobs.sql`：管理员运营导出任务、受限资源枚举和一次性下载事实。导出内容必须来自已脱敏查询 DTO，不允许把原始 Prompt、令牌、对象存储凭据或完整业务请求写入导出文件。配套校验为 `validation/V23__m2_3_admin_export_jobs_validation.sql`，回滚为 `rollback/R23__m2_3_admin_export_jobs.sql`。

`V24__m3_dlq_replay.sql`：DLQ 原始消息受限快照和管理员确认后的重放 Outbox。迁移只创建事实和索引，不自动重放消息。配套校验为 `validation/V24__m3_dlq_replay_validation.sql`，回滚为 `rollback/R24__m3_dlq_replay.sql`。

`V25__m3_retention_governance.sql`：保留策略、法律冻结、清理请求和对象/向量/数据库任务。默认关闭硬删除，数据库清理必须等待对象存储和向量任务成功。配套校验为 `validation/V25__m3_retention_governance_validation.sql`，回滚为 `rollback/R25__m3_retention_governance.sql`。

`V26__m1_4_agent_feedback.sql`：结构化 Agent 反馈事实，保存用户、Run、assistant message、稳定原因代码、幂等键、参数摘要和高风险标记；不保存回答正文、Prompt、原始请求、令牌或敏感内容。配套校验为 `validation/V26__m1_4_agent_feedback_validation.sql`，rollback 为只读前置检查 `rollback/R26__m1_4_agent_feedback_precheck.sql`，执行前必须人工确认反馈数据迁移与保留范围。

`V27__m3_purge_execution_results.sql`：清理任务执行对账事实，保存后端、删除计数、版本、结果摘要和删除后存在性校验；不保存对象键、向量或原始业务内容。配套校验为 `validation/V27__m3_purge_execution_results_validation.sql`，rollback 为只读前置检查 `rollback/R27__m3_purge_execution_results_precheck.sql`，迁移本身不执行清理。

`V28__m2_1_knowledge_retry_outbox.sql`：移除知识索引 Outbox 的旧条目/主题唯一约束，允许管理员重试追加独立事实；保留全部历史消息并增加按条目查找最新载荷的索引。配套校验为 `validation/V28__m2_1_knowledge_retry_outbox_validation.sql`，rollback 为只读前置检查 `rollback/R28__m2_1_knowledge_retry_outbox_precheck.sql`。

`V29__m2_1_embedding_trace.sql`：为知识导入条目追加受限长度的 Embedding 供应商 Trace 关联标识，用于受控排障；不保存 API Key、请求正文或响应正文。配套校验为 `validation/V29__m2_1_embedding_trace_validation.sql`，rollback 为只读前置检查 `rollback/R29__m2_1_embedding_trace_precheck.sql`。

`V30__m2_2_meal_plan_tool_schema_fix.sql`：新增 `meal_plan.save_plan` 注册表 v2 Schema，修正幂等键位于 Proposal payload 而非业务 input 的契约不一致；保留 v1 历史 Schema，不删除任何业务数据。配套校验为 `validation/V30__m2_2_meal_plan_tool_schema_fix_validation.sql`，rollback 为只读前置检查 `rollback/R30__m2_2_meal_plan_tool_schema_fix_precheck.sql`。

`V31__m1_4_memory_invalidation_boundary.sql`：为长期记忆保存候选来源消息和删除/更正后的来源抑制标记，使摘要、近期消息和长期记忆 Context 可以共同阻止旧事实再生。迁移不删除或改写既有业务数据；配套校验为 `validation/V31__m1_4_memory_invalidation_boundary_validation.sql`，rollback 为只读前置检查 `rollback/R31__m1_4_memory_invalidation_boundary_precheck.sql`。

`V32__nutrition_catalog_rebuild_contract.sql`：为真实 USDA 营养目录重建补齐来源版本、规范键、食材形态、数据类型和活动记录索引约束；迁移只增加结构，不删除或改写既有业务数据。配套为 `validation/V32__nutrition_catalog_rebuild_contract_validation.sql`、只读回滚前置检查 `rollback/R32__nutrition_catalog_rebuild_contract_precheck.sql`。

V33 不属于 Flyway 迁移，而是人工执行的生成式 seed：`seed/generated/V33__nutrition_usda_catalog_rebuild_seed.sql` 当前包含 1,000 条 USDA 食材和 1,518 条 foodPortion 换算，配套 manifest、validation 和 rollback 前置检查。V33 seed 只用稳定 USDA/FDC 标识幂等更新；淘汰旧生成记录时必须先核对业务引用，只能按确认范围软删除，禁止 `TRUNCATE` 或宽泛删除。实际执行时间、validation 输出和清理范围以 `../EXECUTION_RECORD.md` 为准。

`V34__m2_4_nutrition_match_confirmation.sql`：为食材明细增加 `pending_confirmation` 状态和候选查询索引。候选存在多个生熟/部位形态时不自动猜测，必须由用户选择目录 ID；迁移不改写既有明细。配套校验为 `validation/V34__m2_4_nutrition_match_confirmation_validation.sql`，回滚为只读前置检查 `rollback/R34__m2_4_nutrition_match_confirmation_precheck.sql`。

## 配套文件矩阵

| 版本 | validation | rollback | 处理边界 |
|---|---|---|---|
| V2 | 有 | 有 | 当前已登记的账户与隐私迁移 |
| V3-V4 | 无 | 无 | 历史运行时结构；只读复核，不生成反向删除 |
| V5-V6 | 无 | 有 | 仅使用已评审回滚前置条件；执行前必须确认数据范围 |
| V7-V12 | 无 | 无 | 历史运行时、记忆和兼容结构；以数据库事实和新增迁移修正 |
| V13-V25 | 有 | 有 | 当前目录约定，按版本保存 validation 和 rollback |
| V26 | 有 | 有（只读前置检查） | 结构化 Agent 反馈；不提供未经人工确认的自动删除 |
| V27 | 有 | 有（只读前置检查） | 清理执行对账事实；不执行清理或删除既有数据 |
| V28 | 有 | 有（只读前置检查） | M2-1 索引重试追加 Outbox 事实；不删除既有消息 |
| V29 | 有 | 有（只读前置检查） | M2-1 Embedding 供应商 Trace 关联事实；不删除既有数据 |
| V30 | 有 | 有（只读前置检查） | 修正 `meal_plan.save_plan` 注册表 Schema；保留 v1 历史行和既有业务数据 |
| V31 | 有 | 有（只读前置检查） | M1-4 记忆来源和失效边界；不删除既有数据 |
| V32 | 有 | 有（只读前置检查） | USDA 营养目录重建结构契约；只增加约束和索引 |
| V33 seed | 有 | 有（只读前置检查） | USDA 食材与 foodPortion 生成种子；按稳定 ID 幂等，淘汰项只允许确认后软删除 |
| V34 | 有 | 有（只读前置检查） | 营养候选人工确认状态和候选查询索引；不自动选择生熟/部位形态 |

该矩阵描述文件现状，不代表任何迁移已在当前数据库执行。实际执行状态、validation 输出、失败与补偿必须以 `../EXECUTION_RECORD.md` 为准。历史版本若需补充校验，优先新增只读 SQL 文档；若需修复结构，创建更高版本迁移，不原地修改已执行脚本，不执行宽泛删除或 `TRUNCATE`。

完整的人工执行顺序、备份要求、目录职责和台账要求见上级目录 `script/sql/FoodMate/README.md`。
