package com.foodmate.application.food.service;

import com.foodmate.application.food.port.out.FoodLogRepository.NutritionFoodCandidate;
import java.util.List;

/** 提供已审核营养目录的候选检索，不替代 Java 权威营养计算。 */
public interface NutritionFoodService {
    List<NutritionFoodCandidate> search(String query, Integer limit);
}
