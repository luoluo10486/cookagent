package com.foodmate.api.response.food;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.foodmate.application.food.port.out.FoodLogRepository.NutritionFoodCandidate;
import java.math.BigDecimal;
import java.util.List;

/** 营养目录候选响应；不包含对象存储、向量索引或用户私有数据。 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record NutritionFoodCandidateResponse(
        String nutritionFoodId,
        String standardName,
        String chineseName,
        String category,
        String foodForm,
        String basisUnit,
        BigDecimal caloriesKcalPer100,
        BigDecimal proteinGPer100,
        BigDecimal fatGPer100,
        BigDecimal carbsGPer100,
        String sourceName,
        String sourceVersion) {
    public static List<NutritionFoodCandidateResponse> map(
            List<NutritionFoodCandidate> candidates) {
        return candidates.stream()
                .map(
                        candidate ->
                                new NutritionFoodCandidateResponse(
                                        Long.toString(candidate.nutritionFoodId()),
                                        candidate.standardName(),
                                        candidate.chineseName(),
                                        candidate.category(),
                                        candidate.foodForm(),
                                        candidate.basisUnit(),
                                        candidate.caloriesKcalPer100(),
                                        candidate.proteinGPer100(),
                                        candidate.fatGPer100(),
                                        candidate.carbsGPer100(),
                                        candidate.sourceName(),
                                        candidate.sourceVersion()))
                .toList();
    }
}
