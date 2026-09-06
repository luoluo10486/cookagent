package com.foodmate.infrastructure.persistence.account;

import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.DeletedRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.DlqRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.KnowledgeRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.OperationAuditRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.Query;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.RunRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.SqlAuditRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.ToolCallRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.ToolRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.TraceRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.TraceSpanRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.UsageRow;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.UserRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** PostgreSQL 分页查询；每条 SQL 明确裁剪字段，禁止返回原文和存储对象键。 */
@Mapper
public interface AdminOperationalQueryMapper {
    @Select(
            "<script>SELECT user_id,username,role,status,CASE WHEN email IS NULL THEN NULL ELSE"
                    + " CONCAT('email-',MD5(email)) END AS email_ref FROM users WHERE"
                    + " is_deleted=FALSE<if test='q.text != null and q.text != &quot;&quot;'> AND"
                    + " username ILIKE CONCAT('%',#{q.text},'%')</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND status=#{q.status}</if> ORDER BY <choose><when"
                    + " test=\"q.sort == 'username'\">username</when><when test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,user_id DESC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<UserRow> users(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM users WHERE is_deleted=FALSE<if test='q.text != null and"
                    + " q.text != &quot;&quot;'> AND username ILIKE CONCAT('%',#{q.text},'%')</if><if"
                    + " test='q.status != null and q.status != &quot;&quot;'> AND"
                    + " status=#{q.status}</if></script>")
    long countUsers(@Param("q") Query query);

    @Select(
            "<script>SELECT r.agent_run_id,r.session_id,r.intent,r.status,r.trace_id,EXTRACT(EPOCH"
                    + " FROM (r.updated_at-r.created_at))*1000 AS duration_ms,CASE WHEN s.user_id IS"
                    + " NULL THEN NULL ELSE CONCAT('user-',MD5(CAST(s.user_id AS TEXT))) END AS"
                    + " actor_ref FROM agent_runs r JOIN sessions s ON s.session_id=r.session_id LEFT"
                    + " JOIN users u ON u.user_id=s.user_id WHERE r.is_deleted=FALSE<if test='q.text !="
                    + " null and q.text != &quot;&quot;'> AND (r.intent ILIKE CONCAT('%',#{q.text},'%')"
                    + " OR r.trace_id ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null"
                    + " and q.status != &quot;&quot;'> AND r.status=#{q.status}</if> ORDER BY"
                    + " <choose><when test=\"q.sort == 'duration_ms'\">duration_ms</when><when"
                    + " test=\"q.sort =="
                    + " 'status'\">r.status</when><otherwise>r.created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,r.agent_run_id DESC"
                    + " LIMIT #{q.limit} OFFSET #{q.offset}</script>")
    List<RunRow> runs(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM agent_runs r JOIN sessions s ON s.session_id=r.session_id"
                    + " WHERE r.is_deleted=FALSE<if test='q.text != null and q.text != &quot;&quot;'>"
                    + " AND (r.intent ILIKE CONCAT('%',#{q.text},'%') OR r.trace_id ILIKE"
                    + " CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and q.status !="
                    + " &quot;&quot;'> AND r.status=#{q.status}</if></script>")
    long countRuns(@Param("q") Query query);

    @Select(
            "<script>SELECT r.trace_id, r.agent_run_id AS run_id, CONCAT_WS(' -> ', 'java.control-plane',"
                    + " CASE WHEN EXISTS (SELECT 1 FROM runtime_event_inbox_v2 e WHERE e.agent_run_id=r.agent_run_id"
                    + " AND e.event_type IN ('run.accepted','run.context_assembled','run.model_usage','run.completed'))"
                    + " THEN 'python.agent-runtime' END, CASE WHEN EXISTS (SELECT 1 FROM tool_calls t WHERE"
                    + " t.agent_run_id=r.agent_run_id AND t.is_deleted=FALSE) THEN 'tool' END, CASE WHEN EXISTS"
                    + " (SELECT 1 FROM model_usage_logs m WHERE m.trace_id=r.trace_id AND m.is_deleted=FALSE) THEN"
                    + " 'model' END, CASE WHEN EXISTS (SELECT 1 FROM agent_run_sse_outbox s WHERE"
                    + " s.agent_run_id=r.agent_run_id) THEN 'sse' END) AS entry, r.status, r.created_at AS started_at,"
                    + " EXTRACT(EPOCH FROM (r.updated_at-r.created_at))*1000 AS duration_ms,"
                    + " 1 + (SELECT COUNT(*) FROM runtime_event_inbox_v2 e WHERE e.agent_run_id=r.agent_run_id)"
                    + " + (SELECT COUNT(*) FROM tool_calls t WHERE t.agent_run_id=r.agent_run_id AND t.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM model_usage_logs m WHERE m.trace_id=r.trace_id AND m.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM agent_run_sse_outbox s WHERE s.agent_run_id=r.agent_run_id)"
                    + " + (SELECT COUNT(*) FROM sql_query_audits q WHERE q.trace_id=r.trace_id AND q.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM operation_audits o WHERE o.trace_id=r.trace_id AND o.is_deleted=FALSE)"
                    + " AS span_count, 'foodmate-java' AS root_service, r.error_code FROM agent_runs r WHERE"
                    + " r.is_deleted=FALSE AND NULLIF(BTRIM(r.trace_id),'') IS NOT NULL<if test='q.text != null and"
                    + " q.text != &quot;&quot;'> AND (r.trace_id ILIKE CONCAT('%',#{q.text},'%') OR CAST(r.agent_run_id AS"
                    + " TEXT) ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and q.status != &quot;&quot;'>"
                    + " AND r.status=#{q.status}</if> ORDER BY <choose><when test=\"q.sort == 'duration_ms'\">"
                    + " duration_ms</when><when test=\"q.sort == 'status'\">r.status</when><otherwise>r.created_at"
                    + "</otherwise></choose> <choose><when test=\"q.direction == 'asc'\">ASC</when><otherwise>DESC"
                    + "</otherwise></choose>,r.agent_run_id DESC LIMIT #{q.limit} OFFSET #{q.offset}</script>")
    List<TraceRow> traces(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM agent_runs r WHERE r.is_deleted=FALSE AND NULLIF(BTRIM(r.trace_id),'')"
                    + " IS NOT NULL<if test='q.text != null and q.text != &quot;&quot;'> AND (r.trace_id ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR CAST(r.agent_run_id AS TEXT) ILIKE CONCAT('%',#{q.text},'%'))"
                    + "</if><if test='q.status != null and q.status != &quot;&quot;'> AND r.status=#{q.status}</if>"
                    + "</script>")
    long countTraces(@Param("q") Query query);

    @Select(
            "SELECT r.trace_id, r.agent_run_id AS run_id, CONCAT_WS(' -> ', 'java.control-plane',"
                    + " CASE WHEN EXISTS (SELECT 1 FROM runtime_event_inbox_v2 e WHERE e.agent_run_id=r.agent_run_id)"
                    + " THEN 'python.agent-runtime' END, CASE WHEN EXISTS (SELECT 1 FROM tool_calls t WHERE"
                    + " t.agent_run_id=r.agent_run_id AND t.is_deleted=FALSE) THEN 'tool' END, CASE WHEN EXISTS"
                    + " (SELECT 1 FROM model_usage_logs m WHERE m.trace_id=r.trace_id AND m.is_deleted=FALSE) THEN"
                    + " 'model' END, CASE WHEN EXISTS (SELECT 1 FROM agent_run_sse_outbox s WHERE"
                    + " s.agent_run_id=r.agent_run_id) THEN 'sse' END) AS entry, r.status, r.created_at AS started_at,"
                    + " EXTRACT(EPOCH FROM (r.updated_at-r.created_at))*1000 AS duration_ms, 1"
                    + " + (SELECT COUNT(*) FROM runtime_event_inbox_v2 e WHERE e.agent_run_id=r.agent_run_id)"
                    + " + (SELECT COUNT(*) FROM tool_calls t WHERE t.agent_run_id=r.agent_run_id AND t.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM model_usage_logs m WHERE m.trace_id=r.trace_id AND m.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM agent_run_sse_outbox s WHERE s.agent_run_id=r.agent_run_id)"
                    + " + (SELECT COUNT(*) FROM sql_query_audits q WHERE q.trace_id=r.trace_id AND q.is_deleted=FALSE)"
                    + " + (SELECT COUNT(*) FROM operation_audits o WHERE o.trace_id=r.trace_id AND o.is_deleted=FALSE)"
                    + " AS span_count, 'foodmate-java' AS root_service, r.error_code FROM agent_runs r WHERE"
                    + " r.is_deleted=FALSE AND r.trace_id=#{traceId}")
    TraceRow traceById(@Param("traceId") String traceId);

    @Select(
            "SELECT e.event_id AS span_id, 'runtime_event' AS span_type, e.event_type AS name,"
                    + " 'python.agent-runtime' AS service, CASE WHEN e.processing_status='applied' THEN 'success'"
                    + " ELSE e.processing_status END AS status, e.occurred_at AS started_at,"
                    + " COALESCE(e.applied_at,e.received_at) AS finished_at,"
                    + " EXTRACT(EPOCH FROM (COALESCE(e.applied_at,e.received_at)-e.occurred_at))*1000 AS duration_ms,"
                    + " NULL::varchar AS error_code, e.event_seq AS sequence_no FROM runtime_event_inbox_v2 e"
                    + " JOIN agent_runs r ON r.agent_run_id=e.agent_run_id WHERE r.is_deleted=FALSE"
                    + " AND r.trace_id=#{traceId} UNION ALL SELECT CAST(t.tool_call_id AS TEXT), 'tool_call',"
                    + " t.tool_name, 'foodmate-java', t.status, t.created_at, t.updated_at,"
                    + " COALESCE(t.latency_ms,0)::numeric, t.error_code, t.tool_call_id FROM tool_calls t"
                    + " JOIN agent_runs r ON r.agent_run_id=t.agent_run_id WHERE r.is_deleted=FALSE"
                    + " AND t.is_deleted=FALSE AND r.trace_id=#{traceId} UNION ALL SELECT"
                    + " CAST(m.model_usage_log_id AS TEXT), 'model_call', CONCAT_WS(' / ',m.scene,m.provider_code,m.model_name),"
                    + " 'foodmate-java', m.status, m.created_at, m.updated_at, COALESCE(m.latency_ms,0)::numeric,"
                    + " NULL::varchar, m.model_usage_log_id FROM model_usage_logs m WHERE m.is_deleted=FALSE"
                    + " AND m.trace_id=#{traceId} UNION ALL SELECT s.sse_event_id, 'sse_event', s.event_type,"
                    + " 'foodmate-java', s.status, s.created_at, COALESCE(s.sent_at,s.updated_at),"
                    + " EXTRACT(EPOCH FROM (COALESCE(s.sent_at,s.updated_at)-s.created_at))*1000,"
                    + " s.last_error_code, s.stream_seq FROM agent_run_sse_outbox s JOIN agent_runs r"
                    + " ON r.agent_run_id=s.agent_run_id WHERE r.is_deleted=FALSE AND r.trace_id=#{traceId}"
                    + " UNION ALL SELECT CAST(q.sql_audit_id AS TEXT), 'sql_audit',"
                    + " CONCAT('sql_query/',MD5(COALESCE(q.sql_text,''))), 'foodmate-java', q.status, q.created_at,"
                    + " q.updated_at, COALESCE(q.latency_ms,0)::numeric, q.reject_reason, q.sql_audit_id"
                    + " FROM sql_query_audits q WHERE q.is_deleted=FALSE AND q.trace_id=#{traceId} UNION ALL"
                    + " SELECT CAST(o.operation_audit_id AS TEXT), 'operation_audit', o.action, 'foodmate-java',"
                    + " o.result, o.created_at, o.updated_at, EXTRACT(EPOCH FROM (o.updated_at-o.created_at))*1000,"
                    + " o.error_code, o.operation_audit_id FROM operation_audits o WHERE o.is_deleted=FALSE"
                    + " AND o.trace_id=#{traceId} ORDER BY started_at, sequence_no, span_type")
    List<TraceSpanRow> traceSpans(@Param("traceId") String traceId);

    @Select(
            "<script>SELECT tool_call_id,agent_run_id,tool_name,status,latency_ms,trace_id FROM"
                    + " tool_calls WHERE is_deleted=FALSE<if test='q.text != null and q.text !="
                    + " &quot;&quot;'> AND (tool_name ILIKE CONCAT('%',#{q.text},'%') OR trace_id ILIKE"
                    + " CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and q.status !="
                    + " &quot;&quot;'> AND status=#{q.status}</if> ORDER BY <choose><when test=\"q.sort"
                    + " == 'latency_ms'\">latency_ms</when><when test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,tool_call_id DESC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<ToolCallRow> toolCalls(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM tool_calls WHERE is_deleted=FALSE<if test='q.text != null"
                    + " and q.text != &quot;&quot;'> AND (tool_name ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " trace_id ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND status=#{q.status}</if></script>")
    long countToolCalls(@Param("q") Query query);

    @Select(
            "<script>SELECT sql_audit_id,created_by AS actor,MD5(COALESCE(sql_text,'')) AS"
                    + " query_hash,status AS result,trace_id,latency_ms,row_count,reject_reason AS"
                    + " error_code,created_at FROM sql_query_audits WHERE is_deleted=FALSE<if"
                    + " test='q.text != null and q.text != &quot;&quot;'> AND (trace_id ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR status ILIKE CONCAT('%',#{q.text},'%'))</if><if"
                    + " test='q.status != null and q.status != &quot;&quot;'> AND"
                    + " status=#{q.status}</if> ORDER BY <choose><when test=\"q.sort =="
                    + " 'latency_ms'\">latency_ms</when><when test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,sql_audit_id DESC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<SqlAuditRow> sqlAudits(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM sql_query_audits WHERE is_deleted=FALSE<if test='q.text"
                    + " != null and q.text != &quot;&quot;'> AND (trace_id ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR status ILIKE CONCAT('%',#{q.text},'%'))</if><if"
                    + " test='q.status != null and q.status != &quot;&quot;'> AND"
                    + " status=#{q.status}</if></script>")
    long countSqlAudits(@Param("q") Query query);

    @Select(
            "<script>SELECT name,COALESCE(current_version,'-') AS version,risk_level AS"
                    + " risk,status,availability_scope AS scope,category AS"
                    + " owner,COALESCE(updated_at::text,'-') AS last_called_at FROM tool_registries"
                    + " WHERE is_deleted=FALSE<if test='q.text != null and q.text != &quot;&quot;'> AND"
                    + " (name ILIKE CONCAT('%',#{q.text},'%') OR category ILIKE"
                    + " CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and q.status !="
                    + " &quot;&quot;'> AND status=#{q.status}</if> ORDER BY <choose><when test=\"q.sort"
                    + " == 'updated_at'\">updated_at</when><when test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>name</otherwise></choose> <choose><when"
                    + " test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,name ASC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<ToolRow> tools(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM tool_registries WHERE is_deleted=FALSE<if test='q.text !="
                    + " null and q.text != &quot;&quot;'> AND (name ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " category ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND status=#{q.status}</if></script>")
    long countTools(@Param("q") Query query);

    @Select(
            "<script>SELECT provider_code AS provider,model_name AS"
                    + " model,scene,COALESCE((usage_json->>'total_tokens'),'0') AS"
                    + " tokens,cost_amount AS cost,latency_ms,status FROM model_usage_logs WHERE"
                    + " is_deleted=FALSE<if test='q.text != null and q.text != &quot;&quot;'> AND"
                    + " (provider_code ILIKE CONCAT('%',#{q.text},'%') OR model_name ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR scene ILIKE CONCAT('%',#{q.text},'%'))</if><if"
                    + " test='q.status != null and q.status != &quot;&quot;'> AND"
                    + " status=#{q.status}</if> ORDER BY <choose><when test=\"q.sort =="
                    + " 'latency_ms'\">latency_ms</when><when test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,model_usage_log_id DESC"
                    + " LIMIT #{q.limit} OFFSET #{q.offset}</script>")
    List<UsageRow> usage(@Param("q") Query query);

    @Select(
            "<script>SELECT provider_code AS provider,model_name AS"
                    + " model,scene,COALESCE((usage_json->>'total_tokens'),'0') AS"
                    + " tokens,cost_amount AS cost,latency_ms,status FROM model_usage_logs WHERE"
                    + " is_deleted=FALSE<if test='q.text != null and q.text != &quot;&quot;'> AND"
                    + " (provider_code ILIKE CONCAT('%',#{q.text},'%') OR model_name ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR scene ILIKE CONCAT('%',#{q.text},'%'))</if><if"
                    + " test='q.status != null and q.status != &quot;&quot;'> AND"
                    + " status=#{q.status}</if></script>")
    long countUsage(@Param("q") Query query);

    @Select(
            "<script>SELECT document_id,title,status,visibility,(SELECT COUNT(*) FROM"
                    + " knowledge_chunks c WHERE c.document_id=d.document_id AND c.is_deleted=FALSE) AS"
                    + " chunks,COALESCE(source_name,source_type,'-') AS source,CASE WHEN"
                    + " status='indexed' THEN '100%' WHEN status='parsed' THEN '70%' ELSE '0%' END AS"
                    + " index_progress,updated_at FROM knowledge_documents d WHERE is_deleted=FALSE<if"
                    + " test='q.text != null and q.text != &quot;&quot;'> AND (title ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR source_name ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " source_type ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND status=#{q.status}</if><if test='q.visibility !="
                    + " null and q.visibility != &quot;&quot;'> AND visibility=#{q.visibility}</if>"
                    + " ORDER BY <choose><when test=\"q.sort == 'title'\">title</when><when"
                    + " test=\"q.sort =="
                    + " 'status'\">status</when><otherwise>updated_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,document_id DESC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<KnowledgeRow> knowledge(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM knowledge_documents WHERE is_deleted=FALSE<if"
                    + " test='q.text != null and q.text != &quot;&quot;'> AND (title ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR source_name ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " source_type ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND status=#{q.status}</if><if test='q.visibility !="
                    + " null and q.visibility != &quot;&quot;'> AND"
                    + " visibility=#{q.visibility}</if></script>")
    long countKnowledge(@Param("q") Query query);

    @Select(
            "<script>SELECT resource_type,resource_id,owner_ref,deleted_at,reason FROM (SELECT"
                    + " 'user' AS resource_type,user_id AS resource_id,CONCAT('user-',MD5(CAST(user_id"
                    + " AS TEXT))) AS owner_ref,deleted_at,'account_deleted' AS reason FROM users WHERE"
                    + " is_deleted=TRUE UNION ALL SELECT"
                    + " 'knowledge_document',document_id,CONCAT('user-',MD5(CAST(COALESCE(created_by,0)"
                    + " AS TEXT))),deleted_at,'knowledge_document_deleted' FROM knowledge_documents"
                    + " WHERE is_deleted=TRUE UNION ALL SELECT"
                    + " 'food_log',food_log_id,CONCAT('user-',MD5(CAST(user_id AS"
                    + " TEXT))),deleted_at,'food_log_deleted' FROM food_logs WHERE is_deleted=TRUE"
                    + " UNION ALL SELECT 'meal_plan',meal_plan_id,CONCAT('user-',MD5(CAST(user_id AS"
                    + " TEXT))),deleted_at,'meal_plan_deleted' FROM meal_plans WHERE is_deleted=TRUE"
                    + " UNION ALL SELECT 'message',message_id,CONCAT('user-',MD5(CAST(created_by AS"
                    + " TEXT))),deleted_at,'message_deleted' FROM messages WHERE is_deleted=TRUE)"
                    + " deleted_resources WHERE 1=1<if test='q.text != null and q.text !="
                    + " &quot;&quot;'> AND (resource_type ILIKE CONCAT('%',#{q.text},'%') OR owner_ref"
                    + " ILIKE CONCAT('%',#{q.text},'%'))</if> ORDER BY <choose><when test=\"q.sort =="
                    + " 'resource_type'\">resource_type</when><otherwise>deleted_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,resource_id DESC LIMIT"
                    + " #{q.limit} OFFSET #{q.offset}</script>")
    List<DeletedRow> deleted(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM (SELECT user_id AS"
                    + " resource_id,CONCAT('user-',MD5(CAST(user_id AS TEXT))) AS owner_ref,'user' AS"
                    + " resource_type FROM users WHERE is_deleted=TRUE UNION ALL SELECT"
                    + " document_id,CONCAT('user-',MD5(CAST(COALESCE(created_by,0) AS"
                    + " TEXT))),'knowledge_document' FROM knowledge_documents WHERE is_deleted=TRUE"
                    + " UNION ALL SELECT food_log_id,CONCAT('user-',MD5(CAST(user_id AS"
                    + " TEXT))),'food_log' FROM food_logs WHERE is_deleted=TRUE UNION ALL SELECT"
                    + " meal_plan_id,CONCAT('user-',MD5(CAST(user_id AS TEXT))),'meal_plan' FROM"
                    + " meal_plans WHERE is_deleted=TRUE UNION ALL SELECT"
                    + " message_id,CONCAT('user-',MD5(CAST(created_by AS TEXT))),'message' FROM"
                    + " messages WHERE is_deleted=TRUE) deleted_resources WHERE 1=1<if test='q.text !="
                    + " null and q.text != &quot;&quot;'> AND (resource_type ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR owner_ref ILIKE"
                    + " CONCAT('%',#{q.text},'%'))</if></script>")
    long countDeleted(@Param("q") Query query);

    @Select(
            "<script>SELECT"
                    + " operator_id,action,target_type,target_id,result,request_id,trace_id,created_at"
                    + " FROM operation_audits WHERE is_deleted=FALSE<if test='q.text != null and q.text"
                    + " != &quot;&quot;'> AND (action ILIKE CONCAT('%',#{q.text},'%') OR target_type"
                    + " ILIKE CONCAT('%',#{q.text},'%') OR target_id ILIKE"
                    + " CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and q.status !="
                    + " &quot;&quot;'> AND result=#{q.status}</if> ORDER BY <choose><when test=\"q.sort"
                    + " == 'result'\">result</when><when test=\"q.sort =="
                    + " 'action'\">action</when><otherwise>created_at</otherwise></choose>"
                    + " <choose><when test=\"q.direction =="
                    + " 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,operation_audit_id DESC"
                    + " LIMIT #{q.limit} OFFSET #{q.offset}</script>")
    List<OperationAuditRow> operationAudits(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM operation_audits WHERE is_deleted=FALSE<if test='q.text"
                    + " != null and q.text != &quot;&quot;'> AND (action ILIKE"
                    + " CONCAT('%',#{q.text},'%') OR target_type ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " target_id ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND result=#{q.status}</if></script>")
    long countOperationAudits(@Param("q") Query query);

    @Select(
            "SELECT operator_id,action,target_type,target_id,result,request_id,trace_id,created_at"
                    + " FROM operation_audits WHERE is_deleted=FALSE AND (operator_id=#{userId} OR"
                    + " (target_type='user' AND target_id=CAST(#{userId} AS TEXT))) ORDER BY"
                    + " created_at DESC,operation_audit_id DESC LIMIT #{limit} OFFSET #{offset}")
    List<OperationAuditRow> operationAuditsForUser(
            @Param("userId") long userId,
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Select(
            "SELECT COUNT(*) FROM operation_audits WHERE is_deleted=FALSE AND (operator_id=#{userId}"
                    + " OR (target_type='user' AND target_id=CAST(#{userId} AS TEXT)))")
    long countOperationAuditsForUser(@Param("userId") long userId);

    @Select(
            "<script>SELECT dlq_id,consumer_group,source_topic,mq_message_id AS message_id,run_id,"
                    + "dispatch_id,event_id,attempt,reconsume_times,error_code,reconciliation_state,"
                    + "first_seen_at,reconciled_at FROM runtime_message_dlq WHERE 1=1<if test='q.text != null"
                    + " and q.text != &quot;&quot;'> AND (consumer_group ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " source_topic ILIKE CONCAT('%',#{q.text},'%') OR run_id ILIKE CONCAT('%',#{q.text},'%')"
                    + " OR error_code ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND reconciliation_state=#{q.status}</if> ORDER BY <choose>"
                    + "<when test=\"q.sort == 'reconciled_at'\">reconciled_at</when><when test=\"q.sort =="
                    + " 'reconsume_times'\">reconsume_times</when><when test=\"q.sort == 'state'\">"
                    + "reconciliation_state</when><otherwise>first_seen_at</otherwise></choose> <choose><when"
                    + " test=\"q.direction == 'asc'\">ASC</when><otherwise>DESC</otherwise></choose>,dlq_id DESC"
                    + " LIMIT #{q.limit} OFFSET #{q.offset}</script>")
    List<DlqRow> dlq(@Param("q") Query query);

    @Select(
            "<script>SELECT COUNT(*) FROM runtime_message_dlq WHERE 1=1<if test='q.text != null and"
                    + " q.text != &quot;&quot;'> AND (consumer_group ILIKE CONCAT('%',#{q.text},'%') OR"
                    + " source_topic ILIKE CONCAT('%',#{q.text},'%') OR run_id ILIKE CONCAT('%',#{q.text},'%')"
                    + " OR error_code ILIKE CONCAT('%',#{q.text},'%'))</if><if test='q.status != null and"
                    + " q.status != &quot;&quot;'> AND reconciliation_state=#{q.status}</if></script>")
    long countDlq(@Param("q") Query query);
}
