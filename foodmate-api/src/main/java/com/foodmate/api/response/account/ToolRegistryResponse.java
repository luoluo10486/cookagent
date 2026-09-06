package com.foodmate.api.response.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.foodmate.application.runtime.service.ToolRegistryService;
import java.time.Instant;
import java.util.List;

/** 管理端工具注册表响应，不包含凭据或运行时秘密。 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ToolRegistryResponse(List<Tool> tools) {
    public static ToolRegistryResponse from(List<ToolRegistryService.ToolView> values) {
        return new ToolRegistryResponse(
                values.stream()
                        .map(
                                value ->
                                        new Tool(
                                                value.toolId(),
                                                value.name(),
                                                value.displayName(),
                                                value.description(),
                                                value.category(),
                                                value.riskLevel(),
                                                value.availabilityScope(),
                                                value.status(),
                                                value.currentVersion(),
                                                value.version(),
                                                value.inputSchema(),
                                                value.outputSchema(),
                                                value.permissions(),
                                                value.timeoutMs(),
                                                value.retryable(),
                                                value.idempotent(),
                                                value.publishedAt(),
                                                value.revision()))
                        .toList());
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Tool(
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
