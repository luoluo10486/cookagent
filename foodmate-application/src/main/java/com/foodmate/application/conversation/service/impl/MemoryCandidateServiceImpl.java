package com.foodmate.application.conversation.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.application.conversation.port.out.MemoryRepository;
import com.foodmate.application.conversation.service.MemoryCandidateService;
import com.foodmate.application.conversation.service.SessionSummaryService;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.id.IdGenerator;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Java 权威校验并写入长期记忆候选；Python 只能提出候选，不能直接写业务库。 */
@Service
public class MemoryCandidateServiceImpl implements MemoryCandidateService {
    private static final Set<String> ALLOWED_MEMORY_TYPES =
            Set.of(
                    "preference",
                    "constraint",
                    "routine",
                    "cooking_skill",
                    "budget_habit",
                    "time_habit",
                    "interaction_preference",
                    "user_rule");
    private static final List<String> RESERVED_ENTITY_TERMS =
            List.of(
                    "food_log",
                    "foodlog",
                    "meal_plan",
                    "mealplan",
                    "shopping_list",
                    "shoppinglist",
                    "weekly_recipe",
                    "recipe_plan",
                    "nutrition_target",
                    "calorie_target",
                    "protein_target",
                    "user_profile",
                    "profile",
                    "饮食记录",
                    "餐食计划",
                    "购物清单",
                    "周食谱",
                    "食谱计划",
                    "个人资料",
                    "营养目标",
                    "一次性请求",
                    "临时请求",
                    "今天",
                    "本周");
    private static final List<String> HIGH_IMPACT_TERMS =
            List.of(
                    "allerg",
                    "medical",
                    "diagnos",
                    "prescription",
                    "medication",
                    "clinical",
                    "过敏",
                    "医疗",
                    "疾病",
                    "诊断",
                    "处方",
                    "药物",
                    "病史",
                    "血糖",
                    "糖尿病",
                    "高血压",
                    "肾病",
                    "blood sugar",
                    "diabetes",
                    "hypertension");
    private final MemoryRepository store;
    private final IdGenerator ids;
    private final SessionSummaryService summaries;
    private final OperationAuditService audit;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    public MemoryCandidateServiceImpl(
            MemoryRepository store, IdGenerator ids, SessionSummaryService summaries) {
        this(store, ids, summaries, null);
    }

    @Autowired
    public MemoryCandidateServiceImpl(
            MemoryRepository store,
            IdGenerator ids,
            SessionSummaryService summaries,
            ObjectProvider<OperationAuditService> auditProvider) {
        this.store = store;
        this.ids = ids;
        this.summaries = summaries;
        this.audit = auditProvider == null ? null : auditProvider.getIfAvailable();
    }

    @Transactional
    @Override
    public void persistFromCompletedRun(long runId, CompletedRunPayload payload) {
        if (payload == null) return;
        List<MemoryCandidate> candidates = payload.memoryCandidates();
        if (candidates.isEmpty()) return;
        Long userId = store.findRunOwner(runId);
        if (userId == null) return;
        try {
            boolean persisted = false;
            int deduplicated = 0;
            int conflicts = 0;
            for (MemoryCandidate candidate : candidates) {
                List<String> sourceMessageIds = sourceMessageIds(candidate);
                if (!allowed(userId, candidate, sourceMessageIds)) continue;
                String type = text(candidate.memoryType(), 32);
                String key = text(candidate.memoryKey(), 64);
                String scope = text(candidate.scope(), 32);
                BigDecimal confidence = candidate.confidence();
                if (type == null
                        || key == null
                        || confidence == null
                        || confidence.signum() < 0
                        || confidence.compareTo(BigDecimal.ONE) > 0) continue;
                String candidateJson = json(candidate.memoryValue());
                MemoryRepository.MemorySnapshot current = store.findActiveByKey(userId, type, key);
                if (current != null && sameJson(current.memoryValue(), candidateJson)) {
                    deduplicated++;
                    continue;
                }
                boolean conflict = current != null;
                store.insert(
                        new MemoryRepository.NewMemory(
                                ids.nextId(),
                                userId,
                                type,
                                key,
                                candidateJson,
                                confidence,
                                text(candidate.source(), 32),
                                scope,
                                conflict ? "conflict" : "confirmed",
                                sourceMessageIdsJson(sourceMessageIds)));
                persisted = true;
                if (conflict) conflicts++;
            }
            if (persisted) {
                summaries.invalidateForUser(userId);
            }
            if (persisted || deduplicated > 0) {
                record(
                        userId,
                        "memory",
                        Long.toString(runId),
                        "memory.candidate.persist",
                        "success",
                        null,
                        Map.of(
                                "candidate_count", candidates.size(),
                                "deduplicated_count", deduplicated,
                                "conflict_count", conflicts));
            }
        } catch (RuntimeException exception) {
            failure(userId, "memory", Long.toString(runId), "memory.candidate.persist", exception);
            throw exception;
        }
    }

    /** 查询用户可见的长期记忆；过期和逻辑删除记录不会重新进入 Agent Context。 */
    @Override
    public List<MemoryView> list(long userId) {
        return store.findVisible(userId, 100).stream()
                .map(MemoryCandidateServiceImpl::view)
                .toList();
    }

    /** 用户只能修改自己的记忆，修改后保留来源和审计归属。 */
    @Transactional
    @Override
    public MemoryView update(long userId, long memoryId, String memoryValue, String scope) {
        try {
            MemoryRepository.MemorySnapshot current = requireOwned(userId, memoryId);
            int changed =
                    store.updateOwned(
                            userId, memoryId, normalizeManualValue(current, memoryValue), scope);
            if (changed != 1) throw new IllegalArgumentException("memory not found");
            store.rejectOtherConflicts(userId, memoryId);
            summaries.invalidateForUser(userId);
            record(
                    userId,
                    "memory",
                    Long.toString(memoryId),
                    "memory.update",
                    "success",
                    null,
                    Map.of("scope", scope == null ? "" : scope));
            return get(userId, memoryId);
        } catch (RuntimeException exception) {
            failure(userId, "memory", Long.toString(memoryId), "memory.update", exception);
            throw exception;
        }
    }

    /** 逻辑删除记忆，避免破坏运行审计和历史上下文来源。 */
    @Transactional
    @Override
    public void delete(long userId, long memoryId) {
        try {
            requireOwned(userId, memoryId);
            store.softDeleteOwned(userId, memoryId);
            summaries.invalidateForUser(userId);
            record(
                    userId,
                    "memory",
                    Long.toString(memoryId),
                    "memory.delete",
                    "success",
                    null,
                    Map.of());
        } catch (RuntimeException exception) {
            failure(userId, "memory", Long.toString(memoryId), "memory.delete", exception);
            throw exception;
        }
    }

    /** 用户明确确认同一 key 的冲突记忆后，才允许它参与后续 Context 装配。 */
    @Transactional
    @Override
    public MemoryView confirm(long userId, long memoryId) {
        try {
            requireOwned(userId, memoryId);
            int changed = store.confirmOwned(userId, memoryId);
            if (changed != 1) throw new IllegalArgumentException("memory not found");
            store.rejectOtherConflicts(userId, memoryId);
            summaries.invalidateForUser(userId);
            record(
                    userId,
                    "memory",
                    Long.toString(memoryId),
                    "memory.confirm",
                    "success",
                    null,
                    Map.of());
            return get(userId, memoryId);
        } catch (RuntimeException exception) {
            failure(userId, "memory", Long.toString(memoryId), "memory.confirm", exception);
            throw exception;
        }
    }

    private void record(
            long userId,
            String targetType,
            String targetId,
            String action,
            String result,
            String errorCode,
            Map<String, ?> metadata) {
        if (audit != null)
            audit.record(
                    userId, targetType, targetId, action, result, errorCode, null, null, metadata);
    }

    private void failure(
            long userId,
            String targetType,
            String targetId,
            String action,
            RuntimeException exception) {
        if (audit != null)
            audit.recordFailure(
                    userId,
                    targetType,
                    targetId,
                    action,
                    "failed",
                    errorCode(exception),
                    null,
                    null,
                    Map.of("exception_type", exception.getClass().getSimpleName()));
    }

    private static String errorCode(RuntimeException exception) {
        return exception instanceof BusinessException businessException
                ? businessException.errorCode().code()
                : ErrorCode.INTERNAL_ERROR.code();
    }

    private MemoryView get(long userId, long memoryId) {
        MemoryRepository.MemorySnapshot memory = store.findOwned(userId, memoryId);
        if (memory == null) throw new IllegalArgumentException("memory not found");
        return view(memory);
    }

    private MemoryRepository.MemorySnapshot requireOwned(long userId, long memoryId) {
        MemoryRepository.MemorySnapshot memory = store.findOwned(userId, memoryId);
        if (memory == null) {
            throw new IllegalArgumentException("memory not found");
        }
        return memory;
    }

    private boolean allowed(long userId, MemoryCandidate candidate, List<String> sourceMessageIds) {
        if (candidate == null || sourceMessageIds.isEmpty()) return false;
        String type = text(candidate.memoryType(), 32);
        String key = text(candidate.memoryKey(), 64);
        if (type == null || key == null) return false;
        String normalizedType = type.toLowerCase(Locale.ROOT);
        String searchable =
                (normalizedType + " " + key + " " + String.valueOf(candidate.memoryValue()))
                        .toLowerCase(Locale.ROOT);
        // 权威业务事实必须留在领域表；高影响健康事实不能由模型候选自动升级。
        return ALLOWED_MEMORY_TYPES.contains(normalizedType)
                && !containsAny(searchable, RESERVED_ENTITY_TERMS)
                && !containsAny(searchable, HIGH_IMPACT_TERMS)
                && !store.hasSuppressedSourceMessages(userId, sourceMessageIds);
    }

    private String normalizeManualValue(
            MemoryRepository.MemorySnapshot current, String memoryValue) {
        String raw = memoryValue == null ? "{}" : memoryValue;
        try {
            JsonNode value = mapper.readTree(raw);
            if (value == null || !value.isObject()) {
                throw new IllegalArgumentException("memory value must be a JSON object");
            }
            String normalized = mapper.writeValueAsString(value);
            String searchable =
                    (current.memoryType() + " " + current.memoryKey() + " " + normalized)
                            .toLowerCase(Locale.ROOT);
            if (containsAny(searchable, RESERVED_ENTITY_TERMS)
                    || containsAny(searchable, HIGH_IMPACT_TERMS)) {
                throw new IllegalArgumentException(
                        "memory value is not eligible for long-term memory");
            }
            return normalized;
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("memory value must be valid JSON", exception);
        }
    }

    private boolean sameJson(String left, String right) {
        try {
            return mapper.readTree(left).equals(mapper.readTree(right));
        } catch (JsonProcessingException exception) {
            return Objects.equals(left, right);
        }
    }

    private static List<String> sourceMessageIds(MemoryCandidate candidate) {
        if (candidate == null) return List.of();
        return candidate.sourceMessageIds().stream()
                .filter(id -> id != null && id.matches("[A-Za-z0-9._:-]{1,128}"))
                .distinct()
                .limit(32)
                .toList();
    }

    private String sourceMessageIdsJson(List<String> sourceMessageIds) {
        try {
            return mapper.writeValueAsString(
                    sourceMessageIds.stream()
                            .filter(id -> id != null && !id.isBlank() && id.length() <= 128)
                            .distinct()
                            .limit(32)
                            .toList());
        } catch (JsonProcessingException exception) {
            return "[]";
        }
    }

    private static boolean containsAny(String value, List<String> terms) {
        return terms.stream().anyMatch(value::contains);
    }

    private static String text(Object value, int max) {
        if (value == null || value.toString().isBlank() || value.toString().length() > max)
            return null;
        return value.toString();
    }

    private String json(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null ? mapper.createObjectNode() : value);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private static MemoryView view(MemoryRepository.MemorySnapshot value) {
        return new MemoryView(
                value.memoryId(),
                value.memoryType(),
                value.memoryKey(),
                value.memoryValue(),
                value.confidence(),
                value.source(),
                value.scope(),
                value.confirmationStatus(),
                value.expiresAt(),
                value.updatedAt());
    }
}
