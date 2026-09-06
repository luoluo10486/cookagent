package com.foodmate.application.conversation.port.out;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** 长期语义记忆持久化端口。 */
public interface MemoryRepository {
    Long findRunOwner(long runId);

    boolean hasSuppressedSourceMessages(long userId, List<String> sourceMessageIds);

    MemorySnapshot findActiveByKey(long userId, String type, String key);

    void insert(NewMemory memory);

    List<MemorySnapshot> findVisible(long userId, int limit);

    MemorySnapshot findOwned(long userId, long memoryId);

    boolean existsOwned(long userId, long memoryId);

    int updateOwned(long userId, long memoryId, String valueJson, String scope);

    int softDeleteOwned(long userId, long memoryId);

    int confirmOwned(long userId, long memoryId);

    int rejectOtherConflicts(long userId, long memoryId);

    record NewMemory(
            long id,
            long userId,
            String type,
            String key,
            String valueJson,
            BigDecimal confidence,
            String source,
            String scope,
            String confirmationStatus,
            String sourceMessageIdsJson) {}

    record MemorySnapshot(
            long memoryId,
            String memoryType,
            String memoryKey,
            String memoryValue,
            BigDecimal confidence,
            String source,
            String scope,
            String confirmationStatus,
            Instant expiresAt,
            Instant updatedAt) {}
}
