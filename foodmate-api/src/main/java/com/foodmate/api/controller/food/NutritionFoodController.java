package com.foodmate.api.controller.food;

import com.foodmate.api.controller.account.AuthenticatedControllerSupport;
import com.foodmate.api.response.food.NutritionFoodCandidateResponse;
import com.foodmate.application.account.service.UserAccountService;
import com.foodmate.application.food.service.NutritionFoodService;
import com.foodmate.shared.api.ApiResponse;
import com.foodmate.shared.trace.TraceContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 为饮食记录输入提供已审核营养目录候选。 */
@RestController
@Profile("local")
@RequestMapping("/api/nutrition-foods")
public class NutritionFoodController extends AuthenticatedControllerSupport {
    private final NutritionFoodService foods;

    public NutritionFoodController(UserAccountService accounts, NutritionFoodService foods) {
        super(accounts);
        this.foods = foods;
    }

    @GetMapping("/search")
    public ApiResponse<List<NutritionFoodCandidateResponse>> search(
            HttpServletRequest request,
            @RequestParam String query,
            @RequestParam(defaultValue = "8") int limit) {
        user(request);
        return ApiResponse.success(
                NutritionFoodCandidateResponse.map(foods.search(query, limit)),
                TraceContextHolder.currentOrNew());
    }
}
