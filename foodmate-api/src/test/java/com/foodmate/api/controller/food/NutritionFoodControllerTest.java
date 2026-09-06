package com.foodmate.api.controller.food;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.foodmate.api.advice.GlobalExceptionHandler;
import com.foodmate.api.filter.TraceContextFilter;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.food.port.out.FoodLogRepository;
import com.foodmate.application.food.service.NutritionFoodService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 营养目录候选接口的认证和安全字段边界测试。 */
class NutritionFoodControllerTest {
    private UserAccountService accounts;
    private NutritionFoodService foods;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        accounts = mock(UserAccountService.class);
        foods = mock(NutritionFoodService.class);
        mvc =
                MockMvcBuilders.standaloneSetup(new NutritionFoodController(accounts, foods))
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .addFilters(new TraceContextFilter())
                        .build();
    }

    @Test
    void returnsPublicCandidateWithoutStorageFields() throws Exception {
        when(accounts.requireSessionUser("session-1")).thenReturn(user());
        when(foods.search("鸡胸肉", 8)).thenReturn(List.of(candidate()));

        mvc.perform(
                        get("/api/nutrition-foods/search")
                                .cookie(
                                        new jakarta.servlet.http.Cookie(
                                                "foodmate_session", "session-1"))
                                .param("query", "鸡胸肉"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].nutrition_food_id", is("171477")))
                .andExpect(jsonPath("$.data[0].food_form", is("cooked")))
                .andExpect(jsonPath("$.data[0].source_name", is("USDA FoodData Central")))
                .andExpect(jsonPath("$.data[0].object_key").doesNotExist());

        verify(foods).search(eq("鸡胸肉"), eq(8));
    }

    private UserAccountService.UserRecord user() {
        return new UserAccountService.UserRecord(
                7L, "user", "user@example.com", "hash", "user", "User", "active");
    }

    private FoodLogRepository.NutritionFoodCandidate candidate() {
        return new FoodLogRepository.NutritionFoodCandidate(
                171477L,
                "Chicken, cooked, roasted",
                "鸡胸肉",
                "meat",
                "cooked",
                "g",
                new BigDecimal("165.0000"),
                new BigDecimal("31.0200"),
                new BigDecimal("3.5700"),
                BigDecimal.ZERO,
                "USDA FoodData Central",
                "USDA-v1",
                0);
    }
}
