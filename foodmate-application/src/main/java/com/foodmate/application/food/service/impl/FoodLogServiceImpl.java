package com.foodmate.application.food.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.application.food.port.out.FoodLogRepository;
import com.foodmate.application.food.service.FoodLogService;
import com.foodmate.application.food.service.NutritionNameNormalizer;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.food.enums.MealType;
import com.foodmate.shared.id.IdGenerator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Java 权威饮食记录写入用例；手工页面和后续 Agent 工具必须复用此服务。 */
@Service
@Profile("local")
public class FoodLogServiceImpl implements FoodLogService {
    private static final int MAX_ITEMS = 100;
    private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 128;

    private final FoodLogRepository store;
    private final IdGenerator ids;
    private final OperationAuditService audit;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @org.springframework.beans.factory.annotation.Autowired
    public FoodLogServiceImpl(
            FoodLogRepository store, IdGenerator ids, OperationAuditService audit) {
        this.store = store;
        this.ids = ids;
        this.audit = Objects.requireNonNull(audit, "OperationAuditService is required");
    }

    @Transactional
    @Override
    public FoodLogView create(long userId, CreateCommand command) {
        String key = command == null ? null : command.idempotencyKey();
        String digest = null;
        String targetId = null;
        boolean reservationAttempted = false;
        boolean reserved = false;
        try {
            validateCreate(userId, command);
            key = requireIdempotencyKey(command.idempotencyKey());
            digest = digest(command);
            FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
            if (previous != null) return replayOrConflict(userId, key, digest);

            long foodLogId = ids.nextId();
            targetId = Long.toString(foodLogId);
            reservationAttempted = true;
            if (reserveAudit(userId, key, digest, "food_log.create", foodLogId) != 1)
                return replayOrConflict(userId, key, digest);
            reserved = true;
            if (store.insertFoodLog(
                            new FoodLogRepository.FoodLogWrite(
                                    foodLogId,
                                    userId,
                                    command.sessionId(),
                                    command.agentRunId(),
                                    command.mealTime(),
                                    command.mealType().code(),
                                    command.notes(),
                                    command.source(),
                                    key,
                                    1))
                    != 1) {
                throw new BusinessException(ErrorCode.CONFLICT, "饮食记录关联资源不存在");
            }
            for (int i = 0; i < command.items().size(); i++) {
                ItemCommand item = command.items().get(i);
                FoodLogRepository.FoodLogItemWrite nutrition =
                        nutrition(item, foodLogId, i, userId);
                store.insertItem(
                        new FoodLogRepository.FoodLogItemWrite(
                                ids.nextId(),
                                nutrition.foodLogId(),
                                nutrition.itemOrder(),
                                nutrition.rawName(),
                                nutrition.amount(),
                                nutrition.unit(),
                                nutrition.userId(),
                                nutrition.nutritionFoodId(),
                                nutrition.normalizedAmount(),
                                nutrition.normalizedUnit(),
                                nutrition.conversionId(),
                                nutrition.caloriesKcal(),
                                nutrition.proteinG(),
                                nutrition.fatG(),
                                nutrition.carbsG(),
                                nutrition.nutritionStatus(),
                                nutrition.nutritionSource(),
                                nutrition.nutritionVersion()));
            }
            FoodLogView result = view(requireSnapshot(userId, foodLogId, false));
            completeAudit(userId, key, auditSummary(result));
            return result;
        } catch (RuntimeException exception) {
            recordFailureIfNeeded(
                    userId,
                    targetId,
                    "food_log.create",
                    key,
                    digest,
                    reservationAttempted,
                    reserved,
                    exception);
            throw exception;
        }
    }

    @Transactional
    @Override
    public FoodLogView update(long userId, long foodLogId, long revision, UpdateCommand command) {
        String key = command == null ? null : command.idempotencyKey();
        String digest = null;
        boolean reservationAttempted = false;
        boolean reserved = false;
        try {
            validateUpdate(command);
            key = requireIdempotencyKey(command.idempotencyKey());
            digest = digest(command, foodLogId, revision);
            FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
            if (previous != null) return replayOrConflict(userId, key, digest);

            FoodLogRepository.FoodLogSnapshot current = requireSnapshot(userId, foodLogId, false);
            requireRevision(current, revision);
            reservationAttempted = true;
            if (reserveAudit(userId, key, digest, "food_log.update", foodLogId) != 1)
                return replayOrConflict(userId, key, digest);
            reserved = true;
            if (store.updateFoodLog(
                            new FoodLogRepository.UpdateFoodLogWrite(
                                    userId,
                                    foodLogId,
                                    revision,
                                    command.mealTime(),
                                    command.mealType().code(),
                                    command.notes()))
                    != 1) {
                throw new BusinessException(ErrorCode.CONFLICT, "饮食记录已被修改");
            }
            store.softDeleteItems(userId, foodLogId);
            for (int i = 0; i < command.items().size(); i++) {
                ItemCommand item = command.items().get(i);
                FoodLogRepository.FoodLogItemWrite nutrition =
                        nutrition(item, foodLogId, i, userId);
                store.insertItem(
                        new FoodLogRepository.FoodLogItemWrite(
                                ids.nextId(),
                                nutrition.foodLogId(),
                                nutrition.itemOrder(),
                                nutrition.rawName(),
                                nutrition.amount(),
                                nutrition.unit(),
                                nutrition.userId(),
                                nutrition.nutritionFoodId(),
                                nutrition.normalizedAmount(),
                                nutrition.normalizedUnit(),
                                nutrition.conversionId(),
                                nutrition.caloriesKcal(),
                                nutrition.proteinG(),
                                nutrition.fatG(),
                                nutrition.carbsG(),
                                nutrition.nutritionStatus(),
                                nutrition.nutritionSource(),
                                nutrition.nutritionVersion()));
            }
            FoodLogView result = view(requireSnapshot(userId, foodLogId, false));
            completeAudit(userId, key, auditSummary(result));
            return result;
        } catch (RuntimeException exception) {
            recordFailureIfNeeded(
                    userId,
                    Long.toString(foodLogId),
                    "food_log.update",
                    key,
                    digest,
                    reservationAttempted,
                    reserved,
                    exception);
            throw exception;
        }
    }

    @Override
    public List<FoodLogView> list(long userId, Instant from, Instant to) {
        if (from == null || to == null || !from.isBefore(to))
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "时间范围无效");
        if (to.minusSeconds(60L * 60 * 24 * 31).isAfter(from))
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "时间范围不能超过 31 天");
        return store.findVisible(userId, from, to).stream().map(FoodLogServiceImpl::view).toList();
    }

    @Override
    public List<FoodLogView> listDeleted(long userId) {
        return store.findDeleted(userId).stream().map(FoodLogServiceImpl::view).toList();
    }

    @Transactional
    @Override
    public void delete(long userId, long foodLogId, long revision, String idempotencyKey) {
        String key = idempotencyKey;
        String digest = null;
        boolean reservationAttempted = false;
        boolean reserved = false;
        try {
            key = requireIdempotencyKey(idempotencyKey);
            digest = digest("delete", foodLogId, revision);
            FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
            if (previous != null) {
                replayVoidOrConflict(previous, digest);
                return;
            }
            FoodLogRepository.FoodLogSnapshot current = requireSnapshot(userId, foodLogId, false);
            requireRevision(current, revision);
            reservationAttempted = true;
            if (reserveAudit(userId, key, digest, "food_log.delete", foodLogId) != 1)
                throw concurrentIdempotencyConflict(userId, key, digest);
            reserved = true;
            if (store.softDelete(userId, foodLogId, revision) != 1)
                throw new BusinessException(ErrorCode.CONFLICT, "饮食记录已被修改");
            completeAudit(userId, key, "{}");
        } catch (RuntimeException exception) {
            recordFailureIfNeeded(
                    userId,
                    Long.toString(foodLogId),
                    "food_log.delete",
                    key,
                    digest,
                    reservationAttempted,
                    reserved,
                    exception);
            throw exception;
        }
    }

    @Transactional
    @Override
    public FoodLogView restore(long userId, long foodLogId, long revision, String idempotencyKey) {
        String key = idempotencyKey;
        String digest = null;
        boolean reservationAttempted = false;
        boolean reserved = false;
        try {
            key = requireIdempotencyKey(idempotencyKey);
            digest = digest("restore", foodLogId, revision);
            FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
            if (previous != null) return replayOrConflict(userId, key, digest);
            FoodLogRepository.FoodLogSnapshot current = store.findOwned(userId, foodLogId, true);
            if (current == null || !current.deleted())
                throw new BusinessException(ErrorCode.NOT_FOUND, "饮食记录不存在");
            requireRevision(current, revision);
            reservationAttempted = true;
            if (reserveAudit(userId, key, digest, "food_log.restore", foodLogId) != 1)
                return replayOrConflict(userId, key, digest);
            reserved = true;
            if (store.restore(userId, foodLogId, revision) != 1)
                throw new BusinessException(ErrorCode.CONFLICT, "饮食记录已被修改");
            FoodLogView result = view(requireSnapshot(userId, foodLogId, false));
            completeAudit(userId, key, auditSummary(result));
            return result;
        } catch (RuntimeException exception) {
            recordFailureIfNeeded(
                    userId,
                    Long.toString(foodLogId),
                    "food_log.restore",
                    key,
                    digest,
                    reservationAttempted,
                    reserved,
                    exception);
            throw exception;
        }
    }

    private void validateCreate(long userId, CreateCommand command) {
        if (command == null || command.mealTime() == null || command.mealType() == null)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "用餐时间和餐别不能为空");
        if (command.items().isEmpty() || command.items().size() > MAX_ITEMS)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材明细数量无效");
        if (command.notes() != null && command.notes().length() > 4000)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "备注过长");
        if (command.sessionId() != null && !store.sessionOwned(userId, command.sessionId()))
            throw new BusinessException(ErrorCode.NOT_FOUND, "来源会话不存在");
        if (command.agentRunId() != null && !store.agentRunOwned(userId, command.agentRunId()))
            throw new BusinessException(ErrorCode.NOT_FOUND, "来源 AgentRun 不存在");
        for (ItemCommand item : command.items()) {
            if (item == null
                    || item.rawName() == null
                    || item.rawName().isBlank()
                    || item.rawName().length() > 255
                    || item.amount() == null
                    || item.amount().signum() <= 0
                    || item.amount().scale() > 3
                    || item.unit() == null
                    || item.unit().isBlank()
                    || item.unit().length() > 32
                    || (item.nutritionFoodId() != null && item.nutritionFoodId() <= 0)) {
                throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材明细无效");
            }
        }
    }

    private void validateUpdate(UpdateCommand command) {
        if (command == null || command.mealTime() == null || command.mealType() == null)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "用餐时间和餐别不能为空");
        if (command.items().isEmpty() || command.items().size() > MAX_ITEMS)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材明细数量无效");
        if (command.notes() != null && command.notes().length() > 4000)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "备注过长");
        for (ItemCommand item : command.items()) {
            if (item == null
                    || item.rawName() == null
                    || item.rawName().isBlank()
                    || item.rawName().length() > 255
                    || item.amount() == null
                    || item.amount().signum() <= 0
                    || item.amount().scale() > 3
                    || item.unit() == null
                    || item.unit().isBlank()
                    || item.unit().length() > 32
                    || (item.nutritionFoodId() != null && item.nutritionFoodId() <= 0)) {
                throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "食材明细无效");
            }
        }
    }

    private String requireIdempotencyKey(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_IDEMPOTENCY_KEY_LENGTH)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "Idempotency-Key 无效");
        return value;
    }

    private FoodLogRepository.FoodLogItemWrite nutrition(
            ItemCommand item, long foodLogId, int itemOrder, long userId) {
        String rawName = item.rawName().trim();
        String sourceUnit = normalizeUnit(item.unit());
        NutritionResolution resolution = resolveNutritionFood(item, rawName);
        FoodLogRepository.NutritionFoodLookup food = resolution.lookup();
        if (food == null) {
            return pendingItem(item, foodLogId, itemOrder, userId, resolution.status());
        }

        BigDecimal normalizedAmount = null;
        Long conversionId = null;
        String normalizedUnit = null;
        String nutritionSource = food.sourceName();
        String nutritionVersion = food.sourceVersion();
        if (food.basisUnit().equals(sourceUnit)) {
            normalizedAmount = item.amount().setScale(3, RoundingMode.HALF_UP);
            normalizedUnit = food.basisUnit();
        } else {
            FoodLogRepository.UnitConversionLookup conversion =
                    store.findUnitConversion(food.nutritionFoodId(), sourceUnit, food.basisUnit());
            if (conversion == null) {
                return pendingItem(item, foodLogId, itemOrder, userId, "pending");
            }
            normalizedAmount =
                    item.amount()
                            .multiply(conversion.multiplier())
                            .setScale(3, RoundingMode.HALF_UP);
            normalizedUnit = conversion.targetUnit();
            conversionId = conversion.conversionId();
            nutritionSource = food.sourceName() + ";" + conversion.sourceName();
            // 换算版本包含同一食材的 FDC 标识和复核份量序号，保留为受限长度快照版本。
            nutritionVersion = conversion.sourceVersion();
        }
        BigDecimal factor = normalizedAmount.divide(new BigDecimal("100"), 8, RoundingMode.HALF_UP);
        return new FoodLogRepository.FoodLogItemWrite(
                0L,
                foodLogId,
                itemOrder,
                rawName,
                item.amount(),
                item.unit().trim(),
                userId,
                food.nutritionFoodId(),
                normalizedAmount,
                normalizedUnit,
                conversionId,
                nutrient(factor, food.caloriesKcalPer100()),
                nutrient(factor, food.proteinGPer100()),
                nutrient(factor, food.fatGPer100()),
                nutrient(factor, food.carbsGPer100()),
                "matched",
                nutritionSource,
                nutritionVersion);
    }

    private NutritionResolution resolveNutritionFood(ItemCommand item, String rawName) {
        if (item.nutritionFoodId() != null) {
            if (item.nutritionFoodId() <= 0) return new NutritionResolution(null, "pending_confirmation");
            FoodLogRepository.NutritionFoodLookup selected =
                    store.findNutritionFoodById(item.nutritionFoodId());
            return selected == null
                    ? new NutritionResolution(null, "pending_confirmation")
                    : new NutritionResolution(selected, "matched");
        }

        String normalizedName = NutritionNameNormalizer.normalize(rawName);
        List<FoodLogRepository.NutritionFoodCandidate> candidates =
                store.findNutritionFoodCandidates(normalizedName, 12);
        if (!candidates.isEmpty()) {
            FoodLogRepository.NutritionFoodCandidate first = candidates.get(0);
            boolean uniqueBest =
                    candidates.size() == 1 || first.matchRank() < candidates.get(1).matchRank();
            return uniqueBest
                    ? new NutritionResolution(first.toLookup(), "matched")
                    : new NutritionResolution(null, "pending_confirmation");
        }
        // 保留旧适配器和历史测试的兼容入口；当前 PostgreSQL 适配器始终优先返回候选结果。
        FoodLogRepository.NutritionFoodLookup fallback = store.findNutritionFood(normalizedName);
        return fallback == null
                ? new NutritionResolution(null, "pending")
                : new NutritionResolution(fallback, "matched");
    }

    private record NutritionResolution(
            FoodLogRepository.NutritionFoodLookup lookup, String status) {}

    private FoodLogRepository.FoodLogItemWrite pendingItem(
            ItemCommand item, long foodLogId, int itemOrder, long userId, String status) {
        return new FoodLogRepository.FoodLogItemWrite(
                0L,
                foodLogId,
                itemOrder,
                item.rawName().trim(),
                item.amount(),
                item.unit().trim(),
                userId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                status,
                null,
                null);
    }

    private static BigDecimal nutrient(BigDecimal factor, BigDecimal per100) {
        return factor.multiply(per100).setScale(4, RoundingMode.HALF_UP);
    }

    private static String normalizeUnit(String value) {
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "克", "g" -> "g";
            case "公斤", "千克", "kg" -> "kg";
            case "毫克", "mg" -> "mg";
            case "毫升", "ml" -> "ml";
            case "杯" -> "cup";
            case "大号", "大个" -> "large";
            case "中号", "中等" -> "medium";
            case "盎司", "oz" -> "oz";
            case "磅", "lb", "lbs" -> "lb";
            case "汤匙", "大匙" -> "tbsp";
            default -> value.trim().toLowerCase(Locale.ROOT);
        };
    }

    private int reserveAudit(
            long userId, String key, String digest, String action, long foodLogId) {
        return audit.reserve(
                userId, "food_log", Long.toString(foodLogId), action, digest, key, Map.of());
    }

    private void completeAudit(long userId, String key, String responseJson) {
        audit.complete(userId, key, responseJson);
    }

    private void recordFailureIfNeeded(
            long userId,
            String targetId,
            String action,
            String key,
            String digest,
            boolean reservationAttempted,
            boolean reserved,
            RuntimeException exception) {
        if (userId <= 0
                || key == null
                || key.isBlank()
                || key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) return;
        if (reserved) {
            recordFailureAfterRollback(userId, targetId, action, key, digest, exception);
            return;
        }
        if (reservationAttempted || store.findIdempotency(userId, key) != null) return;
        audit.recordFailure(
                userId,
                "food_log",
                targetId,
                action,
                "failed",
                errorCode(exception),
                digest,
                key,
                Map.of("failure", action));
    }

    private void recordFailureAfterRollback(
            long userId,
            String targetId,
            String action,
            String key,
            String digest,
            RuntimeException exception) {
        Runnable record =
                () ->
                        audit.recordFailure(
                                userId,
                                "food_log",
                                targetId,
                                action,
                                "failed",
                                errorCode(exception),
                                digest,
                                key,
                                Map.of("failure", action));
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            record.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status == STATUS_ROLLED_BACK) record.run();
                    }
                });
    }

    private static String errorCode(RuntimeException exception) {
        return exception instanceof BusinessException businessException
                ? businessException.errorCode().code()
                : ErrorCode.INTERNAL_ERROR.code();
    }

    private FoodLogRepository.FoodLogSnapshot requireSnapshot(
            long userId, long foodLogId, boolean includeDeleted) {
        FoodLogRepository.FoodLogSnapshot result =
                store.findOwned(userId, foodLogId, includeDeleted);
        if (result == null) throw new BusinessException(ErrorCode.NOT_FOUND, "饮食记录不存在");
        return result;
    }

    private static void requireRevision(FoodLogRepository.FoodLogSnapshot current, long revision) {
        if (current.revision() != revision)
            throw new BusinessException(ErrorCode.CONFLICT, "饮食记录版本已变化");
    }

    private static void requireSameDigest(
            FoodLogRepository.IdempotencyRecord previous, String digest) {
        if (!digest.equals(previous.parametersDigest()))
            throw new BusinessException(ErrorCode.CONFLICT, "幂等键对应的请求参数已变化");
    }

    private String digest(CreateCommand command) {
        return digest(
                "create",
                command.sessionId(),
                command.agentRunId(),
                command.mealTime(),
                command.mealType().code(),
                command.notes(),
                command.items());
    }

    private String digest(UpdateCommand command, long foodLogId, long revision) {
        return digest(
                "update",
                foodLogId,
                revision,
                command.mealTime(),
                command.mealType().code(),
                command.notes(),
                command.items());
    }

    private String digest(Object... values) {
        try {
            byte[] bytes = mapper.writeValueAsBytes(java.util.Arrays.asList(values));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("cannot calculate food log request digest", exception);
        }
    }

    private FoodLogView replayOrConflict(long userId, String key, String digest) {
        FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
        if (previous == null) throw new BusinessException(ErrorCode.CONFLICT, "幂等请求正在处理中");
        requireSameDigest(previous, digest);
        if (!"success".equals(previous.result()))
            throw new BusinessException(ErrorCode.CONFLICT, "幂等请求正在处理中");
        return replayResponse(userId, previous.responseJson());
    }

    private void replayVoidOrConflict(FoodLogRepository.IdempotencyRecord previous, String digest) {
        requireSameDigest(previous, digest);
        if (!"success".equals(previous.result()))
            throw new BusinessException(ErrorCode.CONFLICT, "幂等请求正在处理中");
    }

    private BusinessException concurrentIdempotencyConflict(
            long userId, String key, String digest) {
        FoodLogRepository.IdempotencyRecord previous = store.findIdempotency(userId, key);
        if (previous == null) return new BusinessException(ErrorCode.CONFLICT, "幂等请求正在处理中");
        requireSameDigest(previous, digest);
        return new BusinessException(
                ErrorCode.CONFLICT,
                "success".equals(previous.result()) ? "幂等请求已完成，请重放原请求" : "幂等请求正在处理中");
    }

    private String auditSummary(FoodLogView view) {
        try {
            return mapper.writeValueAsString(
                    java.util.Map.of(
                            "resource_id", view.foodLogId(),
                            "revision", view.revision(),
                            "status", view.deleted() ? "deleted" : "active"));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("cannot serialize food log audit summary", exception);
        }
    }

    private FoodLogView replayResponse(long userId, String responseJson) {
        try {
            com.fasterxml.jackson.databind.JsonNode summary = mapper.readTree(responseJson);
            long foodLogId = summary.path("resource_id").asLong(0);
            if (foodLogId > 0) return view(requireSnapshot(userId, foodLogId, false));
            // Compatibility with pre-M1-6 idempotency records. New records never retain
            // notes/items.
            return mapper.treeToValue(summary, FoodLogView.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("stored food log result is invalid", exception);
        }
    }

    private static FoodLogView view(FoodLogRepository.FoodLogSnapshot value) {
        return new FoodLogView(
                value.foodLogId(),
                value.sessionId(),
                value.agentRunId(),
                value.mealTime(),
                MealType.fromCode(value.mealType()),
                value.notes(),
                value.source(),
                value.revision(),
                value.deleted(),
                value.createdAt(),
                value.updatedAt(),
                value.items().stream()
                        .map(
                                item ->
                                        new ItemView(
                                                item.foodLogItemId(),
                                                item.itemOrder(),
                                                item.rawName(),
                                                item.amount(),
                                                item.unit(),
                                                item.nutritionStatus(),
                                                item.caloriesKcal(),
                                                item.proteinG(),
                                                item.fatG(),
                                                item.carbsG()))
                        .toList());
    }
}
