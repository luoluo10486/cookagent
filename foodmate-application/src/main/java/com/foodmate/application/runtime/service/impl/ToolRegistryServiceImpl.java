package com.foodmate.application.runtime.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository.ToolDefinition;
import com.foodmate.application.runtime.service.ToolRegistryService;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** 解析工具版本和策略元数据，不执行工具副作用。 */
@Service
public class ToolRegistryServiceImpl implements ToolRegistryService {
    private final ToolRegistryRepository repository;
    private final ObjectMapper mapper;

    public ToolRegistryServiceImpl(ToolRegistryRepository repository) {
        this(repository, new ObjectMapper());
    }

    @Autowired
    public ToolRegistryServiceImpl(ToolRegistryRepository repository, ObjectMapper mapper) {
        this.repository = Objects.requireNonNull(repository);
        this.mapper = mapper.copy().findAndRegisterModules();
    }

    @Override
    public List<ToolView> list() {
        return repository.findAll().stream().map(this::view).toList();
    }

    @Override
    public ToolView resolve(String name, String version) {
        String normalizedName = requiredName(name);
        String normalizedVersion = normalize(version);
        ToolDefinition definition =
                normalizedVersion == null
                        ? repository.findCurrent(normalizedName)
                        : repository.findVersion(normalizedName, normalizedVersion);
        if (definition == null) throw new BusinessException(ErrorCode.TOOL_NOT_FOUND);
        if (!"active".equalsIgnoreCase(definition.status()))
            throw new BusinessException(ErrorCode.TOOL_DISABLED);
        return view(definition);
    }

    private ToolView view(ToolDefinition definition) {
        if (definition.version() == null
                || definition.inputSchemaJson() == null
                || definition.outputSchemaJson() == null
                || definition.permissionsJson() == null)
            throw new BusinessException(ErrorCode.TOOL_SCHEMA_UNSUPPORTED);
        return new ToolView(
                definition.toolId(),
                definition.name(),
                definition.displayName(),
                definition.description(),
                definition.category(),
                definition.riskLevel(),
                definition.availabilityScope(),
                definition.status(),
                definition.currentVersion(),
                definition.version(),
                parse(definition.inputSchemaJson()),
                parse(definition.outputSchemaJson()),
                parse(definition.permissionsJson()),
                definition.timeoutMs(),
                definition.retryable(),
                definition.idempotent(),
                definition.publishedAt(),
                definition.revision());
    }

    private JsonNode parse(String value) {
        try {
            JsonNode node = mapper.readTree(value);
            if (node == null || !node.isObject())
                throw new JsonProcessingException("object required") {};
            return node;
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.TOOL_SCHEMA_UNSUPPORTED, "工具 Schema 无效");
        }
    }

    private static String requiredName(String value) {
        String normalized = normalize(value);
        if (normalized == null || normalized.length() > 64)
            throw new BusinessException(ErrorCode.TOOL_NOT_FOUND);
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
