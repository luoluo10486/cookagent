package com.foodmate.application.food;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.application.food.port.out.FoodLogRepository;
import com.foodmate.application.food.service.FoodLogService;
import com.foodmate.application.food.service.impl.FoodLogServiceImpl;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.food.enums.MealType;
import com.foodmate.shared.id.IdGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class FoodLogServiceImplTest {
    private static final Instant MEAL_TIME = Instant.parse("2026-08-12T12:00:00Z");

    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void listsOnlyDeletedRecordsFromRepository() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findDeleted(7L)).thenReturn(List.of(snapshot(true, 4)));

        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L), auditService());

        List<FoodLogService.FoodLogView> result = service.listDeleted(7L);

        assertEquals(1, result.size());
        assertEquals(100L, result.getFirst().foodLogId());
        assertEquals(4L, result.getFirst().revision());
        assertEquals(true, result.getFirst().deleted());
        verify(repository).findDeleted(7L);
    }

    @Test
    void createReplaysSuccessfulIdempotentRequest() throws Exception {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        FoodLogRepository.FoodLogSnapshot snapshot = snapshot(false, 1);
        AtomicInteger lookupCount = new AtomicInteger();
        String[] digest = new String[1];
        String[] response = new String[1];
        when(repository.findIdempotency(7L, "create-1"))
                .thenAnswer(
                        invocation ->
                                lookupCount.getAndIncrement() == 0
                                        ? null
                                        : new FoodLogRepository.IdempotencyRecord(
                                                digest[0], "success", response[0]));
        OperationAuditService audit = auditService();
        doAnswer(
                        invocation -> {
                            digest[0] = invocation.getArgument(4);
                            return 1;
                        })
                .when(audit)
                .reserve(
                        anyLong(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        any());
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshot);
        doAnswer(
                        invocation -> {
                            response[0] = invocation.getArgument(2);
                            return 1;
                        })
                .when(audit)
                .complete(eq(7L), eq("create-1"), any());

        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L, 101L, 102L), audit);
        FoodLogService.CreateCommand command = command("create-1");

        FoodLogService.FoodLogView first = service.create(7L, command);
        FoodLogService.FoodLogView replay = service.create(7L, command);

        assertEquals(first, replay);
        verify(repository).insertFoodLog(any());
        verify(repository).insertItem(any());
    }

    @Test
    void invalidCreateRecordsFailureAudit() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        OperationAuditService audit = auditService();
        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L), audit);

        assertThrows(
                BusinessException.class,
                () ->
                        service.create(
                                7L,
                                new FoodLogService.CreateCommand(
                                        null,
                                        null,
                                        MEAL_TIME,
                                        MealType.LUNCH,
                                        null,
                                        "invalid-create",
                                        List.of())));

        verify(audit)
                .recordFailure(
                        eq(7L),
                        eq("food_log"),
                        isNull(),
                        eq("food_log.create"),
                        eq("failed"),
                        eq("INVALID_ARGUMENT"),
                        isNull(),
                        eq("invalid-create"),
                        any());
    }

    @Test
    void failedCreateRecordsIndependentFailureAudit() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.insertFoodLog(any())).thenReturn(0);
        OperationAuditService audit = auditService();
        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L), audit);

        assertThrows(BusinessException.class, () -> service.create(7L, command("failed-create")));

        verify(audit)
                .recordFailure(
                        eq(7L),
                        eq("food_log"),
                        eq("100"),
                        eq("food_log.create"),
                        eq("failed"),
                        eq("CONFLICT"),
                        anyString(),
                        eq("failed-create"),
                        any());
    }

    @Test
    void auditCompletionStoresOnlyFoodLogSummary() throws Exception {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshot(false, 1));
        OperationAuditService audit = auditService();
        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L, 101L), audit);

        service.create(7L, command("audit-summary"));

        var response = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(audit).complete(eq(7L), eq("audit-summary"), response.capture());
        var summary = mapper.readTree(response.getValue());
        assertEquals(100L, summary.path("resource_id").asLong());
        assertEquals(1L, summary.path("revision").asLong());
        assertEquals("active", summary.path("status").asText());
        assertFalse(response.getValue().contains("at home"));
        assertFalse(response.getValue().contains("rice"));
    }

    @Test
    void rejectsDifferentPayloadForExistingIdempotencyKey() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findIdempotency(7L, "same-key"))
                .thenReturn(new FoodLogRepository.IdempotencyRecord("different", "success", "{}"));
        FoodLogService service = service(repository, () -> 100L);

        BusinessException exception =
                assertThrows(
                        BusinessException.class, () -> service.create(7L, command("same-key")));

        assertEquals(ErrorCode.CONFLICT, exception.errorCode());
    }

    @Test
    void rejectsSourceContextOwnedByAnotherUser() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.sessionOwned(7L, 55L)).thenReturn(false);
        FoodLogService service = service(repository, () -> 100L);

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                service.create(
                                        7L,
                                        new FoodLogService.CreateCommand(
                                                55L,
                                                null,
                                                MEAL_TIME,
                                                MealType.LUNCH,
                                                null,
                                                "owned-check",
                                                List.of(
                                                        new FoodLogService.ItemCommand(
                                                                "rice",
                                                                new BigDecimal("100"),
                                                                "g")))));

        assertEquals(ErrorCode.NOT_FOUND, exception.errorCode());
    }

    @Test
    void calculatesNutritionFromApprovedDirectorySnapshot() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFood("rice"))
                .thenReturn(
                        new FoodLogRepository.NutritionFoodLookup(
                                900L,
                                "rice",
                                "g",
                                new BigDecimal("130.0000"),
                                new BigDecimal("2.7000"),
                                new BigDecimal("0.3000"),
                                new BigDecimal("28.2000"),
                                "test-reviewed-source",
                                "test-v1"));
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L, 102L));

        service.create(7L, command("nutrition-1"));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("matched", item.getValue().nutritionStatus());
        assertEquals(new BigDecimal("130.0000"), item.getValue().caloriesKcal());
        assertEquals(new BigDecimal("2.7000"), item.getValue().proteinG());
        assertEquals("g", item.getValue().normalizedUnit());
        assertEquals(new BigDecimal("100.000"), item.getValue().normalizedAmount());
    }

    @Test
    void keepsAmbiguousChineseFoodAsPendingConfirmation() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFoodCandidates("鸡胸肉", 12))
                .thenReturn(List.of(candidate(171477L, 0), candidate(171478L, 0)));
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L));

        service.create(
                7L,
                new FoodLogService.CreateCommand(
                        null,
                        null,
                        MEAL_TIME,
                        MealType.LUNCH,
                        null,
                        "nutrition-ambiguous",
                        List.of(new FoodLogService.ItemCommand("煮鸡胸肉", new BigDecimal("100"), "g"))));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("pending_confirmation", item.getValue().nutritionStatus());
        assertEquals(null, item.getValue().nutritionFoodId());
    }

    @Test
    void usesExplicitFoodSelectionForAuthoritativeNutritionSnapshot() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFoodById(171477L)).thenReturn(nutritionLookup());
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L));

        service.create(
                7L,
                new FoodLogService.CreateCommand(
                        null,
                        null,
                        MEAL_TIME,
                        MealType.LUNCH,
                        null,
                        "nutrition-selected",
                        List.of(
                                new FoodLogService.ItemCommand(
                                        "鸡胸肉", new BigDecimal("100"), "g", 171477L))));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("matched", item.getValue().nutritionStatus());
        assertEquals(171477L, item.getValue().nutritionFoodId());
        assertEquals(new BigDecimal("165.0000"), item.getValue().caloriesKcal());
    }

    @Test
    void leavesUnknownOrUnsafeUnitAsPendingWithoutNutritionSnapshot() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFood("rice"))
                .thenReturn(
                        new FoodLogRepository.NutritionFoodLookup(
                                900L,
                                "rice",
                                "g",
                                new BigDecimal("130.0000"),
                                new BigDecimal("2.7000"),
                                new BigDecimal("0.3000"),
                                new BigDecimal("28.2000"),
                                "test-reviewed-source",
                                "test-v1"));
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L, 102L));

        service.create(
                7L,
                new FoodLogService.CreateCommand(
                        null,
                        null,
                        MEAL_TIME,
                        MealType.LUNCH,
                        null,
                        "nutrition-2",
                        List.of(new FoodLogService.ItemCommand("rice", new BigDecimal("1"), "个"))));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("pending", item.getValue().nutritionStatus());
        assertEquals(null, item.getValue().caloriesKcal());
        assertEquals(null, item.getValue().nutritionFoodId());
    }

    @Test
    void appliesReviewedFoodPortionConversionBeforeCalculatingNutrition() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFood("rice"))
                .thenReturn(
                        new FoodLogRepository.NutritionFoodLookup(
                                900L,
                                "rice",
                                "g",
                                new BigDecimal("130.0000"),
                                new BigDecimal("2.7000"),
                                new BigDecimal("0.3000"),
                                new BigDecimal("28.2000"),
                                "USDA FoodData Central API",
                                "SR Legacy 2019-04-01 FDC-168880"));
        when(repository.findUnitConversion(900L, "cup", "g"))
                .thenReturn(
                        new FoodLogRepository.UnitConversionLookup(
                                520001L,
                                new BigDecimal("186.0000"),
                                "g",
                                "USDA FoodData Central API foodPortions",
                                "SR Legacy 2019-04-01 FDC-168880 portion-1"));
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L, 102L));

        service.create(
                7L,
                new FoodLogService.CreateCommand(
                        null,
                        null,
                        MEAL_TIME,
                        MealType.LUNCH,
                        null,
                        "nutrition-portion-1",
                        List.of(new FoodLogService.ItemCommand("rice", new BigDecimal("1"), "杯"))));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("matched", item.getValue().nutritionStatus());
        assertEquals(520001L, item.getValue().conversionId());
        assertEquals(new BigDecimal("186.000"), item.getValue().normalizedAmount());
        assertEquals("g", item.getValue().normalizedUnit());
        assertEquals(new BigDecimal("241.8000"), item.getValue().caloriesKcal());
        assertEquals(
                "USDA FoodData Central API;USDA FoodData Central API foodPortions",
                item.getValue().nutritionSource());
        assertEquals(
                "SR Legacy 2019-04-01 FDC-168880 portion-1", item.getValue().nutritionVersion());
    }

    @Test
    void normalizesMetricMassUnitsBeforeLookingUpReviewedConversion() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findNutritionFood("rice"))
                .thenReturn(
                        new FoodLogRepository.NutritionFoodLookup(
                                900L,
                                "rice",
                                "g",
                                new BigDecimal("130.0000"),
                                new BigDecimal("2.7000"),
                                new BigDecimal("0.3000"),
                                new BigDecimal("28.2000"),
                                "USDA FoodData Central API",
                                "SR Legacy 2019-04-01 FDC-168880"));
        when(repository.findUnitConversion(900L, "kg", "g"))
                .thenReturn(
                        new FoodLogRepository.UnitConversionLookup(
                                530001L,
                                new BigDecimal("1000.0000"),
                                "g",
                                "SI conversion",
                                "si-v1"));
        when(repository.insertFoodLog(any())).thenReturn(1);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshotWithEmptyItems());
        FoodLogService service = service(repository, ids(100L, 101L, 102L));

        service.create(
                7L,
                new FoodLogService.CreateCommand(
                        null,
                        null,
                        MEAL_TIME,
                        MealType.LUNCH,
                        null,
                        "nutrition-metric-mass",
                        List.of(
                                new FoodLogService.ItemCommand(
                                        "rice", new BigDecimal("0.5"), "公斤"))));

        var item = org.mockito.ArgumentCaptor.forClass(FoodLogRepository.FoodLogItemWrite.class);
        verify(repository).insertItem(item.capture());
        assertEquals("matched", item.getValue().nutritionStatus());
        assertEquals(530001L, item.getValue().conversionId());
        assertEquals(new BigDecimal("500.000"), item.getValue().normalizedAmount());
        assertEquals("g", item.getValue().normalizedUnit());
    }

    @Test
    void updateReplacesItemsAndIncrementsRevisionWithNutritionSnapshot() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findIdempotency(7L, "update-1")).thenReturn(null);
        when(repository.findOwned(7L, 100L, false))
                .thenReturn(snapshot(false, 1), snapshot(false, 2));
        when(repository.updateFoodLog(any())).thenReturn(1);
        when(repository.softDeleteItems(7L, 100L)).thenReturn(1);
        when(repository.findNutritionFood("rice"))
                .thenReturn(
                        new FoodLogRepository.NutritionFoodLookup(
                                900L,
                                "rice",
                                "g",
                                new BigDecimal("130.0000"),
                                new BigDecimal("2.7000"),
                                new BigDecimal("0.3000"),
                                new BigDecimal("28.2000"),
                                "test-reviewed-source",
                                "test-v1"));

        OperationAuditService audit = auditService();
        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L, 101L, 102L), audit);
        FoodLogService.FoodLogView result =
                service.update(
                        7L,
                        100L,
                        1L,
                        new FoodLogService.UpdateCommand(
                                MEAL_TIME,
                                MealType.LUNCH,
                                "updated",
                                "update-1",
                                List.of(
                                        new FoodLogService.ItemCommand(
                                                "rice", new BigDecimal("100"), "g"))));

        assertEquals(2L, result.revision());
        verify(repository).updateFoodLog(any());
        verify(repository).softDeleteItems(7L, 100L);
        verify(repository).insertItem(any());
        verify(audit).complete(eq(7L), eq("update-1"), any());
    }

    @Test
    void updateRejectsConcurrentRevisionBeforeReplacingItems() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findIdempotency(7L, "update-2")).thenReturn(null);
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshot(false, 2));
        FoodLogService service = service(repository, ids(100L));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                service.update(
                                        7L,
                                        100L,
                                        1L,
                                        new FoodLogService.UpdateCommand(
                                                MEAL_TIME,
                                                MealType.LUNCH,
                                                null,
                                                "update-2",
                                                List.of(
                                                        new FoodLogService.ItemCommand(
                                                                "rice",
                                                                new BigDecimal("100"),
                                                                "g")))));

        assertEquals(ErrorCode.CONFLICT, exception.errorCode());
        verify(repository, never()).updateFoodLog(any());
        verify(repository, never()).softDeleteItems(any(Long.class), any(Long.class));
    }

    @Test
    void doesNotDeleteWhenConcurrentRequestIsStillPending() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        when(repository.findIdempotency(7L, "delete-1"))
                .thenReturn(new FoodLogRepository.IdempotencyRecord(null, "pending", "{}"));
        FoodLogService service = service(repository, () -> 100L);

        BusinessException exception =
                assertThrows(
                        BusinessException.class, () -> service.delete(7L, 100L, 1L, "delete-1"));

        assertEquals(ErrorCode.CONFLICT, exception.errorCode());
        verify(repository, never()).softDelete(7L, 100L, 1L);
    }

    @Test
    void deleteUsesRevisionAndSuccessfulReplayDoesNotDeleteAgain() {
        FoodLogRepository repository = mock(FoodLogRepository.class);
        FoodLogRepository.FoodLogSnapshot snapshot = snapshot(false, 1);
        AtomicInteger lookupCount = new AtomicInteger();
        String[] digest = new String[1];
        when(repository.findIdempotency(7L, "delete-2"))
                .thenAnswer(
                        invocation ->
                                lookupCount.getAndIncrement() == 0
                                        ? null
                                        : new FoodLogRepository.IdempotencyRecord(
                                                digest[0], "success", "{}"));
        when(repository.findOwned(7L, 100L, false)).thenReturn(snapshot);
        OperationAuditService audit = auditService();
        doAnswer(
                        invocation -> {
                            digest[0] = invocation.getArgument(4);
                            return 1;
                        })
                .when(audit)
                .reserve(
                        anyLong(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        any());
        when(repository.softDelete(7L, 100L, 1L)).thenReturn(1);
        FoodLogService service = new FoodLogServiceImpl(repository, ids(100L, 101L), audit);

        service.delete(7L, 100L, 1L, "delete-2");
        service.delete(7L, 100L, 1L, "delete-2");

        verify(repository).softDelete(7L, 100L, 1L);
    }

    private FoodLogService.CreateCommand command(String key) {
        return new FoodLogService.CreateCommand(
                null,
                null,
                MEAL_TIME,
                MealType.LUNCH,
                "at home",
                key,
                List.of(new FoodLogService.ItemCommand("rice", new BigDecimal("100"), "g")));
    }

    private FoodLogRepository.FoodLogSnapshot snapshot(boolean deleted, long revision) {
        return new FoodLogRepository.FoodLogSnapshot(
                100L,
                7L,
                null,
                null,
                MEAL_TIME,
                "lunch",
                "at home",
                "manual",
                revision,
                deleted,
                MEAL_TIME,
                MEAL_TIME,
                List.of(
                        new FoodLogRepository.FoodLogItemSnapshot(
                                101L,
                                0,
                                "rice",
                                new BigDecimal("100"),
                                "g",
                                "pending",
                                null,
                                null,
                                null,
                                null)));
    }

    private FoodLogRepository.FoodLogSnapshot snapshotWithEmptyItems() {
        FoodLogRepository.FoodLogSnapshot value = snapshot(false, 1);
        return new FoodLogRepository.FoodLogSnapshot(
                value.foodLogId(),
                value.userId(),
                value.sessionId(),
                value.agentRunId(),
                value.mealTime(),
                value.mealType(),
                value.notes(),
                value.source(),
                value.revision(),
                value.deleted(),
                value.createdAt(),
                value.updatedAt(),
                List.of());
    }

    private IdGenerator ids(long... values) {
        AtomicInteger index = new AtomicInteger();
        return () -> values[index.getAndIncrement() % values.length];
    }

    private FoodLogService service(FoodLogRepository repository, IdGenerator ids) {
        return new FoodLogServiceImpl(repository, ids, auditService());
    }

    private FoodLogRepository.NutritionFoodLookup nutritionLookup() {
        return new FoodLogRepository.NutritionFoodLookup(
                171477L,
                "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
                "g",
                new BigDecimal("165.0000"),
                new BigDecimal("31.0200"),
                new BigDecimal("3.5700"),
                new BigDecimal("0.0000"),
                "USDA FoodData Central",
                "USDA-SR-Legacy-2019-04-01-FoodMate-1 FDC-171477");
    }

    private FoodLogRepository.NutritionFoodCandidate candidate(long id, int matchRank) {
        return new FoodLogRepository.NutritionFoodCandidate(
                id,
                "Chicken",
                "鸡胸肉",
                "meat",
                "cooked",
                "g",
                new BigDecimal("165.0000"),
                new BigDecimal("31.0200"),
                new BigDecimal("3.5700"),
                new BigDecimal("0.0000"),
                "USDA FoodData Central",
                "USDA-v1",
                matchRank);
    }

    private OperationAuditService auditService() {
        OperationAuditService audit = mock(OperationAuditService.class);
        when(audit.reserve(
                        anyLong(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        any()))
                .thenReturn(1);
        return audit;
    }
}
