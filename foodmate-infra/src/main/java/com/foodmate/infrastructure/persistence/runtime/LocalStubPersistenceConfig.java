package com.foodmate.infrastructure.persistence.runtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.foodmate.application.account.port.out.AdminAuditReportRepository;
import com.foodmate.application.account.port.out.AdminDashboardRepository;
import com.foodmate.application.account.port.out.AdminManagementRepository;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository;
import com.foodmate.application.conversation.port.out.ConversationSummaryRepository;
import com.foodmate.application.conversation.port.out.MemoryRepository;
import com.foodmate.application.knowledge.port.out.KnowledgeRepository;
import com.foodmate.application.retention.port.out.DataRetentionRepository;
import com.foodmate.application.runtime.port.out.AdmissionReconciliationRepository;
import com.foodmate.application.runtime.port.out.CancellationRepository;
import com.foodmate.application.runtime.port.out.DeadLetterRepository;
import com.foodmate.application.runtime.port.out.InboxRepository;
import com.foodmate.application.runtime.port.out.OutboxRepository;
import com.foodmate.application.runtime.port.out.ProtocolAuditRepository;
import com.foodmate.application.runtime.port.out.SqlSchemaCatalogRepository;
import com.foodmate.application.runtime.port.out.SqlSchemaCatalogRepository.CatalogField;
import com.foodmate.application.runtime.port.out.ToolGatewayPort;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository.ToolDefinition;
import com.foodmate.application.runtime.service.ToolRegistryCatalog;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** 本地无数据 stub 的显式持久化适配器。 */
@Configuration
@Profile("local-stub")
public class LocalStubPersistenceConfig {
    @Bean
    ConversationSummaryRepository localConversationSummaryRepository() {
        return new ConversationSummaryRepository() {
            public boolean ownsSession(long userId, long sessionId) {
                return false;
            }

            public List<MessageSnapshot> findEffectiveMessages(long sessionId) {
                return List.of();
            }

            public SummarySnapshot lockSummary(long sessionId) {
                return null;
            }

            public void insertSummary(NewSummary summary) {
                throw unavailable();
            }

            public int updateSummary(UpdatedSummary summary) {
                throw unavailable();
            }

            public int invalidate(long userId, long sessionId) {
                return 0;
            }

            public int invalidateForUser(long userId) {
                return 0;
            }
        };
    }

    @Bean
    MemoryRepository localMemoryRepository() {
        return new MemoryRepository() {
            public Long findRunOwner(long runId) {
                return null;
            }

            public boolean hasSuppressedSourceMessages(long userId, List<String> sourceMessageIds) {
                return false;
            }

            public MemorySnapshot findActiveByKey(long userId, String type, String key) {
                return null;
            }

            public void insert(NewMemory memory) {
                throw unavailable();
            }

            public List<MemorySnapshot> findVisible(long userId, int limit) {
                return List.of();
            }

            public MemorySnapshot findOwned(long userId, long memoryId) {
                return null;
            }

            public boolean existsOwned(long userId, long memoryId) {
                return false;
            }

            public int updateOwned(long userId, long memoryId, String valueJson, String scope) {
                throw unavailable();
            }

            public int softDeleteOwned(long userId, long memoryId) {
                throw unavailable();
            }

            public int confirmOwned(long userId, long memoryId) {
                throw unavailable();
            }

            public int rejectOtherConflicts(long userId, long memoryId) {
                throw unavailable();
            }
        };
    }

    @Bean
    OutboxRepository localOutboxRepository() {
        return new OutboxRepository() {
            public List<OutboxSnapshot> findPending(int limit) {
                return List.of();
            }

            public int lease(long outboxId, String owner) {
                return 0;
            }

            public void markPublished(long outboxId, String topic, String messageId) {
                throw unavailable();
            }

            public void markDelivered(long outboxId) {
                throw unavailable();
            }

            public void markFailed(long outboxId, String error) {
                throw unavailable();
            }
        };
    }

    @Bean
    CancellationRepository localCancellationRepository() {
        return new CancellationRepository() {
            public ActiveDispatch findActiveDispatch(long runId) {
                return null;
            }

            public void insertRequested(NewCancellation cancellation) {
                throw unavailable();
            }

            public int incrementCancellationEpoch(long runId) {
                throw unavailable();
            }

            public List<PendingCancellation> findRequested(int limit) {
                return List.of();
            }

            public int markDispatched(long cancellationId, String transport, String messageId) {
                throw unavailable();
            }
        };
    }

    @Bean
    DeadLetterRepository localDeadLetterRepository() {
        return new DeadLetterRepository() {
            public void insert(DlqMessage message) {
                throw unavailable();
            }

            public List<DlqEntry> findPending(int limit) {
                return List.of();
            }

            public long inboxCount(long runId, String eventId) {
                return 0;
            }

            public List<String> findRunStatuses(long runId) {
                return List.of();
            }

            public int resolve(long dlqId, String state, String note) {
                throw unavailable();
            }

            public ReplayCandidate findReplayCandidate(long dlqId) {
                return null;
            }

            public ReplayOutbox findActiveReplay(long dlqId) {
                return null;
            }

            public int insertReplay(ReplayRequest request) {
                throw unavailable();
            }

            public List<ReplayOutbox> findPendingReplay(int limit) {
                return List.of();
            }

            public int leaseReplay(long replayId, String owner) {
                throw unavailable();
            }

            public int markReplayPublished(long replayId, String owner, String messageId) {
                throw unavailable();
            }

            public void retryReplay(long replayId, String owner, String error) {
                throw unavailable();
            }
        };
    }

    @Bean
    AdmissionReconciliationRepository localAdmissionReconciliationRepository() {
        return new AdmissionReconciliationRepository() {
            public List<RunRef> findQueueExpired(int timeoutSeconds, int limit) {
                return List.of();
            }

            public List<RunRef> findQueued(int limit) {
                return List.of();
            }

            public List<RunRef> findExecutionExpired(int limit) {
                return List.of();
            }

            public int failRun(long agentRunId, String code, String resultJson) {
                throw unavailable();
            }

            public int expireDispatches(long agentRunId) {
                throw unavailable();
            }

            public int failOutboxes(long agentRunId, String code) {
                throw unavailable();
            }

            public Long nextSseSequence(long agentRunId) {
                throw unavailable();
            }

            public void insertFailedEvent(
                    long eventId,
                    long agentRunId,
                    String sseEventId,
                    long sequence,
                    String sourceKey,
                    String payload) {
                throw unavailable();
            }

            public void updateSseSequence(long agentRunId, long sequence) {
                throw unavailable();
            }

            public void promoteOutboxes(List<String> runIds) {
                throw unavailable();
            }
        };
    }

    @Bean
    ProtocolAuditRepository localProtocolAuditRepository() {
        return (id, requestId, fingerprint, errorCode, envelopeJson) -> {};
    }

    @Bean
    InboxRepository localInboxRepository() {
        return new InboxRepository() {
            public int claim(String proposalId, String requestHash, String payload) {
                return 1;
            }

            public InboxRecord find(String proposalId) {
                return null;
            }

            public int complete(String proposalId, String resultJson) {
                return 1;
            }
        };
    }

    @Bean
    AdminAuditReportRepository localAdminAuditReportRepository() {
        return new AdminAuditReportRepository() {
            public OperationAuditSummary operationAudits() {
                return new OperationAuditSummary(0, 0, null);
            }

            public OutboxSummary runtimeDispatchOutbox(java.time.Instant staleBefore) {
                return new OutboxSummary(0, 0, null);
            }

            public OutboxSummary knowledgeIndexOutbox(java.time.Instant staleBefore) {
                return new OutboxSummary(0, 0, null);
            }

            public OutboxSummary knowledgeVisibilityOutbox(java.time.Instant staleBefore) {
                return new OutboxSummary(0, 0, null);
            }

            public OutboxSummary agentRunSseOutbox(java.time.Instant staleBefore) {
                return new OutboxSummary(0, 0, null);
            }

            public KnowledgeImportSummary knowledgeImports() {
                return new KnowledgeImportSummary(0, 0, null);
            }

            public DlqSummary dlq() {
                return new DlqSummary(0, 0, null);
            }
        };
    }

    @Bean
    AdminManagementRepository localAdminManagementRepository() {
        return new AdminManagementRepository() {
            public AdminManagementRepository.UserSnapshot findUser(long userId) {
                return null;
            }

            public AdminManagementRepository.ToolSnapshot findTool(String name) {
                return null;
            }

            public AdminManagementRepository.ResourceSnapshot findResource(
                    com.foodmate.shared.admin.enums.RestorableResourceType resourceType,
                    long resourceId) {
                return null;
            }

            public int updateUserStatus(
                    long userId,
                    com.foodmate.shared.account.enums.UserStatus status,
                    long operatorId,
                    long revision) {
                return 0;
            }

            public AdminManagementRepository.RevokeResult revokeSessions(
                    long userId, long operatorId, long revision) {
                return null;
            }

            public int updateToolStatus(
                    String name,
                    com.foodmate.shared.runtime.enums.ToolStatus status,
                    long operatorId,
                    long revision) {
                return 0;
            }

            public int restore(
                    com.foodmate.shared.admin.enums.RestorableResourceType resourceType,
                    long resourceId,
                    long operatorId,
                    long revision) {
                return 0;
            }
        };
    }

    @Bean
    KnowledgeRepository localKnowledgeRepository() {
        return new KnowledgeRepository() {
            public void insertDocument(
                    long documentId, String title, String storageKey, long operatorId) {}

            public void updateDocumentSource(
                    long documentId,
                    String sourceType,
                    String sourceName,
                    String sourceVersion,
                    String licenseNotice,
                    long operatorId) {}

            public int updateStatus(
                    long documentId,
                    com.foodmate.shared.knowledge.enums.KnowledgeDocumentStatus status,
                    long operatorId) {
                return 0;
            }

            public void insertImportJob(ImportJob job) {}

            public ImportJob findImportJob(long operatorId, String idempotencyKey) {
                return null;
            }

            public void insertImportItem(ImportItem item) {}

            public void insertIndexOutbox(long outboxId, long itemId, String payload) {}

            public int updateVisibility(long documentId, String visibility, long operatorId) {
                return 0;
            }

            public KnowledgeRepository.DocumentView document(long documentId) {
                return null;
            }

            public void insertVisibilityOutbox(long outboxId, long documentId, String payload) {}

            public java.util.List<KnowledgeRepository.OutboxRow> pendingIndexOutbox(int limit) {
                return java.util.List.of();
            }

            public java.util.List<KnowledgeRepository.OutboxRow> pendingVisibilityOutbox(
                    int limit) {
                return java.util.List.of();
            }

            public int leaseIndexOutbox(long id, String owner) {
                return 0;
            }

            public int leaseVisibilityOutbox(long id, String owner) {
                return 0;
            }

            public void markIndexOutboxPublished(long id, String owner) {}

            public void markVisibilityOutboxPublished(long id, String owner) {}

            public void retryIndexOutbox(long id, String owner, String error) {}

            public void retryVisibilityOutbox(long id, String owner, String error) {}

            public void applyIndexResult(KnowledgeRepository.IndexResult result, String hash) {}

            public KnowledgeRepository.JobView job(long id) {
                return null;
            }

            public java.util.List<KnowledgeRepository.ItemView> jobItems(long id) {
                return java.util.List.of();
            }

            public java.util.List<KnowledgeRepository.JobEvent> jobEvents(long id, long after) {
                return java.util.List.of();
            }

            public long jobIdForItem(long itemId) {
                return 0;
            }

            public void insertJobEvent(
                    long eventId, long jobId, Long itemId, String eventType, String payload) {}

            public int retryItem(
                    long itemId, long jobId, long operatorId, long outboxId, String payload) {
                return 0;
            }
        };
    }

    @Bean
    DataRetentionRepository localDataRetentionRepository() {
        return new DataRetentionRepository() {
            public Policy policy(String resourceType) {
                return null;
            }

            public ResourceSnapshot resource(String resourceType, long resourceId) {
                return null;
            }

            public PurgeRequest purgeRequest(long requestId) {
                return null;
            }

            public PurgeRequest purgeRequestByIdempotency(long operatorId, String idempotencyKey) {
                return null;
            }

            public PurgeRequest activePurgeRequest(String resourceType, long resourceId) {
                return null;
            }

            public java.util.List<DataRetentionRepository.PurgeTaskState> purgeTaskStates(
                    long requestId) {
                return java.util.List.of();
            }

            public int insertPurgeRequest(NewPurgeRequest request) {
                throw unavailable();
            }

            public int approvePurge(long requestId, long approverId, java.time.Instant approvedAt) {
                throw unavailable();
            }

            public int insertPurgeTask(PurgeTask task) {
                throw unavailable();
            }

            public java.util.List<PurgeTaskSnapshot> pendingTasks(int limit) {
                return java.util.List.of();
            }

            public int leaseTask(long taskId, String owner, String resourceType, long resourceId) {
                throw unavailable();
            }

            public PurgeTaskContext purgeTaskContext(long taskId) {
                throw unavailable();
            }

            public int markTaskPublished(long taskId, String owner, String messageId) {
                throw unavailable();
            }

            public int markTaskSucceeded(
                    long taskId, String owner, String errorCode, String errorSummary) {
                throw unavailable();
            }

            public void retryTask(
                    long taskId, String owner, String errorCode, String errorSummary) {
                throw unavailable();
            }

            public int applyTaskResult(
                    long taskId, String status, String errorCode, String errorSummary) {
                throw unavailable();
            }

            public int insertPurgeTaskResult(PurgeTaskResult result) {
                throw unavailable();
            }

            public void refreshPurgeRequest(long taskId) {}

            public int insertHold(NewHold hold) {
                throw unavailable();
            }

            public Hold activeHold(String resourceType, long resourceId) {
                return null;
            }

            public Hold hold(long holdId) {
                return null;
            }

            public int releaseHold(long holdId, long operatorId, java.time.Instant releasedAt) {
                throw unavailable();
            }
        };
    }

    @Bean
    AdminDashboardRepository localAdminDashboardRepository() {
        return new AdminDashboardRepository() {
            public Overview overview() {
                return new Overview(0, BigDecimal.ZERO);
            }

            public long modelUsageCount() {
                return 0;
            }

            public long knowledgeCount() {
                return 0;
            }

            public List<RunRow> runs() {
                return List.of();
            }

            public List<ToolCallRow> toolCalls() {
                return List.of();
            }

            public List<SqlAuditRow> sqlAudits() {
                return List.of();
            }

            public List<ToolRow> tools() {
                return List.of();
            }

            public List<UsageRow> usage() {
                return List.of();
            }

            public List<KnowledgeRow> knowledge() {
                return List.of();
            }

            public List<DeletedRow> deleted() {
                return List.of();
            }

            public List<OperationAuditRow> operationAudits() {
                return List.of();
            }
        };
    }

    @Bean
    AdminOperationalQueryRepository localAdminOperationalQueryRepository() {
        return new AdminOperationalQueryRepository() {
            public List<UserRow> users(Query query) {
                return List.of();
            }

            public long countUsers(Query query) {
                return 0;
            }

            public List<RunRow> runs(Query query) {
                return List.of();
            }

            public long countRuns(Query query) {
                return 0;
            }

            public List<TraceRow> traces(Query query) {
                return List.of();
            }

            public long countTraces(Query query) {
                return 0;
            }

            public TraceRow traceById(String traceId) {
                return null;
            }

            public List<TraceSpanRow> traceSpans(String traceId) {
                return List.of();
            }

            public List<ToolCallRow> toolCalls(Query query) {
                return List.of();
            }

            public long countToolCalls(Query query) {
                return 0;
            }

            public List<SqlAuditRow> sqlAudits(Query query) {
                return List.of();
            }

            public long countSqlAudits(Query query) {
                return 0;
            }

            public List<ToolRow> tools(Query query) {
                return List.of();
            }

            public long countTools(Query query) {
                return 0;
            }

            public List<UsageRow> usage(Query query) {
                return List.of();
            }

            public long countUsage(Query query) {
                return 0;
            }

            public List<KnowledgeRow> knowledge(Query query) {
                return List.of();
            }

            public long countKnowledge(Query query) {
                return 0;
            }

            public List<DeletedRow> deleted(Query query) {
                return List.of();
            }

            public long countDeleted(Query query) {
                return 0;
            }

            public List<OperationAuditRow> operationAudits(Query query) {
                return List.of();
            }

            public long countOperationAudits(Query query) {
                return 0;
            }

            public List<OperationAuditRow> operationAuditsForUser(long userId, int limit, int offset) {
                return List.of();
            }

            public long countOperationAuditsForUser(long userId) {
                return 0;
            }

            public List<DlqRow> dlq(Query query) {
                return List.of();
            }

            public long countDlq(Query query) {
                return 0;
            }
        };
    }

    @Bean
    ToolGatewayPort localToolGatewayPort() {
        return new ToolGatewayPort() {
            public boolean runExists(long runId) {
                return false;
            }

            public RunContext runContext(long runId) {
                return null;
            }

            public List<JsonNode> executeRead(String statement) {
                return List.of();
            }

            public void audit(Audit audit) {}
        };
    }

    @Bean
    ToolRegistryRepository localToolRegistryRepository() {
        return new ToolRegistryRepository() {
            private final List<ToolDefinition> definitions = ToolRegistryCatalog.defaults();

            @Override
            public List<ToolDefinition> findAll() {
                return definitions;
            }

            @Override
            public ToolDefinition findCurrent(String name) {
                return definitions.stream()
                        .filter(item -> item.name().equals(name))
                        .findFirst()
                        .orElse(null);
            }

            @Override
            public ToolDefinition findVersion(String name, String version) {
                return definitions.stream()
                        .filter(item -> item.name().equals(name) && item.version().equals(version))
                        .findFirst()
                        .orElse(null);
            }
        };
    }

    @Bean
    SqlSchemaCatalogRepository localSqlSchemaCatalogRepository() {
        return datasourceId ->
                datasourceId == 1L
                        ? List.of(
                                catalog(datasourceId, "food_logs", "food_log_id", "bigint"),
                                catalog(datasourceId, "food_logs", "user_id", "bigint"),
                                catalog(datasourceId, "food_logs", "meal_time", "timestamptz"),
                                catalog(datasourceId, "food_logs", "meal_type", "varchar"),
                                catalog(datasourceId, "food_logs", "is_deleted", "bool"),
                                catalog(
                                        datasourceId,
                                        "food_log_items",
                                        "food_log_item_id",
                                        "bigint"),
                                catalog(datasourceId, "food_log_items", "food_log_id", "bigint"),
                                catalog(datasourceId, "food_log_items", "raw_name", "varchar"),
                                catalog(datasourceId, "food_log_items", "amount", "numeric"),
                                catalog(datasourceId, "food_log_items", "calories_kcal", "numeric"),
                                catalog(datasourceId, "food_log_items", "protein_g", "numeric"),
                                catalog(datasourceId, "food_log_items", "fat_g", "numeric"),
                                catalog(datasourceId, "food_log_items", "carbs_g", "numeric"),
                                catalog(datasourceId, "food_log_items", "is_deleted", "bool"),
                                catalog(datasourceId, "meal_plans", "meal_plan_id", "bigint"),
                                catalog(datasourceId, "meal_plans", "user_id", "bigint"),
                                catalog(datasourceId, "meal_plans", "plan_name", "varchar"),
                                catalog(datasourceId, "meal_plans", "days", "integer"),
                                catalog(datasourceId, "meal_plans", "status", "varchar"),
                                catalog(datasourceId, "meal_plans", "updated_at", "timestamptz"),
                                catalog(datasourceId, "meal_plans", "is_deleted", "bool"),
                                catalog(
                                        datasourceId,
                                        "shopping_lists",
                                        "shopping_list_id",
                                        "bigint"),
                                catalog(datasourceId, "shopping_lists", "meal_plan_id", "bigint"),
                                catalog(datasourceId, "shopping_lists", "user_id", "bigint"),
                                catalog(datasourceId, "shopping_lists", "status", "varchar"),
                                catalog(datasourceId, "shopping_lists", "is_deleted", "bool"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "nutrition_food_id",
                                        "bigint"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "standard_name",
                                        "varchar"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "calories_kcal_per_100",
                                        "numeric"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "protein_g_per_100",
                                        "numeric"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "fat_g_per_100",
                                        "numeric"),
                                catalog(
                                        datasourceId,
                                        "nutrition_foods",
                                        "carbs_g_per_100",
                                        "numeric"),
                                catalog(datasourceId, "nutrition_foods", "is_deleted", "bool"),
                                catalog(
                                        datasourceId,
                                        "knowledge_documents",
                                        "document_id",
                                        "bigint"),
                                catalog(datasourceId, "knowledge_documents", "tenant_id", "bigint"),
                                catalog(datasourceId, "knowledge_documents", "status", "varchar"),
                                catalog(
                                        datasourceId,
                                        "knowledge_documents",
                                        "visibility",
                                        "varchar"),
                                catalog(datasourceId, "knowledge_documents", "is_deleted", "bool"))
                        : List.of();
    }

    private static CatalogField catalog(
            long datasourceId, String tableName, String fieldName, String dataType) {
        return new CatalogField(
                datasourceId,
                "local-stub-v1",
                "public",
                tableName,
                fieldName,
                null,
                dataType,
                false,
                null);
    }

    private static IllegalStateException unavailable() {
        return new IllegalStateException("persistence is disabled by the local-stub profile");
    }
}
