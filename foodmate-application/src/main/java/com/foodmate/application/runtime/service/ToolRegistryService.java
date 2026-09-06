package com.foodmate.application.runtime.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;

/** 工具注册表查询与版本解析用例。 */
public interface ToolRegistryService {
    List<ToolView> list();

    /** 解析当前或指定版本；禁用、不存在和无效 Schema 都必须返回稳定错误。 */
    ToolView resolve(String name, String version);

    record ToolView(
            long toolId,
            String name,
            String displayName,
            String description,
            String category,
            String riskLevel,
            String availabilityScope,
            String status,
            String currentVersion,
            String version,
            JsonNode inputSchema,
            JsonNode outputSchema,
            JsonNode permissions,
            int timeoutMs,
            boolean retryable,
            boolean idempotent,
            Instant publishedAt,
            long revision) {}
}
