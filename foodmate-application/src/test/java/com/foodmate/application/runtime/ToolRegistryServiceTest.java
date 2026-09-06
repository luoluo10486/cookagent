package com.foodmate.application.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.foodmate.application.runtime.port.out.ToolRegistryRepository;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository.ToolDefinition;
import com.foodmate.application.runtime.service.ToolRegistryCatalog;
import com.foodmate.application.runtime.service.ToolRegistryService;
import com.foodmate.application.runtime.service.impl.ToolRegistryServiceImpl;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.Test;

class ToolRegistryServiceTest {
    private final ToolRegistryRepository repository = mock(ToolRegistryRepository.class);
    private final ToolRegistryService service = new ToolRegistryServiceImpl(repository);

    @Test
    void catalogContainsAllSevenVersionedTools() {
        when(repository.findAll()).thenReturn(ToolRegistryCatalog.defaults());

        var tools = service.list();

        assertEquals(
                List.of(
                        "calculator",
                        "time_parser",
                        "knowledge_search",
                        "database_query",
                        "food_log_writer",
                        "plan_validator",
                        "meal_plan.save_plan"),
                tools.stream().map(ToolRegistryService.ToolView::name).toList());
        assertEquals("required", tools.get(4).permissions().path("approval").asText());
        assertEquals(10000, tools.get(6).timeoutMs());
        assertEquals(6, tools.stream().filter(tool -> "v1".equals(tool.version())).count());
        assertEquals("v2", tools.get(3).version());
    }

    @Test
    void resolvesCurrentAndExplicitVersion() {
        ToolDefinition definition = ToolRegistryCatalog.defaults().getFirst();
        when(repository.findCurrent("calculator")).thenReturn(definition);
        when(repository.findVersion("calculator", "v1")).thenReturn(definition);

        assertEquals("calculator", service.resolve(" calculator ", null).name());
        assertEquals("v1", service.resolve("calculator", "v1").version());
    }

    @Test
    void disabledToolHasStableError() {
        ToolDefinition disabled = withStatus(ToolRegistryCatalog.defaults().getFirst(), "disabled");
        when(repository.findCurrent("calculator")).thenReturn(disabled);

        BusinessException exception =
                assertThrows(BusinessException.class, () -> service.resolve("calculator", null));

        assertEquals(ErrorCode.TOOL_DISABLED, exception.errorCode());
    }

    @Test
    void unknownToolAndVersionHaveStableNotFoundError() {
        when(repository.findCurrent("unknown")).thenReturn(null);
        when(repository.findVersion("calculator", "v2")).thenReturn(null);

        BusinessException missingTool =
                assertThrows(BusinessException.class, () -> service.resolve("unknown", null));
        BusinessException missingVersion =
                assertThrows(BusinessException.class, () -> service.resolve("calculator", "v2"));

        assertEquals(ErrorCode.TOOL_NOT_FOUND, missingTool.errorCode());
        assertEquals(ErrorCode.TOOL_NOT_FOUND, missingVersion.errorCode());
    }

    @Test
    void malformedSchemaIsRejectedBeforePolicyUse() {
        ToolDefinition malformed =
                new ToolDefinition(
                        1L,
                        "calculator",
                        "Calculator",
                        "description",
                        "utility",
                        "low",
                        "user",
                        "active",
                        "v1",
                        "v1",
                        "not-json",
                        "{}",
                        "{}",
                        1000,
                        true,
                        true,
                         null,
                         1L);
        when(repository.findCurrent("calculator")).thenReturn(malformed);

        BusinessException exception =
                assertThrows(BusinessException.class, () -> service.resolve("calculator", null));

        assertEquals(ErrorCode.TOOL_SCHEMA_UNSUPPORTED, exception.errorCode());
    }

    private static ToolDefinition withStatus(ToolDefinition source, String status) {
        return new ToolDefinition(
                source.toolId(),
                source.name(),
                source.displayName(),
                source.description(),
                source.category(),
                source.riskLevel(),
                source.availabilityScope(),
                status,
                source.currentVersion(),
                source.version(),
                source.inputSchemaJson(),
                source.outputSchemaJson(),
                source.permissionsJson(),
                source.timeoutMs(),
                source.retryable(),
                source.idempotent(),
                source.publishedAt(),
                source.revision());
    }
}
