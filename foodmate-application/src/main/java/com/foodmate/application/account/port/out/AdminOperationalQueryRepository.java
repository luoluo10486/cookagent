package com.foodmate.application.account.port.out;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** 管理后台分页查询端口，只返回已经裁剪过的运营摘要。 */
public interface AdminOperationalQueryRepository {
    List<UserRow> users(Query query);

    long countUsers(Query query);

    List<RunRow> runs(Query query);

    long countRuns(Query query);

    List<TraceRow> traces(Query query);

    long countTraces(Query query);

    TraceRow traceById(String traceId);

    List<TraceSpanRow> traceSpans(String traceId);

    List<ToolCallRow> toolCalls(Query query);

    long countToolCalls(Query query);

    List<SqlAuditRow> sqlAudits(Query query);

    long countSqlAudits(Query query);

    List<ToolRow> tools(Query query);

    long countTools(Query query);

    List<UsageRow> usage(Query query);

    long countUsage(Query query);

    List<KnowledgeRow> knowledge(Query query);

    long countKnowledge(Query query);

    List<DeletedRow> deleted(Query query);

    long countDeleted(Query query);

    List<OperationAuditRow> operationAudits(Query query);

    long countOperationAudits(Query query);

    List<OperationAuditRow> operationAuditsForUser(long userId, int limit, int offset);

    long countOperationAuditsForUser(long userId);

    List<DlqRow> dlq(Query query);

    long countDlq(Query query);

    record Query(
            String text,
            String status,
            String visibility,
            String sort,
            String direction,
            int limit,
            int offset) {}

    record UserRow(Long userId, String username, String role, String status, String emailRef) {}

    record RunRow(
            Long agentRunId,
            Long sessionId,
            String intent,
            String status,
            String traceId,
            BigDecimal durationMs,
            String actorRef) {}

    record TraceRow(
            String traceId,
            Long runId,
            String entry,
            String status,
            Instant startedAt,
            BigDecimal durationMs,
            Long spanCount,
            String rootService,
            String errorCode) {}

    record TraceSpanRow(
            String spanId,
            String spanType,
            String name,
            String service,
            String status,
            Instant startedAt,
            Instant finishedAt,
            BigDecimal durationMs,
            String errorCode,
            Long sequenceNo) {}

    record ToolCallRow(
            Long toolCallId,
            Long agentRunId,
            String toolName,
            String status,
            Long latencyMs,
            String traceId) {}

    record SqlAuditRow(
            Long sqlAuditId,
            Long actor,
            String queryHash,
            String result,
            String traceId,
            Long latencyMs,
            Long rowCount,
            String errorCode,
            Instant createdAt) {}

    record ToolRow(
            String name,
            String version,
            String risk,
            String status,
            String scope,
            String owner,
            String lastCalledAt) {}

    record UsageRow(
            String provider,
            String model,
            String scene,
            String tokens,
            BigDecimal cost,
            Long latencyMs,
            String status) {}

    record KnowledgeRow(
            Long documentId,
            String title,
            String status,
            String visibility,
            Long chunks,
            String source,
            String indexProgress,
            Instant updatedAt) {}

    record DeletedRow(
            String resourceType,
            Long resourceId,
            String ownerRef,
            Instant deletedAt,
            String reason) {}

    record OperationAuditRow(
            Long operatorId,
            String action,
            String targetType,
            String targetId,
            String result,
            String requestId,
            String traceId,
            Instant createdAt) {}

    record DlqRow(
            Long dlqId,
            String consumerGroup,
            String sourceTopic,
            String messageId,
            String runId,
            String dispatchId,
            String eventId,
            Integer attempt,
            Integer reconsumeTimes,
            String errorCode,
            String reconciliationState,
            Instant firstSeenAt,
            Instant reconciledAt) {}
}
