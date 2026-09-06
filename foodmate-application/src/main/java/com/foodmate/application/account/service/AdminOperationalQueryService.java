package com.foodmate.application.account.service;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/** 管理后台统一分页、筛选和排序查询用例。 */
public interface AdminOperationalQueryService {
    Page<?> query(String resource, Request request);

    /** 查询与用户本人操作或用户主体变更直接相关的审计摘要。 */
    Page<OperationAudit> operationAuditsForUser(long userId, int page, int size);

    /** 返回一个 Trace 的脱敏权威跨度视图。 */
    TraceDetail traceDetail(String traceId);

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Request(
            int page,
            int size,
            String query,
            String status,
            String visibility,
            String sort,
            String direction) {
        public Request normalized() {
            int safePage = page < 1 ? 1 : Math.min(page, 1_000_000);
            int safeSize = size < 1 ? 20 : Math.min(size, 100);
            String safeQuery = normalize(query, 128);
            String safeStatus = normalize(status, 32);
            String safeVisibility = normalize(visibility, 32);
            String safeSort = normalize(sort, 32);
            if (safeSort != null) safeSort = safeSort.toLowerCase(Locale.ROOT);
            String safeDirection = normalize(direction, 4);
            if (safeDirection != null
                    && !"asc".equalsIgnoreCase(safeDirection)
                    && !"desc".equalsIgnoreCase(safeDirection)) {
                throw new IllegalArgumentException("direction must be asc or desc");
            }
            return new Request(
                    safePage,
                    safeSize,
                    safeQuery,
                    safeStatus,
                    safeVisibility,
                    safeSort,
                    safeDirection == null ? "desc" : safeDirection.toLowerCase());
        }

        private static String normalize(String value, int maxLength) {
            if (value == null || value.isBlank()) return null;
            String normalized = value.trim();
            if (normalized.length() > maxLength)
                throw new IllegalArgumentException("query parameter is too long");
            return normalized;
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Page<T>(List<T> items, long total, int page, int size) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Run(
            Long agentRunId,
            Long sessionId,
            String intent,
            String status,
            String traceId,
            BigDecimal durationMs,
            String actorRef) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Trace(
            String traceId,
            Long runId,
            String entry,
            String status,
            Instant startedAt,
            BigDecimal durationMs,
            Long spanCount,
            String rootService,
            String errorCode) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record TraceDetail(Trace summary, List<TraceSpan> spans) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record TraceSpan(
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

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record User(Long userId, String username, String role, String status, String emailRef) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record ToolCall(
            Long toolCallId,
            Long agentRunId,
            String toolName,
            String status,
            Long latencyMs,
            String traceId) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record SqlAudit(
            Long sqlAuditId,
            Long actor,
            String queryHash,
            String result,
            String traceId,
            Long latencyMs,
            Long rowCount,
            String errorCode,
            Instant createdAt) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Tool(
            String name,
            String version,
            String risk,
            String status,
            String scope,
            String owner,
            String lastCalledAt) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Usage(
            String provider,
            String model,
            String scene,
            String tokens,
            BigDecimal cost,
            Long latencyMs,
            String status) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Knowledge(
            Long documentId,
            String title,
            String status,
            String visibility,
            Long chunks,
            String source,
            String indexProgress,
            Instant updatedAt) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record DeletedResource(
            String resourceType,
            Long resourceId,
            String ownerRef,
            Instant deletedAt,
            String reason) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record OperationAudit(
            Long operatorId,
            String action,
            String targetType,
            String targetId,
            String result,
            String requestId,
            String traceId,
            Instant createdAt) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Dlq(
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
