package com.foodmate.infrastructure.persistence.knowledge.adapter;

import com.foodmate.application.knowledge.port.out.KnowledgeRepository;
import com.foodmate.infrastructure.persistence.knowledge.KnowledgeMapper;
import com.foodmate.shared.id.IdGenerator;
import com.foodmate.shared.knowledge.enums.KnowledgeDocumentStatus;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/** 将 application 知识端口适配到 PostgreSQL 持久化和共享审计存储。 */
@Repository
@Profile("local")
public class KnowledgeRepositoryAdapter implements KnowledgeRepository {
    private final KnowledgeMapper mapper;
    private final IdGenerator ids;

    public KnowledgeRepositoryAdapter(KnowledgeMapper mapper, IdGenerator ids) {
        this.mapper = mapper;
        this.ids = ids;
    }

    public void insertDocument(long documentId, String title, String storageKey, long operatorId) {
        mapper.insertDocument(documentId, title, storageKey, operatorId);
    }

    @Override
    public void updateDocumentSource(
            long documentId,
            String sourceType,
            String sourceName,
            String sourceVersion,
            String licenseNotice,
            long operatorId) {
        mapper.updateDocumentSource(
                documentId, sourceType, sourceName, sourceVersion, licenseNotice, operatorId);
    }

    public int updateStatus(long documentId, KnowledgeDocumentStatus status, long operatorId) {
        return mapper.updateStatus(documentId, status.code(), operatorId);
    }

    @Override
    public void insertImportJob(ImportJob job) {
        mapper.insertImportJob(
                job.jobId(),
                job.operatorId(),
                job.idempotencyKey(),
                job.mode(),
                job.sourceType(),
                job.sourceName(),
                job.sourceVersion(),
                job.licenseNotice(),
                job.traceId());
    }

    @Override
    public ImportJob findImportJob(long operatorId, String idempotencyKey) {
        return mapper.findImportJob(operatorId, idempotencyKey);
    }

    @Override
    public void insertImportItem(ImportItem item) {
        mapper.insertImportItem(
                item.itemId(),
                item.jobId(),
                item.documentId(),
                item.filename(),
                item.contentType(),
                item.size());
    }

    @Override
    public void insertIndexOutbox(long outboxId, long itemId, String payload) {
        mapper.insertIndexOutbox(outboxId, itemId, payload);
    }

    @Override
    public int updateVisibility(long documentId, String visibility, long operatorId) {
        return mapper.updateVisibility(documentId, visibility, operatorId);
    }

    @Override
    public DocumentView document(long documentId) {
        return mapper.document(documentId);
    }

    @Override
    public boolean isPublicPublished(long documentId, String version) {
        return mapper.isPublicPublished(documentId, version) == 1;
    }

    @Override
    public void insertVisibilityOutbox(long outboxId, long documentId, String payload) {
        mapper.insertVisibilityOutbox(outboxId, documentId, payload);
    }

    @Override
    public java.util.List<OutboxRow> pendingIndexOutbox(int limit) {
        return mapper.pendingIndexOutbox(limit);
    }

    @Override
    public java.util.List<OutboxRow> pendingVisibilityOutbox(int limit) {
        return mapper.pendingVisibilityOutbox(limit);
    }

    @Override
    public int leaseIndexOutbox(long id, String owner) {
        return mapper.leaseIndexOutbox(id, owner);
    }

    @Override
    public int leaseVisibilityOutbox(long id, String owner) {
        return mapper.leaseVisibilityOutbox(id, owner);
    }

    @Override
    public void markIndexOutboxPublished(long id, String owner) {
        mapper.markIndexOutboxPublished(id, owner);
    }

    @Override
    public void markVisibilityOutboxPublished(long id, String owner) {
        mapper.markVisibilityOutboxPublished(id, owner);
    }

    @Override
    public void retryIndexOutbox(long id, String owner, String error) {
        mapper.retryIndexOutbox(id, owner, error);
    }

    @Override
    public void retryVisibilityOutbox(long id, String owner, String error) {
        mapper.retryVisibilityOutbox(id, owner, error);
    }

    @Override
    public void applyIndexResult(IndexResult result, String hash) {
        if (result.attempt() < 1 || result.attempt() > 3) {
            throw new IllegalArgumentException("knowledge result attempt is outside 1..3");
        }
        if (mapper.resultMatchesItem(result.itemId(), result.documentId(), result.version()) != 1) {
            throw new IllegalArgumentException("knowledge result does not match document version");
        }
        String previous =
                mapper.resultPayloadHash(result.itemId(), result.version(), result.attempt());
        if (previous != null) {
            if (!previous.equals(hash)) {
                throw new IllegalStateException("knowledge result payload hash conflict");
            }
            return;
        }
        if (mapper.insertResultInbox(result.itemId(), result.version(), result.attempt(), hash)
                == 0) {
            String concurrent =
                    mapper.resultPayloadHash(result.itemId(), result.version(), result.attempt());
            if (!hash.equals(concurrent))
                throw new IllegalStateException("knowledge result payload hash conflict");
            return;
        }
        boolean changed;
        if ("indexed".equals(result.status())) {
            changed =
                    mapper.markItemIndexed(
                                    result.itemId(),
                                    result.documentId(),
                                    result.attempt(),
                                    result.chunkCount(),
                                    result.version(),
                                    result.tokenCount(),
                                    result.costAmount(),
                                    result.modelVersion(),
                                    result.providerTraceId())
                            == 1;
            if (changed) {
                if (result.providerTraceId() != null && mapper.hasProviderTraceIdColumn()) {
                    mapper.updateProviderTraceId(result.itemId(), result.providerTraceId());
                }
                replaceKnowledgeChunks(result);
                mapper.markDocumentIndexed(result.documentId(), result.version());
            }
        } else {
            int attempt = Math.max(1, result.attempt());
            changed =
                    mapper.markItemFailed(
                                    result.itemId(),
                                    result.documentId(),
                                    result.errorCode(),
                                    result.errorSummary(),
                                    attempt,
                                    result.version())
                            == 1;
            if (changed && attempt < 3) {
                if (mapper.requeueIndexOutbox(
                                result.itemId(),
                                attempt + 1,
                                1 << (attempt - 1),
                                result.errorCode())
                        != 1) {
                    throw new IllegalStateException("knowledge index outbox is missing");
                }
            }
        }
        if (!changed) return;
        long jobId = mapper.jobIdForItem(result.itemId());
        // 先锁定批次再聚合，保证并发条目全部提交后最终一次刷新可以收敛状态。
        mapper.lockJobForRefresh(jobId);
        mapper.refreshJob(result.itemId());
        mapper.insertJobEvent(
                ids.nextId(),
                jobId,
                result.itemId(),
                "knowledge.index." + result.status(),
                "{\"item_id\":"
                        + result.itemId()
                        + ",\"document_id\":"
                        + result.documentId()
                        + ",\"status\":\""
                        + result.status()
                        + "\",\"error_code\":\""
                        + jsonString(result.errorCode())
                        + "\",\"error_summary\":\""
                        + jsonString(result.errorSummary())
                        + "\"}");
        JobView progress = mapper.job(jobId);
        mapper.insertJobEvent(
                ids.nextId(),
                jobId,
                result.itemId(),
                "knowledge.batch.progress",
                "{\"job_id\":"
                        + jobId
                        + ",\"status\":\""
                        + progress.status()
                        + "\",\"total_items\":"
                        + progress.totalItems()
                        + ",\"indexed_items\":"
                        + progress.indexedItems()
                        + ",\"failed_items\":"
                        + progress.failedItems()
                        + "}");
    }

    private String jsonString(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    @Override
    public void replaceKnowledgeChunks(IndexResult result) {
        if (!"indexed".equals(result.status()) || result.chunks().isEmpty()) return;
        mapper.softDeleteVersionChunks(result.documentId(), result.version());
        List<KnowledgeMapper.KnowledgeChunkRow> rows =
                result.chunks().stream()
                        .map(
                                chunk ->
                                        new KnowledgeMapper.KnowledgeChunkRow(
                                                ids.nextId(),
                                                chunk.chunkNo(),
                                                chunk.embeddingId(),
                                                chunk.sectionPath(),
                                                chunk.text()))
                        .toList();
        mapper.insertKnowledgeChunks(result.documentId(), result.version(), rows);
    }

    @Override
    public JobView job(long jobId) {
        return mapper.job(jobId);
    }

    @Override
    public java.util.List<ItemView> jobItems(long jobId) {
        return mapper.jobItems(jobId);
    }

    @Override
    public java.util.List<JobEvent> jobEvents(long jobId, long after) {
        return mapper.jobEvents(jobId, after);
    }

    @Override
    public long jobIdForItem(long itemId) {
        return mapper.jobIdForItem(itemId);
    }

    @Override
    public void insertJobEvent(
            long eventId, long jobId, Long itemId, String eventType, String payload) {
        mapper.insertJobEvent(eventId, jobId, itemId, eventType, payload);
    }

    @Override
    public int retryItem(long itemId, long jobId, long operatorId, long outboxId, String payload) {
        int changed = mapper.resetItem(itemId, jobId);
        if (changed == 1) {
            mapper.deleteResultInbox(itemId);
            mapper.insertIndexOutbox(outboxId, itemId, payload);
            mapper.refreshJob(itemId);
            mapper.insertJobEvent(
                    ids.nextId(),
                    jobId,
                    itemId,
                    "knowledge.index.retry",
                    "{\"item_id\":" + itemId + ",\"status\":\"pending\"}");
            JobView progress = mapper.job(jobId);
            mapper.insertJobEvent(
                    ids.nextId(),
                    jobId,
                    itemId,
                    "knowledge.batch.progress",
                    "{\"job_id\":"
                            + jobId
                            + ",\"status\":\""
                            + progress.status()
                            + "\",\"total_items\":"
                            + progress.totalItems()
                            + ",\"indexed_items\":"
                            + progress.indexedItems()
                            + ",\"failed_items\":"
                            + progress.failedItems()
                            + "}");
        }
        return changed;
    }
}
