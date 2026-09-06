package com.foodmate.api.controller;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodmate.api.advice.GlobalExceptionHandler;
import com.foodmate.api.controller.account.ToolRegistryController;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.runtime.service.ToolRegistryService;
import com.foodmate.api.filter.TraceContextFilter;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ToolRegistryControllerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private UserAccountService accounts;
    private ToolRegistryService registry;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        accounts = Mockito.mock(UserAccountService.class);
        registry = Mockito.mock(ToolRegistryService.class);
        mvc =
                MockMvcBuilders.standaloneSetup(new ToolRegistryController(accounts, registry))
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .addFilters(new TraceContextFilter())
                        .build();
    }

    @Test
    void adminReceivesRegistrySchemaAndRevision() throws Exception {
        when(accounts.requireSessionUser("admin-session")).thenReturn(user("admin"));
        when(registry.list()).thenReturn(List.of(tool()));

        mvc.perform(
                        get("/api/admin/tools/registry")
                                .cookie(
                                        new jakarta.servlet.http.Cookie(
                                                "foodmate_session", "admin-session")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tools[0].name", is("food_log_writer")))
                .andExpect(jsonPath("$.data.tools[0].input_schema.type", is("object")))
                .andExpect(jsonPath("$.data.tools[0].revision", is(7)));
    }

    private ToolRegistryService.ToolView tool() throws Exception {
        JsonNode schema = mapper.readTree("{\"type\":\"object\"}");
        return new ToolRegistryService.ToolView(
                720005L,
                "food_log_writer",
                "Food log writer",
                "Write food logs.",
                "write",
                "high",
                "user",
                "active",
                "v1",
                "v1",
                schema,
                schema,
                mapper.readTree("{\"approval\":\"required\"}"),
                10000,
                false,
                true,
                Instant.parse("2026-01-01T00:00:00Z"),
                7L);
    }

    private UserAccountService.UserRecord user(String role) {
        return new UserAccountService.UserRecord(
                2L, role, role + "@example.com", "hash", role, role, "active");
    }
}
