package com.foodmate.application.account;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.foodmate.application.account.port.out.AdminOperationalQueryRepository;
import com.foodmate.application.account.service.AdminOperationalQueryService;
import com.foodmate.application.account.service.impl.AdminOperationalQueryServiceImpl;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class AdminOperationalQueryServiceImplTest {
    private AdminOperationalQueryRepository store;
    private AdminOperationalQueryService service;

    @BeforeEach
    void setUp() {
        store = Mockito.mock(AdminOperationalQueryRepository.class);
        service = new AdminOperationalQueryServiceImpl(store);
        when(store.runs(any())).thenReturn(List.of());
        when(store.countRuns(any())).thenReturn(0L);
    }

    @Test
    void clampsPageSizeAndUsesStableDefaultSort() {
        service.query(
                "runs",
                new AdminOperationalQueryService.Request(2, 500, null, null, null, null, null));

        ArgumentCaptor<AdminOperationalQueryRepository.Query> query =
                ArgumentCaptor.forClass(AdminOperationalQueryRepository.Query.class);
        verify(store).runs(query.capture());
        assertEquals("created_at", query.getValue().sort());
        assertEquals("desc", query.getValue().direction());
        assertEquals(100, query.getValue().limit());
        assertEquals(100, query.getValue().offset());
    }

    @Test
    void rejectsUnknownResourceAndSort() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.query(
                                "secrets",
                                new AdminOperationalQueryService.Request(
                                        1, 20, null, null, null, null, null)));
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.query(
                                "runs",
                                new AdminOperationalQueryService.Request(
                                        1, 20, null, null, null, "sql_text", "desc")));
    }

    @Test
    void mapsOnlySafeSqlAuditSummary() {
        when(store.sqlAudits(any()))
                .thenReturn(
                        List.of(
                                new AdminOperationalQueryRepository.SqlAuditRow(
                                        8L, 3L, "hash", "executed", "trace", 12L, 2L, null, null)));
        when(store.countSqlAudits(any())).thenReturn(1L);

        var result =
                service.query(
                        "sql-audits",
                        new AdminOperationalQueryService.Request(
                                1, 20, null, null, null, null, null));

        var row = (AdminOperationalQueryService.SqlAudit) result.items().getFirst();
        assertEquals("hash", row.queryHash());
        assertEquals("executed", row.result());
    }

    @Test
    void exposesDlqIdentityAndReconciliationWithoutPayload() {
        when(store.dlq(any()))
                .thenReturn(
                        List.of(
                                new AdminOperationalQueryRepository.DlqRow(
                                        21L,
                                        "foodmate-java-agent-event-v1",
                                        "foodmate-agent-event-v1",
                                        "mq-21",
                                        "42",
                                        "dispatch-42",
                                        "event-42",
                                        2,
                                        8,
                                        "RUNTIME_MESSAGE_DEAD_LETTERED",
                                        "needs_attention",
                                        null,
                                        null)));
        when(store.countDlq(any())).thenReturn(1L);

        var result =
                service.query(
                        "dlq",
                        new AdminOperationalQueryService.Request(
                                1, 20, null, "needs_attention", null, "state", "asc"));

        var row = (AdminOperationalQueryService.Dlq) result.items().getFirst();
        assertEquals("mq-21", row.messageId());
        assertEquals("needs_attention", row.reconciliationState());
        assertEquals(8, row.reconsumeTimes());
        verify(store).dlq(any());
    }

    @Test
    void mapsTraceAggregationSummary() {
        when(store.traces(any()))
                .thenReturn(
                        List.of(
                                new AdminOperationalQueryRepository.TraceRow(
                                        "trace-1",
                                        42L,
                                        "java.control-plane -> python.agent-runtime -> model -> sse",
                                        "completed",
                                        Instant.parse("2026-08-28T00:00:00Z"),
                                        new BigDecimal("18.5"),
                                        4L,
                                        "foodmate-java",
                                        null)));
        when(store.countTraces(any())).thenReturn(1L);

        var result =
                service.query(
                        "traces",
                        new AdminOperationalQueryService.Request(
                                1, 20, "trace-1", null, null, "duration_ms", "desc"));

        var row = (AdminOperationalQueryService.Trace) result.items().getFirst();
        assertEquals("trace-1", row.traceId());
        assertEquals(42L, row.runId());
        assertEquals(4L, row.spanCount());
        assertEquals("foodmate-java", row.rootService());
        verify(store).traces(any());
    }

    @Test
    void mapsAuthoritativeTraceSpansWithoutPayloads() {
        when(store.traceById("trace-detail"))
                .thenReturn(
                        new AdminOperationalQueryRepository.TraceRow(
                                "trace-detail",
                                42L,
                                "java.control-plane -> python.agent-runtime",
                                "completed",
                                Instant.parse("2026-08-28T00:00:00Z"),
                                new BigDecimal("18.5"),
                                2L,
                                "foodmate-java",
                                null));
        when(store.traceSpans("trace-detail"))
                .thenReturn(
                        List.of(
                                new AdminOperationalQueryRepository.TraceSpanRow(
                                        "event-1",
                                        "runtime_event",
                                        "run.completed",
                                        "python.agent-runtime",
                                        "success",
                                        Instant.parse("2026-08-28T00:00:00Z"),
                                        Instant.parse("2026-08-28T00:00:00.010Z"),
                                        new BigDecimal("10"),
                                        null,
                                        4L)));

        var result = service.traceDetail("trace-detail");

        assertEquals("trace-detail", result.summary().traceId());
        assertEquals(1, result.spans().size());
        assertEquals("run.completed", result.spans().getFirst().name());
        assertEquals("runtime_event", result.spans().getFirst().spanType());
        verify(store).traceById("trace-detail");
        verify(store).traceSpans("trace-detail");
    }

    @Test
    void returnsNotFoundForUnknownTraceDetail() {
        when(store.traceById("missing-trace")).thenReturn(null);

        assertThrows(
                com.foodmate.shared.error.BusinessException.class,
                () -> service.traceDetail("missing-trace"));
    }

    @Test
    void loadsOnlyTheSelectedUsersOperationHistoryPage() {
        when(store.operationAuditsForUser(7L, 20, 20))
                .thenReturn(
                        List.of(
                                new AdminOperationalQueryRepository.OperationAuditRow(
                                        7L,
                                        "profile.update",
                                        "profile",
                                        "7",
                                        "success",
                                        "request-7",
                                        "trace-7",
                                        Instant.parse("2026-09-06T00:00:00Z"))));
        when(store.countOperationAuditsForUser(7L)).thenReturn(1L);

        var result = service.operationAuditsForUser(7L, 2, 20);

        assertEquals(1, result.items().size());
        assertEquals("profile.update", result.items().getFirst().action());
        assertEquals(1L, result.total());
        assertEquals(2, result.page());
        verify(store).operationAuditsForUser(7L, 20, 20);
    }
}
