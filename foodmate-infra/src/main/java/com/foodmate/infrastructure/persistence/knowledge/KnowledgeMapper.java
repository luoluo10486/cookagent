package com.foodmate.infrastructure.persistence.knowledge;

import com.foodmate.application.knowledge.port.out.KnowledgeRepository;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** Java 权威知识文档、任务和 Outbox 的 MyBatis 语句。 */
@Mapper
public interface KnowledgeMapper {
    @Insert(
            "INSERT INTO knowledge_documents(document_id,title,source_type,status,version,storage_key,created_by,updated_by) VALUES (#{documentId},#{title},'admin_upload','uploaded','1',#{storageKey},#{operatorId},#{operatorId})")
    void insertDocument(
            @Param("documentId") long documentId,
            @Param("title") String title,
            @Param("storageKey") String storageKey,
            @Param("operatorId") long operatorId);

    @Update(
            "UPDATE knowledge_documents SET source_type=#{sourceType},source_name=#{sourceName},source_version=#{sourceVersion},license_notice=#{licenseNotice},version=#{sourceVersion},updated_by=#{operatorId},updated_at=CURRENT_TIMESTAMP WHERE document_id=#{documentId}")
    void updateDocumentSource(
            @Param("documentId") long documentId,
            @Param("sourceType") String sourceType,
            @Param("sourceName") String sourceName,
            @Param("sourceVersion") String sourceVersion,
            @Param("licenseNotice") String licenseNotice,
            @Param("operatorId") long operatorId);

    @Update(
            "UPDATE knowledge_documents SET status=#{status},updated_at=CURRENT_TIMESTAMP,updated_by=#{operatorId} WHERE document_id=#{documentId} AND is_deleted=FALSE")
    int updateStatus(
            @Param("documentId") long documentId,
            @Param("status") String status,
            @Param("operatorId") long operatorId);

    @Insert(
            "INSERT INTO knowledge_import_jobs(job_id,operator_id,idempotency_key,requested_mode,source_type,source_name,source_version,license_notice,trace_id,status) VALUES(#{jobId},#{operatorId},#{idempotencyKey},#{mode},#{sourceType},#{sourceName},#{sourceVersion},#{licenseNotice},#{traceId},'uploaded')")
    void insertImportJob(
            @Param("jobId") long jobId,
            @Param("operatorId") long operatorId,
            @Param("idempotencyKey") String idempotencyKey,
            @Param("mode") String mode,
            @Param("sourceType") String sourceType,
            @Param("sourceName") String sourceName,
            @Param("sourceVersion") String sourceVersion,
            @Param("licenseNotice") String licenseNotice,
            @Param("traceId") String traceId);

    @Select(
            "SELECT job_id AS jobId,operator_id AS operatorId,idempotency_key AS idempotencyKey,requested_mode AS mode,source_type AS sourceType,source_name AS sourceName,source_version AS sourceVersion,license_notice AS licenseNotice,trace_id AS traceId FROM knowledge_import_jobs WHERE operator_id=#{operatorId} AND idempotency_key=#{idempotencyKey}")
    KnowledgeRepository.ImportJob findImportJob(
            @Param("operatorId") long operatorId, @Param("idempotencyKey") String idempotencyKey);

    @Insert(
            "INSERT INTO knowledge_import_items(item_id,job_id,document_id,filename,content_type,file_size,upload_status,index_status) VALUES(#{itemId},#{jobId},#{documentId},#{filename},#{contentType},#{size},'uploaded','pending')")
    void insertImportItem(
            @Param("itemId") long itemId,
            @Param("jobId") long jobId,
            @Param("documentId") long documentId,
            @Param("filename") String filename,
            @Param("contentType") String contentType,
            @Param("size") long size);

    @Insert(
            "WITH source AS (SELECT CAST(#{payload} AS jsonb) AS requested_payload), base AS (SELECT requested_payload,CASE WHEN requested_payload='{}'::jsonb THEN COALESCE((SELECT payload_json FROM knowledge_index_outbox WHERE item_id=#{itemId} AND topic='foodmate-knowledge-index-v1' ORDER BY outbox_id DESC LIMIT 1),requested_payload) ELSE requested_payload END AS payload FROM source) INSERT INTO knowledge_index_outbox(outbox_id,item_id,topic,payload_json) SELECT #{outboxId},#{itemId},'foodmate-knowledge-index-v1',jsonb_set(payload,'{attempt}',CASE WHEN requested_payload='{}'::jsonb THEN '1'::jsonb WHEN jsonb_exists(payload,'attempt') THEN payload->'attempt' ELSE '1'::jsonb END,true) FROM base")
    void insertIndexOutbox(
            @Param("outboxId") long outboxId,
            @Param("itemId") long itemId,
            @Param("payload") String payload);

    @Update(
            "UPDATE knowledge_documents SET visibility=#{visibility},is_deleted=(#{visibility}='deleted'),deleted_at=CASE WHEN #{visibility}='deleted' THEN CURRENT_TIMESTAMP ELSE NULL END,deleted_by=CASE WHEN #{visibility}='deleted' THEN #{operatorId} ELSE NULL END,updated_by=#{operatorId},updated_at=CURRENT_TIMESTAMP WHERE document_id=#{documentId} AND (#{visibility}<>'published' OR (status='indexed' AND is_deleted=FALSE AND current_version=TRUE))")
    int updateVisibility(
            @Param("documentId") long documentId,
            @Param("visibility") String visibility,
            @Param("operatorId") long operatorId);

    @Select(
            "SELECT document_id AS documentId,version,current_version AS currentVersion FROM knowledge_documents WHERE document_id=#{documentId}")
    KnowledgeRepository.DocumentView document(@Param("documentId") long documentId);

    @Select(
            "SELECT COUNT(*) FROM knowledge_documents WHERE document_id=#{documentId} AND version=#{version} AND tenant_id=0 AND visibility='published' AND status='indexed' AND current_version=TRUE AND is_deleted=FALSE")
    int isPublicPublished(@Param("documentId") long documentId, @Param("version") String version);

    @Insert(
            "INSERT INTO knowledge_visibility_outbox(outbox_id,document_id,topic,payload_json) VALUES(#{outboxId},#{documentId},'foodmate-knowledge-visibility-v1',CAST(#{payload} AS jsonb))")
    void insertVisibilityOutbox(
            @Param("outboxId") long outboxId,
            @Param("documentId") long documentId,
            @Param("payload") String payload);

    @Select(
            "SELECT outbox_id AS outboxId,item_id AS itemOrDocumentId,topic,payload_json::text AS payload FROM knowledge_index_outbox WHERE status='pending' AND available_at<=CURRENT_TIMESTAMP AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) ORDER BY outbox_id LIMIT #{limit}")
    List<KnowledgeRepository.OutboxRow> pendingIndexOutbox(int limit);

    @Select(
            "SELECT outbox_id AS outboxId,document_id AS itemOrDocumentId,topic,payload_json::text AS payload FROM knowledge_visibility_outbox WHERE status='pending' AND available_at<=CURRENT_TIMESTAMP AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) ORDER BY outbox_id LIMIT #{limit}")
    List<KnowledgeRepository.OutboxRow> pendingVisibilityOutbox(int limit);

    @Update(
            "UPDATE knowledge_index_outbox SET owner_token=#{owner},lease_until=CURRENT_TIMESTAMP+INTERVAL '30 seconds',attempt_count=attempt_count+1,updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP)")
    int leaseIndexOutbox(@Param("outboxId") long outboxId, @Param("owner") String owner);

    @Update(
            "UPDATE knowledge_visibility_outbox SET owner_token=#{owner},lease_until=CURRENT_TIMESTAMP+INTERVAL '30 seconds',attempt_count=attempt_count+1,updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP)")
    int leaseVisibilityOutbox(@Param("outboxId") long outboxId, @Param("owner") String owner);

    @Update(
            "UPDATE knowledge_index_outbox SET status='published',owner_token=NULL,lease_until=NULL,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND owner_token=#{owner}")
    void markIndexOutboxPublished(@Param("outboxId") long outboxId, @Param("owner") String owner);

    @Update(
            "UPDATE knowledge_visibility_outbox SET status='published',owner_token=NULL,lease_until=NULL,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND owner_token=#{owner}")
    void markVisibilityOutboxPublished(
            @Param("outboxId") long outboxId, @Param("owner") String owner);

    @Update(
            "UPDATE knowledge_index_outbox SET status='pending',owner_token=NULL,lease_until=NULL,last_error=#{error},available_at=CURRENT_TIMESTAMP + (LEAST(60,POWER(2,GREATEST(attempt_count-1,0))) * INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND owner_token=#{owner}")
    void retryIndexOutbox(
            @Param("outboxId") long outboxId,
            @Param("owner") String owner,
            @Param("error") String error);

    @Update(
            "UPDATE knowledge_visibility_outbox SET status='pending',owner_token=NULL,lease_until=NULL,last_error=#{error},available_at=CURRENT_TIMESTAMP + (LEAST(60,POWER(2,GREATEST(attempt_count-1,0))) * INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP WHERE outbox_id=#{outboxId} AND status='pending' AND owner_token=#{owner}")
    void retryVisibilityOutbox(
            @Param("outboxId") long outboxId,
            @Param("owner") String owner,
            @Param("error") String error);

    @Insert(
            "INSERT INTO knowledge_index_result_inbox(item_id,document_version,attempt_count,payload_hash) VALUES(#{itemId},#{version},#{attempt},#{payloadHash}) ON CONFLICT (item_id,document_version,attempt_count) DO NOTHING")
    int insertResultInbox(
            @Param("itemId") long itemId,
            @Param("version") String version,
            @Param("attempt") int attempt,
            @Param("payloadHash") String payloadHash);

    @Select(
            "SELECT payload_hash FROM knowledge_index_result_inbox WHERE item_id=#{itemId} AND document_version=#{version} AND attempt_count=#{attempt}")
    String resultPayloadHash(
            @Param("itemId") long itemId,
            @Param("version") String version,
            @Param("attempt") int attempt);

    @Select(
            "SELECT COUNT(*) FROM knowledge_import_items i JOIN knowledge_documents d ON d.document_id=i.document_id WHERE i.item_id=#{itemId} AND i.document_id=#{documentId} AND d.version=#{version}")
    int resultMatchesItem(
            @Param("itemId") long itemId,
            @Param("documentId") long documentId,
            @Param("version") String version);

    @Update(
            // provider_trace_id is introduced by V29 and is not present in older local databases.
            // Keep the authoritative state transition usable before V29; the adapter persists the
            // optional trace in a separate guarded statement when the column exists.
            "UPDATE knowledge_import_items i SET index_status='indexed',attempt_count=GREATEST(i.attempt_count,#{attempt}),chunk_count=#{chunkCount},indexed_at=CURRENT_TIMESTAMP,error_code=NULL,error_summary=NULL,token_count=#{tokenCount},cost_amount=#{costAmount},model_version=#{modelVersion},updated_at=CURRENT_TIMESTAMP FROM knowledge_documents d WHERE i.item_id=#{itemId} AND i.document_id=#{documentId} AND d.document_id=i.document_id AND d.version=#{version} AND i.index_status<>'indexed' AND #{attempt}>=i.attempt_count")
    int markItemIndexed(
            @Param("itemId") long itemId,
            @Param("documentId") long documentId,
            @Param("attempt") int attempt,
            @Param("chunkCount") int chunkCount,
            @Param("version") String version,
            @Param("tokenCount") long tokenCount,
            @Param("costAmount") java.math.BigDecimal costAmount,
            @Param("modelVersion") String modelVersion,
            @Param("providerTraceId") String providerTraceId);

    @Select(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='knowledge_import_items' AND column_name='provider_trace_id')")
    boolean hasProviderTraceIdColumn();

    @Update(
            "UPDATE knowledge_import_items SET provider_trace_id=#{providerTraceId},updated_at=CURRENT_TIMESTAMP WHERE item_id=#{itemId}")
    void updateProviderTraceId(
            @Param("itemId") long itemId, @Param("providerTraceId") String providerTraceId);

    @Update(
            "UPDATE knowledge_documents SET status='indexed',indexed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE document_id=#{documentId} AND version=#{version} AND is_deleted=FALSE")
    void markDocumentIndexed(
            @Param("documentId") long documentId, @Param("version") String version);

    @Update(
            "UPDATE knowledge_chunks SET is_deleted=TRUE,deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE document_id=#{documentId} AND document_version=#{version} AND is_deleted=FALSE")
    void softDeleteVersionChunks(
            @Param("documentId") long documentId, @Param("version") String version);

    @Insert(
            "<script>INSERT INTO knowledge_chunks(chunk_id,document_id,chunk_no,chunk_text,section_path,version,embedding_id,document_version,acl_metadata,metadata_json,created_at,updated_at,is_deleted) VALUES <foreach collection='chunks' item='chunk' separator=','>(#{chunk.chunkId},#{documentId},#{chunk.chunkNo},#{chunk.text},#{chunk.sectionPath},#{version},#{chunk.embeddingId},#{version},CAST('{\"tenant_id\":0,\"scope\":\"public_published\"}' AS jsonb),'{}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,FALSE)</foreach> ON CONFLICT (document_id,chunk_no) WHERE is_deleted=FALSE DO UPDATE SET chunk_text=EXCLUDED.chunk_text,section_path=EXCLUDED.section_path,version=EXCLUDED.version,embedding_id=EXCLUDED.embedding_id,document_version=EXCLUDED.document_version,acl_metadata=EXCLUDED.acl_metadata,metadata_json=EXCLUDED.metadata_json,updated_at=CURRENT_TIMESTAMP,is_deleted=FALSE,deleted_at=NULL</script>")
    void insertKnowledgeChunks(
            @Param("documentId") long documentId,
            @Param("version") String version,
            @Param("chunks") java.util.List<KnowledgeChunkRow> chunks);

    @Update(
            "UPDATE knowledge_import_items i SET index_status=CASE WHEN #{attempt}>=3 THEN 'index_failed' ELSE 'pending' END,attempt_count=GREATEST(i.attempt_count,LEAST(3,#{attempt})),error_code=#{errorCode},error_summary=#{errorSummary},updated_at=CURRENT_TIMESTAMP FROM knowledge_documents d WHERE i.item_id=#{itemId} AND i.document_id=#{documentId} AND d.document_id=i.document_id AND d.version=#{version} AND i.index_status<>'indexed' AND #{attempt}>=i.attempt_count")
    int markItemFailed(
            @Param("itemId") long itemId,
            @Param("documentId") long documentId,
            @Param("errorCode") String errorCode,
            @Param("errorSummary") String errorSummary,
            @Param("attempt") int attempt,
            @Param("version") String version);

    @Update(
            "WITH candidate AS (SELECT outbox_id FROM knowledge_index_outbox WHERE item_id=#{itemId} AND topic='foodmate-knowledge-index-v1' AND status='published' AND CASE WHEN payload_json->>'attempt' ~ '^[1-3]$' THEN (payload_json->>'attempt')::int ELSE 1 END=(#{attempt} - 1) ORDER BY outbox_id DESC LIMIT 1) UPDATE knowledge_index_outbox AS outbox SET status='pending',attempt_count=0,available_at=CURRENT_TIMESTAMP + (#{delaySeconds} * INTERVAL '1 second'),owner_token=NULL,lease_until=NULL,last_error=#{errorCode},payload_json=jsonb_set(outbox.payload_json,'{attempt}',to_jsonb(#{attempt}::int),true),updated_at=CURRENT_TIMESTAMP FROM candidate WHERE outbox.outbox_id=candidate.outbox_id")
    int requeueIndexOutbox(
            @Param("itemId") long itemId,
            @Param("attempt") int attempt,
            @Param("delaySeconds") int delaySeconds,
            @Param("errorCode") String errorCode);

    @Update(
            "UPDATE knowledge_import_jobs j SET status=CASE WHEN EXISTS(SELECT 1 FROM knowledge_import_items i WHERE i.job_id=j.job_id AND i.index_status IN ('pending','parsing','parsed','indexing')) THEN 'indexing' WHEN NOT EXISTS(SELECT 1 FROM knowledge_import_items i WHERE i.job_id=j.job_id AND i.index_status='indexed') THEN 'failed' WHEN EXISTS(SELECT 1 FROM knowledge_import_items i WHERE i.job_id=j.job_id AND i.index_status='index_failed') THEN 'partial_failed' ELSE 'completed' END,token_count=(SELECT COALESCE(SUM(i.token_count),0) FROM knowledge_import_items i WHERE i.job_id=j.job_id),cost_amount=(SELECT COALESCE(SUM(i.cost_amount),0) FROM knowledge_import_items i WHERE i.job_id=j.job_id),updated_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN NOT EXISTS(SELECT 1 FROM knowledge_import_items i WHERE i.job_id=j.job_id AND i.index_status IN ('pending','parsing','parsed','indexing')) THEN COALESCE(j.completed_at,CURRENT_TIMESTAMP) ELSE NULL END WHERE j.job_id=(SELECT job_id FROM knowledge_import_items WHERE item_id=#{itemId})")
    void refreshJob(long itemId);

    @Insert(
            "INSERT INTO knowledge_import_sse_outbox(event_id,job_id,item_id,event_type,payload_json) VALUES(#{eventId},#{jobId},#{itemId},#{eventType},CAST(#{payload} AS jsonb))")
    void insertJobEvent(
            @Param("eventId") long eventId,
            @Param("jobId") long jobId,
            @Param("itemId") Long itemId,
            @Param("eventType") String eventType,
            @Param("payload") String payload);

    @Select("SELECT job_id FROM knowledge_import_items WHERE item_id=#{itemId}")
    long jobIdForItem(@Param("itemId") long itemId);

    /** 锁定批次行，避免并发结果回写时批次状态聚合读取到过期快照。 */
    @Select("SELECT job_id FROM knowledge_import_jobs WHERE job_id=#{jobId} FOR UPDATE")
    long lockJobForRefresh(@Param("jobId") long jobId);

    @Select(
            "SELECT j.job_id AS jobId,j.status AS status,COUNT(i.item_id) AS totalItems,COUNT(i.item_id) FILTER(WHERE i.index_status='indexed') AS indexedItems,COUNT(i.item_id) FILTER(WHERE i.index_status='index_failed') AS failedItems FROM knowledge_import_jobs j LEFT JOIN knowledge_import_items i ON i.job_id=j.job_id WHERE j.job_id=#{jobId} GROUP BY j.job_id")
    KnowledgeRepository.JobView job(long jobId);

    @Select(
            "SELECT item_id AS itemId,document_id AS documentId,filename,upload_status AS uploadStatus,index_status AS indexStatus,attempt_count AS attempts,error_code AS errorCode FROM knowledge_import_items WHERE job_id=#{jobId} ORDER BY created_at")
    List<KnowledgeRepository.ItemView> jobItems(long jobId);

    @Select(
            "SELECT event_id AS eventId,event_type AS eventType,payload_json::text AS payload FROM knowledge_import_sse_outbox WHERE job_id=#{jobId} AND event_id>#{afterEventId} ORDER BY event_id")
    List<KnowledgeRepository.JobEvent> jobEvents(
            @Param("jobId") long jobId, @Param("afterEventId") long afterEventId);

    @Update(
            "UPDATE knowledge_import_items SET index_status='pending',attempt_count=0,chunk_count=NULL,indexed_at=NULL,error_code=NULL,error_summary=NULL,updated_at=CURRENT_TIMESTAMP WHERE item_id=#{itemId} AND job_id=#{jobId} AND index_status='index_failed'")
    int resetItem(@Param("itemId") long itemId, @Param("jobId") long jobId);

    @org.apache.ibatis.annotations.Delete(
            "DELETE FROM knowledge_index_result_inbox WHERE item_id=#{itemId}")
    void deleteResultInbox(long itemId);

    record KnowledgeChunkRow(
            long chunkId, int chunkNo, String embeddingId, String sectionPath, String text) {}
}
