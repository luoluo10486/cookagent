package com.foodmate.api.controller;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.foodmate.api.advice.GlobalExceptionHandler;
import com.foodmate.api.controller.account.AdminUserController;
import com.foodmate.api.filter.TraceContextFilter;
import com.foodmate.application.account.service.AdminOperationalQueryService;
import com.foodmate.application.account.service.UserAccountService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminUserControllerRbacTest {
    private UserAccountService accounts;
    private AdminOperationalQueryService queries;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        accounts = Mockito.mock(UserAccountService.class);
        queries = Mockito.mock(AdminOperationalQueryService.class);
        mvc =
                MockMvcBuilders.standaloneSetup(new AdminUserController(accounts, queries))
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .addFilters(new TraceContextFilter())
                        .build();
        when(accounts.listUsersForAdmin())
                .thenReturn(
                        List.of(
                                new UserAccountService.AdminUserView(
                                        1L,
                                        "safe",
                                        "safe@example.com",
                                        "Safe",
                                        "user",
                                        "active",
                                        1L)));
    }

    @Test
    void ordinaryUserIsForbidden() throws Exception {
        when(accounts.requireSessionUser("user-session"))
                .thenReturn(
                        new UserAccountService.UserRecord(
                                2L, "u", "u@example.com", "hash", "U", "user", "active"));
        mvc.perform(
                        get("/api/admin/users")
                                .cookie(
                                        new jakarta.servlet.http.Cookie(
                                                "foodmate_session", "user-session")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code", is("FORBIDDEN")));
    }

    @Test
    void operatorAdminAndSuperadminCanReadWithoutSensitiveFields() throws Exception {
        for (String role : List.of("operator", "admin", "superadmin")) {
            when(accounts.requireSessionUser(role + "-session"))
                    .thenReturn(
                            new UserAccountService.UserRecord(
                                    2L, role, role + "@example.com", "hash", role, role, "active"));
            mvc.perform(
                            get("/api/admin/users")
                                    .cookie(
                                            new jakarta.servlet.http.Cookie(
                                                    "foodmate_session", role + "-session")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].username", is("safe")))
                    .andExpect(jsonPath("$.data[0].password_hash").doesNotExist())
                    .andExpect(jsonPath("$.data[0].csrf_token_hash").doesNotExist());
        }
    }

    @Test
    void adminCanReadUserDetailWithSessionsAndSafeOperationHistory() throws Exception {
        when(accounts.requireSessionUser("admin-session"))
                .thenReturn(
                        new UserAccountService.UserRecord(
                                2L, "admin", "admin@example.com", "hash", "Admin", "admin", "active"));
        when(accounts.profile(7L))
                .thenReturn(
                        new UserAccountService.ProfileRecord(
                                7L,
                                "用户七",
                                "female",
                                null,
                                null,
                                null,
                                "moderate",
                                "maintenance",
                                2_000,
                                120,
                                "[]",
                                "[]",
                                "{}"));
        when(accounts.listAuthSessions(7L)).thenReturn(List.of());
        when(accounts.listSessions(7L, 1, 50, null, null))
                .thenReturn(new UserAccountService.PageResult<>(List.of(), 0, 1, 50));
        when(queries.operationAuditsForUser(7L, 1, 50))
                .thenReturn(
                        new AdminOperationalQueryService.Page<>(
                                List.of(
                                        new AdminOperationalQueryService.OperationAudit(
                                                7L,
                                                "profile.update",
                                                "profile",
                                                "7",
                                                "success",
                                                "request-7",
                                                "trace-7",
                                                Instant.parse("2026-09-06T00:00:00Z"))),
                                1,
                                1,
                                50));

        mvc.perform(
                        get("/api/admin/users/7/detail")
                                .cookie(
                                        new jakarta.servlet.http.Cookie(
                                                "foodmate_session", "admin-session")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile.display_name", is("用户七")))
                .andExpect(jsonPath("$.data.business_sessions.total", is(0)))
                .andExpect(jsonPath("$.data.operation_history.items[0].action", is("profile.update")))
                .andExpect(jsonPath("$.data.operation_history.items[0].request_id", is("request-7")))
                .andExpect(jsonPath("$.data.profile.password_hash").doesNotExist());
    }
}
