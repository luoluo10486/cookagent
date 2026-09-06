package com.foodmate.infrastructure.persistence.runtime;

import com.foodmate.application.runtime.port.out.AgentRunCommandRepository.MemoryContextRow;
import com.foodmate.application.runtime.port.out.AgentRunCommandRepository.RecentMessageRow;
import com.foodmate.application.runtime.port.out.AgentRunCommandRepository.SummarySnapshot;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface AgentRunCommandMapper {
    @Select(
            "SELECT agent_run_id FROM agent_runs WHERE session_id=#{sessionId} AND"
                    + " status='waiting_user' AND is_deleted=FALSE ORDER BY created_at DESC LIMIT 1")
    Long waitingRun(long sessionId);

    @Insert(
            "<script>INSERT INTO agent_runs(agent_run_id,session_id,status,trace_id,created_by<if"
                    + " test='parentRunId != null'>,parent_run_id,continuation_reason</if>) VALUES"
                    + " (#{runId},#{sessionId},'queued',#{traceId},#{userId}<if test='parentRunId !="
                    + " null'>,#{parentRunId},'clarification'</if>)</script>")
    void insertRun(long runId, long sessionId, String traceId, long userId, Long parentRunId);

    @Update(
            "UPDATE agent_runs SET user_message_id=#{messageId},updated_at=CURRENT_TIMESTAMP WHERE"
                    + " agent_run_id=#{runId}")
    void bindMessage(long runId, long messageId);

    @Select(
            """
            SELECT message.message_id::text AS messageId, message.role, message.content,
                   message.sequence_no AS sequenceNo
            FROM messages message
            JOIN sessions session ON session.session_id = message.session_id
            WHERE message.session_id=#{sessionId}
              AND message.is_deleted=FALSE
              AND NOT EXISTS (
                  SELECT 1
                  FROM user_memories memory
                  WHERE memory.user_id = session.user_id
                    AND (
                        memory.is_deleted = TRUE
                        OR memory.suppressed_source_message_ids <> '[]'::jsonb
                    )
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(
                            COALESCE(memory.source_message_ids, '[]'::jsonb)
                            || COALESCE(memory.suppressed_source_message_ids, '[]'::jsonb)
                        ) source_id
                        WHERE source_id.value = message.message_id::text
                    )
              )
            ORDER BY message.sequence_no DESC
            LIMIT 8
            """)
    @Options(useCache = false)
    List<RecentMessageRow> recentMessages(long sessionId);

    @Select(
            "SELECT summary_id::text AS summaryId,summary_text AS summaryText,key_constraints::text"
                    + " AS keyConstraints,covered_from_sequence AS"
                    + " coveredFromSequence,covered_to_sequence AS"
                    + " coveredToSequence,source_message_count AS sourceMessageCount,prompt_version AS"
                    + " promptVersion,content_digest AS contentDigest,version FROM session_summaries"
                    + " WHERE session_id=#{sessionId} AND is_deleted=FALSE AND invalidated_at IS NULL")
    SummarySnapshot summary(long sessionId);

    @Select(
            """
            <script>
            SELECT memory.memory_id::text AS memoryId,
                   memory.memory_type AS memoryType,
                   memory.memory_key AS memoryKey,
                   memory.memory_value::text AS memoryValue,
                   memory.confidence,
                   memory.scope
            FROM user_memories memory
            WHERE memory.user_id=#{userId}
              AND memory.is_deleted=FALSE
              AND memory.confirmation_status='confirmed'
              AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP)
              AND NOT EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements_text(COALESCE(memory.source_message_ids, '[]'::jsonb)) source_id
                  JOIN messages message ON message.message_id::text = source_id.value
                  WHERE message.is_deleted = TRUE
              )
              AND memory.memory_type IN
              <choose>
                  <when test="intent == 'planning'">
                      ('preference','constraint','routine','cooking_skill','budget_habit','time_habit','interaction_preference','user_rule')
                  </when>
                  <when test="intent == 'cooking'">
                      ('preference','constraint','routine','cooking_skill','interaction_preference','user_rule')
                  </when>
                  <when test="intent == 'record'">
                      ('preference','constraint','routine','budget_habit','time_habit','user_rule')
                  </when>
                  <when test="intent == 'nutrition'">
                      ('preference','constraint','budget_habit','time_habit','user_rule')
                  </when>
                  <otherwise>
                      ('preference','constraint','routine','cooking_skill','budget_habit','time_habit','interaction_preference','user_rule')
                  </otherwise>
              </choose>
            ORDER BY memory.updated_at DESC
            LIMIT 8
            </script>
            """)
    @Options(useCache = false)
    List<MemoryContextRow> memories(@Param("userId") long userId, @Param("intent") String intent);

    @Insert(
            "INSERT INTO"
                    + " agent_run_dispatches(agent_run_dispatch_id,agent_run_id,dispatch_id,attempt,active_epoch,fencing_token,admission_epoch,deadline_at)"
                    + " VALUES (#{id},#{runId},#{dispatchId},1,1,#{fence},0,#{deadline})")
    void insertDispatch(long id, long runId, String dispatchId, String fence, Instant deadline);

    @Insert(
            "INSERT INTO"
                    + " runtime_dispatch_outbox(outbox_id,agent_run_dispatch_id,agent_run_id,dispatch_id,run_id,attempt,schema_version,deadline_at,fencing_epoch,payload_json,request_hash)"
                    + " VALUES"
                    + " (#{id},#{dispatchRowId},#{runId},#{dispatchId},#{runId}::text,1,'v1',#{deadline},1,CAST(#{payload}"
                    + " AS jsonb),#{hash})")
    void insertOutbox(
            long id,
            long dispatchRowId,
            long runId,
            String dispatchId,
            Instant deadline,
            String payload,
            String hash);

    @Update(
            "UPDATE runtime_dispatch_outbox SET"
                    + " status='queued',queued_at=CURRENT_TIMESTAMP,queue_priority=#{priority},updated_at=CURRENT_TIMESTAMP"
                    + " WHERE agent_run_id=#{runId} AND dispatch_id=#{dispatchId}")
    void queueOutbox(long runId, String dispatchId, int priority);

    @Update(
            "UPDATE agent_runs SET active_dispatch_id=#{dispatchRowId},updated_at=CURRENT_TIMESTAMP"
                    + " WHERE agent_run_id=#{runId}")
    void activateDispatch(long runId, long dispatchRowId);

    @Update(
            "UPDATE agent_runs SET"
                    + " status='superseded',superseded_by_run_id=#{continuationRunId},admission_state='closed',updated_at=CURRENT_TIMESTAMP"
                    + " WHERE agent_run_id=#{parentRunId} AND status='waiting_user'")
    int supersede(long parentRunId, long continuationRunId);

    @Update(
            "UPDATE agent_run_dispatches SET"
                    + " dispatch_arbitration_state='superseded',updated_at=CURRENT_TIMESTAMP WHERE"
                    + " agent_run_id=#{runId} AND dispatch_arbitration_state='active'")
    void supersedeDispatch(long runId);

    @Update(
            "UPDATE runtime_dispatch_outbox SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE"
                    + " agent_run_id=#{runId} AND status='pending'")
    void expireOutbox(long runId);

    @Select("SELECT sse_last_stream_seq+1 FROM agent_runs WHERE agent_run_id=#{runId} FOR UPDATE")
    long lockNextSseSequence(long runId);

    @Insert(
            "INSERT INTO"
                    + " agent_run_sse_outbox(agent_run_sse_outbox_id,agent_run_id,sse_event_id,stream_seq,source_event_key,event_type,payload_json)"
                    + " VALUES"
                    + " (#{id},#{runId},#{eventId},#{seq},#{sourceKey},'run.superseded',CAST(#{payload}"
                    + " AS jsonb))")
    void insertSse(long id, long runId, String eventId, long seq, String sourceKey, String payload);

    @Update("UPDATE agent_runs SET sse_last_stream_seq=#{seq} WHERE agent_run_id=#{runId}")
    void updateSseSequence(long runId, long seq);

    @Insert(
            "INSERT INTO"
                    + " agent_run_budget_snapshots(budget_snapshot_id,agent_run_id,revision,source,max_total_tokens,max_cost_cny,max_step_retries,max_replans,max_answer_rewrites,max_total_steps,max_model_calls,queue_timeout_seconds,execution_timeout_seconds,node_timeout_seconds,waiting_user_timeout_seconds,config_version)"
                    + " VALUES"
                    + " (#{id},#{runId},1,'initial',#{tokens},#{cost},#{retries},#{replans},#{rewrites},#{steps},#{calls},#{queueTimeout},#{executionTimeout},#{nodeTimeout},#{waitingTimeout},#{version})")
    void insertBudget(
            long id,
            long runId,
            int tokens,
            BigDecimal cost,
            int retries,
            int replans,
            int rewrites,
            int steps,
            int calls,
            int queueTimeout,
            int executionTimeout,
            int nodeTimeout,
            int waitingTimeout,
            String version);
}
